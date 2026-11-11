// Caixinhas pelo Plano Consciente (SPEC-0004, REQ-002) e ligação de cada lançamento a uma caixinha.
import { spendingValue } from "../analytics/classify.mjs";
import { addMonths, monthOf } from "../analytics/dates.mjs";

/** Faixas do Plano Consciente, como fração da renda. */
export const FRAMEWORK = [
  { kind: "fixos", name: "Fixos", min: 0.5, max: 0.6, rollover: false,
    groups: ["g:casa", "g:transporte", "g:saude", "g:educacao", "g:taxas"] },
  { kind: "livre", name: "Livre", min: 0.2, max: 0.35, rollover: false,
    groups: ["g:alimentacao", "g:compras", "g:assinaturas", "g:lazer", "g:terceiros", "g:outros"] },
  { kind: "investir", name: "Investir", min: 0.1, max: 0.2, rollover: false, groups: ["k:investimento"] },
  { kind: "reservas", name: "Reservas e objetivos", min: 0.05, max: 0.1, rollover: true, groups: [] },
];
export const INVESTMENT_KEY = "k:investimento";
const ROUND = 1000; // R$ 10
const TOLERANCE = 0.005;

/**
 * Chave e valor de um lançamento para as caixinhas. Despesas e estornos usam a categoria ou o grupo;
 * aportes em investimento usam a chave própria, com resgate abatendo.
 * @param {import("../analytics/aggregate.mjs").Row} row
 * @returns {{ keys: string[]; value: number } | null}
 */
export function bucketValue(row) {
  const { info } = row;
  if (info.kind === "despesa" || info.kind === "estorno") return { keys: ["c:" + info.category, "g:" + info.group], value: spendingValue(info) };
  if (info.kind === "investimento") return { keys: [INVESTMENT_KEY], value: row.entry.direction === "DEBIT" ? info.amount : -info.amount };
  return null;
}

/**
 * Caixinha de cada chave: a categoria vence o grupo.
 * @param {{ id: string; groups: string[]; archived?: boolean }[]} buckets
 */
export function keyMap(buckets) {
  const map = new Map();
  for (const bucket of buckets) if (!bucket.archived) for (const key of bucket.groups) map.set(key, bucket.id);
  return (/** @type {string[]} */ keys) => {
    for (const key of keys) if (map.has(key)) return /** @type {string} */ (map.get(key));
    return null;
  };
}

/**
 * Soma por caixinha e mês. A chave null junta o que não tem caixinha.
 * @param {import("../analytics/aggregate.mjs").Row[]} rows
 * @param {(keys: string[]) => string | null} lookup
 * @returns {Map<string | null, Map<string, number>>}
 */
export function spentByBucket(rows, lookup) {
  const result = new Map();
  for (const row of rows) {
    const value = bucketValue(row);
    if (!value) continue;
    const bucket = lookup(value.keys);
    // Aporte sem caixinha não é gasto: só entra na caixinha que o recebe.
    if (bucket === null && value.keys[0] === INVESTMENT_KEY) continue;
    const month = monthOf(row.entry.date);
    const byMonth = result.get(bucket) ?? new Map();
    byMonth.set(month, (byMonth.get(month) ?? 0) + value.value);
    result.set(bucket, byMonth);
  }
  return result;
}

/** Média dos últimos `count` meses antes de `month`. */
export function averageBefore(/** @type {Map<string, number> | undefined} */ byMonth, /** @type {string} */ month, count = 3) {
  let total = 0;
  for (let index = 1; index <= count; index += 1) total += byMonth?.get(addMonths(month, -index)) ?? 0;
  return Math.round(total / count);
}

const fit = (/** @type {number} */ value, /** @type {number} */ min, /** @type {number} */ max) => Math.min(max, Math.max(min, value));
const rounded = (/** @type {number} */ value) => Math.max(0, Math.round(value / ROUND) * ROUND);

/**
 * Sugestão pelo Plano Consciente: média de 3 meses do gasto real, encaixada na faixa sobre a renda.
 * Reservas usam a soma dos aportes planejados das metas.
 * @param {import("../analytics/aggregate.mjs").Row[]} rows
 * @param {string} month
 * @param {number} income renda prevista
 * @param {number} goalsMonthly aportes mensais planejados nas metas
 */
export function suggestBuckets(rows, month, income, goalsMonthly = 0) {
  const spent = spentByBucket(rows, keyMap(FRAMEWORK.map((item) => ({ id: item.kind, groups: item.groups }))));
  return FRAMEWORK.map((item) => {
    const average = item.kind === "reservas" ? goalsMonthly : Math.max(0, averageBefore(spent.get(item.kind), month));
    const amount = income > 0 ? fit(average, item.min * income, item.max * income) : average;
    return { kind: item.kind, name: item.name, groups: item.groups, rollover: item.rollover, average, amount: rounded(amount),
      min: item.min, max: item.max };
  });
}

/**
 * Gasto real do mês em cada fatia do Plano Consciente, pelos grupos do framework e não pelas caixinhas do usuário.
 * @param {import("../analytics/aggregate.mjs").Row[]} rows @param {string} month
 */
export function frameworkSpending(rows, month) {
  const spent = spentByBucket(rows, keyMap(FRAMEWORK.map((item) => ({ id: item.kind, groups: item.groups }))));
  return new Map(FRAMEWORK.map((item) => [item.kind, spent.get(item.kind)?.get(month) ?? 0]));
}

/**
 * Situação do Plano Consciente: planejado nas caixinhas e realizado de cada fatia sobre a renda.
 * Reservas não têm gasto próprio e usam o planejado.
 * @param {{ kind: string; planned: number }[]} buckets resultado do mês
 * @param {number} income
 * @param {Map<string, number>} actual gasto real por fatia, de frameworkSpending
 */
export function frameworkStatus(buckets, income, actual) {
  return FRAMEWORK.map((item) => {
    const own = buckets.filter((bucket) => bucket.kind === item.kind || (item.kind === "reservas" && bucket.kind === "meta"));
    const planned = own.reduce((total, bucket) => total + bucket.planned, 0);
    const spent = actual.get(item.kind) ?? 0;
    const share = income > 0 ? (item.kind === "reservas" ? planned : spent) / income : null;
    return {
      kind: item.kind, name: item.name, min: item.min, max: item.max, planned, spent,
      plannedShare: income > 0 ? planned / income : null, share,
      // Meio ponto de tolerância, para o arredondamento da sugestão não cair fora da faixa.
      position: share === null ? null : share < item.min - TOLERANCE ? "abaixo" : share > item.max + TOLERANCE ? "acima" : "dentro",
    };
  });
}
