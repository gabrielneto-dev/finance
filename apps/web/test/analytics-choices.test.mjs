import assert from "node:assert/strict";
import test from "node:test";
import { loadChoices, parseChoice, setEntryChoice, setRuleChoice } from "../lib/analytics/choices.mjs";
import { dashboard, openDatabase, writeBatch } from "../lib/db.mjs";

const pix = (id, description) => ({
  id, accountId: "a1", date: "2026-10-05", time: null, description, status: "POSTED", direction: "DEBIT",
  amount: 5000, currency: "BRL", method: "Pix", category: "Transfer - PIX", billId: null, installment: null, installments: null,
});

function setup() {
  const db = openDatabase(":memory:");
  const insert = db.prepare("INSERT INTO connections (id,owner,name,status,baseline,active) VALUES(?,?,?,?,?,?)");
  insert.run("i1", "owner-a", "Banco Sintético", "CONECTADA", "2026-10-01T00:00:00Z", 1);
  insert.run("i2", "owner-a", "Banco Inativo", "REMOVENDO", "2026-10-01T00:00:00Z", 0);
  const account = { id: "a1", name: "Conta", type: "BANK", currency: "BRL", balance: 0 };
  writeBatch(db, "i1", [account], [pix("e1", "PIX ENVIADO   Academia Sintetica"), pix("e2", "PIX ENVIADO   Academia Sintetica"),
    pix("e3", "PIX ENVIADO   Outra Pessoa")], []);
  writeBatch(db, "i2", [account], [pix("e9", "PIX ENVIADO   Inativo")], []);
  return db;
}
const choiceOf = (db, id) => dashboard(db, "owner-a", "2026-10-01", "2026-10-31").entries.find((row) => row.id === id).choice;

test("valida o pedido de categoria", () => {
  assert.deepEqual(parseChoice({ itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" }),
    { itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" });
  assert.equal(parseChoice({ itemId: "i1", accountId: "a1", entryId: "e1", category: "" }).category, null);
  assert.equal(parseChoice({ itemId: "i1", accountId: "a1", entryId: "e1", category: "inexistente" }), null);
  assert.equal(parseChoice({ itemId: "", accountId: "a1", entryId: "e1", category: "academia" }), null);
  assert.equal(parseChoice({ itemId: 1, accountId: "a1", entryId: "e1", category: "academia" }), null);
  assert.equal(parseChoice(null), null);
});

test("grava a escolha do lançamento só para o dono e numa conexão ativa", () => {
  const db = setup();
  assert.equal(setEntryChoice(db, "owner-b", { itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" }), false);
  assert.equal(setEntryChoice(db, "owner-a", { itemId: "i2", accountId: "a1", entryId: "e9", category: "academia" }), false);
  assert.equal(setEntryChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "nao-existe", category: "academia" }), false);
  assert.equal(setEntryChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" }), true);
  assert.deepEqual(choiceOf(db, "e1"), { value: "academia", source: "lancamento" });
  assert.equal(choiceOf(db, "e2"), null);
  assert.equal(loadChoices(db, "owner-b").entries.size, 0);

  // Vazio remove.
  assert.equal(setEntryChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e1", category: null }), true);
  assert.equal(choiceOf(db, "e1"), null);
});

test("regra do estabelecimento vale para todos e cede à escolha do lançamento", () => {
  const db = setup();
  setEntryChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e2", category: "lazer" });
  assert.equal(setRuleChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" }), "ACADEMIA SINTETICA");
  assert.deepEqual(choiceOf(db, "e1"), { value: "academia", source: "estabelecimento" });
  assert.deepEqual(choiceOf(db, "e2"), { value: "lazer", source: "lancamento" });
  assert.equal(choiceOf(db, "e3"), null);
  assert.equal(setRuleChoice(db, "owner-b", { itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" }), null);

  // A regra criada a partir do e2 remove a escolha própria dele.
  setRuleChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e2", category: "ignorar" });
  assert.deepEqual(choiceOf(db, "e2"), { value: "ignorar", source: "estabelecimento" });
  setRuleChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e2", category: null });
  assert.equal(choiceOf(db, "e1"), null);
});

test("reimportar os lançamentos preserva as escolhas", () => {
  const db = setup();
  setEntryChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e3", category: "delivery" });
  setRuleChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" });
  writeBatch(db, "i1", [{ id: "a1", name: "Conta", type: "BANK", currency: "BRL", balance: 0 }],
    [pix("e1", "PIX ENVIADO   Academia Sintetica"), pix("e3", "PIX ENVIADO   Outra Pessoa")], []);
  assert.equal(choiceOf(db, "e3").value, "delivery");
  assert.equal(choiceOf(db, "e1").value, "academia");
});

test("as análises usam só os dados do dono e respeitam a categoria escolhida", async () => {
  const { analytics } = await import("../lib/analytics/index.mjs");
  const db = setup();
  const options = { from: "2026-10-01", to: "2026-10-31", reference: "2026-11-10" };
  const before = analytics(db, "owner-a", options);
  assert.equal(before.totals.current.expense, 15000);
  assert.deepEqual(before.groups.map((group) => group.id), ["terceiros"]);
  setRuleChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e1", category: "academia" });
  setEntryChoice(db, "owner-a", { itemId: "i1", accountId: "a1", entryId: "e3", category: "ignorar" });
  const after = analytics(db, "owner-a", options);
  assert.equal(after.totals.current.expense, 10000);
  assert.deepEqual(after.groups.map((group) => [group.id, group.amount]), [["lazer", 10000]]);
  assert.equal(after.totals.current.neutral.ignorado, 5000);
  assert.equal(analytics(db, "owner-b", options).entries.length, 0);
  assert.equal(analytics(db, "owner-a", { ...options, account: "i1/outra" }).entries.length, 0);
});
