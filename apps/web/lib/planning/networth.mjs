// Patrimônio e investimentos (SPEC-0004, REQ-007).
import { monthOf } from "../analytics/dates.mjs";

export const CLASS_LABEL = {
  renda_fixa: "Renda fixa", tesouro: "Tesouro Direto", acoes: "Ações", fiis: "Fundos imobiliários", fundos: "Fundos",
  previdencia: "Previdência", cripto: "Cripto", outros: "Outros",
};
export const LIQUIDITY_LABEL = { diaria: "Liquidez diária", vencimento: "No vencimento", longo: "Longo prazo" };

/** Saldo de um investimento no fim de uma data, pelo último snapshot até ela. */
export function balanceAt(/** @type {{ snapshots: { date: string; balance: number }[] }} */ investment, /** @type {string} */ date) {
  let value = 0;
  for (const snapshot of investment.snapshots) if (snapshot.date <= date) value = snapshot.balance;
  return value;
}

/**
 * Aportes líquidos por mês: aplicação soma e resgate abate.
 * @param {import("../analytics/aggregate.mjs").Row[]} rows @param {string[]} months
 */
export function contributions(rows, months) {
  return months.map((month) => ({
    month,
    amount: rows.filter((row) => row.info.kind === "investimento" && monthOf(row.entry.date) === month)
      .reduce((total, row) => total + (row.entry.direction === "DEBIT" ? row.info.amount : -row.info.amount), 0),
  }));
}

/**
 * @param {{
 *   cash: number; cardDebt: number; installmentsDebt: number;
 *   investments: { id: string; name: string; source: string; class: string; liquidity: string; balance: number;
 *     snapshots: { date: string; balance: number }[] }[];
 *   cashHistory: { date: string; balance: number }[];
 *   monthEnds: { month: string; date: string }[];
 *   rows: import("../analytics/aggregate.mjs").Row[];
 *   month: string; income: number; essentialAverage: number;
 * }} input
 */
export function networth(input) {
  const invested = input.investments.reduce((total, row) => total + row.balance, 0);
  const total = input.cash + invested - input.cardDebt - input.installmentsDebt;
  const group = (/** @type {(row: (typeof input.investments)[number]) => string} */ key, /** @type {Record<string, string>} */ labels) => {
    const map = new Map();
    for (const row of input.investments) map.set(key(row), (map.get(key(row)) ?? 0) + row.balance);
    return Array.from(map, ([id, amount]) => ({ id, label: labels[id] ?? id, amount, share: invested > 0 ? amount / invested : 0 }))
      .sort((a, b) => b.amount - a.amount);
  };
  const months = input.monthEnds.map((row) => row.month);
  const flows = contributions(input.rows, months);
  const monthFlow = flows.find((row) => row.month === input.month)?.amount ?? 0;
  const liquid = input.cash + input.investments.filter((row) => row.liquidity === "diaria").reduce((sum, row) => sum + row.balance, 0);
  // Evolução: saldo das contas reconstruído e o último snapshot de cada investimento em cada fim de mês.
  const cashAt = new Map(input.cashHistory.map((point) => [point.date, point.balance]));
  const history = input.monthEnds.map(({ month, date }) => {
    const accounts = cashAt.get(date) ?? null;
    const investments = input.investments.reduce((sum, row) => sum + balanceAt(row, date), 0);
    return { month, accounts, investments, total: accounts === null ? null : accounts + investments };
  });
  return {
    total, cash: input.cash, invested, cardDebt: input.cardDebt, installmentsDebt: input.installmentsDebt,
    byClass: group((row) => row.class, CLASS_LABEL), byLiquidity: group((row) => row.liquidity, LIQUIDITY_LABEL),
    contributions: flows, monthContribution: monthFlow,
    investmentRate: input.income > 0 ? monthFlow / input.income : null,
    reserveMonths: input.essentialAverage > 0 ? liquid / input.essentialAverage : null,
    liquid, history,
  };
}
