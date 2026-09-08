import { describe, expect, it } from "vitest";
import { parseCommand } from "./command-parser";

describe("parseCommand — mensagens sem comando", () => {
  it("retorna null para texto livre sem barra", () => {
    expect(parseCommand("gastei 45 no ifood")).toBeNull();
  });
});

describe("parseCommand — /g (gasto)", () => {
  it("extrai valor e descrição simples", () => {
    const result = parseCommand("/g 45,90 ifood");
    expect(result).toEqual({
      kind: "transaction",
      type: "EXPENSE",
      amountCents: 4590,
      description: "ifood",
      accountHint: undefined,
      cardHint: undefined,
      categoryHint: undefined,
      installments: undefined,
      date: undefined,
    });
  });

  it("extrai modificadores conta/cat independente da ordem", () => {
    const result = parseCommand("/g 45,90 cat:alimentacao ifood conta:nubank");
    expect(result).toMatchObject({
      kind: "transaction",
      amountCents: 4590,
      description: "ifood",
      accountHint: "nubank",
      categoryHint: "alimentacao",
    });
  });

  it("aceita cartao e parcelas juntos", () => {
    const result = parseCommand("/g 1200 notebook cartao:nubank cat:eletronicos parcelas:10");
    expect(result).toMatchObject({
      kind: "transaction",
      amountCents: 120000,
      cardHint: "nubank",
      categoryHint: "eletronicos",
      installments: 10,
    });
  });

  it("ignora parcelas:1 (não é parcelamento de verdade)", () => {
    const result = parseCommand("/g 100 cafe parcelas:1");
    expect(result).toMatchObject({ installments: undefined });
  });

  it("interpreta data no formato dd/mm", () => {
    const result = parseCommand("/g 50 mercado data:15/03");
    expect(result?.kind).toBe("transaction");
    if (result?.kind === "transaction") {
      expect(result.date?.getDate()).toBe(15);
      expect(result.date?.getMonth()).toBe(2);
    }
  });

  it("descrição cai para placeholder quando omitida", () => {
    const result = parseCommand("/g 50 conta:nubank");
    expect(result).toMatchObject({ description: "(sem descrição)" });
  });

  it("retorna invalid quando falta o valor", () => {
    const result = parseCommand("/g");
    expect(result?.kind).toBe("invalid");
  });

  it("retorna invalid quando o valor não é numérico", () => {
    const result = parseCommand("/g abc ifood");
    expect(result?.kind).toBe("invalid");
  });

  it("retorna invalid para valor zero ou negativo", () => {
    expect(parseCommand("/g 0 ifood")?.kind).toBe("invalid");
    expect(parseCommand("/g -10 ifood")?.kind).toBe("invalid");
  });

  it("aceita o alias /gasto", () => {
    const result = parseCommand("/gasto 10 cafe");
    expect(result?.kind).toBe("transaction");
  });
});

describe("parseCommand — /r (receita)", () => {
  it("marca type INCOME", () => {
    const result = parseCommand("/r 3000 salario conta:nubank");
    expect(result).toMatchObject({ kind: "transaction", type: "INCOME", amountCents: 300000 });
  });

  it("aceita o alias /receita", () => {
    const result = parseCommand("/receita 100 venda");
    expect(result?.kind).toBe("transaction");
  });
});

describe("parseCommand — comandos de controle", () => {
  it("/ok confirma", () => {
    expect(parseCommand("/ok")).toEqual({ kind: "confirm" });
  });

  it("/confirmar é alias de /ok", () => {
    expect(parseCommand("/confirmar")).toEqual({ kind: "confirm" });
  });

  it("/desfazer cancela", () => {
    expect(parseCommand("/desfazer")).toEqual({ kind: "undo" });
  });

  it("/cancelar é alias de /desfazer", () => {
    expect(parseCommand("/cancelar")).toEqual({ kind: "undo" });
  });

  it("/corrigir extrai campo e valor", () => {
    expect(parseCommand("/corrigir categoria lazer")).toEqual({
      kind: "correct",
      field: "categoria",
      value: "lazer",
    });
  });

  it("/corrigir junta múltiplas palavras no valor", () => {
    expect(parseCommand("/corrigir descricao almoço com cliente")).toEqual({
      kind: "correct",
      field: "descricao",
      value: "almoço com cliente",
    });
  });

  it("/corrigir sem valor retorna invalid", () => {
    expect(parseCommand("/corrigir categoria")?.kind).toBe("invalid");
  });

  it("/saldo sem argumento não define accountHint", () => {
    expect(parseCommand("/saldo")).toEqual({ kind: "balance", accountHint: undefined });
  });

  it("/saldo com argumento define accountHint", () => {
    expect(parseCommand("/saldo nubank")).toEqual({ kind: "balance", accountHint: "nubank" });
  });

  it("/ajuda retorna help", () => {
    expect(parseCommand("/ajuda")).toEqual({ kind: "help" });
  });

  it("/help é alias de /ajuda", () => {
    expect(parseCommand("/help")).toEqual({ kind: "help" });
  });

  it("comando desconhecido retorna invalid com mensagem", () => {
    const result = parseCommand("/xyz");
    expect(result?.kind).toBe("invalid");
  });

  it("é case-insensitive no nome do comando", () => {
    expect(parseCommand("/OK")).toEqual({ kind: "confirm" });
  });
});
