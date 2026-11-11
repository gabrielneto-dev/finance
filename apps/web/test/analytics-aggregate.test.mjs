import assert from "node:assert/strict";
import test from "node:test";
import * as aggregate from "../lib/analytics/aggregate.mjs";
import { balanceHistory } from "../lib/analytics/balance-history.mjs";
import { composition, cardBills } from "../lib/analytics/bills.mjs";
import { classify } from "../lib/analytics/classify.mjs";
import { addMonths, daysInMonth, monthsBetween, previousPeriod } from "../lib/analytics/dates.mjs";
import { insights } from "../lib/analytics/insights.mjs";
import { merchantKey } from "../lib/analytics/merchant.mjs";
import { recurring } from "../lib/analytics/recurring.mjs";

let next = 0;
const entry = (date, amount, extra = {}) => ({
  id: "e" + (next += 1), itemId: "i1", accountId: "a1", description: "Loja Sintética", date, time: null,
  status: "POSTED", direction: "DEBIT", amount, currency: "BRL", method: "Débito", category: "Shopping",
  billId: null, installment: null, installments: null, ...extra,
});
const row = (value, accountType = "BANK") => ({
  entry: value, info: classify(value, { accountType }), account: value.itemId + "/" + value.accountId,
  accountType, merchant: merchantKey(value.description),
});

test("datas: meses, período anterior e dias do mês", () => {
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(daysInMonth("2028-02"), 29);
  assert.deepEqual(monthsBetween("2026-10", "2027-01"), ["2026-10", "2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(previousPeriod("2026-11-01", "2026-11-10"), { from: "2026-10-22", to: "2026-10-31" });
});

test("totais separam receita, rendimento, despesa, estorno e neutros", () => {
  const rows = [
    row(entry("2026-10-02", 500000, { direction: "CREDIT", category: "Salary", method: "TED" })),
    row(entry("2026-10-03", 1000, { direction: "CREDIT", category: "Proceeds interests and dividends" })),
    row(entry("2026-10-04", 20000)),
    row(entry("2026-10-05", 5000, { direction: "CREDIT", category: "Shopping" })),
    row(entry("2026-10-06", 90000, { category: "Credit card payment", method: "Cartão" })),
    row(entry("2026-10-07", 30000, { category: "Same person transfer", method: "Pix" })),
    row(entry("2026-10-08", 3000, { status: "PENDING", category: "Eating out" })),
  ];
  const totals = aggregate.totals(rows, "2026-10-01", "2026-10-10");
  assert.equal(totals.income, 501000);
  assert.equal(totals.yield, 1000);
  assert.equal(totals.expense, 18000);
  assert.equal(totals.refunds, 5000);
  assert.equal(totals.pending, 3000);
  assert.equal(totals.result, 483000);
  assert.equal(totals.savingsRate, 483000 / 501000);
  assert.equal(totals.dailyAverage, 1800);
  assert.equal(totals.neutral.pagamento_fatura, 90000);
  assert.equal(totals.neutral.transferencia_propria, 30000);
  assert.equal(aggregate.totals([], "2026-10-01", "2026-10-01").savingsRate, null);
});

test("grupos trazem participação, período anterior, tendência e categorias", () => {
  const current = [row(entry("2026-10-04", 20000, { category: "Eating out" })), row(entry("2026-10-05", 10000, { category: "Food delivery" })),
    row(entry("2026-10-06", 10000, { category: "Groceries" }))];
  const previous = [row(entry("2026-09-04", 5000, { category: "Eating out" }))];
  const [first, second] = aggregate.groups(current, previous, [...previous, ...current], ["2026-09", "2026-10"]);
  assert.equal(first.label, "Alimentação fora");
  assert.equal(first.amount, 30000);
  assert.equal(first.previous, 5000);
  assert.equal(first.share, 0.75);
  assert.deepEqual(first.spark, [5000, 30000]);
  assert.deepEqual(first.categories.map((category) => [category.label, category.amount, category.average]),
    [["Restaurantes e bares", 20000, 20000], ["Delivery", 10000, 10000]]);
  assert.equal(second.label, "Mercado e casa");
  assert.deepEqual(aggregate.natures(current), { essencial: 10000, estilo: 30000, indefinido: 0 });
});

test("ritmo do mês acumula por dia, compara com meses anteriores e projeta o mês corrente", () => {
  const rows = [row(entry("2026-11-02", 10000)), row(entry("2026-11-05", 10000)), row(entry("2026-10-03", 30000)),
    row(entry("2026-09-10", 60000)), row(entry("2026-08-01", 0))];
  const pace = aggregate.pace(rows, "2026-11", "2026-11-10");
  assert.equal(pace.days.length, 30);
  assert.equal(pace.days[4].current, 20000);
  assert.equal(pace.days[10].current, null);
  assert.equal(pace.days[2].previous, 30000);
  assert.equal(pace.spent, 20000);
  assert.equal(pace.projection, 60000);
  assert.equal(pace.averageTotal, 30000);
  assert.equal(aggregate.pace(rows, "2026-10", "2026-11-10").projection, null);
});

test("calendário, formas de pagamento, entradas, faixas e compras pequenas", () => {
  const rows = [row(entry("2026-10-01", 1500, { time: "08:30", method: "Pix", description: "Padaria Sintética" })),
    row(entry("2026-10-01", 2500, { time: "20:10", description: "Padaria Sintética" })),
    row(entry("2026-10-03", 50000)),
    row(entry("2026-10-03", 9000, { direction: "CREDIT", category: "Transfer - PIX" }))];
  const daily = aggregate.daily(rows, "2026-10-01", "2026-10-03");
  assert.deepEqual(daily.map((day) => day.amount), [4000, 0, 50000]);
  assert.deepEqual(aggregate.methods(rows), [{ label: "Débito", amount: 52500 }, { label: "Pix", amount: 1500 }]);
  assert.deepEqual(aggregate.incomeSources(rows), [{ label: "Pix e transferências recebidas", amount: 9000 }]);
  const bands = aggregate.weekdayBands(rows);
  assert.equal(bands.find((cell) => cell.weekday === 4 && cell.band === "Manhã").amount, 1500);
  assert.equal(bands.find((cell) => cell.weekday === 4 && cell.band === "Noite").count, 1);
  assert.equal(bands.find((cell) => cell.weekday === 6 && cell.band === "Sem horário").amount, 50000);
  const small = aggregate.smallPurchases(rows);
  assert.deepEqual([small.count, small.amount, small.top[0].label, small.top[0].count], [2, 4000, "Padaria Sintetica", 2]);
});

test("estabelecimentos e instituições", () => {
  const current = [row(entry("2026-10-01", 9000, { description: "Mercado Azul" })), row(entry("2026-10-02", 3000, { description: "Mercado Azul" })),
    row(entry("2026-10-03", 5000, { description: "Posto Verde", itemId: "i2" }))];
  const previous = [row(entry("2026-09-01", 1000, { description: "Posto Verde", itemId: "i2" }))];
  const [first, second] = aggregate.merchants(current, previous);
  assert.deepEqual([first.label, first.amount, first.count, first.average, first.previousRank], ["Mercado Azul", 12000, 2, 6000, null]);
  assert.deepEqual([second.previous, second.previousRank], [1000, 1]);
  const banks = aggregate.institutions(current, current, ["2026-10"],
    [{ id: "i1", name: "MeuPluggy", label: "Banco A" }, { id: "i2", name: "MeuPluggy" }, { id: "i3", name: "Vazio" }],
    [{ key: "i1/a1", itemId: "i1", name: "Conta", type: "BANK", last4: null }, { key: "i2/a1", itemId: "i2", name: "Conta", type: "BANK", last4: null }]);
  assert.deepEqual(banks.map((bank) => [bank.name, bank.expense, bank.share]), [["Banco A", 12000, 12000 / 17000], ["MeuPluggy", 5000, 5000 / 17000]]);
  assert.equal(banks[0].accounts[0].outflow, 12000);
  assert.deepEqual(banks[0].monthly, [{ month: "2026-10", amount: 12000 }]);
});

test("saldo reconstruído termina no saldo atual e desfaz os lançamentos efetivados", () => {
  const entries = [entry("2026-10-02", 10000, { direction: "CREDIT" }), entry("2026-10-03", 4000), entry("2026-10-05", 1000),
    entry("2026-10-04", 999, { status: "PENDING" }), entry("2026-10-03", 500, { currency: "USD" })]
    .map((value) => ({ ...value, account: "i1/a1" }));
  const [history] = balanceHistory([{ key: "i1/a1", name: "Conta", type: "BANK", balance: 50000, currency: "BRL" },
    { key: "i1/c1", name: "Cartão", type: "CREDIT", balance: 0, currency: "BRL" }], entries, "2026-10-01", "2026-10-05", "2026-10-05");
  assert.deepEqual(history.points.map((point) => point.balance), [45000, 55000, 51000, 51000, 50000]);
  const [past] = balanceHistory([{ key: "i1/a1", name: "Conta", type: "BANK", balance: 50000, currency: "BRL" }], entries, "2026-10-01", "2026-10-03", "2026-10-05");
  assert.equal(past.points.at(-1).balance, 51000);
  assert.deepEqual(balanceHistory([], entries, "2026-10-05", "2026-10-01", "2026-10-05"), []);
});

test("detecta assinatura mensal estável, nova ou com preço novo, e ignora parcelas", () => {
  const monthly = ["2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05"]
    .map((date, index) => row(entry(date, index === 4 ? 2390 : 2190, { description: "DM*Streaming", category: "Digital services" })));
  const recent = ["2026-08-20", "2026-09-20", "2026-10-20"].map((date) => row(entry(date, 4000, { description: "Academia Nova" })));
  const parcels = ["2026-08-10", "2026-09-10", "2026-10-10"].map((date) => row(entry(date, 10000, { description: "Loja Parcelada", installments: 10 })));
  const random = ["2026-08-01", "2026-08-03", "2026-10-28"].map((date, index) => row(entry(date, 1000 * (index + 1), { description: "Bar Variado" })));
  const found = recurring([...monthly, ...recent, ...parcels, ...random], "2026-10-31");
  assert.deepEqual(found.map((item) => item.label), ["Academia Nova", "Streaming"]);
  const [academia, streaming] = found;
  assert.deepEqual([academia.isNew, academia.annual], [true, 48000]);
  assert.deepEqual([streaming.typical, streaming.priceChanged, streaming.isNew], [2190, true, false]);
});

test("composição da fatura e parcelas futuras por cartão", () => {
  const card = { key: "i1/c1", itemId: "i1", id: "c1", name: "Cartão", last4: "1234", type: "CREDIT", limit: 100000, available: 40000, currency: "BRL" };
  const rows = [entry("2026-10-01", 10000, { accountId: "c1", billId: "b1" }), entry("2026-10-02", 5000, { accountId: "c1", billId: "b1", installments: 3, installment: 1 }),
    entry("2026-10-03", 300, { accountId: "c1", billId: "b1", category: "Tax on financial operations" }),
    entry("2026-10-04", 2000, { accountId: "c1", billId: "b1", amount: 400, currency: "USD", accountAmount: 2000, accountCurrency: "BRL" }),
    entry("2026-10-05", 1000, { accountId: "c1", billId: "b1", direction: "CREDIT", category: "Shopping" }),
    entry("2026-10-06", 16300, { accountId: "c1", billId: "b1", direction: "CREDIT", category: "Credit card payment" }),
    entry("2026-11-02", 7000, { accountId: "c1", id: "open-1" })].map((value) => row(value, "CREDIT"));
  const parts = composition(rows.filter((item) => item.entry.billId === "b1"));
  assert.deepEqual([parts.avista, parts.parcelas, parts.iof, parts.exterior, parts.estornos], [10000, 5000, 300, 2000, 1000]);
  assert.equal(parts.byGroup["Compras"], 16000);
  const [summary] = cardBills([card, { ...card, key: "i1/a1", type: "BANK" }],
    [{ id: "b1", itemId: "i1", accountId: "c1", due: "2026-10-15", closes: "2026-10-08", currency: "BRL", amount: 16300 }],
    [{ itemId: "i1", accountId: "c1", month: "2026-12", closes: "2026-11-08", due: "2026-11-15", purchases: [], imported: [],
      estimated: [{ amount: 2000, currency: "BRL" }], total: [{ amount: 60000, currency: "BRL" }], count: 1,
      entries: [{ id: "open-1" }], forecast: [] }],
    [{ itemId: "i1", accountId: "c1", month: "2026-12", amount: 5000, currency: "BRL", estimated: false },
      { itemId: "i1", accountId: "c1", month: "2026-12", amount: 5000, currency: "BRL", estimated: true }],
    rows, "2026-11-10");
  assert.equal(summary.bills.length, 1);
  assert.equal(summary.open.amount, 60000);
  assert.equal(summary.open.avista, 7000);
  assert.equal(summary.usage, 0.6);
  assert.equal(summary.average, 16300);
  assert.deepEqual(summary.future[1], { month: "2026-12", imported: 5000, estimated: 5000 });
});

test("destaques escolhem as maiores mudanças e cortam em cinco", () => {
  const found = insights({
    groups: [{ id: "alimentacao", label: "Alimentação fora", amount: 60000 }, { id: "compras", label: "Compras", amount: 10000 },
      { id: "casa", label: "Mercado e casa", amount: 41000 }],
    groupAverages: new Map([["alimentacao", 40000], ["compras", 30000], ["casa", 40000]]),
    recurring: [{ key: "A", label: "Streaming", typical: 2000, lastAmount: 2000, isNew: true, priceChanged: false },
      { key: "B", label: "Nuvem", typical: 1000, lastAmount: 1500, isNew: false, priceChanged: true }],
    pace: { isCurrent: true, projection: 150000, averageTotal: 100000 },
    nextInstallments: { month: "2026-12", amount: 200000 }, averageIncome: 500000,
    merchants: [{ key: "M", label: "Loja Nova", amount: 20000, previousRank: null }],
  });
  assert.equal(found.length, 5);
  assert.deepEqual(found.map((item) => item.id), ["parcelas", "ritmo", "nova-A", "alta-alimentacao", "queda-compras"]);
  assert.match(found[3].text, /Alimentação fora subiu 50%/);
  assert.equal(found[4].tone, "down");
  assert.equal(insights({ groups: [], groupAverages: new Map(), recurring: [], pace: { isCurrent: false, projection: null, averageTotal: 0 },
    nextInstallments: null, averageIncome: 0, merchants: [] }).length, 0);
});
