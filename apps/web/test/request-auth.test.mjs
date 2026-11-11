import assert from "node:assert/strict";
import test from "node:test";
import { devOrigins, parseBearer, writeAllowed } from "../lib/request-auth.mjs";

// Token do app no cabeçalho (SPEC-0005, REQ-004). Valores sintéticos.
test("lê o token Bearer e distingue ausência de cabeçalho inválido", () => {
  const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.assinatura-sintetica";
  assert.equal(parseBearer("Bearer " + token), token);
  assert.equal(parseBearer(null), undefined);
  assert.equal(parseBearer(undefined), undefined);
  assert.equal(parseBearer(""), null);
  assert.equal(parseBearer("Basic " + token), null);
  assert.equal(parseBearer("Bearer curto"), null);
  assert.equal(parseBearer("Bearer " + token + " extra"), null);
  assert.equal(parseBearer("Bearer " + "a".repeat(5000)), null);
});

test("escrita exige a origem do app web, exceto quando vem com Authorization", () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://finance.example.test";
  try {
    const post = (headers) => new Request("https://finance.example.test/api/planning", { method: "POST", headers });
    assert.equal(writeAllowed(post({ origin: "https://finance.example.test" })), true);
    assert.equal(writeAllowed(post({ origin: "https://outro.example.test" })), false);
    assert.equal(writeAllowed(post({})), false, "sem origem e sem token");
    assert.equal(writeAllowed(post({ authorization: "Bearer qualquer" })), true, "o token é conferido depois por owner()");
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous;
  }
});

test("CORS de desenvolvimento só aceita origens completas, sem caminho", () => {
  assert.deepEqual(devOrigins(""), []);
  assert.deepEqual(devOrigins(undefined), []);
  assert.deepEqual(devOrigins(" http://localhost:8081 , https://a.example.test "), ["http://localhost:8081", "https://a.example.test"]);
  assert.deepEqual(devOrigins("*,http://localhost:8081/x,localhost:8081"), []);
});
