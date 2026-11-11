// Push de transferência por FCM HTTP v1, enviado pelo worker (SPEC-0005, REQ-005 e REQ-006).
// Cada aviso vira um trabalho por aparelho, para que uma nova tentativa nunca repita a entrega
// em outro aparelho. Credencial só no servidor: FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço
// em base64). Logs nunca mostram valor, descrição nem token.
import { createSign } from "node:crypto";
import { complete, enqueue } from "./db.mjs";

const TOKEN = /^[A-Za-z0-9_:-]{20,4096}$/;
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export const CHANNEL = "transferencias";
const MAX_TRIES = 8;
const b64u = (value) => Buffer.from(value).toString("base64url");

export const validToken = (value) => typeof value === "string" && TOKEN.test(value);

/** Registra o aparelho do dono. O mesmo token só pertence a um dono. */
export function registerDevice(db, owner, token) {
  if (!validToken(token)) return false;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO devices(owner,token,created_at,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(token) DO UPDATE SET owner=excluded.owner, updated_at=excluded.updated_at`).run(owner, token, now, now);
  return true;
}

export function removeDevice(db, owner, token) {
  return validToken(token) && db.prepare("DELETE FROM devices WHERE owner=? AND token=?").run(owner, token).changes > 0;
}

export function deviceCount(db, owner) {
  return db.prepare("SELECT COUNT(*) AS total FROM devices WHERE owner=?").get(owner).total;
}

/** Um trabalho por aparelho do dono para cada aviso novo. Chamado na mesma transação que grava o aviso. */
export function enqueueNoticePush(db, itemId, noticeId) {
  const owner = db.prepare("SELECT owner FROM connections WHERE id=?").get(itemId)?.owner;
  if (!owner) return 0;
  const devices = db.prepare("SELECT id FROM devices WHERE owner=?").all(owner);
  for (const { id } of devices) enqueue(db, { id: "push:" + noticeId + ":" + id, itemId, kind: "push", data: { notice: noticeId, device: id } });
  return devices.length;
}

/** Notificação de teste para os aparelhos do dono (Ajustes do app). */
export function enqueueTestPush(db, owner) {
  const devices = db.prepare("SELECT id FROM devices WHERE owner=?").all(owner);
  const stamp = Date.now();
  for (const { id } of devices) enqueue(db, { id: "push:test:" + stamp + ":" + id, itemId: "push:" + owner, kind: "push", data: { test: true, device: id } });
  return devices.length;
}

/** Texto da notificação. Por padrão, sem valor: ele apareceria na tela bloqueada. */
export function noticeMessage(notice, showValue = false) {
  const title = notice.direction === "CREDIT" ? "Transferência recebida" : "Transferência enviada";
  const value = showValue && Number.isFinite(notice.amount) && notice.currency
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: notice.currency }).format(notice.amount / 100) : null;
  return { title, body: [notice.method, value].filter(Boolean).join(" · ") || "Abra o Finance para ver o extrato." };
}

export function serviceAccount(env = process.env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  for (const field of ["project_id", "client_email", "private_key"]) if (typeof parsed[field] !== "string") throw new Error("Conta de serviço do Firebase sem " + field);
  return parsed;
}

let cached = null;
/** Só para testes: esquece o token OAuth guardado. */
export const resetTokenCache = () => { cached = null; };
/** Token OAuth do Google pela conta de serviço (JWT RS256, validade de 1 hora). Reaproveitado até perto de vencer. */
export async function accessToken(account, fetcher = fetch, now = Date.now()) {
  if (cached && cached.email === account.client_email && cached.expires - 60_000 > now) return cached.token;
  const iat = Math.floor(now / 1000);
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", ...(account.private_key_id ? { kid: account.private_key_id } : {}) }));
  const claims = b64u(JSON.stringify({
    iss: account.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600,
  }));
  const signature = createSign("RSA-SHA256").update(header + "." + claims).sign(account.private_key).toString("base64url");
  const response = await fetcher(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: header + "." + claims + "." + signature }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.access_token !== "string") throw new PushError("Token do Google recusado (HTTP " + response.status + ")", false);
  cached = { email: account.client_email, token: body.access_token, expires: now + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export class PushError extends Error {
  /** @param {string} message @param {boolean} retry @param {number} [wait] */
  constructor(message, retry, wait = 0) {
    super(message);
    this.retry = retry;
    this.wait = wait;
  }
}

/** Envia uma mensagem a um token. 404 (UNREGISTERED) devolve "unregistered"; 429 e 5xx pedem nova tentativa. */
export async function sendToDevice(account, token, message, fetcher = fetch, endpoint = process.env.FCM_ENDPOINT || "https://fcm.googleapis.com") {
  const bearer = await accessToken(account, fetcher);
  const response = await fetcher(endpoint + "/v1/projects/" + encodeURIComponent(account.project_id) + "/messages:send", {
    method: "POST",
    headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token,
      notification: message,
      data: { view: "extrato" },
      android: { priority: "HIGH", ttl: "86400s", notification: { channel_id: CHANNEL } },
    } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) return "sent";
  if (response.status === 404) return "unregistered";
  const after = Number(response.headers.get("retry-after"));
  if (response.status === 429) throw new PushError("FCM pediu para esperar (429)", true, (Number.isFinite(after) && after > 0 ? after : 60) * 1000);
  if (response.status >= 500) throw new PushError("FCM indisponível (" + response.status + ")", true, Number.isFinite(after) && after > 0 ? after * 1000 : 0);
  throw new PushError("FCM recusou a mensagem (HTTP " + response.status + ")", false);
}

/**
 * Trabalho "push" do worker. Encerra sozinho: sucesso, aparelho removido, sem configuração ou erro
 * definitivo. Erros temporários voltam para a fila com espera mínima (10 s, ou 60 s em 429).
 */
export async function deliverPush(db, job, { fetcher = fetch, env = process.env, logger = console, retry } = {}) {
  const device = db.prepare("SELECT id,owner,token FROM devices WHERE id=?").get(job.data.device);
  const notice = job.data.test ? { direction: "CREDIT", method: "Teste" } : job.data.notice != null
    ? db.prepare("SELECT data FROM notices WHERE id=?").get(job.data.notice) : null;
  let account;
  try {
    account = serviceAccount(env);
  } catch (error) {
    logger.error("Push sem configuração válida: %s", error instanceof Error ? error.message : error);
    return complete(db, job, undefined, 2);
  }
  if (!device || !notice || !account) return complete(db, job, undefined, 2);
  const message = job.data.test
    ? { title: "Finance", body: "Avisos de transferência ativos neste aparelho." }
    : noticeMessage(JSON.parse(notice.data));
  try {
    const result = await sendToDevice(account, device.token, message, fetcher, env.FCM_ENDPOINT || "https://fcm.googleapis.com");
    if (result === "unregistered") {
      complete(db, job, () => db.prepare("DELETE FROM devices WHERE id=?").run(device.id), 2);
      logger.warn("Push: aparelho %d não está mais registrado no FCM e foi removido", device.id);
      return;
    }
    complete(db, job);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (error instanceof PushError && error.retry && job.tries < MAX_TRIES) {
      retry(db, job, Math.max(10_000, error.wait));
      logger.warn("Push adiado (tentativa %d): %s", job.tries, reason);
      return;
    }
    complete(db, job, undefined, 2);
    logger.error("Push encerrado sem entrega: %s", reason);
  }
}
