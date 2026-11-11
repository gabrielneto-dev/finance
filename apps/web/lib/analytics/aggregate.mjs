// Agregações das Análises (SPEC-0003, seção 1.5). Funções puras sobre lançamentos já classificados.
import { businessValue, spendingValue } from "./classify.mjs";
import { GROUPS } from "./categories.mjs";
import { merchantLabel } from "./merchant.mjs";
import { addMonths, daysBetween, daysInMonth, monthOf, shiftDays, weekday } from "./dates.mjs";

/**
 * @typedef {{
 *   entry: import("../types").Entry; info: import("./classify.mjs").Classified;
 *   account: string; accountType: "BANK" | "CREDIT"; merchant: string;
 * }} Row
 */

const SMALL_PURCHASE = 3000; // R$ 30,00
const sum = (/** @type {Row[]} */ rows, /** @type {(row: Row) => number} */ value) => rows.reduce((total, row) => total + value(row), 0);
const spend = (/** @type {Row} */ row) => spendingValue(row.info);
const isSpending = (/** @type {Row} */ row) => row.info.kind === "despesa" || row.info.kind === "estorno";
const isIncome = (/** @type {Row} */ row) => row.info.kind === "receita" || row.info.kind === "rendimento";
const business = (/** @type {Row} */ row) => businessValue(row.info);
export const BUSINESS_PROFIT_LABEL = "Lucro do negócio";

/** Vendas, custos, lucro e retiradas do negócio (SPEC-0004, REQ-001). */
export function businessTotals(/** @type {Row[]} */ rows) {
  const revenue = sum(rows.filter((row) => row.info.kind === "negocio_receita"), business);
  const costs = sum(rows.filter((row) => row.info.kind === "negocio_custo"), business);
  const withdrawals = sum(rows.filter((row) => row.info.withdrawal), (row) => row.entry.direction === "DEBIT" ? row.info.amount : 0);
  return { revenue, costs, profit: revenue - costs, withdrawals };
}

/** @param {Row[]} rows @param {string} from @param {string} to */
export const between = (rows, from, to) => rows.filter(({ entry }) => entry.date >= from && entry.date <= to);

/** Receitas, despesas, resultado e movimentos neutros do período. */
export function totals(/** @type {Row[]} */ rows, /** @type {string} */ from, /** @type {string} */ to) {
  const income = sum(rows.filter(isIncome), (row) => row.info.amount);
  const yieldAmount = sum(rows.filter((row) => row.info.kind === "rendimento"), (row) => row.info.amount);
  const expense = sum(rows.filter(isSpending), spend);
  const refunds = sum(rows.filter((row) => row.info.kind === "estorno"), (row) => row.info.amount);
  const pending = sum(rows.filter((row) => isSpending(row) && row.info.pending), spend);
  const neutral = Object.fromEntries(["pagamento_fatura", "transferencia_propria", "investimento", "emprestimo", "ignorado"]
    .map((kind) => [kind, sum(rows.filter((row) => row.info.kind === kind), (row) => row.info.amount)]));
  // O lucro do negócio entra no resultado, mas vendas e custos ficam fora das receitas e despesas pessoais.
  const businessPart = businessTotals(rows);
  const result = income + businessPart.profit - expense;
  const base = income + Math.max(0, businessPart.profit);
  return {
    income, yield: yieldAmount, expense, refunds, pending, result,
    savingsRate: base > 0 ? result / base : null,
    business: businessPart,
    dailyAverage: Math.round(expense / Math.max(1, daysBetween(from, to))),
    purchases: rows.filter((row) => row.info.kind === "despesa").length,
    neutral,
  };
}

/** Receitas e despesas por mês. */
export function monthly(/** @type {Row[]} */ rows, /** @type {string[]} */ months) {
  return months.map((month) => {
    const inMonth = rows.filter(({ entry }) => monthOf(entry.date) === month);
    const income = sum(inMonth.filter(isIncome), (row) => row.info.amount);
    const expense = sum(inMonth.filter(isSpending), spend);
    const profit = businessTotals(inMonth).profit;
    return { month, income, expense, business: profit, result: income + profit - expense };
  });
}

/** Despesa por grupo em cada mês, para a evolução empilhada. */
export function monthlyByGroup(/** @type {Row[]} */ rows, /** @type {string[]} */ months) {
  return months.map((month) => {
    /** @type {Record<string, number>} */
    const values = {};
    for (const row of rows) if (isSpending(row) && monthOf(row.entry.date) === month) {
      values[row.info.group] = (values[row.info.group] ?? 0) + spend(row);
    }
    return { month, values };
  });
}

/**
 * Ranking de grupos e categorias, com o período anterior e a tendência de 6 meses.
 * @param {Row[]} current @param {Row[]} previous @param {Row[]} history @param {string[]} sparkMonths
 */
export function groups(current, previous, history, sparkMonths) {
  const by = (/** @type {Row[]} */ rows, /** @type {(row: Row) => string} */ key) => {
    const map = new Map();
    for (const row of rows) if (isSpending(row)) map.set(key(row), (map.get(key(row)) ?? 0) + spend(row));
    return map;
  };
  const total = sum(current.filter(isSpending), spend);
  const previousGroups = by(previous, (row) => row.info.group);
  const previousCategories = by(previous, (row) => row.info.group + "/" + row.info.label);
  const result = [];
  for (const group of GROUPS) {
    const rows = current.filter((row) => isSpending(row) && row.info.group === group.id);
    const amount = sum(rows, spend);
    if (!rows.length && !previousGroups.get(group.id)) continue;
    const categories = new Map();
    for (const row of rows) {
      const category = categories.get(row.info.label) ?? { id: row.info.category, label: row.info.label, amount: 0, count: 0, gross: 0 };
      category.amount += spend(row);
      // O ticket médio usa o valor das compras, sem os estornos.
      if (row.info.kind === "despesa") { category.count += 1; category.gross += row.info.amount; }
      categories.set(row.info.label, category);
    }
    result.push({
      id: group.id, label: group.label, nature: group.nature, amount,
      previous: previousGroups.get(group.id) ?? 0, share: total > 0 ? amount / total : 0,
      count: rows.filter((row) => row.info.kind === "despesa").length,
      spark: sparkMonths.map((month) => sum(history.filter((row) => isSpending(row) && row.info.group === group.id &&
        monthOf(row.entry.date) === month), spend)),
      categories: Array.from(categories.values()).map(({ gross, ...category }) => ({
        ...category, previous: previousCategories.get(group.id + "/" + category.label) ?? 0,
        average: category.count ? Math.round(gross / category.count) : 0,
      })).sort((a, b) => b.amount - a.amount),
    });
  }
  return result.sort((a, b) => b.amount - a.amount);
}

/** Essencial, estilo de vida e sem natureza. */
export function natures(/** @type {Row[]} */ rows) {
  const spending = rows.filter(isSpending);
  return {
    essencial: sum(spending.filter((row) => row.info.nature === "essencial"), spend),
    estilo: sum(spending.filter((row) => row.info.nature === "estilo"), spend),
    indefinido: sum(spending.filter((row) => row.info.nature === null), spend),
  };
}

/** Despesa acumulada por dia no mês, contra o mês anterior e a média dos 3 anteriores. */
export function pace(/** @type {Row[]} */ rows, /** @type {string} */ month, /** @type {string} */ reference) {
  const cumulative = (/** @type {string} */ target) => {
    const days = daysInMonth(target);
    const daily = new Array(days).fill(0);
    for (const row of rows) if (isSpending(row) && monthOf(row.entry.date) === target) daily[Number(row.entry.date.slice(8, 10)) - 1] += spend(row);
    let running = 0;
    return daily.map((value) => (running += value));
  };
  const days = daysInMonth(month);
  const current = cumulative(month);
  const previous = cumulative(addMonths(month, -1));
  const earlier = [1, 2, 3].map((delta) => cumulative(addMonths(month, -delta)));
  const isCurrent = monthOf(reference) === month;
  const elapsed = isCurrent ? Number(reference.slice(8, 10)) : days;
  const at = (/** @type {number[]} */ series, /** @type {number} */ day) => series[Math.min(day, series.length) - 1] ?? 0;
  const spent = current[elapsed - 1] ?? 0;
  return {
    month, days: Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      current: index < elapsed ? current[index] : null,
      previous: at(previous, index + 1),
      average: Math.round(earlier.reduce((total, series) => total + at(series, index + 1), 0) / earlier.length),
    })),
    elapsed, spent, isCurrent,
    projection: isCurrent && elapsed > 0 ? Math.round(spent / elapsed * days) : null,
    averageTotal: Math.round(earlier.reduce((total, series) => total + (series.at(-1) ?? 0), 0) / earlier.length),
  };
}

/** Despesa por dia do período, para o calendário. */
export function daily(/** @type {Row[]} */ rows, /** @type {string} */ from, /** @type {string} */ to) {
  const length = Math.min(daysBetween(from, to), 400);
  const values = new Map();
  for (const row of rows) if (isSpending(row)) values.set(row.entry.date, (values.get(row.entry.date) ?? 0) + spend(row));
  return Array.from({ length }, (_, index) => {
    const date = shiftDays(from, index);
    return { date, amount: values.get(date) ?? 0 };
  });
}

/** Soma por rótulo, ordenada. */
function ranked(/** @type {Row[]} */ rows, /** @type {(row: Row) => string} */ label, /** @type {(row: Row) => number} */ value) {
  const map = new Map();
  for (const row of rows) map.set(label(row), (map.get(label(row)) ?? 0) + value(row));
  return Array.from(map, ([name, amount]) => ({ label: name, amount })).filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount);
}

const methodLabel = (/** @type {Row} */ row) => row.entry.method ?? (row.accountType === "CREDIT" ? "Crédito" : "Não informada");

export function incomeSources(/** @type {Row[]} */ rows) {
  const sources = ranked(rows.filter(isIncome), (row) => row.info.label, (row) => row.info.amount);
  const { profit } = businessTotals(rows);
  if (profit > 0) sources.push({ label: BUSINESS_PROFIT_LABEL, amount: profit });
  return sources.sort((a, b) => b.amount - a.amount);
}
export const methods = (/** @type {Row[]} */ rows) => ranked(rows.filter(isSpending), methodLabel, spend);

const BANDS = [["Madrugada", 0, 6], ["Manhã", 6, 12], ["Tarde", 12, 18], ["Noite", 18, 24]];
/** Despesa por dia da semana e faixa de horário. Sem horário fica numa faixa própria. */
export function weekdayBands(/** @type {Row[]} */ rows) {
  const cells = [];
  for (let day = 0; day < 7; day += 1) for (const band of [...BANDS.map(([label]) => label), "Sem horário"]) cells.push({ weekday: day, band, amount: 0, count: 0 });
  for (const row of rows) {
    if (row.info.kind !== "despesa") continue;
    const hour = row.entry.time ? Number(row.entry.time.slice(0, 2)) : null;
    const band = hour === null ? "Sem horário" : BANDS.find(([, start, end]) => hour >= Number(start) && hour < Number(end))?.[0] ?? "Sem horário";
    const cell = cells.find((item) => item.weekday === weekday(row.entry.date) && item.band === band);
    if (cell) { cell.amount += row.info.amount; cell.count += 1; }
  }
  return cells;
}

/** Compras abaixo de R$ 30: quantidade, soma e os lugares mais frequentes. */
export function smallPurchases(/** @type {Row[]} */ rows) {
  const small = rows.filter((row) => row.info.kind === "despesa" && row.info.amount < SMALL_PURCHASE && row.info.group !== "terceiros");
  const places = new Map();
  for (const row of small) {
    const place = places.get(row.merchant) ?? { label: merchantLabel(row.merchant), count: 0, amount: 0 };
    place.count += 1;
    place.amount += row.info.amount;
    places.set(row.merchant, place);
  }
  return {
    threshold: SMALL_PURCHASE, count: small.length, amount: sum(small, (row) => row.info.amount),
    top: Array.from(places.values()).sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 5),
  };
}

/** Principais estabelecimentos e destinatários, com o período anterior. */
export function merchants(/** @type {Row[]} */ current, /** @type {Row[]} */ previous, limit = 15) {
  const collect = (/** @type {Row[]} */ rows) => {
    const map = new Map();
    for (const row of rows) {
      if (!isSpending(row)) continue;
      const item = map.get(row.merchant) ?? { key: row.merchant, label: merchantLabel(row.merchant), group: row.info.groupLabel, amount: 0, count: 0 };
      item.amount += spend(row);
      if (row.info.kind === "despesa") item.count += 1;
      map.set(row.merchant, item);
    }
    return map;
  };
  const before = collect(previous);
  const rankedBefore = Array.from(before.values()).sort((a, b) => b.amount - a.amount).map((row) => row.key);
  return Array.from(collect(current).values()).filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, limit)
    .map((row) => ({
      ...row, previous: before.get(row.key)?.amount ?? 0,
      average: row.count ? Math.round(row.amount / row.count) : 0,
      previousRank: rankedBefore.indexOf(row.key) + 1 || null,
    }));
}

/**
 * Entradas, saídas e despesas por instituição e conta.
 * @param {Row[]} current @param {Row[]} history @param {string[]} months
 * @param {{ id: string; name: string; label?: string | null }[]} connections
 * @param {{ key: string; itemId: string; name: string; type: string; last4: string | null }[]} accounts
 */
export function institutions(current, history, months, connections, accounts) {
  const total = sum(current.filter(isSpending), spend);
  return connections.map((connection) => {
    const own = (/** @type {Row[]} */ rows) => rows.filter((row) => row.entry.itemId === connection.id && row.info.kind !== "ignorado");
    const rows = own(current);
    const expense = sum(rows.filter(isSpending), spend);
    return {
      id: connection.id, name: connection.label || connection.name,
      inflow: sum(rows.filter((row) => row.entry.direction === "CREDIT"), (row) => row.info.amount),
      outflow: sum(rows.filter((row) => row.entry.direction === "DEBIT"), (row) => row.info.amount),
      income: sum(rows.filter(isIncome), (row) => row.info.amount), expense, count: rows.length,
      share: total > 0 ? expense / total : 0,
      monthly: months.map((month) => ({ month, amount: sum(own(history).filter((row) => isSpending(row) && monthOf(row.entry.date) === month), spend) })),
      methods: methods(rows),
      accounts: accounts.filter((account) => account.itemId === connection.id).map((account) => {
        const accountRows = rows.filter((row) => row.account === account.key);
        return {
          key: account.key, name: account.name, type: account.type, last4: account.last4,
          inflow: sum(accountRows.filter((row) => row.entry.direction === "CREDIT"), (row) => row.info.amount),
          outflow: sum(accountRows.filter((row) => row.entry.direction === "DEBIT"), (row) => row.info.amount),
          expense: sum(accountRows.filter(isSpending), spend), count: accountRows.length,
        };
      }),
    };
  }).filter((row) => row.count > 0 || row.accounts.length > 0);
}
