// Recortes do detalhe lateral, usados por várias páginas das Análises.
import type { AnalyticsData, AnalyticsEntry } from "@/lib/analytics/types";
import type { DetailSpec } from "./detail-sheet";

const spending = (entry: AnalyticsEntry) => entry.info.kind === "despesa" || entry.info.kind === "estorno";

export function groupDetail(data: AnalyticsData, id: string, label: string): DetailSpec {
  return {
    title: label, filter: (entry) => spending(entry) && entry.info.group === id,
    series: data.monthlyByGroup.map((row) => ({ month: row.month, amount: row.values[id] ?? 0 })),
  };
}

export function categoryDetail(group: string, label: string): DetailSpec {
  return { title: label, filter: (entry) => spending(entry) && entry.info.group === group && entry.info.label === label };
}

export function merchantDetail(key: string, label: string): DetailSpec {
  return { title: label, filter: (entry) => spending(entry) && entry.merchant === key };
}

export function dayDetail(date: string, label: string): DetailSpec {
  return { title: label, filter: (entry) => spending(entry) && entry.date === date };
}

export function incomeDetail(label: string): DetailSpec {
  return { title: label, mode: "amount", filter: (entry) => (entry.info.kind === "receita" || entry.info.kind === "rendimento") && entry.info.label === label };
}

export function methodDetail(label: string, accountType?: (key: string) => string | undefined): DetailSpec {
  return {
    title: "Pago com " + label,
    filter: (entry) => spending(entry) && (entry.method ?? (accountType?.(entry.itemId + "/" + entry.accountId) === "CREDIT" ? "Crédito" : "Não informada")) === label,
  };
}
