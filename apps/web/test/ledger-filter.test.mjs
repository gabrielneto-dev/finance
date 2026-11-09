import assert from "node:assert/strict";
import test from "node:test";
import { filterLedger } from "../lib/ledger-filter.ts";

const row = (id, accountId, method, time) => ({ id, itemId: "item", accountId, method, time });
const rows = [
  row("pix-manha", "banco", "Pix", "06:00"),
  row("pix-tarde", "banco", "Pix", "12:00"),
  row("pix-noite", "banco", "Pix", "18:00"),
  row("pix-madrugada", "banco", "Pix", "05:59"),
  row("pix-sem-horario", "banco", "Pix", null),
  row("sem-forma", "banco", null, "11:59"),
  row("credito-noite", "cartao", "Crédito", "23:00"),
  row("credito-sem-horario", "cartao", "Crédito", null),
];
const ids = (filters) => filterLedger(rows, filters).map(({ id }) => id);

test("mantém todos os lançamentos sem filtros", () => {
  assert.equal(ids({ account: "", method: "", hours: "" }).length, rows.length);
});

test("separa lançamentos sem horário e sem forma em filtros próprios", () => {
  assert.deepEqual(ids({ account: "", method: "", hours: "unknown" }), ["pix-sem-horario", "credito-sem-horario"]);
  assert.deepEqual(ids({ account: "", method: "Não informada", hours: "" }), ["sem-forma"]);
});

test("classifica as faixas de horário nos limites", () => {
  assert.deepEqual(ids({ account: "", method: "", hours: "morning" }), ["pix-manha", "sem-forma"]);
  assert.deepEqual(ids({ account: "", method: "", hours: "afternoon" }), ["pix-tarde"]);
  assert.deepEqual(ids({ account: "", method: "", hours: "night" }), ["pix-noite", "pix-madrugada", "credito-noite"]);
});

test("combina conta, forma e horário", () => {
  assert.deepEqual(ids({ account: "item/cartao", method: "Crédito", hours: "night" }), ["credito-noite"]);
  assert.deepEqual(ids({ account: "item/cartao", method: "Crédito", hours: "unknown" }), ["credito-sem-horario"]);
  assert.deepEqual(ids({ account: "item/banco", method: "Crédito", hours: "" }), []);
});
