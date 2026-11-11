// Resultado do negócio e divisão Profit First (SPEC-0004, REQ-008).
import { businessValue } from "../analytics/classify.mjs";
import { monthOf } from "../analytics/dates.mjs";

/** Divisão do Profit First para receita pequena, aplicada sobre a margem depois da reposição de mercadoria. */
export const PROFIT_FIRST = { lucro: 0.05, retirada: 0.5, impostos: 0.15, operacao: 0.3 };
const COST_PARTS = { negocio_mercadoria: "reposicao", negocio_frete: "operacao", negocio_taxas: "impostos", negocio_outros: "operacao" };

/**
 * @param {import("../analytics/aggregate.mjs").Row[]} rows @param {string} month
 */
export function businessMonth(rows, month) {
  const inMonth = rows.filter((row) => monthOf(row.entry.date) === month);
  let revenue = 0;
  let sales = 0;
  /** @type {Record<string, number>} */
  const costs = { negocio_mercadoria: 0, negocio_frete: 0, negocio_taxas: 0, negocio_outros: 0 };
  let withdrawals = 0;
  for (const row of inMonth) {
    if (row.info.kind === "negocio_receita") {
      revenue += businessValue(row.info);
      if (!row.info.refund) sales += 1;
    } else if (row.info.kind === "negocio_custo") {
      costs[row.info.category] = (costs[row.info.category] ?? 0) + businessValue(row.info);
    } else if (row.info.withdrawal && row.entry.direction === "DEBIT") withdrawals += row.info.amount;
  }
  const cost = Object.values(costs).reduce((total, value) => total + value, 0);
  const profit = revenue - cost;
  return {
    month, revenue, costs, cost, profit, sales, withdrawals,
    margin: revenue > 0 ? profit / revenue : null,
    ticket: sales > 0 ? Math.round(revenue / sales) : null,
  };
}

/**
 * Para cada R$ 100 vendidos: o destino real de hoje e a sugestão. A reposição fica como está;
 * o restante segue as proporções do Profit First.
 * @param {ReturnType<typeof businessMonth>[]} months meses usados como base
 */
export function profitFirst(months) {
  const revenue = months.reduce((total, row) => total + row.revenue, 0);
  if (revenue <= 0) return null;
  const sum = (/** @type {string} */ part) => months.reduce((total, row) =>
    total + Object.entries(row.costs).filter(([id]) => COST_PARTS[id] === part).reduce((value, [, amount]) => value + amount, 0), 0);
  const reposicao = sum("reposicao");
  const impostos = sum("impostos");
  const operacao = sum("operacao");
  const withdrawals = months.reduce((total, row) => total + row.withdrawals, 0);
  const profit = revenue - reposicao - impostos - operacao;
  const retirada = Math.min(Math.max(0, profit), withdrawals);
  const actual = { reposicao, impostos, operacao, retirada, lucro: profit - retirada };
  const margin = Math.max(0, 1 - reposicao / revenue);
  const suggested = {
    reposicao: reposicao / revenue, impostos: margin * PROFIT_FIRST.impostos, operacao: margin * PROFIT_FIRST.operacao,
    retirada: margin * PROFIT_FIRST.retirada, lucro: margin * PROFIT_FIRST.lucro,
  };
  return Object.keys(suggested).map((id) => ({
    id, actual: actual[id] / revenue, suggested: suggested[id], actualPer100: Math.round(actual[id] / revenue * 10000), suggestedPer100: Math.round(suggested[id] * 10000),
  }));
}

/**
 * @param {import("../analytics/aggregate.mjs").Row[]} rows @param {string[]} months do mais antigo ao escolhido
 */
export function businessReport(rows, months) {
  const monthly = months.map((month) => businessMonth(rows, month));
  const current = monthly.at(-1) ?? businessMonth([], months.at(-1) ?? "");
  const previous = monthly.at(-2) ?? null;
  const recent = monthly.slice(-3);
  return {
    hasData: rows.some((row) => row.info.kind === "negocio_receita" || row.info.kind === "negocio_custo"),
    monthly, current, previous,
    split: profitFirst(current.revenue > 0 ? [current] : recent),
    splitBasis: current.revenue > 0 ? "mes" : "tres_meses",
  };
}
