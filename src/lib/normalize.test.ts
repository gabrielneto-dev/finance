import { describe, expect, it } from "vitest";
import { normalize } from "./normalize.js";

describe("normalize", () => {
  it("remove acentos", () => {
    expect(normalize("Alimentação")).toBe("alimentacao");
  });

  it("converte para minúsculas", () => {
    expect(normalize("NUBANK")).toBe("nubank");
  });

  it("remove espaços nas bordas", () => {
    expect(normalize("  carteira  ")).toBe("carteira");
  });

  it("mantém espaços internos", () => {
    expect(normalize("Nubank Crédito")).toBe("nubank credito");
  });

  it("é idempotente em texto já normalizado", () => {
    expect(normalize("mercado")).toBe("mercado");
  });
});
