// Projeção mensal com cenário base e ajustado (SPEC-0004, REQ-005).
import { addMonths } from "../analytics/dates.mjs";
import { FULL } from "./validate.mjs";
import { monthlyRate } from "./goals.mjs";

/** Rendimento anual assumido para os investimentos na projeção, em centésimos de ponto. */
export const ASSUMED_YIELD = 800;
const SAVING_KINDS = new Set(["investir", "reservas", "meta"]);

/**
 * @typedef {{ id: string; kind: string; label: string; startMonth: string; endMonth: string | null;
 *   amount: number | null; percent: number | null; group: string | null; enabled: boolean }} Adjustment
 * @typedef {{
 *   months: string[];
 *   incomeOf: (month: string) => number;
 *   buckets: { kind: string; groups: string[]; baseOf: (month: string) => number }[];
 *   unassignedAverage: number;
 *   groupAverage: (key: string) => number;
 *   goalsMonthly: number;
 *   installments: Map<string, number>;
 *   cash: number; invested: number; debt: number;
 *   yieldRate?: number;
 * }} ProjectionInput
 */

const active = (/** @type {Adjustment} */ item, /** @type {string} */ month) =>
  item.startMonth <= month && (item.endMonth === null || month <= item.endMonth);

/**
 * Um cenário mês a mês. Saídas são o planejado das caixinhas de gasto mais a média do gasto sem caixinha.
 * O investido é o planejado das caixinhas de investir e reservas, ou os aportes das metas quando elas não existem.
 * @param {ProjectionInput} input @param {Adjustment[]} adjustments ajustes ligados neste cenário
 */
export function scenario(input, adjustments) {
  const rate = monthlyRate(input.yieldRate ?? ASSUMED_YIELD);
  const savings = input.buckets.filter((bucket) => SAVING_KINDS.has(bucket.kind));
  const spending = input.buckets.filter((bucket) => !SAVING_KINDS.has(bucket.kind));
  let cash = input.cash;
  let invested = input.invested;
  let remainingDebt = input.debt + Array.from(input.installments.values()).reduce((total, value) => total + value, 0);
  return input.months.map((month) => {
    let income = input.incomeOf(month);
    let outflow = spending.reduce((total, bucket) => total + bucket.baseOf(month), 0) + input.unassignedAverage;
    let saving = savings.length ? savings.reduce((total, bucket) => total + bucket.baseOf(month), 0) : input.goalsMonthly;
    const base = income;
    for (const item of adjustments) {
      if (!active(item, month)) continue;
      if (item.kind === "renda") income += item.amount ?? Math.round(base * /** @type {number} */ (item.percent) / FULL);
      else if (item.kind === "corte") outflow -= Math.round(input.groupAverage(/** @type {string} */ (item.group)) * /** @type {number} */ (item.percent) / FULL);
      else if (item.kind === "evento") {
        if (/** @type {number} */ (item.amount) > 0) outflow += /** @type {number} */ (item.amount);
        else income -= /** @type {number} */ (item.amount);
      } else if (item.kind === "aporte") saving += /** @type {number} */ (item.amount);
    }
    outflow = Math.max(0, outflow);
    const installments = input.installments.get(month) ?? 0;
    const surplus = income - outflow - installments - saving;
    cash += surplus;
    invested = Math.round(invested * (1 + rate)) + saving;
    remainingDebt = Math.max(0, remainingDebt - installments);
    return { month, income, outflow, installments, invested: saving, surplus, cash, investments: invested, networth: cash + invested - remainingDebt };
  });
}

/**
 * Cenário base, cenário com os ajustes ligados e o efeito de cada ajuste no patrimônio do fim do horizonte.
 * @param {ProjectionInput} input @param {Adjustment[]} adjustments
 */
export function projection(input, adjustments) {
  const base = scenario(input, []);
  const enabled = adjustments.filter((item) => item.enabled);
  const adjusted = scenario(input, enabled);
  const end = (/** @type {ReturnType<typeof scenario>} */ rows) => rows.at(-1)?.networth ?? 0;
  return {
    months: input.months, assumedYield: input.yieldRate ?? ASSUMED_YIELD, base, adjusted,
    effects: adjustments.map((item) => ({ id: item.id, delta: end(scenario(input, [item])) - end(base) })),
    difference: end(adjusted) - end(base),
  };
}

/** Meses do horizonte a partir do mês escolhido. */
export const horizonMonths = (/** @type {string} */ first, /** @type {number} */ count) =>
  Array.from({ length: count }, (_, index) => addMonths(first, index));
