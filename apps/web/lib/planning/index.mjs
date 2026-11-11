// Monta a resposta do Planejamento (SPEC-0004). Reaproveita dashboard() e a classificação das Análises,
// e junta o que o proprietário planejou às funções puras de cada página.
import { dashboard } from "../db.mjs";
import { charged } from "../charged.mjs";
import { classifyEntries } from "../analytics/index.mjs";
import { balanceHistory } from "../analytics/balance-history.mjs";
import { recurring } from "../analytics/recurring.mjs";
import { addMonths, daysInMonth, monthOf, monthsBetween } from "../analytics/dates.mjs";
import { loadPlan } from "./store.mjs";
import { expectedIncome, monthlyIncome } from "./income.mjs";
import { averageBefore, bucketValue, frameworkSpending, frameworkStatus, keyMap, spentByBucket, suggestBuckets } from "./buckets.mjs";
import { baseAmount, monthBudget } from "./budget.mjs";
import { evaluateGoals } from "./goals.mjs";
import { horizonMonths, projection } from "./projection.mjs";
import { trends } from "./trends.mjs";
import { CLASS_LABEL, LIQUIDITY_LABEL, networth } from "./networth.mjs";
import { businessReport } from "./business.mjs";

const CURRENCY = "BRL";
const HISTORY_MONTHS = 12;
const TREND_MONTHS = 6;
const AVERAGE_MONTHS = 3;

const brl = (/** @type {{ amount: number; currency: string }[] | undefined} */ totals) =>
  (totals ?? []).filter((row) => row.currency === CURRENCY).reduce((total, row) => total + row.amount, 0);
const average = (/** @type {number[]} */ values) => values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;

/**
 * Dados compartilhados pela resposta e pela sugestão de caixinhas.
 * @param {import("node:sqlite").DatabaseSync} db @param {string} owner @param {string} month @param {string} reference
 */
function context(db, owner, month, reference) {
  const current = monthOf(reference);
  const first = [addMonths(month, -HISTORY_MONTHS), addMonths(current, -HISTORY_MONTHS)].sort()[0];
  const last = month > current ? month : current;
  const base = dashboard(db, owner, first + "-01", last + "-" + daysInMonth(last), reference, "", reference, reference);
  const { accounts, rows } = classifyEntries(base);
  const plan = loadPlan(db, owner);
  const history = monthlyIncome(rows, monthsBetween(first, last));
  const incomeCache = new Map();
  const incomeOf = (/** @type {string} */ target) => {
    if (!incomeCache.has(target)) incomeCache.set(target, expectedIncome(history, target, plan.income, current));
    return incomeCache.get(target);
  };
  // Médias pelos meses completos antes do mês atual.
  const complete = monthsBetween(addMonths(current, -HISTORY_MONTHS), addMonths(current, -1));
  const byMonth = (/** @type {(row: (typeof rows)[number]) => boolean} */ keep) => complete.map((target) => rows
    .filter((row) => keep(row) && monthOf(row.entry.date) === target && (row.info.kind === "despesa" || row.info.kind === "estorno"))
    .reduce((total, row) => total + (row.info.kind === "estorno" ? -row.info.amount : row.info.amount), 0));
  const essential = byMonth((row) => row.info.nature === "essencial");
  const spending = byMonth(() => true);
  const started = spending.findIndex((value) => value !== 0);
  const goalsMonthly = plan.goals.reduce((total, goal) => total + goal.monthly, 0);
  return {
    base, accounts, rows, plan, history, incomeOf, current, goalsMonthly,
    essentialAverage: average(essential.slice(-AVERAGE_MONTHS)),
    annualSpending: started < 0 ? 0 : average(spending.slice(started)) * 12,
  };
}

/** Caixinhas sugeridas pelo Plano Consciente para o mês. */
export function suggestionFor(/** @type {import("node:sqlite").DatabaseSync} */ db, /** @type {string} */ owner,
  /** @type {string} */ month, /** @type {string} */ reference) {
  const data = context(db, owner, month, reference);
  return suggestBuckets(data.rows, month, data.incomeOf(month).expected, data.goalsMonthly);
}

/**
 * @param {import("node:sqlite").DatabaseSync} db @param {string} owner
 * @param {{ month: string; horizon: number; reference: string }} options
 */
export function planning(db, owner, { month, horizon, reference }) {
  const data = context(db, owner, month, reference);
  const { base, accounts, rows, plan, current } = data;
  const incomeAmount = (/** @type {string} */ target) => data.incomeOf(target).expected;
  const active = plan.buckets.filter((bucket) => !bucket.archived);
  const lookup = keyMap(active);
  const spent = spentByBucket(rows, lookup);

  // Mês e caixinhas.
  const budget = monthBudget({ buckets: plan.buckets, spent, month, reference, incomeOf: incomeAmount });
  const bucketRows = budget.buckets.map((bucket) => ({ ...bucket, average: averageBefore(spent.get(bucket.id), month) }));
  const monthRows = rows.filter((row) => monthOf(row.entry.date) === month);
  const entries = monthRows.flatMap((row) => {
    const value = bucketValue(row);
    return value ? [{ ...row.entry, info: row.info, merchant: row.merchant, bucket: lookup(value.keys) }] : [];
  });

  // Saldos, faturas e parcelas futuras.
  const cash = accounts.filter((row) => row.type === "BANK" && row.currency === CURRENCY).reduce((total, row) => total + (row.balance ?? 0), 0);
  const openBills = base.openBills ?? [];
  const cardDebt = openBills.reduce((total, bill) => total + brl(bill.total), 0);
  const openMonth = new Map(openBills.map((bill) => [bill.itemId + "/" + bill.accountId, bill.month]));
  const installments = new Map();
  for (const row of base.installments ?? []) {
    if (row.currency !== CURRENCY || row.month <= (openMonth.get(row.itemId + "/" + row.accountId) ?? current)) continue;
    installments.set(row.month, (installments.get(row.month) ?? 0) + row.amount);
  }
  const installmentsDebt = Array.from(installments.values()).reduce((total, value) => total + value, 0);
  const investments = plan.investments;
  const invested = investments.reduce((total, row) => total + row.balance, 0);

  // Metas.
  const goals = evaluateGoals(plan.goals, {
    month: current, essentialAverage: data.essentialAverage, annualSpending: data.annualSpending,
    investments: new Map(investments.map((row) => [row.id, row.balance])),
    accounts: new Map(accounts.filter((row) => row.type === "BANK").map((row) => [row.key, row.balance])),
  });

  // Projeção: médias por grupo e categoria nos 3 meses completos.
  const byKey = new Map();
  for (const row of rows) {
    const value = bucketValue(row);
    if (!value) continue;
    for (const key of value.keys) {
      const series = byKey.get(key) ?? new Map();
      series.set(monthOf(row.entry.date), (series.get(monthOf(row.entry.date)) ?? 0) + value.value);
      byKey.set(key, series);
    }
  }
  const projected = projection({
    months: horizonMonths(addMonths(current, 1), horizon),
    incomeOf: incomeAmount,
    buckets: active.map((bucket) => ({ kind: bucket.kind, groups: bucket.groups, baseOf: (target) => baseAmount(bucket, target, incomeAmount(target)) })),
    unassignedAverage: Math.max(0, averageBefore(spent.get(null), current)),
    groupAverage: (key) => Math.max(0, averageBefore(byKey.get(key), current)),
    goalsMonthly: data.goalsMonthly,
    installments, cash: cash - cardDebt, invested, debt: 0,
  }, plan.adjustments);

  // Tendências nos 6 meses completos.
  const trendMonths = monthsBetween(addMonths(current, -TREND_MONTHS), addMonths(current, -1));
  const found = trends({
    rows, months: trendMonths,
    buckets: active.map((bucket) => ({ id: bucket.id, name: bucket.name,
      planned: (target) => baseAmount(bucket, target, incomeAmount(target)), spent: (target) => spent.get(bucket.id)?.get(target) ?? 0 })),
    recurring: recurring(rows.filter((row) => row.entry.date <= reference), reference),
  });

  // Patrimônio, com o saldo das contas reconstruído em cada fim de mês.
  const historyMonths = monthsBetween(addMonths(current, -(HISTORY_MONTHS - 1)), current);
  const monthEnds = historyMonths.map((target) => {
    const end = target + "-" + String(daysInMonth(target)).padStart(2, "0");
    return { month: target, date: end < reference ? end : reference };
  });
  const balances = balanceHistory(accounts.filter((row) => row.currency === CURRENCY), rows.map((row) => ({ ...row.entry, account: row.account })),
    historyMonths[0] + "-01", reference, reference);
  const cashByDate = new Map();
  for (const series of balances) for (const point of series.points) cashByDate.set(point.date, (cashByDate.get(point.date) ?? 0) + point.balance);
  const income = data.incomeOf(month);
  const actualIncome = data.history.find((row) => row.month === month);
  const worth = networth({
    cash, cardDebt, installmentsDebt, investments,
    cashHistory: balances.length ? Array.from(cashByDate, ([date, balance]) => ({ date, balance })) : [],
    monthEnds, rows, month,
    income: actualIncome ? actualIncome.salary + actualIncome.other + Math.max(0, actualIncome.business) : 0,
    essentialAverage: data.essentialAverage,
  });

  const businessMonths = monthsBetween(addMonths(month, -(HISTORY_MONTHS - 1)), month);
  return {
    month, reference, horizon,
    accounts: accounts.map(({ key, name, type, last4, balance, business }) => ({ key, name, type, last4, balance, business })),
    income: { ...income, history: data.history.filter((row) => row.month <= current).slice(-HISTORY_MONTHS) },
    budget: { ...budget, buckets: bucketRows },
    framework: frameworkStatus(bucketRows, income.expected, frameworkSpending(rows, month)),
    suggestion: suggestBuckets(rows, month, income.expected, data.goalsMonthly),
    archived: plan.buckets.filter((bucket) => bucket.archived).map(({ id, name, kind, mode, amount, rollover }) => ({ id, name, kind, mode, amount, rollover })),
    entries,
    goals, essentialAverage: data.essentialAverage, annualSpending: data.annualSpending,
    adjustments: plan.adjustments, projection: projected,
    trends: found,
    networth: worth,
    investments: investments.map((row) => ({ ...row, classLabel: CLASS_LABEL[row.class] ?? row.class,
      liquidityLabel: LIQUIDITY_LABEL[row.liquidity] ?? row.liquidity })),
    business: businessReport(rows, businessMonths),
    foreignExcluded: base.entries.filter((entry) => charged(entry).currency !== CURRENCY).length,
  };
}
