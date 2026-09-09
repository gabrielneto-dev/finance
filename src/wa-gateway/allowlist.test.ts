import { afterEach, describe, expect, it } from "vitest";
import { isSenderAllowed } from "./allowlist";

const ORIGINAL_ENV = process.env.ALLOWED_PHONES;

afterEach(() => {
  process.env.ALLOWED_PHONES = ORIGINAL_ENV;
});

describe("isSenderAllowed", () => {
  it("permite o número configurado", () => {
    process.env.ALLOWED_PHONES = "5511999999999";
    expect(isSenderAllowed("5511999999999@s.whatsapp.net")).toBe(true);
  });

  it("nega número fora da lista", () => {
    process.env.ALLOWED_PHONES = "5511999999999";
    expect(isSenderAllowed("5599999999999@s.whatsapp.net")).toBe(false);
  });

  it("aceita múltiplos números separados por vírgula", () => {
    process.env.ALLOWED_PHONES = "5511999999999,5521888888888";
    expect(isSenderAllowed("5521888888888@s.whatsapp.net")).toBe(true);
  });

  it("nega tudo quando a allowlist está vazia", () => {
    process.env.ALLOWED_PHONES = "";
    expect(isSenderAllowed("5511999999999@s.whatsapp.net")).toBe(false);
  });

  it("nega tudo quando a variável não está definida", () => {
    delete process.env.ALLOWED_PHONES;
    expect(isSenderAllowed("5511999999999@s.whatsapp.net")).toBe(false);
  });

  it("ignora caracteres não numéricos ao comparar", () => {
    process.env.ALLOWED_PHONES = "+55 (11) 99999-9999";
    expect(isSenderAllowed("5511999999999@s.whatsapp.net")).toBe(true);
  });
});
