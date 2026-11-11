// Destaques do Resumo (SPEC-0003, 1.7): até cinco frases calculadas, ordenadas pelo impacto em reais.

const MIN_CHANGE = 5000; // R$ 50,00
const MIN_SHARE = 0.2;
const PROJECTION_MARGIN = 0.1;
const COMMITMENT_LIMIT = 0.3;
const MIN_MERCHANT = 10000; // R$ 100,00
const MAX_INSIGHTS = 5;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (/** @type {number} */ value) => currency.format(Math.round(value) / 100);
const percent = (/** @type {number} */ value) => Math.round(value * 100) + "%";

/**
 * @typedef {{ id: string; tone: "up" | "down" | "neutral"; text: string; impact: number; target: { section: string; group?: string } }} Insight
 * @param {{
 *   groups: { id: string; label: string; amount: number }[];
 *   groupAverages: Map<string, number>;
 *   recurring: { key: string; label: string; typical: number; lastAmount: number; isNew: boolean; priceChanged: boolean }[];
 *   pace: { isCurrent: boolean; projection: number | null; averageTotal: number };
 *   nextInstallments: { month: string; amount: number } | null;
 *   averageIncome: number;
 *   merchants: { key: string; label: string; amount: number; previousRank: number | null }[];
 * }} input
 * @returns {Insight[]}
 */
export function insights({ groups, groupAverages, recurring, pace, nextInstallments, averageIncome, merchants }) {
  /** @type {Insight[]} */
  const found = [];
  const changes = groups.map((group) => {
    const average = groupAverages.get(group.id) ?? 0;
    return { group, average, diff: group.amount - average };
  }).filter(({ average, diff }) => average > 0 && Math.abs(diff) >= MIN_CHANGE && Math.abs(diff) / average >= MIN_SHARE);
  const up = changes.filter((row) => row.diff > 0).sort((a, b) => b.diff - a.diff)[0];
  const down = changes.filter((row) => row.diff < 0).sort((a, b) => a.diff - b.diff)[0];
  if (up) found.push({
    id: "alta-" + up.group.id, tone: "up", impact: up.diff, target: { section: "categorias", group: up.group.id },
    text: `${up.group.label} subiu ${percent(up.diff / up.average)} sobre a média dos 3 períodos anteriores: ${brl(up.diff)} a mais.`,
  });
  if (down) found.push({
    id: "queda-" + down.group.id, tone: "down", impact: -down.diff, target: { section: "categorias", group: down.group.id },
    text: `${down.group.label} caiu ${percent(-down.diff / down.average)} sobre a média dos 3 períodos anteriores: ${brl(-down.diff)} a menos.`,
  });
  for (const item of recurring) {
    if (item.isNew) found.push({
      id: "nova-" + item.key, tone: "neutral", impact: item.typical * 12, target: { section: "habitos" },
      text: `Nova cobrança recorrente: ${item.label}, ${brl(item.typical)} por mês, ou ${brl(item.typical * 12)} por ano.`,
    });
    else if (item.priceChanged) found.push({
      id: "preco-" + item.key, tone: item.lastAmount > item.typical ? "up" : "down",
      impact: Math.abs(item.lastAmount - item.typical) * 12, target: { section: "habitos" },
      text: `${item.label} passou de ${brl(item.typical)} para ${brl(item.lastAmount)} na última cobrança.`,
    });
  }
  if (pace.isCurrent && pace.projection !== null && pace.averageTotal > 0 &&
      pace.projection > pace.averageTotal * (1 + PROJECTION_MARGIN)) found.push({
    id: "ritmo", tone: "up", impact: pace.projection - pace.averageTotal, target: { section: "resumo" },
    text: `No ritmo atual, o mês fecha em ${brl(pace.projection)}, ${percent(pace.projection / pace.averageTotal - 1)} acima da média dos últimos 3 meses.`,
  });
  if (nextInstallments && averageIncome > 0 && nextInstallments.amount / averageIncome > COMMITMENT_LIMIT) found.push({
    id: "parcelas", tone: "up", impact: nextInstallments.amount, target: { section: "faturas" },
    text: `As parcelas que vencem no próximo mês já comprometem ${percent(nextInstallments.amount / averageIncome)} da sua renda média.`,
  });
  const entered = merchants.slice(0, 5).find((row) => row.amount >= MIN_MERCHANT && (row.previousRank === null || row.previousRank > 5));
  if (entered) found.push({
    id: "top-" + entered.key, tone: "neutral", impact: entered.amount, target: { section: "habitos" },
    text: `${entered.label} entrou entre os 5 maiores gastos do período, com ${brl(entered.amount)}.`,
  });
  return found.sort((a, b) => b.impact - a.impact).slice(0, MAX_INSIGHTS);
}
