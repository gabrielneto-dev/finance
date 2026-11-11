// FCM e OAuth do Google falsos, só para testar o worker localmente (SPEC-0005, Marco 2).
// Confere a assinatura do JWT com a chave pública sintética e registra o que receberia, sem o token do aparelho.
//   MOCK_FCM_PUBLIC_KEY=<arquivo .pem> node tests/dev/mock-fcm.mjs
// Aponte o worker para cá com FCM_ENDPOINT=http://127.0.0.1:54322 e token_uri=http://127.0.0.1:54322/token.
import { createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.MOCK_FCM_PORT || 54322);
const publicKey = process.env.MOCK_FCM_PUBLIC_KEY ? readFileSync(process.env.MOCK_FCM_PUBLIC_KEY, "utf8") : null;
const issued = new Set();

createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "POST" && req.url === "/token") {
    const assertion = new URLSearchParams(text).get("assertion") ?? "";
    const [header, claims, signature] = assertion.split(".");
    const valid = Boolean(publicKey && signature) &&
      createVerify("RSA-SHA256").update(header + "." + claims).verify(publicKey, Buffer.from(signature, "base64url"));
    console.log(new Date().toISOString(), "OAuth: JWT", valid ? "com assinatura válida" : "INVÁLIDO");
    if (!valid) return send(400, { error: "invalid_grant" });
    const token = "oauth-" + Date.now();
    issued.add(token);
    return send(200, { access_token: token, expires_in: 3600, token_type: "Bearer" });
  }
  const match = /^\/v1\/projects\/([^/]+)\/messages:send$/.exec(req.url ?? "");
  if (req.method === "POST" && match) {
    if (!issued.has((req.headers.authorization ?? "").replace(/^Bearer /, ""))) return send(401, { error: { status: "UNAUTHENTICATED" } });
    const { message } = JSON.parse(text);
    const { token, ...rest } = message;
    console.log(new Date().toISOString(), "FCM recebeu para o projeto", match[1] + ":", JSON.stringify(rest), "(token com", String(token).length, "caracteres)");
    return send(200, { name: "projects/" + match[1] + "/messages/" + Date.now() });
  }
  send(404, { error: { status: "NOT_FOUND" } });
}).listen(port, "127.0.0.1", () => console.log("FCM falso em http://127.0.0.1:" + port));
