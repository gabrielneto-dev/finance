// Monta a resposta das Análises (SPEC-0003). Reaproveita dashboard() para contas, faturas,
// fatura aberta e cronograma de parcelas, e as funções puras de agregação.
import { dashboard } from "../db.mjs";
import { charged } from "../charged.mjs";
import { classify } from "./classify.mjs";
import { merchantKey } from "./merchant.mjs";
import * as aggregate from "./aggregate.mjs";
import { balanceHistory } from "./balance-history.mjs";
import { recurring } from "./recurring.mjs";
import { cardBills } from "./bills.mjs";
import { insights } from "./insights.mjs";
import { addMonths, daysBetween, monthOf, monthsBetween, previousPeriod, shiftDays } from "./dates.mjs";

const CURRENCY = "BRL";
const TREND_MONTHS = 12;
const SPARK_MONTHS = 6;
const AVERAGE_PERIODS = 3;

const keyOf = (/** @type {{ itemId: string; accountId?: string; id?: string }} */ row) => row.itemId + "/" + (row.accountId ?? row.id);

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} owner
 * @param {{ from: string; to: string; compareFrom?: string; compareTo?: string; account?: string; reference: string }} options
 */
export function analytics(db, owner, { from, to, compareFrom, compareTo, account = "", reference }) {
  const previous = compareFrom && compareTo ? { from: compareFrom, to: compareTo } : previousPeriod(from, to);
  const length = daysBetween(from, to);
  const trendMonths = monthsBetween(addMonths(monthOf(to), -(TREND_MONTHS - 1)), monthOf(to));
  // Janela que cobre o período, a comparação, as médias, a tendência e o ritmo do mês.
  const start = [previous.from, shiftDays(from, -length * AVERAGE_PERIODS), trendMonths[0] + "-01",
    addMonths(monthOf(to), -3) + "-01", addMonths(monthOf(reference), -6) + "-01"].sort()[0];
  const end = to > reference ? to : reference;
  const base = dashboard(db, owner, start, end, reference, "", reference, reference);

  const accounts = base.accounts.map((row) => ({
    key: keyOf(row), itemId: row.itemId, id: row.id, name: row.name, type: row.type, last4: row.last4 ?? null,
    currency: row.currency, balance: row.balance ?? null,
    limit: row.credit?.limit ?? null, available: row.credit?.availableLimit ?? null,
  }));
  const accountTypes = new Map(accounts.map((row) => [row.key, row.type]));
  const selected = accounts.find((row) => row.key === account) ?? null;
  // Conta pedida que não existe para o dono não mostra nada.
  const chosen = (/** @type {{ itemId: string; accountId?: string; id?: string }} */ row) => !account || keyOf(row) === selected?.key;

  let foreign = 0;
  /** @type {import("./aggregate.mjs").Row[]} */
  const rows = [];
  for (const entry of base.entries) {
    if (!chosen(entry)) continue;
    if (charged(entry).currency !== CURRENCY) { foreign += 1; continue; }
    const accountType = accountTypes.get(keyOf(entry)) ?? "BANK";
    rows.push({ entry, info: classify(entry, { accountType, choice: entry.choice ?? null }), account: keyOf(entry), accountType, merchant: merchantKey(entry.description) });
  }
  const until = (/** @type {string} */ date) => rows.filter((row) => row.entry.date <= date);
  const current = aggregate.between(rows, from, to);
  const before = aggregate.between(rows, previous.from, previous.to);
  const history = until(to);

  const sparkMonths = trendMonths.slice(-SPARK_MONTHS);
  const groups = aggregate.groups(current, before, history, sparkMonths);
  // Média por grupo nos 3 períodos de mesmo tamanho logo antes do atual, para os destaques.
  const groupAverages = new Map();
  for (let index = 1; index <= AVERAGE_PERIODS; index += 1) {
    const windowTo = shiftDays(from, -length * (index - 1) - 1);
    const windowRows = aggregate.between(rows, shiftDays(windowTo, -(length - 1)), windowTo);
    for (const group of aggregate.groups(windowRows, [], [], [])) {
      groupAverages.set(group.id, (groupAverages.get(group.id) ?? 0) + group.amount / AVERAGE_PERIODS);
    }
  }

  const monthly = aggregate.monthly(history, trendMonths);
  const pace = aggregate.pace(rows, monthOf(to), reference);
  const found = recurring(until(to), to);
  const fixedKeys = new Set(found.map((row) => row.key));
  const spending = current.filter((row) => row.info.kind === "despesa" || row.info.kind === "estorno");
  const fixed = spending.filter((row) => fixedKeys.has(row.merchant)).reduce((total, row) => total + (row.info.kind === "estorno" ? -row.info.amount : row.info.amount), 0);
  const merchants = aggregate.merchants(current, before);

  const cards = cardBills(accounts.filter(chosen), base.bills, base.openBills ?? [], base.installments ?? [], rows, reference);
  const nextMonth = addMonths(monthOf(reference), 1);
  const nextAmount = cards.reduce((total, card) => {
    const due = card.future.find((row) => row.month === nextMonth);
    return total + (due ? due.imported + due.estimated : 0);
  }, 0);
  const incomeMonths = monthly.filter((row) => row.month < monthOf(reference)).slice(-3);
  const averageIncome = incomeMonths.length ? Math.round(incomeMonths.reduce((total, row) => total + row.income, 0) / incomeMonths.length) : 0;

  return {
    period: { from, to, previousFrom: previous.from, previousTo: previous.to, days: length, reference },
    accounts,
    connections: base.connections.filter((row) => row.active).map((row) => ({ id: row.id, name: row.label || row.name })),
    totals: { current: aggregate.totals(current, from, to), previous: aggregate.totals(before, previous.from, previous.to) },
    monthly,
    monthlyByGroup: aggregate.monthlyByGroup(history, trendMonths),
    pace,
    groups,
    natures: aggregate.natures(current),
    fixedVariable: { fixed, variable: spending.reduce((total, row) => total + (row.info.kind === "estorno" ? -row.info.amount : row.info.amount), 0) - fixed },
    incomeSources: aggregate.incomeSources(current),
    methods: aggregate.methods(current),
    daily: aggregate.daily(current, from, to),
    balances: balanceHistory(accounts.filter(chosen), rows.map((row) => ({ ...row.entry, account: row.account })), from, to, reference),
    institutions: aggregate.institutions(current, history, trendMonths, base.connections.filter((row) => row.active), accounts.filter(chosen)),
    merchants,
    recurring: found,
    weekdays: aggregate.weekdayBands(current),
    small: aggregate.smallPurchases(current),
    cards,
    commitment: { month: nextMonth, amount: nextAmount, averageIncome, share: averageIncome > 0 ? nextAmount / averageIncome : null },
    insights: insights({ groups, groupAverages, recurring: found, pace,
      nextInstallments: nextAmount ? { month: nextMonth, amount: nextAmount } : null, averageIncome, merchants }),
    entries: current.map((row) => ({ ...row.entry, info: row.info, merchant: row.merchant })),
    foreignExcluded: foreign,
  };
}
