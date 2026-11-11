import assert from "node:assert/strict";
import test from "node:test";
import {
  accountOptions, connectionRows, currentMonth, entryRow, homeQuery, ledgerQuery, ledgerRows, monthBounds,
  monthLabel, openBills, shiftMonth,
} from "../src/lib/ledger.ts";
import type { DashboardData } from "../src/lib/overview.ts";

// Dados sintéticos (SPEC-0005, REQ-007). Valores em centavos, como a API.
const item = "00000000-0000-4000-8000-0000000000a1";
const entry = (id: string, accountId: string, direction: "CREDIT" | "DEBIT", amount: number, extra: object = {}) => ({
  id, itemId: item, accountId, description: "Lançamento " + id, date: "2026-11-05", time: "09:30" as string | null,
  status: "POSTED" as const, direction, amount, currency: "BRL", method: "Pix" as string | null, category: null,
  billId: null, installment: null, installments: null, ...extra,
});
const data: DashboardData = {
  accounts: [
    { id: "conta", itemId: item, name: "Conta", type: "BANK", last4: "0001", currency: "BRL", balance: 1, closes: null, due: null },
    { id: "cartao", itemId: item, name: "Cartão", type: "CREDIT", last4: "4242", currency: "BRL", balance: 1, closes: null, due: null },
  ],
  entries: [
    entry("1", "conta", "CREDIT", 12_000),
    entry("2", "cartao", "DEBIT", 1_000, { currency: "USD", accountAmount: 5_480, accountCurrency: "BRL", method: "Crédito" }),
    entry("3", "cartao", "DEBIT", 30_000, { installment: 2, installments: 3, purchaseDate: "2026-10-05", time: null, status: "PENDING" }),
  ],
  bills: [], notifications: [], unread: 0,
  connections: [
    { id: item, name: "Banco", label: "Meu banco", status: "CONECTADA", syncedAt: "2026-11-10T13:00:00Z", active: 1 },
    { id: "outra", name: "Antiga", status: "REMOVENDO", syncedAt: null, active: 0 },
  ],
  openBills: [{
    itemId: item, accountId: "cartao", month: "2026-12", closes: "2026-12-03", due: "2026-12-10",
    purchases: [{ amount: 18_820, currency: "BRL" }], imported: [], estimated: [{ amount: 10_000, currency: "BRL" }],
    total: [{ amount: 28_820, currency: "BRL" }], count: 2,
    entries: [entry("2", "cartao", "DEBIT", 1_000, { currency: "USD", accountAmount: 5_480, accountCurrency: "BRL" })],
    forecast: [{ id: "p", itemId: item, accountId: "cartao", description: "Parcela", installment: 3, installments: 3,
      month: "2026-12", amount: 10_000, currency: "BRL", estimated: true, billId: null }],
  }],
};
const real = (value: string) => value.replace(/\s/g, " ");

test("meses: rótulo, deslocamento e período que termina hoje no mês corrente", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(monthLabel("2026-11"), "Novembro de 2026");
  assert.deepEqual(monthBounds("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  const now = currentMonth();
  assert.equal(monthBounds(now).from, now + "-01");
  assert.ok(monthBounds(now).to <= now + "-31");
  assert.match(ledgerQuery("2026-10"), /from=2026-10-01&to=2026-10-31$/);
  assert.match(homeQuery(), /&open=1$/);
});

test("extrato filtra por conta e mostra sinal, cobrança em reais e parcela", () => {
  assert.equal(ledgerRows(data).length, 3);
  assert.deepEqual(ledgerRows(data, item + "/conta").map((row) => row.description), ["Lançamento 1"]);
  const foreign = entryRow(data.entries[1], data.accounts);
  assert.equal(real(foreign.amount), "−US$ 10,00");
  assert.equal(real(foreign.charged!), "R$ 54,80 cobrados");
  const credit = entryRow(data.entries[0], data.accounts);
  assert.equal(credit.credit, true);
  assert.equal(real(credit.amount), "+R$ 120,00");
  assert.equal(credit.charged, null);
  const installment = entryRow(data.entries[2], data.accounts);
  assert.equal(installment.pending, true);
  assert.match(installment.detail, /Cartão · Pix · 2\/3 · compra em/);
  assert.doesNotMatch(installment.date, /·/, "sem horário não mostra hora");
  assert.deepEqual(accountOptions(data).map((row) => row.label), ["Conta · 0001", "Cartão · 4242"]);
});

test("fatura aberta: total, datas, partes, compras e previsões; ocultar mascara valores", () => {
  const [bill] = openBills(data);
  assert.equal(bill.card, "Cartão · 4242");
  assert.equal(real(bill.total), "R$ 288,20");
  assert.match(bill.when, /^Fecha 3 de dez\. de 2026 · vence 10 de dez\. de 2026$/);
  assert.equal(real(bill.parts), "Compras R$ 188,20 · Parcelas previstas R$ 100,00");
  assert.equal(bill.entries.length, 1);
  assert.equal(bill.forecast[0].detail, "3/3 · prevista");
  const [hidden] = openBills(data, true);
  assert.equal(hidden.total, "R$ ••••••");
  assert.equal(hidden.parts, "Compras R$ •••••• · Parcelas previstas R$ ••••••");
  assert.deepEqual(openBills({ ...data, openBills: [{ ...data.openBills![0], count: 0 }] }), [], "fatura vazia some");
  assert.deepEqual(openBills({ ...data, openBills: undefined }), []);
});

test("conexões ativas com nome escolhido, situação e sincronização", () => {
  const rows = connectionRows(data);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Meu banco");
  assert.equal(rows[0].status, "Conectada");
  assert.match(rows[0].synced, /^Sincronizada em 10\/11\/2026/);
  assert.equal(rows[0].reconnect, false);
  assert.equal(rows[0].meuPluggy, false);
});

test("ações da conexão seguem as regras do web", () => {
  const meu = connectionRows({ ...data, connections: [{ ...data.connections[0], name: "MeuPluggy" }] })[0];
  assert.equal(meu.meuPluggy, true);
  const broken = connectionRows({ ...data, connections: [{ ...data.connections[0], name: "MeuPluggy", status: "RECONECTAR" }] })[0];
  assert.deepEqual([broken.reconnect, broken.meuPluggy, broken.status], [true, false, "Reconectar"]);
  const importing = connectionRows({ ...data, connections: [{ ...data.connections[0], status: "IMPORTANDO" }] })[0];
  assert.equal(importing.importing, true);
});
