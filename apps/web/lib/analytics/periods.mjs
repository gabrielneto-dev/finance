// Períodos das Análises e o período de comparação equivalente (SPEC-0003, REQ-005).
import { addMonths, daysInMonth, monthOf } from "./dates.mjs";

export const PRESETS = [
  ["mes", "Este mês"], ["anterior", "Mês anterior"], ["3m", "3 meses"], ["6m", "6 meses"],
  ["12m", "12 meses"], ["ano", "Este ano"], ["custom", "Personalizado"],
];

/** Mesmo dia em outro mês, limitado ao último dia dele. */
const sameDay = (/** @type {string} */ month, /** @type {number} */ day) => month + "-" + String(Math.min(day, daysInMonth(month))).padStart(2, "0");
const lastDay = (/** @type {string} */ month) => sameDay(month, 31);

/**
 * @param {string} preset
 * @param {string} today YYYY-MM-DD
 * @param {{ from?: string; to?: string }} [custom]
 * @returns {{ from: string; to: string; compareFrom?: string; compareTo?: string }}
 */
export function resolvePeriod(preset, today, custom = {}) {
  const month = monthOf(today);
  const day = Number(today.slice(8, 10));
  if (preset === "anterior") {
    const previous = addMonths(month, -1);
    return { from: previous + "-01", to: lastDay(previous), compareFrom: addMonths(previous, -1) + "-01", compareTo: lastDay(addMonths(previous, -1)) };
  }
  if (preset === "3m" || preset === "6m" || preset === "12m") {
    // Inclui o mês corrente até hoje e compara com os mesmos dias dos meses anteriores.
    const count = Number(preset.slice(0, -1));
    const start = addMonths(month, -(count - 1));
    return { from: start + "-01", to: today, compareFrom: addMonths(start, -count) + "-01", compareTo: sameDay(addMonths(month, -count), day) };
  }
  if (preset === "ano") {
    const year = Number(today.slice(0, 4));
    return { from: year + "-01-01", to: today, compareFrom: year - 1 + "-01-01", compareTo: sameDay(year - 1 + today.slice(4, 7), day) };
  }
  if (preset === "custom" && custom.from && custom.to && custom.from <= custom.to) return { from: custom.from, to: custom.to };
  const previous = addMonths(month, -1);
  return { from: month + "-01", to: today, compareFrom: previous + "-01", compareTo: sameDay(previous, day) };
}
