// Classificação de cada lançamento para Análises e Gastos (SPEC-0003, REQ-001).
// Ver a decisão em Context/branches/produto/decisions/DEC-20261110-classificacao-analises.md.
import { charged } from "../charged.mjs";
import { categoryById, groupOf, neutralKind, pluggyCategory, SPECIAL_CHOICES } from "./categories.mjs";
import { merchantKey } from "./merchant.mjs";

/** Tipos que contam como consumo ou renda. Os demais são neutros. */
export const SPENDING_KINDS = new Set(["despesa", "estorno"]);
export const INCOME_KINDS = new Set(["receita", "rendimento"]);

/**
 * @typedef {{ value: string; source: "lancamento" | "estabelecimento" }} Choice
 * @typedef {{
 *   kind: "despesa" | "estorno" | "receita" | "rendimento" | "pagamento_fatura" | "transferencia_propria" | "investimento" | "emprestimo" | "ignorado";
 *   category: string; label: string; group: string; groupLabel: string; nature: "essencial" | "estilo" | null;
 *   amount: number; currency: string; pending: boolean; source: "pluggy" | "lancamento" | "estabelecimento";
 * }} Classified
 */

const NEUTRAL_LABEL = {
  pagamento_fatura: "Pagamento de fatura", transferencia_propria: "Transferência entre minhas contas",
  investimento: "Investimento", emprestimo: "Empréstimo e financiamento", ignorado: "Ignorado nas análises",
};

/** @param {string} id @param {string | null} [fallback] */
function describe(id, fallback = null) {
  const category = categoryById(id) ?? categoryById("sem");
  const group = groupOf(/** @type {NonNullable<typeof category>} */ (category).group);
  return {
    category: /** @type {NonNullable<typeof category>} */ (category).id,
    label: fallback ?? /** @type {NonNullable<typeof category>} */ (category).label,
    group: group?.id ?? "outros", groupLabel: group?.label ?? "Sem categoria", nature: group?.nature ?? null,
  };
}

/**
 * Escolha do usuário para o lançamento: a do lançamento vence a do estabelecimento.
 * @param {{ itemId: string; accountId: string; id: string; description: string }} entry
 * @param {{ entries: Map<string, string>; rules: Map<string, string> } | null | undefined} choices
 * @returns {Choice | null}
 */
export function choiceFor(entry, choices) {
  if (!choices) return null;
  const own = choices.entries.get(entryKey(entry));
  if (own) return { value: own, source: "lancamento" };
  const rule = choices.rules.get(merchantKey(entry.description));
  return rule ? { value: rule, source: "estabelecimento" } : null;
}

/** @param {{ itemId: string; accountId: string; id: string }} entry */
export const entryKey = (entry) => entry.itemId + "/" + entry.accountId + "/" + entry.id;

/**
 * @param {import("../types").Entry} entry
 * @param {{ accountType?: "BANK" | "CREDIT"; choice?: Choice | null }} [options]
 * @returns {Classified}
 */
export function classify(entry, { accountType = "BANK", choice = null } = {}) {
  const { amount, currency } = charged(entry);
  const base = { amount, currency, pending: entry.status === "PENDING", source: choice?.source ?? "pluggy" };
  const special = choice && Object.hasOwn(SPECIAL_CHOICES, choice.value)
    ? /** @type {keyof typeof SPECIAL_CHOICES} */ (choice.value) : null;
  if (special) {
    const kind = /** @type {Classified["kind"]} */ (SPECIAL_CHOICES[special].kind);
    return { ...base, kind, ...describe("sem", NEUTRAL_LABEL[kind]), group: "neutro", groupLabel: NEUTRAL_LABEL[kind], nature: null };
  }
  const chosen = choice && categoryById(choice.value) ? choice.value : null;
  if (!chosen) {
    const neutral = entry.method === "Fatura" ? "pagamento_fatura" : neutralKind(entry.category);
    if (neutral) {
      const kind = /** @type {Classified["kind"]} */ (neutral);
      return { ...base, kind, ...describe("sem", NEUTRAL_LABEL[kind]), group: "neutro", groupLabel: NEUTRAL_LABEL[kind], nature: null };
    }
  }
  const id = chosen ?? pluggyCategory(entry.category, entry.direction);
  const category = id ? categoryById(id) : null;
  // Nome desconhecido continua visível, sem perder o lançamento.
  const unknown = !category && entry.category ? entry.category : null;
  if (entry.direction === "DEBIT") {
    const debit = category?.direction === "DEBIT" ? category.id : "sem";
    return { ...base, kind: "despesa", ...describe(debit, debit === "sem" ? unknown : null) };
  }
  if (category?.direction === "CREDIT" && !(accountType === "CREDIT" && !chosen)) {
    return { ...base, kind: category.id === "rendimentos" ? "rendimento" : "receita", ...describe(category.id) };
  }
  // Crédito de consumo, ou qualquer crédito no cartão que não seja pagamento, é estorno.
  if (category?.direction === "DEBIT" || accountType === "CREDIT") {
    const refund = category?.direction === "DEBIT" ? category.id : "sem";
    return { ...base, kind: "estorno", ...describe(refund, refund === "sem" ? unknown : null) };
  }
  return { ...base, kind: "receita", ...describe("outras", unknown) };
}

/**
 * Valor com sinal para somar despesas: despesa soma, estorno abate, o resto não entra.
 * @param {Classified} row
 */
export const spendingValue = (row) => (row.kind === "despesa" ? row.amount : row.kind === "estorno" ? -row.amount : 0);
