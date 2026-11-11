// Metas, reserva de emergência e independência financeira (SPEC-0004, REQ-004).
import { addMonths } from "../analytics/dates.mjs";
import { FULL } from "./validate.mjs";

export const RESERVE_MONTHS = 6;
export const INDEPENDENCE_MULTIPLE = 25; // regra dos 4%
const MAX_MONTHS = 1200;

/** Taxa mensal equivalente a um rendimento anual em centésimos de ponto. */
export const monthlyRate = (/** @type {number} */ yearly) => yearly > 0 ? (1 + yearly / FULL) ** (1 / 12) - 1 : 0;

/** Meses do mês atual até o prazo, contando o mês do prazo. */
export function monthsUntil(/** @type {string} */ from, /** @type {string} */ to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + tm - fm + 1;
}

/**
 * Aporte mensal para chegar ao alvo em `months` meses, com juros compostos no fim de cada mês.
 * @param {number} target @param {number} current @param {number} months @param {number} rate taxa mensal
 */
export function requiredMonthly(target, current, months, rate = 0) {
  if (current >= target) return 0;
  if (months <= 0) return target - current;
  if (!rate) return Math.ceil((target - current) / months);
  const growth = (1 + rate) ** months;
  return Math.max(0, Math.ceil((target - current * growth) * rate / (growth - 1)));
}

/**
 * Meses até chegar ao alvo com o aporte planejado. Null quando não chega.
 * @param {number} target @param {number} current @param {number} monthly @param {number} rate taxa mensal
 */
export function monthsToReach(target, current, monthly, rate = 0) {
  if (current >= target) return 0;
  if (monthly <= 0 && rate <= 0) return null;
  let value = current;
  for (let month = 1; month <= MAX_MONTHS; month += 1) {
    value = value * (1 + rate) + monthly;
    if (value >= target) return month;
  }
  return null;
}

/**
 * @param {{ id: string; name: string; kind: string; target: number | null; months: number | null; deadline: string | null;
 *   monthly: number; yieldRate: number; source: string; current: number; link: any; priority: number }} goal
 * @param {{ month: string; essentialAverage: number; annualSpending: number;
 *   investments: Map<string, number>; accounts: Map<string, number | null> }} context
 */
export function evaluateGoal(goal, context) {
  const current = goal.source === "investimentos" ? (goal.link ?? []).reduce((total, id) => total + (context.investments.get(id) ?? 0), 0)
    : goal.source === "conta" ? Math.max(0, context.accounts.get(goal.link) ?? 0) : goal.current;
  const reserveMonths = goal.months ?? RESERVE_MONTHS;
  const target = goal.target ?? (goal.kind === "reserva" ? context.essentialAverage * reserveMonths
    : goal.kind === "independencia" ? context.annualSpending * INDEPENDENCE_MULTIPLE : 0);
  const rate = monthlyRate(goal.yieldRate);
  const left = goal.deadline ? monthsUntil(context.month, goal.deadline) : null;
  const required = left === null ? null : requiredMonthly(target, current, Math.max(0, left), rate);
  const eta = monthsToReach(target, current, goal.monthly, rate);
  const etaMonth = eta === null ? null : addMonths(context.month, Math.max(0, eta - 1));
  const done = target > 0 && current >= target;
  const delay = goal.deadline && etaMonth && etaMonth > goal.deadline ? monthsUntil(goal.deadline, etaMonth) - 1 : 0;
  return {
    ...goal, current, target, automaticTarget: goal.target === null, reserveMonths,
    remaining: Math.max(0, target - current), progress: target > 0 ? Math.min(1, current / target) : 0,
    monthsLeft: left, required, eta, etaMonth,
    situation: done ? "concluida" : goal.deadline === null ? (eta === null ? "sem_aporte" : "sem_prazo")
      : eta === null || (etaMonth && etaMonth > goal.deadline) ? "atrasada" : "no_prazo",
    delay,
    // Meses de gasto essencial que a reserva já cobre.
    covered: goal.kind === "reserva" && context.essentialAverage > 0 ? current / context.essentialAverage : null,
  };
}

/** Metas avaliadas, com a reserva de emergência no topo. */
export function evaluateGoals(/** @type {Parameters<typeof evaluateGoal>[0][]} */ goals, /** @type {Parameters<typeof evaluateGoal>[1]} */ context) {
  return goals.map((goal) => evaluateGoal(goal, context))
    .sort((a, b) => Number(b.kind === "reserva") - Number(a.kind === "reserva") || a.priority - b.priority);
}
