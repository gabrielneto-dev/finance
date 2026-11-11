import assert from "node:assert/strict";
import test from "node:test";
import { openBill } from "../lib/open-bill.mjs";

const card = { itemId: "i1", id: "c1" };
const bills = [
  { id: "b1", itemId: "i1", accountId: "c1", closes: "2026-09-03", due: "2026-09-10" },
  { id: "b2", itemId: "i1", accountId: "c1", closes: "2026-10-05", due: "2026-10-10" },
  { id: "b3", itemId: "i1", accountId: "c1", closes: "2026-11-03", due: "2026-11-10" },
];
const cycle = { itemId: "i1", accountId: "c1", nextClosing: "2026-12-03", lastClosing: "2026-11-03", source: "history" };
let sequence = 0;
const entry = (amount, date, extra = {}) => ({
  id: "e" + ++sequence, itemId: "i1", accountId: "c1", date, amount, currency: "BRL", direction: "DEBIT",
  status: "PENDING", method: "Crédito", billId: null, installment: null, installments: null, ...extra,
});
const parcel = (amount, month, estimated, extra = {}) => ({
  id: "p" + ++sequence, itemId: "i1", accountId: "c1", amount, currency: "BRL", month, estimated, ...extra,
});

test("soma compras do ciclo aberto, estornos e parcelas do mês de vencimento", () => {
  const entries = [
    entry(1000, "2026-11-05"),
    entry(500, "2026-11-02"), // chegou depois do fechamento e entra no ciclo aberto
    entry(300, "2026-11-06", { status: "POSTED" }),
    entry(200, "2026-11-07", { direction: "CREDIT" }),
    entry(999, "2026-10-01", { status: "POSTED" }),
    entry(888, "2026-11-08", { method: "Fatura" }),
    entry(777, "2026-11-08", { installment: 2, installments: 3 }),
    entry(666, "2026-11-08", { accountId: "c2" }),
    entry(40, "2026-11-08", { currency: "USD" }),
  ];
  const schedule = [
    parcel(150, "2026-12", false), parcel(250, "2026-12", true),
    parcel(999, "2027-01", true), parcel(555, "2026-12", true, { accountId: "c2" }),
  ];
  const bill = openBill({ card, bills, entries, schedule, cycle, reference: "2026-11-10" });
  assert.equal(bill.month, "2026-12");
  assert.equal(bill.closes, "2026-12-03");
  assert.equal(bill.due, "2026-12-10");
  assert.deepEqual(bill.purchases, [{ amount: 1600, currency: "BRL" }, { amount: 40, currency: "USD" }]);
  assert.deepEqual(bill.imported, [{ amount: 150, currency: "BRL" }]);
  assert.deepEqual(bill.estimated, [{ amount: 250, currency: "BRL" }]);
  assert.deepEqual(bill.total, [{ amount: 2000, currency: "BRL" }, { amount: 40, currency: "USD" }]);
  assert.equal(bill.count, 7);
  assert.deepEqual(bill.entries.map((row) => row.amount), [40, 200, 300, 1000, 500]);
  assert.deepEqual(bill.forecast.map((row) => row.amount), [150, 250]);
});

test("lista a parcela importada com o lançamento original", () => {
  const installment = entry(120, "2026-11-20", { installment: 2, installments: 4 });
  const schedule = [parcel(120, "2026-12", false, { id: installment.id }), parcel(120, "2026-12", true)];
  const bill = openBill({ card, bills, entries: [entry(80, "2026-11-21"), installment], schedule, cycle, reference: "2026-11-10" });
  assert.deepEqual(bill.entries.map((row) => [row.date, row.amount]), [["2026-11-21", 80], ["2026-11-20", 120]]);
  assert.deepEqual(bill.forecast.map((row) => row.estimated), [true]);
});

test("omite o vencimento fora do mês do ciclo e devolve vazio sem histórico de faturas", () => {
  const late = openBill({ card, bills, entries: [], schedule: [], reference: "2026-11-10",
    cycle: { ...cycle, nextClosing: "2026-12-28" } });
  assert.equal(late.month, "2026-12");
  assert.equal(late.due, null);
  assert.deepEqual(late.total, []);
  assert.equal(openBill({ card, bills: [], entries: [entry(100, "2026-11-05")], schedule: [], cycle, reference: "2026-11-10" }), null);
});

test("ignora pendente anterior ao ciclo já fechado", () => {
  const entries = [
    entry(100, "2026-11-05"),
    entry(70, "2026-10-20"), // pendente do ciclo anterior que ainda pode entrar
    entry(30, "2026-08-10"), // autorização antiga que nunca se confirmou
  ];
  const bill = openBill({ card, bills, entries, schedule: [], cycle, reference: "2026-11-10" });
  assert.deepEqual(bill.purchases, [{ amount: 170, currency: "BRL" }]);
});

test("usa o valor cobrado em reais nas compras em outra moeda", () => {
  const entries = [
    entry(100, "2026-11-05"),
    entry(1000, "2026-11-06", { currency: "USD", accountAmount: 5530, accountCurrency: "BRL" }),
    entry(40, "2026-11-07", { currency: "USD" }), // sem valor convertido, permanece em dólar
  ];
  const bill = openBill({ card, bills, entries, schedule: [], cycle, reference: "2026-11-10" });
  assert.deepEqual(bill.purchases, [{ amount: 5630, currency: "BRL" }, { amount: 40, currency: "USD" }]);
  assert.deepEqual(bill.total, [{ amount: 5630, currency: "BRL" }, { amount: 40, currency: "USD" }]);
});

test("deixa fora o pagamento da fatura lançado no cartão como pagamento ou transferência própria", () => {
  const entries = [
    entry(100, "2026-11-05"),
    entry(900, "2026-11-06", { direction: "CREDIT", status: "POSTED", category: "Credit card payment" }),
    entry(500, "2026-11-08", { direction: "CREDIT", category: "Transfer - Internal" }), // pagamento como transferência própria
    entry(20, "2026-11-07", { direction: "CREDIT", category: "Shopping" }), // estorno continua abatendo
  ];
  const bill = openBill({ card, bills, entries, schedule: [], cycle, reference: "2026-11-10" });
  assert.deepEqual(bill.purchases, [{ amount: 80, currency: "BRL" }]);
  assert.equal(bill.entries.some((row) => row.direction === "CREDIT" && row.category !== "Shopping"), false);
});
