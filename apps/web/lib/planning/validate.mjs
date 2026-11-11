// Validação dos pedidos de escrita do Planejamento (SPEC-0004, REQ-010).
// Cada parser devolve { ok: true, value } ou { ok: false, error }, sem confiar em nada do corpo.
import { uuid } from "../config.mjs";
import { CATEGORIES, GROUPS } from "../analytics/categories.mjs";

export const BUCKET_KINDS = ["fixos", "livre", "investir", "reservas", "meta", "negocio", "outro"];
export const BUCKET_MODES = ["valor", "percentual"];
export const GOAL_KINDS = ["reserva", "objetivo", "independencia"];
export const GOAL_SOURCES = ["manual", "investimentos", "conta"];
export const ADJUSTMENT_KINDS = ["renda", "corte", "evento", "aporte"];
export const INVESTMENT_CLASSES = ["renda_fixa", "tesouro", "acoes", "fiis", "fundos", "previdencia", "cripto", "outros"];
export const LIQUIDITY = ["diaria", "vencimento", "longo"];

export const LIMITS = { buckets: 30, goals: 50, adjustments: 50, investments: 200, name: 60, groups: 40, links: 50 };
export const MAX_CENTS = 1_000_000_000_000; // R$ 10 bilhões
export const FULL = 10_000; // 100% em centésimos de ponto

// Grupos e categorias de despesa pessoal que uma caixinha pode receber. Entradas e Negócio ficam fora.
const EXPENSE_GROUPS = GROUPS.filter((group) => !["entradas", "negocio"].includes(group.id)).map((group) => "g:" + group.id);
const EXPENSE_CATEGORIES = CATEGORIES.filter((row) => row.direction === "DEBIT" && row.group !== "negocio").map((row) => "c:" + row.id);
/** Chaves aceitas: grupo, categoria e os aportes em investimento. */
export const BUCKET_KEYS = new Set([...EXPENSE_GROUPS, ...EXPENSE_CATEGORIES, "k:investimento"]);

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ACCOUNT = /^[^/\s]{1,100}\/[^/\s]{1,100}$/;

const fail = (/** @type {string} */ error) => ({ ok: /** @type {const} */ (false), error });
const pass = (/** @type {any} */ value) => ({ ok: /** @type {const} */ (true), value });

/** Nome curto, sem caracteres de controle, com espaços normalizados. */
export function cleanName(/** @type {unknown} */ value, max = LIMITS.name) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name && name.length <= max ? name : null;
}

/** Inteiro entre os limites, inclusive. */
export const integer = (/** @type {unknown} */ value, min, max) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
export const cents = (/** @type {unknown} */ value, min = 0) => integer(value, min, MAX_CENTS);
export const isMonth = (/** @type {unknown} */ value) => typeof value === "string" && MONTH.test(value);
export const isDate = (/** @type {unknown} */ value) => typeof value === "string" && DATE.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z"));
export const isId = (/** @type {unknown} */ value) => typeof value === "string" && uuid.test(value);
export const isAccountKey = (/** @type {unknown} */ value) => typeof value === "string" && ACCOUNT.test(value);
const optionalId = (/** @type {unknown} */ value) => value === undefined || value === null || isId(value);
const oneOf = (/** @type {unknown} */ value, /** @type {readonly string[]} */ list) => typeof value === "string" && list.includes(value);

/** @param {any} body */
export function parseBucket(body) {
  if (!optionalId(body.id)) return fail("Caixinha inválida.");
  const name = cleanName(body.name);
  if (!name) return fail("Dê um nome de até " + LIMITS.name + " caracteres à caixinha.");
  if (!oneOf(body.kind, BUCKET_KINDS)) return fail("Tipo de caixinha inválido.");
  if (!oneOf(body.mode, BUCKET_MODES)) return fail("Escolha valor ou percentual.");
  const valid = body.mode === "valor" ? cents(body.amount) : integer(body.amount, 0, FULL);
  if (!valid) return fail(body.mode === "valor" ? "Informe um valor válido." : "Informe um percentual entre 0 e 100.");
  if (!Array.isArray(body.groups) || body.groups.length > LIMITS.groups || !body.groups.every((key) => BUCKET_KEYS.has(key))) {
    return fail("Grupos de despesa inválidos.");
  }
  if (new Set(body.groups).size !== body.groups.length) return fail("Grupo repetido na caixinha.");
  if (body.sort !== undefined && !integer(body.sort, 0, 1000)) return fail("Ordem inválida.");
  return pass({
    id: body.id ?? null, name, kind: body.kind, mode: body.mode, amount: body.amount, rollover: body.rollover === true,
    archived: body.archived === true, sort: body.sort ?? null, groups: body.groups,
  });
}

/** @param {any} body */
export function parseBucketOrder(body) {
  if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > LIMITS.buckets || !body.ids.every(isId)) return fail("Ordem inválida.");
  if (new Set(body.ids).size !== body.ids.length) return fail("Ordem inválida.");
  return pass({ ids: body.ids });
}

/** Ajuste só de um mês. `amount` nulo volta ao padrão da caixinha. @param {any} body */
export function parseBucketMonth(body) {
  if (!isId(body.id) || !isMonth(body.month)) return fail("Mês ou caixinha inválidos.");
  if (body.amount !== null && !cents(body.amount)) return fail("Informe um valor válido.");
  return pass({ id: body.id, month: body.month, amount: body.amount });
}

/** @param {any} body */
export function parseIncome(body) {
  if (!isMonth(body.month)) return fail("Mês inválido.");
  if (body.expected !== null && !cents(body.expected)) return fail("Informe uma renda válida.");
  return pass({ month: body.month, expected: body.expected });
}

/** @param {any} body */
export function parseGoal(body) {
  if (!optionalId(body.id)) return fail("Meta inválida.");
  const name = cleanName(body.name);
  if (!name) return fail("Dê um nome de até " + LIMITS.name + " caracteres à meta.");
  if (!oneOf(body.kind, GOAL_KINDS)) return fail("Tipo de meta inválido.");
  if (!oneOf(body.source, GOAL_SOURCES)) return fail("Origem do valor inválida.");
  // Reserva e independência calculam o alvo quando ele não vem.
  const target = body.target ?? null;
  if (target === null ? body.kind === "objetivo" : !cents(target, 1)) return fail("Informe o valor da meta.");
  const months = body.months ?? null;
  if (months !== null && !integer(months, 1, 36)) return fail("Use de 1 a 36 meses de reserva.");
  const deadline = body.deadline ?? null;
  if (deadline !== null && !isMonth(deadline)) return fail("Prazo inválido.");
  if (!cents(body.monthly ?? 0)) return fail("Aporte mensal inválido.");
  // Rendimento ao ano em centésimos de ponto, até 50%.
  if (!integer(body.yieldRate ?? 0, 0, 5000)) return fail("Use um rendimento entre 0% e 50% ao ano.");
  if (!cents(body.current ?? 0)) return fail("Valor atual inválido.");
  if (!integer(body.priority ?? 0, 0, 100)) return fail("Prioridade inválida.");
  let link = null;
  if (body.source === "investimentos") {
    if (!Array.isArray(body.link) || !body.link.length || body.link.length > LIMITS.links || !body.link.every(isId)) {
      return fail("Escolha os investimentos da meta.");
    }
    link = [...new Set(body.link)];
  } else if (body.source === "conta") {
    if (!isAccountKey(body.link)) return fail("Escolha a conta da meta.");
    link = body.link;
  }
  return pass({
    id: body.id ?? null, name, kind: body.kind, target, months, deadline, monthly: body.monthly ?? 0,
    yieldRate: body.yieldRate ?? 0, source: body.source, current: body.current ?? 0, link, priority: body.priority ?? 0,
  });
}

/** @param {any} body */
export function parseAdjustment(body) {
  if (!optionalId(body.id)) return fail("Ajuste inválido.");
  if (!oneOf(body.kind, ADJUSTMENT_KINDS)) return fail("Tipo de ajuste inválido.");
  const label = cleanName(body.label, 80);
  if (!label) return fail("Descreva o ajuste em até 80 caracteres.");
  if (!isMonth(body.startMonth)) return fail("Mês inicial inválido.");
  const endMonth = body.endMonth ?? null;
  if (endMonth !== null && (!isMonth(endMonth) || endMonth < body.startMonth)) return fail("Mês final inválido.");
  const amount = body.amount ?? null;
  const percent = body.percent ?? null;
  const group = body.group ?? null;
  if (body.kind === "renda") {
    // Renda muda por percentual ou por valor, para mais ou para menos.
    if ((amount === null) === (percent === null)) return fail("Informe o valor ou o percentual da mudança de renda.");
    if (amount !== null && !integer(amount, -MAX_CENTS, MAX_CENTS)) return fail("Valor inválido.");
    if (percent !== null && !integer(percent, -FULL, 10 * FULL)) return fail("Percentual inválido.");
  } else if (body.kind === "corte") {
    if (!BUCKET_KEYS.has(group) || group === "k:investimento") return fail("Escolha o grupo a cortar.");
    if (!integer(percent, 1, FULL) || amount !== null) return fail("Informe um corte entre 1% e 100%.");
  } else {
    // Evento pontual: positivo é saída e negativo é entrada. Aporte extra é sempre positivo.
    if (percent !== null || !(body.kind === "evento" ? integer(amount, -MAX_CENTS, MAX_CENTS) && amount !== 0 : cents(amount, 1))) {
      return fail("Informe um valor válido.");
    }
  }
  return pass({
    id: body.id ?? null, kind: body.kind, label, startMonth: body.startMonth,
    endMonth: body.kind === "evento" ? body.startMonth : endMonth,
    amount, percent, group: body.kind === "corte" ? group : null, enabled: body.enabled !== false,
  });
}

/** @param {any} body */
export function parseToggle(body) {
  if (!isId(body.id) || typeof body.enabled !== "boolean") return fail("Ajuste inválido.");
  return pass({ id: body.id, enabled: body.enabled });
}

/** @param {any} body */
export function parseId(body) {
  return isId(body.id) ? pass({ id: body.id }) : fail("Item inválido.");
}

/** Investimento manual. @param {any} body */
export function parseInvestment(body) {
  if (!optionalId(body.id)) return fail("Investimento inválido.");
  const name = cleanName(body.name, 80);
  if (!name) return fail("Dê um nome de até 80 caracteres ao investimento.");
  const institution = body.institution == null || body.institution === "" ? null : cleanName(body.institution, 60);
  if (institution === null && body.institution != null && body.institution !== "") return fail("Instituição inválida.");
  if (!oneOf(body.class, INVESTMENT_CLASSES)) return fail("Classe inválida.");
  if (!oneOf(body.liquidity, LIQUIDITY)) return fail("Liquidez inválida.");
  const dueDate = body.dueDate ?? null;
  if (dueDate !== null && !isDate(dueDate)) return fail("Vencimento inválido.");
  // O saldo inicial só vale na criação; depois, use a atualização de saldo, que guarda o histórico.
  if (!body.id && !cents(body.balance)) return fail("Informe o saldo atual.");
  return pass({ id: body.id ?? null, name, institution, class: body.class, liquidity: body.liquidity, dueDate, balance: body.balance ?? null });
}

/** @param {any} body */
export function parseInvestmentBalance(body) {
  if (!isId(body.id)) return fail("Investimento inválido.");
  if (!cents(body.balance)) return fail("Informe o saldo atual.");
  const date = body.date ?? null;
  if (date !== null && !isDate(date)) return fail("Data inválida.");
  return pass({ id: body.id, balance: body.balance, date });
}

/** @param {any} body */
export function parseAccountBusiness(body) {
  const id = (/** @type {unknown} */ value) => typeof value === "string" && value.length > 0 && value.length <= 100 && !/[/\s]/.test(value);
  if (!id(body.itemId) || !id(body.accountId) || typeof body.business !== "boolean") return fail("Conta inválida.");
  return pass({ itemId: body.itemId, accountId: body.accountId, business: body.business });
}

/** Consulta do GET. @param {URLSearchParams} params @param {string} reference */
export function parsePlanningQuery(params, reference) {
  const month = params.get("month") ?? reference.slice(0, 7);
  if (!isMonth(month)) return fail("Mês inválido.");
  const horizon = Number(params.get("horizon") ?? 12);
  if (![12, 24].includes(horizon)) return fail("Use um horizonte de 12 ou 24 meses.");
  return pass({ month, horizon });
}
