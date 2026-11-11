// Tendências de gasto (SPEC-0004, REQ-006): alta consistente, acima do planejado e recorrência nova.
import { spendingValue } from "../analytics/classify.mjs";
import { GROUPS } from "../analytics/categories.mjs";
import { monthOf } from "../analytics/dates.mjs";

export const RISING = 0.08; // +8% ao mês
const MIN_MONTHS = 3;
const ABOVE_MONTHS = 2;

/** Inclinação da reta de mínimos quadrados, em unidades por mês. */
export function slope(/** @type {number[]} */ values) {
  const count = values.length;
  if (count < 2) return 0;
  const meanX = (count - 1) / 2;
  const meanY = values.reduce((total, value) => total + value, 0) / count;
  let top = 0;
  let bottom = 0;
  values.forEach((value, index) => { top += (index - meanX) * (value - meanY); bottom += (index - meanX) ** 2; });
  return bottom ? top / bottom : 0;
}

/** Variação relativa por mês: inclinação sobre a média. */
export function monthlyChange(/** @type {number[]} */ values) {
  const mean = values.reduce((total, value) => total + value, 0) / (values.length || 1);
  return mean > 0 ? slope(values) / mean : 0;
}

/**
 * @param {{
 *   rows: import("../analytics/aggregate.mjs").Row[]; months: string[];
 *   buckets: { id: string; name: string; planned: (month: string) => number; spent: (month: string) => number }[];
 *   recurring: { key: string; label: string; group: string; monthly: number; isNew: boolean }[];
 * }} input meses completos, do mais antigo ao mais recente
 */
export function trends({ rows, months, buckets, recurring }) {
  const series = new Map();
  for (const row of rows) {
    if (row.info.kind !== "despesa" && row.info.kind !== "estorno") continue;
    const index = months.indexOf(monthOf(row.entry.date));
    if (index < 0) continue;
    for (const [key, label, group] of [["g:" + row.info.group, row.info.groupLabel, row.info.group],
      ["c:" + row.info.group + "/" + row.info.label, row.info.label, row.info.group]]) {
      const item = series.get(key) ?? { key, label, group, values: new Array(months.length).fill(0) };
      item.values[index] += spendingValue(row.info);
      series.set(key, item);
    }
  }
  const found = [];
  for (const item of series.values()) {
    const filled = item.values.filter((value) => value > 0).length;
    const change = monthlyChange(item.values);
    if (filled < MIN_MONTHS || change < RISING) continue;
    const isGroup = item.key.startsWith("g:");
    // A categoria só aparece quando o grupo dela não subiu, para não repetir.
    if (!isGroup && found.some((row) => row.key === "g:" + item.group)) continue;
    found.push({
      id: "subindo/" + item.key, key: item.key, kind: "subindo", label: item.label,
      groupLabel: GROUPS.find((group) => group.id === item.group)?.label ?? item.label, group: item.group,
      change, spark: item.values, latest: item.values.at(-1) ?? 0,
    });
  }
  for (const bucket of buckets) {
    let streak = 0;
    for (let index = months.length - 1; index >= 0; index -= 1) {
      if (bucket.spent(months[index]) > bucket.planned(months[index]) && bucket.planned(months[index]) > 0) streak += 1;
      else break;
    }
    if (streak >= ABOVE_MONTHS) {
      found.push({ id: "acima/" + bucket.id, key: bucket.id, kind: "acima", label: bucket.name, months: streak,
        spark: months.map((month) => bucket.spent(month)), bucket: bucket.id, latest: bucket.spent(months.at(-1) ?? "") });
    }
  }
  for (const item of recurring) {
    if (!item.isNew) continue;
    found.push({ id: "recorrente/" + item.key, key: item.key, kind: "recorrente", label: item.label, groupLabel: item.group,
      monthly: item.monthly, merchant: item.key, spark: [], latest: item.monthly });
  }
  const order = { acima: 0, subindo: 1, recorrente: 2 };
  return found.sort((a, b) => order[a.kind] - order[b.kind] || b.latest - a.latest);
}
