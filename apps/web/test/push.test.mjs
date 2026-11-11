import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { claim, notifyTransfers, openDatabase } from "../lib/db.mjs";
import {
  CHANNEL, deliverPush, enqueueNoticePush, enqueueTestPush, noticeMessage, registerDevice, removeDevice, resetTokenCache,
} from "../lib/push.mjs";
import { runJob } from "../lib/sync.mjs";

// Push por FCM HTTP v1 com dados, chaves e serviço falsos (SPEC-0005, REQ-005 e REQ-006).
const OWNER = "5ca1ab1e-0000-4000-8000-000000000001";
const OTHER = "99999999-8888-4777-8666-555555555555";
const ITEM = "00000000-0000-4000-8000-0000000000a1";
const TOKEN_A = "fcm-token-aparelho-a:" + "a".repeat(40);
const TOKEN_B = "fcm-token-aparelho-b:" + "b".repeat(40);
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  project_id: "finance-teste", client_email: "push@finance-teste.iam.example", private_key_id: "chave-1",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth.example.test/token",
};
const env = { FIREBASE_SERVICE_ACCOUNT: Buffer.from(JSON.stringify(account)).toString("base64"), FCM_ENDPOINT: "https://fcm.example.test" };
const transfer = (id, direction = "CREDIT") => ({
  id, accountId: "conta", status: "POSTED", transfer: true, createdAt: "2026-11-11T12:00:00Z",
  direction, amount: 12_345, currency: "BRL", method: "Pix",
});

function setup() {
  const db = openDatabase(":memory:");
  db.prepare("INSERT INTO connections(id,owner,name,status,synced_at,baseline,active) VALUES(?,?,?,?,?,?,1)")
    .run(ITEM, OWNER, "Banco Teste", "CONECTADA", "2026-11-10T00:00:00Z", "2026-11-10T00:00:00Z");
  db.prepare("INSERT INTO accounts VALUES(?,?,?)").run(ITEM, "conta", "{}");
  return db;
}

/** Google OAuth e FCM falsos. fcm(status, headers) define a resposta do envio. */
function fakeGoogle(fcm = () => ({ status: 200, body: { name: "projects/finance-teste/messages/1" } })) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url) === account.token_uri) {
      return new Response(JSON.stringify({ access_token: "token-oauth-sintetico", expires_in: 3600, token_type: "Bearer" }), { status: 200 });
    }
    const { status, body = {}, headers = {} } = fcm(calls.length);
    return new Response(JSON.stringify(body), { status, headers });
  };
  return { fetcher, calls };
}

const logs = () => {
  const lines = [];
  const write = (...args) => lines.push(args.map(String).join(" "));
  return { lines, logger: { warn: write, error: write, log: write } };
};
const job = (db, id) => db.prepare("SELECT done,due,tries FROM jobs WHERE id=?").get(id);

test("registra aparelho só com token válido e remove só o do próprio dono", () => {
  const db = setup();
  assert.equal(registerDevice(db, OWNER, TOKEN_A), true);
  assert.equal(registerDevice(db, OWNER, "curto"), false);
  assert.equal(registerDevice(db, OWNER, "token com espaço " + "x".repeat(30)), false);
  assert.equal(registerDevice(db, OWNER, 42), false);
  assert.equal(registerDevice(db, OWNER, TOKEN_A), true, "registrar de novo atualiza");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM devices").get().n, 1);
  assert.equal(removeDevice(db, OTHER, TOKEN_A), false, "outro dono não remove");
  assert.equal(removeDevice(db, OWNER, TOKEN_A), true);
});

test("aviso novo vira um trabalho por aparelho do dono; repetido ou primeira importação não", () => {
  const db = setup();
  registerDevice(db, OWNER, TOKEN_A);
  registerDevice(db, OWNER, TOKEN_B);
  registerDevice(db, OTHER, "fcm-token-outro-dono:" + "c".repeat(40));
  const created = notifyTransfers(db, ITEM, [transfer("t1")]);
  assert.equal(created.length, 1);
  assert.equal(enqueueNoticePush(db, ITEM, created[0]), 2, "só os aparelhos do dono");
  assert.deepEqual(notifyTransfers(db, ITEM, [transfer("t1")]), [], "mesmo lançamento não gera de novo");
  db.prepare("UPDATE connections SET synced_at=NULL").run();
  assert.deepEqual(notifyTransfers(db, ITEM, [transfer("t2")]), [], "primeira importação não avisa");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind='push'").get().n, 2);
});

test("envia pelo FCM v1 com JWT assinado, prioridade alta, canal e sem valor na notificação", async () => {
  resetTokenCache();
  const db = setup();
  registerDevice(db, OWNER, TOKEN_A);
  const [notice] = notifyTransfers(db, ITEM, [transfer("t1")]);
  enqueueNoticePush(db, ITEM, notice);
  const google = fakeGoogle();
  const log = logs();
  const claimed = claim(db);
  await deliverPush(db, claimed, { fetcher: google.fetcher, env, logger: log.logger, retry: () => assert.fail("não deveria repetir") });
  assert.equal(job(db, claimed.id).done, 1);

  const [oauth, send] = google.calls;
  const assertion = new URLSearchParams(String(oauth.init.body)).get("assertion");
  const [header, claims, signature] = assertion.split(".");
  assert.equal(new URLSearchParams(String(oauth.init.body)).get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  assert.ok(createVerify("RSA-SHA256").update(header + "." + claims).verify(publicKey, Buffer.from(signature, "base64url")), "assinatura RS256 válida");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "RS256", typ: "JWT", kid: "chave-1" });
  const payload = JSON.parse(Buffer.from(claims, "base64url"));
  assert.equal(payload.scope, "https://www.googleapis.com/auth/firebase.messaging");
  assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
  assert.equal(payload.exp - payload.iat, 3600);

  assert.equal(send.url, "https://fcm.example.test/v1/projects/finance-teste/messages:send");
  assert.equal(send.init.headers.Authorization, "Bearer token-oauth-sintetico");
  const { message } = JSON.parse(send.init.body);
  assert.equal(message.token, TOKEN_A);
  assert.deepEqual(message.notification, { title: "Transferência recebida", body: "Pix" });
  assert.deepEqual(message.android, { priority: "HIGH", ttl: "86400s", notification: { channel_id: CHANNEL } });
  assert.deepEqual(message.data, { view: "extrato" });
  assert.doesNotMatch(send.init.body, /123,45|12345/, "valor fora da notificação");
});

test("404 remove o aparelho; 429 e 5xx esperam; 403 e tentativas esgotadas encerram; logs sem token nem valor", async () => {
  const run = async (fcm, tries = 1) => {
    resetTokenCache();
    const db = setup();
    registerDevice(db, OWNER, TOKEN_A);
    const [notice] = notifyTransfers(db, ITEM, [transfer("t1")]);
    enqueueNoticePush(db, ITEM, notice);
    const claimed = { ...claim(db), tries };
    const waits = [];
    const log = logs();
    await deliverPush(db, claimed, { fetcher: fakeGoogle(fcm).fetcher, env, logger: log.logger, retry: (_db, _job, wait) => waits.push(wait) });
    return { db, claimed, waits, lines: log.lines };
  };
  const gone = await run(() => ({ status: 404, body: { error: { status: "NOT_FOUND" } } }));
  assert.equal(job(gone.db, gone.claimed.id).done, 2);
  assert.equal(gone.db.prepare("SELECT COUNT(*) AS n FROM devices").get().n, 0, "token UNREGISTERED removido");

  const busy = await run(() => ({ status: 429, headers: { "retry-after": "30" } }));
  assert.deepEqual(busy.waits, [30_000]);
  const busyDefault = await run(() => ({ status: 429 }));
  assert.deepEqual(busyDefault.waits, [60_000], "sem Retry-After, 60 s");
  const down = await run(() => ({ status: 503 }));
  assert.deepEqual(down.waits, [10_000], "mínimo de 10 s");

  const denied = await run(() => ({ status: 403 }));
  assert.deepEqual(denied.waits, [], "403 não repete");
  assert.equal(job(denied.db, denied.claimed.id).done, 2);
  const exhausted = await run(() => ({ status: 503 }), 8);
  assert.deepEqual(exhausted.waits, []);
  assert.equal(job(exhausted.db, exhausted.claimed.id).done, 2);

  for (const line of [...gone.lines, ...busy.lines, ...down.lines, ...denied.lines, ...exhausted.lines]) {
    assert.doesNotMatch(line, /fcm-token|123,45|12345|token-oauth/);
  }
});

test("sem configuração no servidor, o trabalho encerra sem chamar o FCM; teste vai para todos os aparelhos", async () => {
  resetTokenCache();
  const db = setup();
  registerDevice(db, OWNER, TOKEN_A);
  registerDevice(db, OWNER, TOKEN_B);
  assert.equal(enqueueTestPush(db, OWNER), 2);
  const google = fakeGoogle();
  const first = claim(db);
  await deliverPush(db, first, { fetcher: google.fetcher, env: {}, logger: logs().logger, retry: () => {} });
  assert.equal(google.calls.length, 0);
  assert.equal(job(db, first.id).done, 2);
  const second = claim(db);
  // Pelo runJob do worker, sem FIREBASE_SERVICE_ACCOUNT no ambiente: encerra sem rede e sem passar pela Pluggy.
  await runJob(db, second);
  assert.notEqual(job(db, second.id).done, 0);
});

test("texto da notificação", () => {
  assert.deepEqual(noticeMessage({ direction: "DEBIT", method: "TED", amount: 5_000, currency: "BRL" }), { title: "Transferência enviada", body: "TED" });
  assert.deepEqual(noticeMessage({ direction: "CREDIT", method: null }), { title: "Transferência recebida", body: "Abra o Finance para ver o extrato." });
  assert.equal(noticeMessage({ direction: "CREDIT", method: "Pix", amount: 12_345, currency: "BRL" }, true).body.replace(/\s/g, " "), "Pix · R$ 123,45");
});
