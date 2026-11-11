// Recorrências e assinaturas detectadas pelos lançamentos (SPEC-0003, 1.6).
import { addMonths, median, monthOf, toTime } from "./dates.mjs";
import { merchantLabel } from "./merchant.mjs";

const MIN_MONTHS = 3;
const WINDOW_MONTHS = 6;
const MIN_INTERVAL = 25;
const MAX_INTERVAL = 35;
const MAX_VARIATION = 0.2;
const PRICE_CHANGE = 0.05;
const NEW_DAYS = 95; // começou nos últimos três ciclos

/**
 * @param {import("./aggregate.mjs").Row[]} rows despesas classificadas
 * @param {string} reference data final da análise
 */
export function recurring(rows, reference) {
  const since = addMonths(monthOf(reference), -(WINDOW_MONTHS - 1)) + "-01";
  const byMerchant = new Map();
  for (const row of rows) {
    if (row.info.kind !== "despesa" || row.entry.date > reference) continue;
    // Parcelas não são assinatura.
    if ((row.entry.installments ?? 1) > 1) continue;
    byMerchant.set(row.merchant, [...(byMerchant.get(row.merchant) ?? []), row]);
  }
  const found = [];
  for (const [key, all] of byMerchant) {
    const charges = all.filter((row) => row.entry.date >= since).sort((a, b) => a.entry.date.localeCompare(b.entry.date));
    const months = new Set(charges.map((row) => monthOf(row.entry.date)));
    if (months.size < MIN_MONTHS) continue;
    const amounts = charges.map((row) => row.info.amount);
    const typical = median(amounts);
    const mean = amounts.reduce((total, value) => total + value, 0) / amounts.length;
    const deviation = Math.sqrt(amounts.reduce((total, value) => total + (value - mean) ** 2, 0) / amounts.length);
    if (!mean || deviation / mean >= MAX_VARIATION) continue;
    const intervals = charges.slice(1).map((row, index) => (toTime(row.entry.date) - toTime(charges[index].entry.date)) / 86_400_000);
    const interval = median(intervals);
    if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) continue;
    const last = charges.at(-1);
    const first = all.map((row) => row.entry.date).sort()[0];
    found.push({
      key, label: merchantLabel(key), group: last.info.groupLabel, category: last.info.label,
      typical: Math.round(typical), monthly: Math.round(typical), annual: Math.round(typical * 12),
      lastDate: last.entry.date, lastAmount: last.info.amount, count: charges.length,
      isNew: (toTime(reference) - toTime(first)) / 86_400_000 <= NEW_DAYS,
      priceChanged: typical > 0 && Math.abs(last.info.amount - typical) / typical > PRICE_CHANGE,
    });
  }
  return found.sort((a, b) => b.monthly - a.monthly);
}
