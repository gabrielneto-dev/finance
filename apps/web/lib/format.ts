import { charged } from "./charged.mjs";
const zone = "America/Sao_Paulo";

export function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: zone, dateStyle: "short" }).format(new Date());
}

export function monthRange() {
  const current = today();
  return { from: current.slice(0, 7) + "-01", to: current };
}

export function money(amount: number, currency: string) {
  const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
  return formatter.format(amount / 10 ** formatter.resolvedOptions().maximumFractionDigits!);
}

export function displayDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(date.slice(0, 10) + "T12:00:00Z"));
}

const dateWithYear = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" });

// Faturas cobrem mais de 12 meses; o ano distingue ciclos com o mesmo dia e mês.
export function displayDateWithYear(date: string | null) {
  if (!date) return "—";
  return dateWithYear.format(new Date(date.slice(0, 10) + "T12:00:00Z"));
}

export function timestamp(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: zone }).format(new Date(date));
}

// Saldos, limites e faturas podem ser ocultados; lançamentos ficam sempre visíveis (REQ-016).
export function maskValue<T extends string | null | undefined>(hidden: boolean, value: T): T | string {
  return hidden && value != null && value !== "—" ? "R$ ••••••" : value;
}

type Charged = Parameters<typeof charged>[0];

// Soma por moeda usando o valor cobrado na moeda da conta quando o banco o informa.
export function moneyTotals(rows: Charged[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const { amount, currency } = charged(row);
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return totals.size ? Array.from(totals, ([currency, amount]) => money(amount, currency)).join(" · ") : "—";
}
