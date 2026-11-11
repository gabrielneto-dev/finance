// Classificação de cada lançamento para Análises e Gastos (SPEC-0003, REQ-001).
// Ver a decisão em Context/branches/produto/decisions/DEC-20261110-classificacao-analises.md.
import { charged } from "../charged.mjs";
import { BUSINESS_GROUP, categoryById, groupOf, neutralKind, pluggyCategory, SPECIAL_CHOICES } from "./categories.mjs";
import { merchantKey } from "./merchant.mjs";

/** Tipos que contam como consumo ou renda. Os demais são neutros. */
export const SPENDING_KINDS = new Set(["despesa", "estorno"]);
export const INCOME_KINDS = new Set(["receita", "rendimento"]);
/** Vendas e custos do negócio, fora das finanças pessoais (SPEC-0004, REQ-001). */
export const BUSINESS_KINDS = new Set(["negocio_receita", "negocio_custo"]);

/**
 * @typedef {{ value: string; source: "lancamento" | "estabelecimento" }} Choice
 * @typedef {{
 *   kind: "despesa" | "estorno" | "receita" | "rendimento" | "pagamento_fatura" | "transferencia_propria" | "investimento" | "emprestimo" | "ignorado"
 *     | "negocio_receita" | "negocio_custo";
 *   category: string; label: string; group: string; groupLabel: string; nature: "essencial" | "estilo" | null;
 *   amount: number; currency: string; pending: boolean; source: "pluggy" | "lancamento" | "estabelecimento";
 *   refund?: boolean; withdrawal?: boolean;
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
 * Venda ou custo do negócio. O lançamento na direção contrária à da categoria abate o valor.
 * @param {{ amount: number; currency: string; pending: boolean; source: Classified["source"] }} base
 * @param {import("./categories.mjs").Category} category
 * @param {"DEBIT" | "CREDIT"} direction
 * @returns {Classified}
 */
function businessRow(base, category, direction) {
  const kind = category.direction === "CREDIT" ? "negocio_receita" : "negocio_custo";
  return { ...base, kind, ...describe(category.id), refund: direction !== category.direction };
}

/**
 * @param {import("../types").Entry} entry
 * @param {{ accountType?: "BANK" | "CREDIT"; choice?: Choice | null; business?: boolean }} [options]
 * `business` marca a conta do negócio (SPEC-0004, REQ-001).
 * @returns {Classified}
 */
export function classify(entry, { accountType = "BANK", choice = null, business = false } = {}) {
  const { amount, currency } = charged(entry);
  const base = { amount, currency, pending: entry.status === "PENDING", source: choice?.source ?? "pluggy" };
  const special = choice && Object.hasOwn(SPECIAL_CHOICES, choice.value)
    ? /** @type {keyof typeof SPECIAL_CHOICES} */ (choice.value) : null;
  if (special) {
    const kind = /** @type {Classified["kind"]} */ (SPECIAL_CHOICES[special].kind);
    // Aporte e retirada mostram o próprio nome; as demais escolhas mantêm o nome do tipo.
    const label = special === "aporte" || special === "retirada" ? SPECIAL_CHOICES[special].label : NEUTRAL_LABEL[kind];
    return { ...base, kind, ...describe("sem", label), group: "neutro", groupLabel: label, nature: null,
      ...(special === "retirada" ? { withdrawal: true } : {}) };
  }
  const chosen = choice && categoryById(choice.value) ? choice.value : null;
  if (!chosen) {
    const neutral = entry.method === "Fatura" ? "pagamento_fatura" : neutralKind(entry.category);
    if (neutral) {
      const kind = /** @type {Classified["kind"]} */ (neutral);
      // Na conta do negócio, a saída para outra conta própria é retirada (pró-labore).
      const withdrawal = business && kind === "transferencia_propria" && entry.direction === "DEBIT";
      return { ...base, kind, ...describe("sem", NEUTRAL_LABEL[kind]), group: "neutro", groupLabel: NEUTRAL_LABEL[kind], nature: null,
        ...(withdrawal ? { withdrawal: true } : {}) };
    }
  }
  const chosenCategory = chosen ? categoryById(chosen) : null;
  if (chosenCategory?.group === BUSINESS_GROUP) return businessRow(base, chosenCategory, entry.direction);
  if (!chosen && business) {
    // Sem escolha, a conta do negócio vende pelos créditos e gasta pelos débitos. No cartão, crédito é estorno de custo.
    const id = entry.direction === "CREDIT" && accountType !== "CREDIT" ? "negocio_vendas" : "negocio_outros";
    return businessRow(base, /** @type {import("./categories.mjs").Category} */ (categoryById(id)), entry.direction);
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

/**
 * Valor com sinal dentro do negócio: venda e custo somam no próprio total, o estorno abate.
 * @param {Classified} row
 */
export const businessValue = (row) => (BUSINESS_KINDS.has(row.kind) ? (row.refund ? -row.amount : row.amount) : 0);
