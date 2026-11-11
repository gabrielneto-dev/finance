import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { origin } from "./config.mjs";
import { atomic, database } from "./db.mjs";
import { parseBearer } from "./request-auth.mjs";
import { AUTH_UNAVAILABLE, sessionCookie, supabaseConfig } from "./session-cookies";

const localCookie = "finance_local_session";
const localOwner = "local-owner";
const sessionSeconds = 8 * 60 * 60;
const hexKey = /^[a-f0-9]{64}$/;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function localLoginEnabled() {
  return Boolean(process.env.FINANCE_LOCAL_KEY_HASH);
}

async function localRequest() {
  const configured = process.env.FINANCE_LOCAL_KEY_HASH;
  const address = origin();
  if (!configured || !hexKey.test(configured) || !/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(address)) return null;
  const request = await headers();
  return request.get("host") === new URL(address).host ? { configured, address, request } : null;
}

function sessionId(token: string, keyHash: string) {
  return digest(keyHash + token);
}

export async function signInLocally(key: string) {
  const local = await localRequest();
  if (!local || local.request.get("origin") !== local.address || !hexKey.test(key) ||
      !timingSafeEqual(Buffer.from(digest(key), "hex"), Buffer.from(local.configured, "hex"))) return false;

  const jar = await cookies();
  const previous = jar.get(localCookie)?.value;
  const token = randomBytes(32).toString("hex");
  const db = database();
  atomic(db, () => {
    db.prepare("DELETE FROM local_sessions WHERE expires_at<=? OR id=?")
      .run(Date.now(), previous && hexKey.test(previous) ? sessionId(previous, local.configured) : "");
    db.prepare("INSERT INTO local_sessions VALUES(?,?)")
      .run(sessionId(token, local.configured), Date.now() + sessionSeconds * 1000);
  });
  jar.set(localCookie, token, { httpOnly: true, sameSite: "strict", path: "/", maxAge: sessionSeconds });
  return true;
}

export async function signOutLocally() {
  const local = await localRequest();
  if (!local || local.request.get("origin") !== local.address) return;
  const jar = await cookies();
  const token = jar.get(localCookie)?.value;
  if (token && hexKey.test(token)) {
    database().prepare("DELETE FROM local_sessions WHERE id=?").run(sessionId(token, local.configured));
  }
  jar.delete(localCookie);
}

export async function authClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) jar.set(name, value, sessionCookie(options));
        } catch { /* Páginas não gravam cookies; o proxy.ts renova a sessão antes delas (SPEC-0005, REQ-001). */ }
      },
    },
  });
}

export function isOwner(email?: string) {
  return Boolean(email && process.env.FINANCE_OWNER_EMAIL &&
    email.toLowerCase() === process.env.FINANCE_OWNER_EMAIL.trim().toLowerCase());
}

export async function owner() {
  const request = await headers();
  // Com Authorization, vale só o token do app, nunca o cookie (SPEC-0005, REQ-004).
  const bearer = parseBearer(request.get("authorization"));
  if (localLoginEnabled()) {
    // A chave local é só do navegador em loopback; token do app não vale nesse modo.
    if (bearer !== undefined) return null;
    const local = await localRequest();
    if (!local) return null;
    const token = (await cookies()).get(localCookie)?.value;
    if (!token || !hexKey.test(token)) return null;
    const session = database().prepare("SELECT 1 FROM local_sessions WHERE id=? AND expires_at>?")
      .get(sessionId(token, local.configured), Date.now());
    return session ? localOwner : null;
  }
  // O proxy.ts já tentou renovar a sessão e o Supabase não respondeu: nega sem tentar de novo.
  if (request.get(AUTH_UNAVAILABLE)) return null;
  if (bearer !== undefined) {
    const config = supabaseConfig();
    if (!bearer || !config) return null;
    const app = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // getUser consulta o Supabase: token revogado ou de sessão encerrada é recusado.
    const { data: { user } } = await app.auth.getUser(bearer);
    return user && isOwner(user.email) ? user.id : null;
  }
  const client = await authClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  return user && isOwner(user.email) ? user.id : null;
}
