import { describe, expect, it } from "vitest";
import { addByFrequency, addMonths, referenceMonthOf, resolveInvoicePeriod } from "./date";

describe("addMonths", () => {
  it("soma meses simples", () => {
    const result = addMonths(new Date(2026, 0, 15), 2);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(15);
  });

  it("vira o ano ao ultrapassar dezembro", () => {
    const result = addMonths(new Date(2026, 11, 10), 2);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1);
  });

  it("dia 31 em mês sem dia 31 rola para o mês seguinte (comportamento nativo do Date)", () => {
    const result = addMonths(new Date(2026, 0, 31), 1);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(3);
  });
});

describe("addByFrequency", () => {
  it("DAILY soma dias", () => {
    const result = addByFrequency(new Date(2026, 0, 1), "DAILY", 5);
    expect(result.getDate()).toBe(6);
  });

  it("WEEKLY soma semanas (7 dias * interval)", () => {
    const result = addByFrequency(new Date(2026, 0, 1), "WEEKLY", 2);
    expect(result.getDate()).toBe(15);
  });

  it("MONTHLY soma meses", () => {
    const result = addByFrequency(new Date(2026, 0, 10), "MONTHLY", 3);
    expect(result.getMonth()).toBe(3);
  });

  it("YEARLY soma anos", () => {
    const result = addByFrequency(new Date(2026, 0, 10), "YEARLY", 1);
    expect(result.getFullYear()).toBe(2027);
  });

  it("respeita interval maior que 1", () => {
    const result = addByFrequency(new Date(2026, 0, 1), "MONTHLY", 2);
    expect(result.getMonth()).toBe(2);
  });
});

describe("referenceMonthOf", () => {
  it("formata com zero à esquerda para meses de um dígito", () => {
    expect(referenceMonthOf(new Date(2026, 0, 15))).toBe("2026-01");
  });

  it("formata meses de dois dígitos normalmente", () => {
    expect(referenceMonthOf(new Date(2026, 10, 15))).toBe("2026-11");
  });
});

describe("resolveInvoicePeriod", () => {
  const closingDay = 25;
  const dueDay = 5;

  it("compra antes do fechamento entra na fatura do mês corrente", () => {
    const period = resolveInvoicePeriod(new Date(2026, 8, 8), closingDay, dueDay);
    expect(period.referenceMonth).toBe("2026-09");
    expect(period.closingDate.getMonth()).toBe(8);
    expect(period.closingDate.getDate()).toBe(25);
  });

  it("compra exatamente no dia de fechamento ainda entra no ciclo atual", () => {
    const period = resolveInvoicePeriod(new Date(2026, 8, 25), closingDay, dueDay);
    expect(period.referenceMonth).toBe("2026-09");
  });

  it("compra após o fechamento entra na fatura do mês seguinte", () => {
    const period = resolveInvoicePeriod(new Date(2026, 8, 26), closingDay, dueDay);
    expect(period.referenceMonth).toBe("2026-10");
    expect(period.closingDate.getMonth()).toBe(9);
  });

  it("vencimento é sempre no mês seguinte ao fechamento", () => {
    const period = resolveInvoicePeriod(new Date(2026, 8, 8), closingDay, dueDay);
    expect(period.dueDate.getMonth()).toBe(9);
    expect(period.dueDate.getDate()).toBe(5);
  });

  it("vira o ano corretamente quando a compra de dezembro cai após o fechamento", () => {
    const period = resolveInvoicePeriod(new Date(2026, 11, 26), closingDay, dueDay);
    expect(period.referenceMonth).toBe("2027-01");
    expect(period.closingDate.getFullYear()).toBe(2027);
    expect(period.dueDate.getFullYear()).toBe(2027);
    expect(period.dueDate.getMonth()).toBe(1);
  });
});
