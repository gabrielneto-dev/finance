import assert from "node:assert/strict";
import test from "node:test";
import { APP_REDIRECT, CONNECT_PRODUCTS, connectOptions } from "../lib/connect.mjs";

// Opções do Connect Token (SPEC-0005, REQ-008).
test("app recebe o deep link fixo; web recebe a origem HTTPS; loopback fica sem retorno", () => {
  assert.equal(APP_REDIRECT, "finance://pluggy/retorno");
  assert.equal(connectOptions({ appOrigin: "https://finance.example.test", client: "app" }).oauthRedirectUri, APP_REDIRECT);
  assert.equal(connectOptions({ appOrigin: "http://127.0.0.1:3001", client: "app" }).oauthRedirectUri, APP_REDIRECT);
  assert.equal(connectOptions({ appOrigin: "https://finance.example.test" }).oauthRedirectUri, "https://finance.example.test/pluggy/retorno");
  assert.equal("oauthRedirectUri" in connectOptions({ appOrigin: "http://127.0.0.1:3001" }), false, "Pluggy recusa localhost");
});

test("o cliente não escolhe a URL de retorno", () => {
  for (const client of ["https://atacante.example/roubo", "evil://x", { url: "x" }, "APP", null]) {
    assert.equal(connectOptions({ appOrigin: "https://finance.example.test", client }).oauthRedirectUri, "https://finance.example.test/pluggy/retorno");
  }
});

test("intenção e produtos", () => {
  const options = connectOptions({ appOrigin: "https://finance.example.test", client: "app", intent: "intent-1" });
  assert.equal(options.clientUserId, "intent-1");
  assert.deepEqual(options.products, CONNECT_PRODUCTS);
  assert.ok(CONNECT_PRODUCTS.includes("INVESTMENTS"));
  const fallback = connectOptions({ appOrigin: "https://finance.example.test", withProducts: false });
  assert.equal("products" in fallback, false);
  assert.equal("clientUserId" in fallback, false);
});
