// Renda prevista do mês (SPEC-0004, 1.3). Salário pela mediana, demais receitas e lucro do negócio pela média.
import { businessTotals } from "../analytics/aggregate.mjs";
import { addMonths, median, monthOf } from "../analytics/dates.mjs";

const BASIS_MONTHS = 3;

/**
 * Receita por mês, separada em salário, outras receitas e lucro do negócio.
 * @param {import("../analytics/aggregate.mjs").Row[]} rows @param {string[]} months
 */
export function monthlyIncome(rows, months) {
  return months.map((month) => {
    const inMonth = rows.filter((row) => monthOf(row.entry.date) === month);
    let salary = 0;
    let other = 0;
    for (const row of inMonth) {
      if (row.info.kind !== "receita" && row.info.kind !== "rendimento") continue;
      if (row.info.category === "salario") salary += row.info.amount;
      else other += row.info.amount;
    }
    return { month, salary, other, business: businessTotals(inMonth).profit };
  });
}

/**
 * Estimativa pelos 3 meses completos antes de `month`. O valor manual do mês vence a estimativa.
 * @param {ReturnType<typeof monthlyIncome>} history
 * @param {string} month YYYY-MM
 * @param {Record<string, number>} manual valores definidos pelo usuário, por mês
 * @param {string} [current] mês atual: meses futuros usam a mesma base dele, só com meses completos
 */
export function expectedIncome(history, month, manual = {}, current = month) {
  const limit = month < current ? month : current;
  const basis = history.filter((row) => row.month < limit).slice(-BASIS_MONTHS);
  const average = (/** @type {number[]} */ values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  const parts = {
    salary: Math.round(median(basis.map((row) => row.salary))),
    other: Math.round(average(basis.map((row) => row.other))),
    business: Math.round(average(basis.map((row) => row.business))),
  };
  const estimated = Math.max(0, parts.salary + parts.other + parts.business);
  const own = Object.hasOwn(manual, month) ? manual[month] : null;
  return { month, estimated, manual: own, expected: own ?? estimated, parts, basis: basis.map((row) => row.month) };
}

/**
 * Renda prevista de cada mês a partir de `firstMonth`. Meses futuros repetem a estimativa do mês atual,
 * salvo valor manual.
 * @param {ReturnType<typeof monthlyIncome>} history @param {string} firstMonth @param {number} count
 * @param {Record<string, number>} manual @param {string} current
 */
export function incomeSeries(history, firstMonth, count, manual = {}, current = firstMonth) {
  return Array.from({ length: count }, (_, index) => expectedIncome(history, addMonths(firstMonth, index), manual, current));
}
