// Ajudantes de Gastos que usam a classificação das Análises (SPEC-0003, REQ-003).
import { classify, SPENDING_KINDS, spendingValue, type Classified } from "./classify.mjs";
import { money } from "../format";
import type { Account, Entry } from "../types";

export type Analyzed = { row: Entry; info: Classified };

const key = (row: { itemId: string; accountId?: string; id?: string }) => row.itemId + "/" + (row.accountId ?? row.id);

/** Classifica cada lançamento com o tipo da conta e a escolha do proprietário. */
export function analyzer(accounts: Account[]) {
  const types = new Map(accounts.map((row) => [key(row), row.type]));
  return (row: Entry): Classified => classify(row, { accountType: types.get(key(row)) ?? "BANK", choice: row.choice ?? null });
}

/** Lançamentos que contam em Gastos: despesas e estornos. */
export function spendingEntries(rows: Entry[], analyze: (row: Entry) => Classified): Analyzed[] {
  return rows.flatMap((row) => {
    const info = analyze(row);
    return SPENDING_KINDS.has(info.kind) ? [{ row, info }] : [];
  });
}

/** Total líquido por moeda: despesas menos estornos. */
export function spendingTotals(rows: Analyzed[]) {
  const totals = new Map<string, number>();
  for (const { info } of rows) totals.set(info.currency, (totals.get(info.currency) ?? 0) + spendingValue(info));
  return totals.size ? Array.from(totals, ([currency, amount]) => money(amount, currency)).join(" · ") : "—";
}
