import assert from "node:assert/strict";
import test from "node:test";
import { classify } from "../lib/analytics/classify.mjs";
import { merchantKey } from "../lib/analytics/merchant.mjs";
import { expectedIncome, incomeSeries, monthlyIncome } from "../lib/planning/income.mjs";
import { frameworkSpending, frameworkStatus, keyMap, spentByBucket, suggestBuckets } from "../lib/planning/buckets.mjs";
import { baseAmount, carryOver, monthBudget, monthClock, status } from "../lib/planning/budget.mjs";
import { evaluateGoal, evaluateGoals, monthlyRate, monthsToReach, monthsUntil, requiredMonthly } from "../lib/planning/goals.mjs";
import { projection, scenario } from "../lib/planning/projection.mjs";
import { monthlyChange, slope, trends } from "../lib/planning/trends.mjs";
import { balanceAt, contributions, networth } from "../lib/planning/networth.mjs";
import { businessMonth, businessReport, profitFirst } from "../lib/planning/business.mjs";
import { parseAdjustment, parseGoal, parseInvestment, parsePlanningQuery } from "../lib/planning/validate.mjs";

let next = 0;
const entry = (date, amount, extra = {}) => ({
  id: "e" + (next += 1), itemId: "i1", accountId: "a1", description: "Loja Sintética", date, time: null,
  status: "POSTED", direction: "DEBIT", amount, currency: "BRL", method: "Débito", category: "Groceries",
  billId: null, installment: null, installments: null, ...extra,
});
const row = (value, options = {}) => ({
  entry: value, info: classify(value, options), account: value.itemId + "/" + value.accountId,
  accountType: options.accountType ?? "BANK", merchant: merchantKey(value.description),
});
const choice = (value) => ({ choice: { value, source: "lancamento" } });

test("renda prevista: mediana do salário, média das outras receitas e do lucro, e valor manual", () => {
  const rows = [
    row(entry("2026-08-05", 500000, { direction: "CREDIT", category: "Salary" })),
    row(entry("2026-09-05", 520000, { direction: "CREDIT", category: "Salary" })),
    row(entry("2026-10-05", 900000, { direction: "CREDIT", category: "Salary" })),
    row(entry("2026-10-06", 30000, { direction: "CREDIT", category: "Transfer - PIX" })),
    row(entry("2026-10-07", 60000, { direction: "CREDIT" }), choice("negocio_vendas")),
  ];
  const history = monthlyIncome(rows, ["2026-08", "2026-09", "2026-10", "2026-11"]);
  const november = expectedIncome(history, "2026-11");
  assert.deepEqual(november.parts, { salary: 520000, other: 10000, business: 20000 });
  assert.equal(november.expected, 550000);
  assert.deepEqual(november.basis, ["2026-08", "2026-09", "2026-10"]);
  assert.equal(expectedIncome(history, "2026-11", { "2026-11": 480000 }).expected, 480000);
  assert.equal(expectedIncome([], "2026-11").expected, 0);
  // Meses futuros usam a base de meses completos do mês atual, não o mês corrente parcial nem meses vazios.
  const partial = [...rows, row(entry("2026-11-05", 100, { direction: "CREDIT", category: "Salary" }))];
  const withPartial = monthlyIncome(partial, ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(incomeSeries(withPartial, "2026-12", 3, {}, "2026-11").map((item) => item.expected), [550000, 550000, 550000]);
  assert.notEqual(incomeSeries(withPartial, "2027-01", 1)[0].expected, 550000);
  // Um mês passado continua usando os meses anteriores a ele.
  assert.deepEqual(expectedIncome(withPartial, "2026-10", {}, "2026-11").basis, ["2026-08", "2026-09"]);
});

test("caixinhas: categoria vence o grupo, aporte entra só na caixinha de investir e sugestão encaixa nas faixas", () => {
  const rows = [
    row(entry("2026-10-03", 100000)),
    row(entry("2026-10-04", 20000, { category: "Food delivery" })),
    row(entry("2026-10-05", 10000, { category: "Eating out" })),
    row(entry("2026-10-06", 50000, { category: "Fixed income" })),
    row(entry("2026-10-07", 10000, { direction: "CREDIT", category: "Fixed income" })),
  ];
  const lookup = keyMap([{ id: "casa", groups: ["g:casa", "c:delivery"] }, { id: "lazer", groups: ["g:alimentacao"] }, { id: "inv", groups: ["k:investimento"] }]);
  const spent = spentByBucket(rows, lookup);
  assert.equal(spent.get("casa").get("2026-10"), 120000);
  assert.equal(spent.get("lazer").get("2026-10"), 10000);
  assert.equal(spent.get("inv").get("2026-10"), 40000);
  assert.equal(spentByBucket(rows, keyMap([])).get(null).get("2026-10"), 130000);

  const many = [];
  for (const month of ["2026-08", "2026-09", "2026-10"]) {
    many.push(row(entry(month + "-03", 400000)), row(entry(month + "-04", 50000, { category: "Eating out" })));
  }
  const suggestion = suggestBuckets(many, "2026-11", 500000, 30000);
  const amount = (kind) => suggestion.find((item) => item.kind === kind).amount;
  assert.equal(amount("fixos"), 300000); // 400.000 limitado a 60%
  assert.equal(amount("livre"), 100000); // 50.000 elevado a 20%
  assert.equal(amount("investir"), 50000); // nenhum aporte, mínimo de 10%
  assert.equal(amount("reservas"), 30000); // aportes das metas, dentro de 5% a 10%
  assert.equal(suggestBuckets(many, "2026-11", 0).find((item) => item.kind === "fixos").amount, 400000);

  // O gasto real vem dos grupos do framework, mesmo sem caixinhas criadas.
  const actual = frameworkSpending(rows, "2026-10");
  assert.deepEqual([actual.get("fixos"), actual.get("livre"), actual.get("investir")], [100000, 30000, 40000]);
  const status = frameworkStatus([{ kind: "reservas", planned: 40000 }], 200000, actual);
  // Fixos 50%, livre 15%, investir 20% e reservas 20% sobre a renda de 200.000.
  assert.deepEqual(status.map((item) => item.position), ["dentro", "abaixo", "dentro", "acima"]);
  assert.equal(frameworkStatus([], 0, actual)[0].share, null);
});

test("mês: planejado com acúmulo, ajuste do mês, ritmo, situação e valor por dia", () => {
  const bucket = { id: "b", name: "Mercado", kind: "fixos", mode: "valor", amount: 100000, months: {}, rollover: true, start: "2026-09",
    archived: false, groups: ["g:casa"], sort: 0 };
  const spent = new Map([["b", new Map([["2026-09", 60000], ["2026-10", 130000], ["2026-11", 50000]])], [null, new Map([["2026-11", 7000]])]]);
  const incomeOf = () => 500000;
  // Setembro sobra 40.000; outubro gasta 130.000 de 140.000 e sobra 10.000.
  assert.equal(carryOver(bucket, "2026-11", incomeOf, (month) => spent.get("b").get(month) ?? 0), 10000);
  assert.equal(carryOver({ ...bucket, rollover: false }, "2026-11", incomeOf, () => 0), 0);
  const result = monthBudget({ buckets: [bucket], spent, month: "2026-11", reference: "2026-11-15", incomeOf });
  const [item] = result.buckets;
  assert.deepEqual([item.base, item.carry, item.planned, item.spent, item.available], [100000, 10000, 110000, 50000, 60000]);
  assert.equal(item.expectedToday, 55000);
  assert.equal(item.perDay, 3750); // 60.000 em 16 dias
  assert.equal(item.status, "dentro");
  assert.equal(result.unassigned, 7000);
  assert.equal(result.spent, 57000);
  assert.equal(result.unallocated, 400000);

  assert.equal(baseAmount({ mode: "percentual", amount: 5500, months: {} }, "2026-11", 500000), 275000);
  assert.equal(baseAmount({ mode: "valor", amount: 1, months: { "2026-11": 9 } }, "2026-11", 0), 9);
  const clock = monthClock("2026-11", "2026-11-15");
  assert.equal(status(100000, 101000, clock), "estourou");
  assert.equal(status(100000, 86000, clock), "atencao");
  assert.equal(status(100000, 60000, clock), "atencao"); // ritmo de 120.000
  assert.equal(status(100000, 40000, clock), "dentro");
  assert.deepEqual([monthClock("2026-10", "2026-11-15").remaining, monthClock("2026-12", "2026-11-15").elapsed], [0, 0]);
  const past = monthBudget({ buckets: [bucket], spent, month: "2026-10", reference: "2026-11-15", incomeOf }).buckets[0];
  assert.deepEqual([past.perDay, past.status], [null, "dentro"]);
  assert.equal(monthBudget({ buckets: [{ ...bucket, archived: true }], spent, month: "2026-11", reference: "2026-11-15", incomeOf }).buckets.length, 0);
});

test("metas: aporte necessário com juros, data prevista, reserva e regra dos 4%", () => {
  assert.equal(requiredMonthly(120000, 0, 12), 10000);
  assert.equal(requiredMonthly(100, 200, 5), 0);
  assert.equal(requiredMonthly(1000, 0, 0), 1000);
  const rate = monthlyRate(1200);
  assert.ok(rate > 0.0094 && rate < 0.0095);
  assert.ok(requiredMonthly(120000, 0, 12, rate) < 10000);
  assert.equal(monthsToReach(120000, 0, 10000), 12);
  assert.equal(monthsToReach(120000, 0, 0), null);
  assert.equal(monthsToReach(100, 100, 0), 0);
  assert.equal(monthsUntil("2026-11", "2027-04"), 6);

  const context = { month: "2026-11", essentialAverage: 300000, annualSpending: 6000000, investments: new Map([["inv", 600000]]), accounts: new Map([["i/a", 50000]]) };
  const reserve = evaluateGoal({ id: "r", name: "Reserva", kind: "reserva", target: null, months: null, deadline: "2027-10", monthly: 100000,
    yieldRate: 0, source: "investimentos", current: 0, link: ["inv"], priority: 0 }, context);
  assert.deepEqual([reserve.target, reserve.current, reserve.remaining, reserve.covered], [1800000, 600000, 1200000, 2]);
  assert.equal(reserve.required, 100000);
  assert.deepEqual([reserve.eta, reserve.etaMonth, reserve.situation], [12, "2027-10", "no_prazo"]);
  const late = evaluateGoal({ id: "o", name: "Carro", kind: "objetivo", target: 1000000, months: null, deadline: "2027-04", monthly: 100000,
    yieldRate: 0, source: "conta", current: 0, link: "i/a", priority: 1 }, context);
  assert.deepEqual([late.current, late.etaMonth, late.situation, late.delay], [50000, "2027-08", "atrasada", 4]);
  const free = evaluateGoal({ id: "f", name: "Independência", kind: "independencia", target: null, months: null, deadline: null, monthly: 0,
    yieldRate: 0, source: "manual", current: 0, link: null, priority: 2 }, context);
  assert.deepEqual([free.target, free.situation], [150000000, "sem_aporte"]);
  const ordered = evaluateGoals([{ ...late, target: 1000000 }, { ...reserve, target: null, months: 3 }], context);
  assert.equal(ordered[0].kind, "reserva");
  assert.equal(ordered[0].target, 900000);
});

test("projeção: base e ajustado, com efeito de cada ajuste e parcelas comprometidas", () => {
  const input = {
    months: ["2026-12", "2027-01", "2027-02"], incomeOf: () => 500000,
    buckets: [{ kind: "fixos", groups: ["g:casa"], baseOf: () => 250000 }, { kind: "investir", groups: ["k:investimento"], baseOf: () => 50000 }],
    unassignedAverage: 50000, groupAverage: (key) => key === "g:alimentacao" ? 100000 : 0, goalsMonthly: 0,
    installments: new Map([["2027-01", 20000]]), cash: 100000, invested: 0, debt: 0, yieldRate: 0,
  };
  const base = scenario(input, []);
  assert.deepEqual(base.map((item) => item.surplus), [150000, 130000, 150000]);
  assert.equal(base.at(-1).cash, 530000);
  assert.equal(base.at(-1).investments, 150000);
  assert.equal(base[0].networth, 100000 + 150000 + 50000 - 20000);
  const adjustments = [
    { id: "r", kind: "renda", label: "Salário +10%", startMonth: "2027-01", endMonth: null, amount: null, percent: 1000, group: null, enabled: true },
    { id: "c", kind: "corte", label: "Cortar 20%", startMonth: "2026-12", endMonth: null, amount: null, percent: 2000, group: "g:alimentacao", enabled: true },
    { id: "e", kind: "evento", label: "IPVA", startMonth: "2027-01", endMonth: "2027-01", amount: 150000, percent: null, group: null, enabled: false },
    { id: "a", kind: "aporte", label: "Extra", startMonth: "2026-12", endMonth: null, amount: 10000, percent: null, group: null, enabled: true },
    { id: "x", kind: "evento", label: "13º", startMonth: "2026-12", endMonth: "2026-12", amount: -40000, percent: null, group: null, enabled: false },
  ];
  const result = projection(input, adjustments);
  const effect = (id) => result.effects.find((item) => item.id === id).delta;
  assert.equal(effect("r"), 100000);
  assert.equal(effect("c"), 60000);
  assert.equal(effect("e"), -150000);
  assert.equal(effect("a"), 0); // aporte troca saldo em conta por investimento
  assert.equal(effect("x"), 40000);
  assert.equal(result.difference, 160000);
  assert.equal(result.adjusted[1].income, 550000);
  // Sem caixinhas de investir, os aportes das metas viram o investido.
  assert.equal(scenario({ ...input, buckets: [], goalsMonthly: 30000 }, [])[0].invested, 30000);
});

test("tendências: alta consistente, acima do planejado e recorrência nova", () => {
  assert.equal(slope([1, 2, 3]), 1);
  assert.equal(slope([5]), 0);
  assert.equal(monthlyChange([0, 0, 0]), 0);
  const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const rows = months.flatMap((month, index) => [
    row(entry(month + "-10", 10000 * (index + 1), { category: "Food delivery" })),
    row(entry(month + "-11", 50000)),
  ]);
  const found = trends({
    rows, months,
    buckets: [{ id: "b", name: "Livre", planned: () => 40000, spent: (month) => month >= "2026-09" ? 50000 : 10000 }],
    recurring: [{ key: "STREAMING", label: "Streaming", group: "Assinaturas", monthly: 3990, isNew: true },
      { key: "VELHO", label: "Velho", group: "Assinaturas", monthly: 1000, isNew: false }],
  });
  assert.deepEqual(found.map((item) => item.kind), ["acima", "subindo", "recorrente"]);
  assert.equal(found[0].months, 2);
  assert.equal(found[1].label, "Alimentação fora");
  assert.ok(found[1].change > 0.08);
  assert.equal(found.some((item) => item.label === "Mercado e casa"), false);
});

test("patrimônio: total, alocação, aportes, taxa de investimento e meses de reserva", () => {
  const rows = [
    row(entry("2026-10-10", 50000, { category: "Fixed income" })),
    row(entry("2026-11-10", 80000, { category: "Fixed income" })),
    row(entry("2026-11-12", 20000, { direction: "CREDIT", category: "Fixed income" })),
  ];
  const investments = [
    { id: "a", name: "CDB", source: "manual", class: "renda_fixa", liquidity: "diaria", balance: 300000, snapshots: [{ date: "2026-10-01", balance: 250000 }, { date: "2026-11-05", balance: 300000 }] },
    { id: "b", name: "Ações", source: "pluggy", class: "acoes", liquidity: "longo", balance: 100000, snapshots: [{ date: "2026-11-01", balance: 100000 }] },
  ];
  assert.equal(balanceAt(investments[0], "2026-10-31"), 250000);
  assert.equal(balanceAt(investments[1], "2026-10-31"), 0);
  assert.deepEqual(contributions(rows, ["2026-10", "2026-11"]).map((item) => item.amount), [50000, 60000]);
  const result = networth({
    cash: 200000, cardDebt: 50000, installmentsDebt: 30000, investments,
    cashHistory: [{ date: "2026-10-31", balance: 180000 }, { date: "2026-11-15", balance: 200000 }],
    monthEnds: [{ month: "2026-10", date: "2026-10-31" }, { month: "2026-11", date: "2026-11-15" }],
    rows, month: "2026-11", income: 600000, essentialAverage: 250000,
  });
  assert.equal(result.total, 520000);
  assert.deepEqual(result.byClass.map((item) => [item.id, item.share]), [["renda_fixa", 0.75], ["acoes", 0.25]]);
  assert.equal(result.byLiquidity[0].label, "Liquidez diária");
  assert.equal(result.investmentRate, 0.1);
  assert.equal(result.reserveMonths, 2);
  assert.deepEqual(result.history.map((item) => item.total), [430000, 600000]);
  const empty = networth({ cash: 0, cardDebt: 0, installmentsDebt: 0, investments: [], cashHistory: [], monthEnds: [{ month: "2026-11", date: "2026-11-15" }],
    rows: [], month: "2026-11", income: 0, essentialAverage: 0 });
  assert.deepEqual([empty.investmentRate, empty.reserveMonths, empty.history[0].total], [null, null, null]);
});

test("negócio: vendas, custos, lucro, margem, ticket, retiradas e Profit First", () => {
  const rows = [
    row(entry("2026-11-02", 30000, { direction: "CREDIT" }), choice("negocio_vendas")),
    row(entry("2026-11-03", 70000, { direction: "CREDIT" }), choice("negocio_vendas")),
    row(entry("2026-11-04", 10000), choice("negocio_vendas")), // devolução de venda
    row(entry("2026-11-05", 40000), choice("negocio_mercadoria")),
    row(entry("2026-11-06", 5000), choice("negocio_frete")),
    row(entry("2026-11-07", 4500), choice("negocio_taxas")),
    row(entry("2026-11-08", 20000, { category: "Same person transfer" }), choice("retirada")),
    row(entry("2026-11-09", 99999)),
  ];
  const month = businessMonth(rows, "2026-11");
  assert.deepEqual([month.revenue, month.cost, month.profit, month.sales, month.ticket, month.withdrawals], [90000, 49500, 40500, 2, 45000, 20000]);
  assert.equal(month.margin, 0.45);
  assert.equal(month.costs.negocio_mercadoria, 40000);
  const split = profitFirst([month]);
  const part = (id) => split.find((item) => item.id === id);
  assert.equal(part("reposicao").actualPer100, Math.round(40000 / 90000 * 10000));
  assert.equal(part("retirada").actual, 20000 / 90000);
  const margin = 1 - 40000 / 90000;
  assert.ok(Math.abs(part("lucro").suggested - margin * 0.05) < 1e-9);
  assert.ok(Math.abs(split.reduce((total, item) => total + item.suggested, 0) - 1) < 1e-9);
  assert.equal(profitFirst([businessMonth([], "2026-11")]), null);
  const report = businessReport(rows, ["2026-10", "2026-11"]);
  assert.deepEqual([report.hasData, report.splitBasis, report.previous.revenue], [true, "mes", 0]);
  assert.equal(businessReport([row(entry("2026-11-01", 100))], ["2026-11"]).hasData, false);
});

test("valida ajustes, metas, investimentos e a consulta", () => {
  assert.equal(parseAdjustment({ kind: "evento", label: "IPVA", startMonth: "2027-01", endMonth: "2027-05", amount: 150000 }).value.endMonth, "2027-01");
  assert.equal(parseAdjustment({ kind: "evento", label: "IPVA", startMonth: "2027-01", amount: 0 }).ok, false);
  assert.equal(parseAdjustment({ kind: "aporte", label: "Extra", startMonth: "2027-01", amount: -1 }).ok, false);
  assert.equal(parseAdjustment({ kind: "renda", label: "Renda", startMonth: "2027-02", endMonth: "2027-01", percent: 100 }).ok, false);
  assert.equal(parseAdjustment({ kind: "corte", label: "Corte", startMonth: "2027-01", percent: 2000, group: "k:investimento" }).ok, false);
  assert.equal(parseGoal({ name: "Reserva", kind: "reserva", source: "manual", months: 40 }).ok, false);
  assert.equal(parseGoal({ name: "Meta", kind: "objetivo", source: "investimentos", target: 100, link: [] }).ok, false);
  assert.equal(parseGoal({ name: "Meta", kind: "objetivo", source: "manual", target: 100, yieldRate: 9000 }).ok, false);
  assert.equal(parseInvestment({ id: "11111111-1111-4111-8111-111111111111", name: "CDB", class: "renda_fixa", liquidity: "diaria" }).ok, true);
  assert.equal(parseInvestment({ name: "CDB", class: "imovel", liquidity: "diaria", balance: 1 }).ok, false);
  assert.equal(parsePlanningQuery(new URLSearchParams(""), "2026-11-15").value.month, "2026-11");
  assert.equal(parsePlanningQuery(new URLSearchParams("month=2026-13"), "2026-11-15").ok, false);
  assert.equal(parsePlanningQuery(new URLSearchParams("horizon=6"), "2026-11-15").ok, false);
});
