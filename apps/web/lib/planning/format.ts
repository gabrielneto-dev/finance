// Entrada e exibição de valores do Planejamento. Sem "use client": usado também nos testes.
import { CATEGORIES, GROUPS } from "../analytics/categories.mjs";

/** Texto como "1.234,56" ou "1234.5" em centavos. Null quando não é um valor. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[R$\s]/g, "");
  if (!clean) return null;
  const normalized = /,\d{1,2}$/.test(clean) ? clean.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(clean) ? clean.replace(/\./g, "") : clean.replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(value) ? value : null;
}

/** Percentual como "55,5" em centésimos de ponto (5550). */
export function parsePercent(text: string): number | null {
  const clean = text.replace(/[%\s]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** Centavos para o campo de texto. */
export const moneyInput = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const percentInput = (points: number | null | undefined) =>
  points == null ? "" : (points / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const groupLabels = new Map(GROUPS.map((group) => [group.id, group.label]));
const categoryLabels = new Map(CATEGORIES.map((row) => [row.id, row.label]));

/** Nome de uma chave de caixinha: grupo, categoria ou aportes. */
export function keyLabel(key: string) {
  if (key === "k:investimento") return "Aportes em investimento";
  const [type, id] = key.split(":");
  return (type === "g" ? groupLabels.get(id) : categoryLabels.get(id)) ?? id;
}

/** Grupos e categorias de despesa que uma caixinha pode receber, agrupados. */
export function bucketOptions() {
  const groups = GROUPS.filter((group) => !["entradas", "negocio"].includes(group.id));
  return groups.map((group) => ({
    key: "g:" + group.id, label: group.label,
    categories: CATEGORIES.filter((row) => row.group === group.id && row.direction === "DEBIT").map((row) => ({ key: "c:" + row.id, label: row.label })),
  }));
}

export const BUCKET_KIND_LABEL: Record<string, string> = {
  fixos: "Fixos", livre: "Livre", investir: "Investir", reservas: "Reservas e objetivos", meta: "Meta", negocio: "Negócio", outro: "Outra",
};
/** Cor fixa de cada tipo de caixinha, com os tokens da paleta das Análises. */
export const BUCKET_COLOR: Record<string, string> = {
  fixos: "var(--series-1)", livre: "var(--series-2)", investir: "var(--series-4)", reservas: "var(--series-3)",
  meta: "var(--series-5)", negocio: "var(--seq-5)", outro: "var(--seq-3)",
};
export const UNASSIGNED_COLOR = "var(--series-other)";
