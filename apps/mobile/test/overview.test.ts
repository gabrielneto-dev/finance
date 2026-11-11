import assert from "node:assert/strict";
import test from "node:test";
import { overview, overviewQuery, type DashboardData } from "../src/lib/overview.ts";

// Dados sintéticos (SPEC-0005, REQ-003). Valores em centavos, como a API.
const item = "00000000-0000-4000-8000-0000000000a1";
const entry = (id: string, accountId: string, direction: "CREDIT" | "DEBIT", amount: number, status: "POSTED" | "PENDING" = "POSTED") => ({
  id, itemId: item, accountId, description: "Teste", date: "2026-11-05", time: null, status, direction, amount,
  currency: "BRL", method: null, category: null, billId: null, installment: null, installments: null,
});
const data: DashboardData = {
  accounts: [
    { id: "conta", itemId: item, name: "Conta", type: "BANK", last4: "0001", currency: "BRL", balance: 523_450, closes: null, due: null,
      bank: { closingBalance: 573_450, investedBalance: null, overdraftLimit: null, overdraftUsed: null, unarrangedOverdraft: null } },
    { id: "cartao", itemId: item, name: "Cartão", type: "CREDIT", last4: "4242", currency: "BRL", balance: 81_230, closes: null, due: null },
  ],
  entries: [
    entry("1", "conta", "CREDIT", 850_000),
    entry("2", "conta", "DEBIT", 250_000),
    entry("3", "conta", "DEBIT", 18_900, "PENDING"),
    entry("4", "cartao", "DEBIT", 8_750),
  ],
  bills: [], notifications: [], unread: 0,
  connections: [{ id: item, name: "Banco", status: "CONECTADA", syncedAt: "2026-11-10T13:00:00Z", active: 1 }],
};
const real = (value: string) => value.replace(/\s/g, " ");

test("resume saldo, bloqueado, entradas e saídas como a Visão geral do web", () => {
  const summary = overview(data);
  assert.equal(real(summary.balance), "R$ 5.234,50");
  assert.equal(real(summary.blocked!.amount), "R$ 500,00");
  assert.equal(real(summary.blocked!.ledger), "R$ 5.734,50");
  assert.equal(real(summary.income), "R$ 8.500,00");
  assert.equal(real(summary.expense), "R$ 2.500,00", "sem pendente e sem cartão");
  assert.equal(summary.connections, 1);
  assert.match(summary.lastSync!, /10\/11\/2026/);
});

test("ocultar valores mascara saldo e bloqueado, mas não entradas e saídas", () => {
  const summary = overview(data, true);
  assert.equal(summary.balance, "R$ ••••••");
  assert.equal(summary.blocked!.amount, "R$ ••••••");
  assert.notEqual(summary.income, "R$ ••••••");
});

test("sem contas e sem conexões", () => {
  const summary = overview({ ...data, accounts: [], entries: [], connections: [] });
  assert.equal(summary.balance, "—");
  assert.equal(summary.blocked, null);
  assert.equal(summary.connections, 0);
  assert.equal(summary.lastSync, null);
});

test("consulta o mês corrente", () => {
  assert.match(overviewQuery(), /^\/api\/dashboard\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}$/);
});
