import assert from "node:assert/strict";
import test from "node:test";
import { cardCycle } from "../lib/card-cycle.mjs";
import { dashboard, openDatabase, writeBatch } from "../lib/db.mjs";

const card = { itemId: "item", id: "card", type: "CREDIT" };
const bill = (id, due, closes) => ({ id, accountId: card.id, due, closes });

test("prioriza fechamento informado e projeta um novo ciclo após o último fechamento", () => {
  const bills = [
    bill("a", "2026-09-14", "2026-09-06"),
    bill("b", "2026-10-14", "2026-10-06"),
    bill("c", "2026-11-10", "2026-11-02"),
  ];
  const reference = "2026-11-03";
  const historical = cardCycle({ ...card, due: "2026-11-10" }, bills, [], reference);
  assert.equal(historical.nextClosing, "2026-12-06");
  assert.equal(historical.lastClosing, "2026-11-02");
  assert.equal(historical.source, "history");
  assert.equal(cardCycle({ ...card, due: "2026-12-12" }, bills, [], reference).nextClosing, "2026-12-04");

  const futureBill = [...bills, bill("d", "2026-12-10", "2026-12-02")];
  assert.equal(cardCycle(card, futureBill, [], reference).source, "bill");
  const reported = cardCycle({ ...card, closes: "2026-12-01" }, futureBill, [], reference);
  assert.equal(reported.nextClosing, "2026-12-01");
  assert.equal(reported.source, "card");
  assert.equal(cardCycle(card, [bill("a", "2027-02-07", "2027-01-31")], [], "2027-02-08").nextClosing, "2027-02-28");
});

test("usa apenas compras vinculadas e elegíveis do próprio cartão quando não há fechamento oficial", (t) => {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(card.itemId, "owner", "Banco sintético", "CONECTADA", "2026-10-01");
  const older = bill("a", "2026-10-12", null);
  const newer = bill("b", "2026-11-12", null);
  const purchase = (id, billId, date, installment = null) => ({
    id, billId, date, installment, accountId: card.id, direction: "DEBIT", method: "Crédito",
  });
  writeBatch(db, card.itemId, [card], [
    purchase("one", "a", "2026-10-02"),
    purchase("two", "b", "2026-10-05"),
    purchase("excluded", "b", "2026-09-01", 2),
    { ...purchase("payment", "a", "2026-10-11"), direction: "CREDIT", method: "Fatura" },
  ], [older, newer]);
  const read = (owner) => dashboard(db, owner, "2026-11-01", "2026-11-08", "", "", "2026-11-08");
  const own = read("owner");
  assert.equal(own.entries.length, 0);
  assert.equal(own.cardCycles[0].source, "transactions");
  assert.equal(own.cardCycles[0].nextClosing, "2026-12-03");
  assert.deepEqual(read("another").cardCycles, []);
  assert.equal(cardCycle(card, [older], [], "2026-11-08").nextClosing, null);
});
