// Resumo da tela Início, com as mesmas regras da Visão geral do web (SPEC-0005, REQ-003).
// Reaproveita as funções puras do web, sem copiar.
import { blockedBalances } from "../../../web/lib/balances.ts";
import { maskValue, moneyTotals, monthRange, timestamp } from "../../../web/lib/format.ts";
import type { DashboardData } from "../../../web/lib/types.ts";

export type { DashboardData };

export type Overview = {
  balance: string;
  blocked: { amount: string; ledger: string } | null;
  income: string;
  expense: string;
  lastSync: string | null;
  connections: number;
};

/** Consulta do mês corrente para /api/dashboard. */
export function overviewQuery() {
  const { from, to } = monthRange();
  return "/api/dashboard?" + new URLSearchParams({ from, to }).toString();
}

export function overview(data: DashboardData, hidden = false): Overview {
  const key = (itemId: string, accountId: string) => itemId + "/" + accountId;
  const banks = data.accounts.filter((row) => row.type === "BANK");
  const bankKeys = new Set(banks.map((row) => key(row.itemId, row.id)));
  const balances = banks.flatMap((row) => row.balance === null ? [] : [{ amount: row.balance, currency: row.currency }]);
  const blocked = blockedBalances(banks);
  const posted = data.entries.filter((row) => row.status === "POSTED" && bankKeys.has(key(row.itemId, row.accountId)));
  const lastSync = data.connections.reduce<string | null>(
    (last, row) => row.syncedAt && (!last || row.syncedAt > last) ? row.syncedAt : last, null);
  const mask = (value: string) => String(maskValue(hidden, value));
  return {
    balance: mask(moneyTotals(balances)),
    blocked: blocked.blocked.length ? { amount: mask(moneyTotals(blocked.blocked)), ledger: mask(moneyTotals(blocked.ledger)) } : null,
    income: moneyTotals(posted.filter((row) => row.direction === "CREDIT")),
    expense: moneyTotals(posted.filter((row) => row.direction === "DEBIT")),
    lastSync: lastSync ? timestamp(lastSync) : null,
    connections: data.connections.filter((row) => row.active).length,
  };
}
