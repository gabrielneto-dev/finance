import { describe, expect, it } from "vitest";
import { centsToBRL, parseAmountToCents, splitEvenly } from "./money.js";

describe("parseAmountToCents", () => {
  it("aceita vírgula como separador decimal", () => {
    expect(parseAmountToCents("45,90")).toBe(4590);
  });

  it("aceita ponto como separador decimal (formato americano)", () => {
    expect(parseAmountToCents("45.90")).toBe(4590);
  });

  it("aceita milhar com ponto e decimal com vírgula (formato BR)", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
  });

  it("trata ponto único sem vírgula e 3+ dígitos como separador de milhar", () => {
    expect(parseAmountToCents("1.234")).toBe(123400);
  });

  it("trata múltiplos pontos como separadores de milhar", () => {
    expect(parseAmountToCents("1.234.567")).toBe(123456700);
  });

  it("aceita valor inteiro sem decimais", () => {
    expect(parseAmountToCents("1200")).toBe(120000);
  });

  it("retorna null para texto não numérico", () => {
    expect(parseAmountToCents("abc")).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(parseAmountToCents("")).toBeNull();
  });

  it("ignora espaços nas bordas", () => {
    expect(parseAmountToCents("  45,90  ")).toBe(4590);
  });
});

describe("centsToBRL", () => {
  it("formata centavos como moeda brasileira", () => {
    expect(centsToBRL(4590)).toBe("R$ 45,90");
  });

  it("formata valores negativos", () => {
    expect(centsToBRL(-4590)).toBe("-R$ 45,90");
  });

  it("formata zero", () => {
    expect(centsToBRL(0)).toBe("R$ 0,00");
  });
});

describe("splitEvenly", () => {
  it("divide um valor exatamente divisível em partes iguais", () => {
    expect(splitEvenly(30000, 3)).toEqual([10000, 10000, 10000]);
  });

  it("joga o resto da divisão inteira na última parcela", () => {
    expect(splitEvenly(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it("nunca perde ou ganha centavos: a soma bate com o total", () => {
    const total = 100037;
    const parts = splitEvenly(total, 7);
    expect(parts.reduce((sum, p) => sum + p, 0)).toBe(total);
    expect(parts).toHaveLength(7);
  });

  it("com 1 parcela, devolve o valor total inteiro", () => {
    expect(splitEvenly(4590, 1)).toEqual([4590]);
  });
});
