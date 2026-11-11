import assert from "node:assert/strict";
import test from "node:test";
import { dashboard, openDatabase, writeBatch } from "../lib/db.mjs";
import { applyAction } from "../lib/planning/actions.mjs";
import { loadPlan, writeInvestments } from "../lib/planning/store.mjs";
import { planning } from "../lib/planning/index.mjs";

const TODAY = "2026-11-15";
const ITEM = "11111111-1111-4111-8111-111111111111";
const OTHER_ITEM = "22222222-2222-4222-8222-222222222222";

function setup() {
  const db = openDatabase(":memory:");
  const connect = (id, owner) => db.prepare("INSERT INTO connections (id,owner,name,status,baseline,synced_at) VALUES(?,?,?,?,?,?)")
    .run(id, owner, "Banco Sintético", "CONECTADA", "2026-01-01T00:00:00Z", "2026-11-01T00:00:00Z");
  connect(ITEM, "dono");
  connect(OTHER_ITEM, "outro");
  const account = (id, type = "BANK", balance = 100000) => ({ id, type, name: "Conta " + id, last4: null, currency: "BRL", balance, closes: null, due: null });
  let next = 0;
  const entry = (accountId, date, amount, extra = {}) => ({
    id: "t" + (next += 1), accountId, description: "Loja Sintética", date, time: null, status: "POSTED", direction: "DEBIT",
    amount, currency: "BRL", method: "Débito", category: "Groceries", billId: null, installment: null, installments: null, ...extra,
  });
  const entries = [];
  for (const month of ["2026-08", "2026-09", "2026-10"]) {
    entries.push(entry("conta", month + "-05", 500000, { direction: "CREDIT", category: "Salary", description: "SALARIO EMPRESA" }));
    entries.push(entry("conta", month + "-10", 200000));
    entries.push(entry("conta", month + "-12", 80000, { category: "Eating out", description: "Restaurante" }));
    entries.push(entry("conta", month + "-15", 50000, { category: "Fixed income", description: "Aplicação" }));
  }
  entries.push(entry("conta", "2026-11-03", 120000));
  entries.push(entry("conta", "2026-11-04", 30000, { category: "Eating out", description: "Restaurante" }));
  writeBatch(db, ITEM, [account("conta"), account("negocio", "BANK", 20000)], entries, []);
  writeBatch(db, OTHER_ITEM, [account("alheia")], [], []);
  return db;
}

const act = (db, body, owner = "dono") => applyAction(db, owner, body, TODAY);

test("migração idempotente e tabelas do planejamento vazias", () => {
  const db = setup();
  const plan = loadPlan(db, "dono");
  assert.deepEqual([plan.buckets, plan.goals, plan.adjustments, plan.investments], [[], [], [], []]);
  // Reabrir o mesmo banco não falha nem duplica.
  assert.doesNotThrow(() => db.exec("CREATE TABLE IF NOT EXISTS plan_buckets (id TEXT PRIMARY KEY)"));
});

test("caixinhas: cria, edita, recusa grupo repetido, ajusta o mês e respeita o dono", () => {
  const db = setup();
  const created = act(db, { action: "bucket-save", name: "  Fixos  ", kind: "fixos", mode: "valor", amount: 250000, groups: ["g:casa"], rollover: true });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(loadPlan(db, "dono").buckets[0].name, "Fixos");
  assert.equal(act(db, { action: "bucket-save", name: "Outra", kind: "livre", mode: "valor", amount: 1, groups: ["g:casa"] }).status, 409);
  assert.equal(act(db, { action: "bucket-save", id, name: "Fixos", kind: "fixos", mode: "percentual", amount: 5500, groups: ["g:casa", "c:delivery"] }).status, 200);
  assert.equal(act(db, { action: "bucket-month", id, month: "2026-11", amount: 300000 }).status, 200);
  assert.deepEqual(loadPlan(db, "dono").buckets[0].months, { "2026-11": 300000 });
  assert.equal(act(db, { action: "bucket-month", id, month: "2026-11", amount: null }).status, 200);
  // Outro dono não enxerga nem altera.
  assert.equal(act(db, { action: "bucket-save", id, name: "Invasão", kind: "fixos", mode: "valor", amount: 1, groups: [] }, "outro").status, 404);
  assert.equal(act(db, { action: "bucket-delete", id }, "outro").status, 404);
  assert.equal(act(db, { action: "bucket-month", id, month: "2026-11", amount: 1 }, "outro").status, 404);
  assert.equal(loadPlan(db, "outro").buckets.length, 0);
  const second = act(db, { action: "bucket-save", name: "Livre", kind: "livre", mode: "valor", amount: 100000, groups: [] }).body.id;
  assert.equal(act(db, { action: "bucket-order", ids: [second, id] }).status, 200);
  assert.deepEqual(loadPlan(db, "dono").buckets.map((row) => row.id), [second, id]);
  assert.equal(act(db, { action: "bucket-delete", id }).status, 200);
  assert.equal(loadPlan(db, "dono").buckets.length, 1);
});

test("recusa valores inválidos com mensagem e sem gravar", () => {
  const db = setup();
  for (const body of [
    { action: "bucket-save", name: "", kind: "fixos", mode: "valor", amount: 1, groups: [] },
    { action: "bucket-save", name: "X", kind: "ruim", mode: "valor", amount: 1, groups: [] },
    { action: "bucket-save", name: "X", kind: "fixos", mode: "valor", amount: 1.5, groups: [] },
    { action: "bucket-save", name: "X", kind: "fixos", mode: "percentual", amount: 10001, groups: [] },
    { action: "bucket-save", name: "X", kind: "fixos", mode: "valor", amount: 1, groups: ["g:entradas"] },
    { action: "bucket-save", name: "X\u0007", kind: "fixos", mode: "valor", amount: 1, groups: [] },
    { action: "goal-save", name: "Viagem", kind: "objetivo", source: "manual" },
    { action: "goal-save", name: "Viagem", kind: "objetivo", source: "manual", target: 100, deadline: "2026-13" },
    { action: "adjustment-save", kind: "corte", label: "Corte", startMonth: "2026-12", percent: 2000, group: "g:inexistente" },
    { action: "adjustment-save", kind: "renda", label: "Renda", startMonth: "2026-12" },
    { action: "investment-save", name: "CDB", class: "renda_fixa", liquidity: "diaria", balance: -1 },
    { action: "income-set", month: "2026-11", expected: "100" },
    { action: "desconhecida" },
    null, [], "texto",
  ]) {
    const result = act(db, body);
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(typeof result.body.error, "string");
  }
  const plan = loadPlan(db, "dono");
  assert.deepEqual([plan.buckets.length, plan.goals.length, plan.adjustments.length, plan.investments.length], [0, 0, 0, 0]);
});

test("metas, ajustes, investimentos manuais e conta do negócio com checagem de dono", () => {
  const db = setup();
  const investment = act(db, { action: "investment-save", name: "CDB Sintético", class: "renda_fixa", liquidity: "diaria", balance: 300000 });
  assert.equal(investment.status, 201);
  assert.equal(act(db, { action: "investment-balance", id: investment.body.id, balance: 320000, date: "2026-11-10" }).status, 200);
  assert.equal(act(db, { action: "investment-balance", id: investment.body.id, balance: 1, date: "2026-12-01" }).status, 400);
  assert.equal(act(db, { action: "investment-balance", id: investment.body.id, balance: 1 }, "outro").status, 404);
  const [saved] = loadPlan(db, "dono").investments;
  assert.equal(saved.balance, 320000);
  assert.deepEqual(saved.snapshots.map((row) => row.date), ["2026-11-10", TODAY]);

  const reserve = act(db, { action: "goal-save", name: "Reserva", kind: "reserva", source: "investimentos", link: [investment.body.id], monthly: 50000 });
  assert.equal(reserve.status, 201);
  assert.equal(act(db, { action: "goal-save", name: "Outra reserva", kind: "reserva", source: "manual" }).status, 409);
  assert.equal(act(db, { action: "goal-save", name: "Alheia", kind: "objetivo", source: "conta", target: 1000, link: OTHER_ITEM + "/alheia" }).status, 404);
  assert.equal(act(db, { action: "goal-save", name: "Conta", kind: "objetivo", source: "conta", target: 1000, link: ITEM + "/conta" }).status, 201);
  assert.equal(act(db, { action: "goal-delete", id: reserve.body.id }, "outro").status, 404);

  const adjustment = act(db, { action: "adjustment-save", kind: "renda", label: "Salário +10%", startMonth: "2027-03", percent: 1000 });
  assert.equal(adjustment.status, 201);
  assert.equal(act(db, { action: "adjustment-toggle", id: adjustment.body.id, enabled: false }).status, 200);
  assert.equal(loadPlan(db, "dono").adjustments[0].enabled, false);
  assert.equal(act(db, { action: "adjustment-toggle", id: adjustment.body.id, enabled: true }, "outro").status, 404);
  assert.equal(act(db, { action: "adjustment-delete", id: adjustment.body.id }).status, 200);

  assert.equal(act(db, { action: "account-business", itemId: OTHER_ITEM, accountId: "alheia", business: true }).status, 404);
  assert.equal(act(db, { action: "account-business", itemId: ITEM, accountId: "negocio", business: true }).status, 200);
  assert.deepEqual(dashboard(db, "dono", "2026-11-01", "2026-11-30").accounts.map((row) => [row.id, row.business]).sort(),
    [["conta", false], ["negocio", true]]);
  assert.equal(act(db, { action: "investment-delete", id: investment.body.id }, "outro").status, 404);
  assert.equal(act(db, { action: "investment-delete", id: investment.body.id }).status, 200);
});

test("sugestão pelo Plano Consciente cria as caixinhas e o mês bate com as despesas", () => {
  const db = setup();
  assert.equal(act(db, { action: "bucket-suggest", month: "2026-11" }).status, 200);
  const data = planning(db, "dono", { month: "2026-11", horizon: 12, reference: TODAY });
  assert.deepEqual(data.budget.buckets.map((row) => row.kind), ["fixos", "livre", "investir", "reservas"]);
  assert.equal(data.income.expected, 500000);
  const fixos = data.budget.buckets.find((row) => row.kind === "fixos");
  // Média de 200.000 encaixada em 50% a 60% de 500.000.
  assert.equal(fixos.planned, 250000);
  assert.equal(fixos.spent, 120000);
  assert.equal(data.budget.buckets.find((row) => row.kind === "livre").spent, 30000);
  assert.equal(data.budget.spent, 150000);
  assert.equal(data.budget.unassigned, 0);
  // Repetir a sugestão não duplica.
  act(db, { action: "bucket-suggest", month: "2026-11" });
  assert.equal(loadPlan(db, "dono").buckets.length, 4);
  assert.equal(data.projection.base.length, 12);
  assert.equal(planning(db, "dono", { month: "2026-11", horizon: 24, reference: TODAY }).projection.adjusted.length, 24);
});

test("investimentos da Pluggy: atualiza, guarda snapshot e remove os que sumiram", () => {
  const db = setup();
  const row = (externalId, balance) => ({ externalId, name: "Fundo " + externalId, institution: "Corretora", class: "fundos", liquidity: "diaria", balance, dueDate: null });
  writeInvestments(db, ITEM, [row("a", 1000), row("b", 2000)], "2026-11-10");
  writeInvestments(db, ITEM, [row("a", 1500)], "2026-11-11");
  const list = loadPlan(db, "dono").investments;
  assert.deepEqual(list.map((item) => [item.name, item.balance, item.source]), [["Fundo a", 1500, "pluggy"]]);
  assert.deepEqual(list[0].snapshots.map((item) => item.balance), [1000, 1500]);
  // Investimento da Pluggy não é editado nem apagado pela ação manual.
  assert.equal(act(db, { action: "investment-balance", id: list[0].id, balance: 1 }).status, 404);
  assert.equal(loadPlan(db, "outro").investments.length, 0);
});
