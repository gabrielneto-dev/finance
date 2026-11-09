import assert from "node:assert/strict";
import test from "node:test";
import { dashboard, openDatabase, writeBatch } from "../lib/db.mjs";
import { normalizeTransaction } from "../lib/pluggy.mjs";

const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const itemId = id(1);
const accountId = id(2);

function purchase(n, installmentNumber, billForecastDate, metadata = {}) {
  return normalizeTransaction({
    id: id(n), accountId, date: "2026-10-21T00:00:00Z", description: "Compra sintética", currencyCode: "BRL",
    amount: "19.99", type: "DEBIT", status: "PENDING",
    creditCardMetadata: {
      purchaseDate: "2026-10-21T12:00:00Z", cardNumber: "1234567812345678",
      installmentNumber, totalInstallments: 5, billForecastDate, ...metadata,
    },
  }, accountId);
}

test("usa todo o histórico do cartão e substitui previsões quando chegam parcelas reais", (t) => {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(itemId, "owner", "Banco sintético", "CONECTADA", "2026-10-01");
  const account = { id: accountId, type: "CREDIT" };
  const first = purchase(3, 1, "2026-11");
  const third = purchase(5, 3, "2027-01");
  assert.doesNotMatch(JSON.stringify(first), /1234567812345678/);
  writeBatch(db, itemId, [account], [first, third], []);
  const result = () => dashboard(db, "owner", "2026-11-01", "2026-11-08", "2026-11");
  const schedule = () => result().installments.map(({ installment, month, amount, estimated }) =>
    [installment, month, amount, estimated]);
  assert.deepEqual(schedule(), [
    [1, "2026-11", 1999, false], [2, "2026-12", 1999, true], [3, "2027-01", 1999, false],
    [4, "2027-02", 1999, true], [5, "2027-03", 1999, true],
  ]);
  assert.equal(result().entries.length, 0);
  assert.equal(dashboard(db, "other", "2026-11-01", "2026-11-08", "2026-11").installments.length, 0);

  const second = purchase(4, 2, "2027-01", { billId: id(8) });
  writeBatch(db, itemId, [], [second, second], [{ id: id(8), accountId, due: "2026-12-14" }]);
  assert.deepEqual(schedule().filter(([position]) => position === 2), [[2, "2026-12", 1999, false]]);
  assert.equal(result().installments.find((row) => row.installment === 2).billId, id(8));
  assert.ok(result().installments.filter((row) => row.estimated).every((row) => row.billId === null));

  const otherAccount = id(9);
  writeBatch(db, itemId, [{ id: otherAccount, type: "CREDIT" }], [
    { ...second, id: id(10), accountId: otherAccount },
    { ...second, id: id(11), installment: null, installments: null },
  ], []);
  const invoice = (owner) => dashboard(db, owner, "2026-11-01", "2026-11-08", "", id(8));
  assert.equal(invoice("owner").entries.length, 0);
  assert.deepEqual(invoice("owner").billPurchases.entries.map((row) => row.id), [id(4), id(11)]);
  assert.equal(invoice("other").billPurchases.entries.length, 0);
});

test("mantém parcelas recebidas e omite estimativas de compras ambíguas ou sem metadados", (t) => {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(itemId, "owner", "Banco sintético", "CONECTADA", "2026-10-01");
  writeBatch(db, itemId, [{ id: accountId, type: "CREDIT" }], [
    purchase(3, 1, "2026-11"), purchase(4, 1, "2026-11"), purchase(5, 2, "2026-12", { purchaseDate: null }),
  ], []);
  const rows = dashboard(db, "owner", "2026-11-01", "2026-11-08", "2026-11").installments;
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => !row.estimated));
});

test("posiciona parcelas sem fatura pelo ciclo de fechamento do cartão", (t) => {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(itemId, "owner", "Banco sintético", "CONECTADA", "2026-08-01");
  const bills = [
    { id: id(20), accountId, closes: "2026-09-02", due: "2026-09-10" },
    { id: id(21), accountId, closes: "2026-10-05", due: "2026-10-10" },
    { id: id(22), accountId, closes: "2026-11-03", due: "2026-11-10" },
  ];
  // O provedor informa o mês da compra em billForecastDate, não o mês de vencimento.
  const pending = (n, date, total) => normalizeTransaction({
    id: id(n), accountId, date: date + "T00:00:00Z", description: "Compra sintética " + n, currencyCode: "BRL",
    amount: "10.00", type: "DEBIT", status: "PENDING",
    creditCardMetadata: {
      purchaseDate: date + "T12:00:00Z", installmentNumber: 1, totalInstallments: total,
      billForecastDate: date.slice(0, 7),
    },
  }, accountId);
  writeBatch(db, itemId, [{ id: accountId, type: "CREDIT" }], [
    pending(30, "2026-11-06", 3), pending(31, "2026-11-03", 2), pending(32, "2026-12-05", 2),
    { ...pending(33, "2026-11-04", 2), status: "POSTED" },
  ], bills);
  const rows = dashboard(db, "owner", "2026-11-01", "2026-11-08", "2026-11").installments;
  const months = (n) => rows.filter((row) => row.description === "Compra sintética " + n)
    .map(({ installment, month }) => [installment, month]);
  // Compra após o último fechamento entra na fatura seguinte.
  assert.deepEqual(months(30), [[1, "2026-12"], [2, "2027-01"], [3, "2027-02"]]);
  // Compra no dia do fechamento também vai para o ciclo seguinte.
  assert.deepEqual(months(31), [[1, "2026-12"], [2, "2027-01"]]);
  // Compra após o fechamento projetado de dezembro vai para janeiro.
  assert.deepEqual(months(32), [[1, "2027-01"], [2, "2027-02"]]);
  // Lançamento efetivado sem fatura não é deslocado para o ciclo aberto.
  assert.deepEqual(months(33), [[1, "2026-11"], [2, "2026-12"]]);
});

test("usa a fatura oficial ainda aberta como ciclo das parcelas pendentes", (t) => {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(itemId, "owner", "Banco sintético", "CONECTADA", "2026-08-01");
  const bills = [
    { id: id(40), accountId, closes: "2026-10-05", due: "2026-10-10" },
    { id: id(41), accountId, closes: "2026-11-03", due: "2026-11-10" },
    // Fatura do ciclo atual, devolvida antes do fechamento e com data diferente da habitual.
    { id: id(42), accountId, closes: "2026-12-01", due: "2026-12-08" },
  ];
  const pending = (n, date) => normalizeTransaction({
    id: id(n), accountId, date: date + "T00:00:00Z", description: "Compra sintética " + n, currencyCode: "BRL",
    amount: "10.00", type: "DEBIT", status: "PENDING",
    creditCardMetadata: {
      purchaseDate: date + "T12:00:00Z", installmentNumber: 1, totalInstallments: 2, billForecastDate: date.slice(0, 7),
    },
  }, accountId);
  writeBatch(db, itemId, [{ id: accountId, type: "CREDIT" }], [pending(50, "2026-11-06")], bills);
  const months = (reference) => dashboard(db, "owner", "2026-11-01", "2026-11-08", reference).installments
    .map(({ installment, month }) => [installment, month]);
  assert.deepEqual(months("2026-11-08"), [[1, "2026-12"], [2, "2027-01"]]);
  // Sem a data de referência, o comportamento anterior é mantido para chamadas por mês.
  assert.equal(months("2026-11")[0][0], 1);
});
