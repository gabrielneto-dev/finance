// Datas no formato YYYY-MM-DD, tratadas em UTC para não depender do fuso do servidor.
const DAY = 86_400_000;

export const toTime = (/** @type {string} */ date) => Date.parse(date.slice(0, 10) + "T00:00:00Z");
export const fromTime = (/** @type {number} */ time) => new Date(time).toISOString().slice(0, 10);
export const shiftDays = (/** @type {string} */ date, /** @type {number} */ days) => fromTime(toTime(date) + days * DAY);
export const daysBetween = (/** @type {string} */ from, /** @type {string} */ to) => Math.round((toTime(to) - toTime(from)) / DAY) + 1;
export const monthOf = (/** @type {string} */ date) => date.slice(0, 7);

/** @param {string} month YYYY-MM @param {number} delta */
export function addMonths(month, delta) {
  const [year, value] = month.split("-").map(Number);
  const index = year * 12 + value - 1 + delta;
  return Math.floor(index / 12) + "-" + String(index % 12 + 1).padStart(2, "0");
}

/** @param {string} month */
export const daysInMonth = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

/** Meses de `from` até `to`, inclusive. */
export function monthsBetween(/** @type {string} */ fromMonth, /** @type {string} */ toMonth) {
  const months = [];
  for (let month = fromMonth; month <= toMonth && months.length < 120; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** 0 = domingo. */
export const weekday = (/** @type {string} */ date) => new Date(toTime(date)).getUTCDay();

/**
 * Período anterior com o mesmo número de dias, logo antes de `from`.
 * @param {string} from @param {string} to
 */
export function previousPeriod(from, to) {
  const length = daysBetween(from, to);
  const previousTo = shiftDays(from, -1);
  return { from: shiftDays(previousTo, -(length - 1)), to: previousTo };
}

export const median = (/** @type {number[]} */ values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
