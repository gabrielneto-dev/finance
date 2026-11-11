// Extrato, fatura aberta e conexões no app, com as mesmas regras do web (SPEC-0005, REQ-007).
// Reaproveita as funções puras do web, sem copiar.
import { charged } from "../../../web/lib/charged.mjs";
import { displayDate, displayDateWithYear, maskValue, money, moneyTotals, timestamp, today } from "../../../web/lib/format.ts";
import { filterLedger } from "../../../web/lib/ledger-filter.ts";
import type { Account, DashboardData, Entry, Installment } from "../../../web/lib/types.ts";

const accountKey = (row: { itemId: string; accountId?: string; id?: string }) => row.itemId + "/" + (row.accountId ?? row.id);
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** Mês corrente no fuso de São Paulo, como AAAA-MM. */
export const currentMonth = () => today().slice(0, 7);

export function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  const text = monthName.format(new Date(month + "-01T12:00:00Z"));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Período de um mês para a API. O mês corrente termina hoje; meses futuros não são consultados. */
export function monthBounds(month: string) {
  const current = today();
  const [year, value] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
  return { from: month + "-01", to: last < current ? last : current };
}

export function ledgerQuery(month: string) {
  return "/api/dashboard?" + new URLSearchParams(monthBounds(month)).toString();
}

/** Início: Visão geral do mês e fatura aberta de cada cartão. */
export function homeQuery() {
  return ledgerQuery(currentMonth()) + "&open=1";
}

/** Só as conexões: período de um dia, para trazer o mínimo de lançamentos. */
export function connectionsQuery() {
  const day = today();
  return "/api/dashboard?" + new URLSearchParams({ from: day, to: day }).toString();
}

export const accountLabel = (row: Account) => row.name.trim() + (row.last4 ? " · " + row.last4 : "");

export function accountOptions(data: DashboardData) {
  return data.accounts.map((row) => ({ key: accountKey(row), label: accountLabel(row) }));
}

export type EntryRow = {
  key: string; description: string; detail: string; date: string; pending: boolean;
  credit: boolean; amount: string; charged: string | null;
};

export function entryRow(row: Entry, accounts: Account[]): EntryRow {
  const account = accounts.find((item) => accountKey(item) === accountKey(row));
  const cost = charged(row);
  const detail = [
    account?.name.trim(),
    row.method,
    row.installment && row.installments ? row.installment + "/" + row.installments : null,
    row.purchaseDate ? "compra em " + displayDate(row.purchaseDate) : null,
  ].filter(Boolean).join(" · ");
  return {
    key: accountKey(row) + "/" + row.id,
    description: row.description,
    detail,
    date: displayDate(row.date) + (row.time ? " · " + row.time : ""),
    pending: row.status === "PENDING",
    credit: row.direction === "CREDIT",
    amount: (row.direction === "CREDIT" ? "+" : "−") + money(row.amount, row.currency),
    charged: cost.currency !== row.currency ? money(cost.amount, cost.currency) + " cobrados" : null,
  };
}

/** Lançamentos do período, opcionalmente de uma conta, na ordem da API (mais novos primeiro). */
export function ledgerRows(data: DashboardData, account = "") {
  return filterLedger(data.entries, { account, method: "", hours: "" }).map((row) => entryRow(row, data.accounts));
}

export type ForecastRow = { key: string; description: string; detail: string; amount: string };

const forecastRow = (row: Installment): ForecastRow => ({
  key: accountKey(row) + "/" + row.id + "/" + row.installment,
  description: row.description,
  detail: row.installment + "/" + row.installments + (row.estimated ? " · prevista" : " · importada"),
  amount: money(row.amount, row.currency),
});

export type OpenBillCard = {
  key: string; card: string; total: string; when: string; parts: string;
  entries: EntryRow[]; forecast: ForecastRow[];
};

/** Fatura aberta de cada cartão, calculada pelo servidor (open=1). O valor segue "ocultar valores". */
export function openBills(data: DashboardData, hidden = false): OpenBillCard[] {
  return (data.openBills ?? []).filter((bill) => bill.count > 0).map((bill) => {
    const card = data.accounts.find((row) => accountKey(row) === accountKey(bill));
    const mask = (value: string) => String(maskValue(hidden, value));
    const when = [
      bill.closes ? "Fecha " + displayDateWithYear(bill.closes) : null,
      bill.due ? "vence " + displayDateWithYear(bill.due) : "vence em " + monthLabel(bill.month).toLowerCase(),
    ].filter(Boolean).join(" · ");
    const parts = ([["Compras", bill.purchases], ["Parcelas importadas", bill.imported], ["Parcelas previstas", bill.estimated]] as const)
      .filter(([, totals]) => totals.length).map(([label, totals]) => label + " " + mask(moneyTotals([...totals]))).join(" · ");
    return {
      key: accountKey(bill), card: card ? accountLabel(card) : "Cartão", total: mask(moneyTotals(bill.total)), when, parts,
      entries: bill.entries.map((row) => entryRow(row, data.accounts)), forecast: bill.forecast.map(forecastRow),
    };
  });
}

const STATES: Record<string, string> = {
  CONECTADA: "Conectada", IMPORTANDO: "Importando", RECONECTAR: "Reconectar",
  "ATENÇÃO": "Atenção", PARCIAL: "Importação parcial", REMOVENDO: "Removendo",
};

export function connectionRows(data: DashboardData) {
  return data.connections.filter((row) => row.active).map((row) => ({
    key: row.id,
    name: row.label || row.name,
    status: STATES[row.status] ?? row.status,
    ok: row.status === "CONECTADA",
    synced: row.syncedAt ? "Sincronizada em " + timestamp(row.syncedAt) : "Ainda não sincronizada",
    // Mesmas regras do painel web: reconectar quando o banco pede; atualizar no Meu Pluggy só nessa conexão.
    reconnect: row.status === "RECONECTAR",
    importing: row.status === "IMPORTANDO",
    meuPluggy: row.name === "MeuPluggy" && row.status !== "RECONECTAR",
  }));
}
