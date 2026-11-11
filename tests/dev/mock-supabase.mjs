// Supabase Auth falso, só para testes locais do app e do backend (SPEC-0005, Marco 1).
// Implementa o mínimo que supabase-js e o servidor usam: login por senha, renovação, usuário e logout.
// Usuário, senha e tokens são sintéticos. Nunca use em produção.
//   node tests/dev/mock-supabase.mjs
// Variáveis: MOCK_SUPABASE_PORT (54321), MOCK_USER_EMAIL, MOCK_USER_PASSWORD, MOCK_USER_ID, MOCK_TOKEN_SECONDS (3600).
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.MOCK_SUPABASE_PORT || 54321);
const ttl = Number(process.env.MOCK_TOKEN_SECONDS || 3600);
const user = {
  id: process.env.MOCK_USER_ID || "5ca1ab1e-0000-4000-8000-000000000001",
  email: process.env.MOCK_USER_EMAIL || "dono@example.com",
  password: process.env.MOCK_USER_PASSWORD || "senha-sintetica-123",
};
const access = new Map(); // access token -> { exp, session }
// refresh token -> { session, usedAt, child }. Regras do Supabase real (guides/auth/sessions):
// cada refresh token vale uma vez; reuso em até 10 s devolve o mesmo resultado; o pai do token ativo
// devolve o ativo; qualquer outro reuso encerra a sessão inteira.
const refresh = new Map();
const REUSE_MS = 10_000;
const b64u = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

const userBody = () => ({
  id: user.id, aud: "authenticated", role: "authenticated", email: user.email,
  email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {}, identities: [], created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z",
});

function issue(session = randomUUID()) {
  const exp = now() + ttl;
  const token = [b64u({ alg: "HS256", typ: "JWT" }),
    b64u({ sub: user.id, email: user.email, aud: "authenticated", role: "authenticated", exp, iat: now(), session_id: session }),
    randomBytes(16).toString("base64url")].join(".");
  const renew = randomBytes(24).toString("hex");
  access.set(token, { exp, session });
  refresh.set(renew, { session, usedAt: null, child: null });
  return { access_token: token, token_type: "bearer", expires_in: ttl, expires_at: exp, refresh_token: renew, user: userBody() };
}

function revoke(session) {
  for (const [token, row] of access) if (row.session === session) access.delete(token);
  for (const [token, value] of refresh) if (value.session === session) refresh.delete(token);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};
const send = (res, status, body) => {
  res.writeHead(status, { ...cors, ...(body ? { "Content-Type": "application/json" } : {}) });
  res.end(body ? JSON.stringify(body) : undefined);
};
const bearer = (req) => /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") return send(res, 204);
  let body = {};
  if (req.method === "POST") {
    let text = "";
    for await (const chunk of req) text += chunk;
    try { body = text ? JSON.parse(text) : {}; } catch { return send(res, 400, { code: "bad_json", message: "JSON inválido" }); }
  }
  const grant = url.searchParams.get("grant_type");
  if (req.method === "POST" && url.pathname === "/auth/v1/token" && grant === "password") {
    if (String(body.email).toLowerCase() !== user.email || body.password !== user.password) {
      return send(res, 400, { code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
    }
    return send(res, 200, issue());
  }
  if (req.method === "POST" && url.pathname === "/auth/v1/token" && grant === "refresh_token") {
    const row = refresh.get(body.refresh_token);
    const stamp = new Date().toISOString();
    if (!row) {
      console.log(stamp, "renovação recusada: refresh token desconhecido ou de sessão encerrada");
      return send(res, 400, { code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" });
    }
    if (row.usedAt === null) {
      row.usedAt = Date.now();
      row.child = issue(row.session);
      console.log(stamp, "token renovado");
      return send(res, 200, row.child);
    }
    const childActive = refresh.get(row.child.refresh_token)?.usedAt === null;
    if (Date.now() - row.usedAt <= REUSE_MS || childActive) {
      console.log(stamp, "reuso aceito (intervalo de 10 s ou pai do token ativo)");
      return send(res, 200, row.child);
    }
    revoke(row.session);
    console.log(stamp, "reuso fora do intervalo: sessão encerrada");
    return send(res, 400, { code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" });
  }
  if (req.method === "GET" && url.pathname === "/auth/v1/user") {
    const row = access.get(bearer(req));
    if (!row || row.exp <= now()) return send(res, 403, { code: "bad_jwt", msg: "invalid JWT: token is expired or invalid" });
    return send(res, 200, userBody());
  }
  if (req.method === "POST" && url.pathname === "/auth/v1/logout") {
    const row = access.get(bearer(req));
    if (row) revoke(row.session);
    return send(res, 204);
  }
  if (url.pathname === "/auth/v1/.well-known/jwks.json") return send(res, 200, { keys: [] });
  return send(res, 404, { code: "not_found", msg: "Rota não implementada no mock" });
}).listen(port, "127.0.0.1", () => console.log("Mock do Supabase Auth em http://127.0.0.1:" + port + " (usuário " + user.email + ")"));
