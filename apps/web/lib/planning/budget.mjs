// O mês de cada caixinha (SPEC-0004, REQ-003): planejado com acúmulo, gasto, disponível, ritmo e situação.
import { addMonths, daysInMonth, monthOf } from "../analytics/dates.mjs";
import { FULL } from "./validate.mjs";

const ATTENTION = 0.85;
const MAX_ROLLOVER_MONTHS = 24;

/**
 * Valor padrão da caixinha num mês: o ajuste do mês, o valor fixo ou o percentual da renda.
 * @param {{ mode: string; amount: number; months: Record<string, number> }} bucket
 * @param {string} month @param {number} income renda prevista do mês
 */
export function baseAmount(bucket, month, income) {
  if (Object.hasOwn(bucket.months, month)) return bucket.months[month];
  return bucket.mode === "percentual" ? Math.round(income * bucket.amount / FULL) : bucket.amount;
}

/**
 * Sobra acumulada até o início do mês, desde o mês de criação. Estouro não vira dívida: a sobra só fica positiva.
 * @param {{ mode: string; amount: number; months: Record<string, number>; rollover: boolean; start: string }} bucket
 * @param {string} month @param {(month: string) => number} incomeOf @param {(month: string) => number} spentOf
 */
export function carryOver(bucket, month, incomeOf, spentOf) {
  if (!bucket.rollover) return 0;
  const first = bucket.start > addMonths(month, -MAX_ROLLOVER_MONTHS) ? bucket.start : addMonths(month, -MAX_ROLLOVER_MONTHS);
  let carry = 0;
  for (let current = first; current < month; current = addMonths(current, 1)) {
    carry = Math.max(0, carry + baseAmount(bucket, current, incomeOf(current)) - spentOf(current));
  }
  return carry;
}

/**
 * Ritmo do mês na data de referência: dias passados, dias restantes e projeção do gasto.
 * @param {string} month @param {string} reference
 */
export function monthClock(month, reference) {
  const days = daysInMonth(month);
  const current = monthOf(reference) === month;
  const elapsed = current ? Number(reference.slice(8, 10)) : month < monthOf(reference) ? days : 0;
  return { days, elapsed, remaining: current ? days - elapsed + 1 : month > monthOf(reference) ? days : 0, current, past: month < monthOf(reference) };
}

/**
 * @param {number} planned @param {number} spent @param {ReturnType<typeof monthClock>} clock
 * @returns {"dentro" | "atencao" | "estourou"}
 */
export function status(planned, spent, clock) {
  if (spent > planned) return "estourou";
  // Mês fechado dentro do planejado não pede atenção.
  if (clock.past) return "dentro";
  const projected = clock.current && clock.elapsed > 0 ? spent / clock.elapsed * clock.days : spent;
  if (planned > 0 && (spent >= planned * ATTENTION || projected > planned)) return "atencao";
  return "dentro";
}

/**
 * @param {{
 *   buckets: { id: string; name: string; kind: string; mode: string; amount: number; months: Record<string, number>;
 *     rollover: boolean; start: string; archived: boolean; groups: string[]; sort: number }[];
 *   spent: Map<string | null, Map<string, number>>;
 *   month: string; reference: string; incomeOf: (month: string) => number;
 * }} input
 */
export function monthBudget({ buckets, spent, month, reference, incomeOf }) {
  const clock = monthClock(month, reference);
  const income = incomeOf(month);
  const rows = buckets.filter((bucket) => !bucket.archived).map((bucket) => {
    const spentOf = (/** @type {string} */ target) => spent.get(bucket.id)?.get(target) ?? 0;
    const base = baseAmount(bucket, month, income);
    const carry = carryOver(bucket, month, incomeOf, spentOf);
    const planned = base + carry;
    const used = spentOf(month);
    const available = planned - used;
    const projected = clock.current && clock.elapsed > 0 ? Math.round(used / clock.elapsed * clock.days) : used;
    return {
      id: bucket.id, name: bucket.name, kind: bucket.kind, mode: bucket.mode, amount: bucket.amount, rollover: bucket.rollover,
      groups: bucket.groups, sort: bucket.sort, adjusted: Object.hasOwn(bucket.months, month),
      base, carry, planned, spent: used, available, projected,
      // Onde o gasto deveria estar hoje, se o mês fosse gasto por igual.
      expectedToday: clock.current ? Math.round(planned * clock.elapsed / clock.days) : clock.past ? planned : 0,
      perDay: clock.remaining > 0 ? Math.max(0, Math.floor(available / clock.remaining)) : null,
      status: status(planned, used, clock),
      share: income > 0 ? base / income : null,
    };
  });
  const unassigned = spent.get(null)?.get(month) ?? 0;
  const plannedBase = rows.reduce((total, row) => total + row.base, 0);
  return {
    month, clock, income, buckets: rows, unassigned,
    planned: rows.reduce((total, row) => total + row.planned, 0),
    spent: rows.reduce((total, row) => total + row.spent, 0) + unassigned,
    // Base zero: a renda que ainda não foi dividida entre as caixinhas.
    unallocated: income - plannedBase,
  };
}
