import { createHash } from "node:crypto";
import { uuid } from "./config.mjs";

const base = "https://api.pluggy.ai";
const moneyFields = new Set([
  "amount", "amountInAccountCurrency", "balance", "totalAmount",
  "availableCreditLimit", "creditLimit", "minimumPayment", "minimumPaymentAmount", "balanceForeignCurrency",
  "closingBalance", "automaticallyInvestedBalance", "overdraftContractedLimit", "overdraftUsedLimit", "unarrangedOverdraftAmount",
]);
const currencies = new Set(Intl.supportedValuesOf("currency"));
let key;
let expires = 0;
let authRequest;

const MAX_DETAIL_LENGTH = 200;

export class PluggyError extends Error {
  constructor(status, detail = "") {
    super("A Pluggy retornou HTTP " + status + (detail ? ": " + detail : ""));
    this.status = status;
    this.detail = detail;
  }
}

// Guarda apenas a mensagem curta da Pluggy para diagnóstico, nunca o corpo inteiro.
async function errorDetail(response) {
  try {
    const body = JSON.parse(await response.text());
    return typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").trim().slice(0, MAX_DETAIL_LENGTH) : "";
  } catch {
    return "";
  }
}

async function request(path, method = "GET", body, credential) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(credential ? { "X-API-KEY": credential } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new PluggyError(response.status, await errorDetail(response));
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text, (field, value, context) =>
    moneyFields.has(field) && typeof value === "number" ? context.source : value);
}

async function apiKey() {
  if (key && Date.now() < expires) return key;
  if (!authRequest) {
    const { PLUGGY_CLIENT_ID: clientId, PLUGGY_CLIENT_SECRET: clientSecret } = process.env;
    if (!clientId || !clientSecret) throw new Error("Credenciais da Pluggy ausentes");
    authRequest = request("/auth", "POST", { clientId, clientSecret }).then((result) => {
      if (typeof result?.apiKey !== "string" || !result.apiKey) throw new Error("Chave da Pluggy ausente");
      key = result.apiKey;
      expires = Date.now() + 105 * 60_000;
      return key;
    }).finally(() => { authRequest = undefined; });
  }
  return authRequest;
}

export async function pluggy(path, method = "GET", body) {
  const credential = await apiKey();
  try {
    return await request(path, method, body, credential);
  } catch (error) {
    if (!(error instanceof PluggyError) || error.status !== 401) throw error;
    if (key === credential) expires = 0;
    return request(path, method, body, await apiKey());
  }
}

export function minor(value, currency) {
  if (!currencies.has(currency)) throw new Error("Moeda não reconhecida");
  const decimal = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!decimal) throw new Error("Valor inválido");
  const [, sign, integer, fraction = "", exponent = "0"] = decimal;
  const scale = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  const shift = Number(exponent) + scale - fraction.length;
  const digits = (integer + fraction).replace(/^0+/, "");
  if (!digits) return 0;
  if (!Number.isSafeInteger(shift) || digits.length + shift > 16) throw new Error("Valor fora do intervalo");
  if (shift < 0 && (digits.length + shift <= 0 || /[^0]/.test(digits.slice(shift)))) {
    throw new Error("Precisão monetária incompatível");
  }
  const result = Number(sign + (shift < 0 ? digits.slice(0, shift) : digits + "0".repeat(shift)));
  if (!Number.isSafeInteger(result)) throw new Error("Valor fora do intervalo");
  return result;
}

export async function list(path, query) {
  const rows = [];
  for (let page = 1; page <= 500; page++) {
    const data = await pluggy(path + "?" + new URLSearchParams({ ...query, page: String(page) }));
    if (!Array.isArray(data?.results) || !Number.isInteger(data.totalPages)) throw new Error("Página inválida");
    rows.push(...data.results);
    if (page >= data.totalPages) return rows;
  }
  throw new Error("Limite de páginas excedido");
}

export async function transactions(accountId, filters = {}, accountCurrency = null) {
  let next = "?" + new URLSearchParams({ accountId, ...filters });
  const seen = new Set();
  const rows = [];
  while (next !== null) {
    if (typeof next !== "string" || !next.startsWith("?") || seen.has(next) || seen.size >= 500) throw new Error("Cursor inválido");
    const query = new URLSearchParams(next);
    if (query.getAll("accountId").length !== 1 || query.get("accountId") !== accountId) throw new Error("Cursor fora da conta");
    seen.add(next);
    const page = await pluggy("/v2/transactions" + next);
    if (!Array.isArray(page?.results)) throw new Error("Página de transações inválida");
    rows.push(...page.results.map((row) => normalizeTransaction(row, accountId, accountCurrency)));
    next = page.next;
  }
  return rows;
}

const payment = {
  PIX: "Pix", TED: "TED", DOC: "DOC", TRANSFERENCIA_MESMA_INSTITUICAO: "Transferência",
  TRANSFERENCIA: "Transferência", BOLETO: "Boleto", CARTAO: "Cartão",
  CARTAO_DEBITO: "Débito", CARTAO_CREDITO: "Crédito", PAGAMENTO_FATURA: "Fatura",
};
const transfers = new Set(["Pix", "TED", "DOC", "Transferência"]);

function installmentMetadata(row, card) {
  if (!Number.isInteger(card?.totalInstallments) || card.totalInstallments < 2 ||
      !Number.isInteger(card.installmentNumber) || card.installmentNumber < 1 ||
      card.installmentNumber > card.totalInstallments) return {};
  const purchaseDate = typeof card.purchaseDate === "string" && Number.isFinite(Date.parse(card.purchaseDate))
    ? new Date(card.purchaseDate).toISOString() : null;
  const description = [row.descriptionRaw, row.description]
    .find((value) => typeof value === "string" && value.trim())?.trim().replace(/\s+/g, " ").toUpperCase();
  const last4 = typeof card.cardNumber === "string" ? card.cardNumber.replace(/\D/g, "").slice(-4) : "";
  return {
    installmentMonth: row.date.slice(0, 7),
    billForecastMonth: /^\d{4}-(0[1-9]|1[0-2])$/.test(card.billForecastDate) ? card.billForecastDate : null,
    installmentPlan: purchaseDate && description ? createHash("sha256")
      .update(JSON.stringify([purchaseDate, description, last4, row.currencyCode, card.totalInstallments])).digest("hex") : null,
  };
}

// Valor cobrado na moeda da conta, informado pelo banco para compras em outra moeda.
function accountAmount(row, accountCurrency) {
  if (!accountCurrency || accountCurrency === row.currencyCode || row.amountInAccountCurrency == null) return {};
  try {
    return { accountCurrency, accountAmount: Math.abs(minor(row.amountInAccountCurrency, accountCurrency)) };
  } catch {
    return {};
  }
}

export function normalizeTransaction(row, accountId, accountCurrency = null) {
  if (row.accountId !== accountId || !uuid.test(row.id)) throw new Error("Transação fora do escopo");
  if (!["CREDIT", "DEBIT"].includes(row.type) || !["PENDING", "POSTED"].includes(row.status)) throw new Error("Transação inválida");
  if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(row.date) || !Number.isFinite(Date.parse(row.date))) throw new Error("Data inválida");
  const card = row.creditCardMetadata;
  const rawMethod = row.operationType ?? row.paymentData?.paymentMethod;
  const method = typeof rawMethod === "string" && Object.hasOwn(payment, rawMethod) ? payment[rawMethod] : card ? "Crédito" : null;
  const dateTime = card?.transactionDateTime || row.date;
  const hasTime = typeof dateTime === "string" && /T\d{2}:\d{2}/.test(dateTime) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(dateTime) && (Boolean(card?.transactionDateTime) || !/T00:00:00(?:\.0+)?Z$/.test(dateTime));
  const local = hasTime && Number.isFinite(Date.parse(dateTime))
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short", hourCycle: "h23" }).format(new Date(dateTime))
    : null;
  return {
    id: row.id, accountId, date: local?.slice(0, 10) || row.date.slice(0, 10), time: local?.slice(11, 16) || null,
    description: typeof row.description === "string" ? row.description.slice(0, 250) : "Lançamento",
    direction: row.type, status: row.status, currency: row.currencyCode,
    amount: Math.abs(minor(row.amount, row.currencyCode)), method, transfer: transfers.has(method),
    category: typeof row.category === "string" ? row.category.slice(0, 100) : null,
    billId: uuid.test(card?.billId) ? card.billId : null,
    installment: Number.isInteger(card?.installmentNumber) ? card.installmentNumber : null,
    installments: Number.isInteger(card?.totalInstallments) ? card.totalInstallments : null,
    ...installmentMetadata(row, card),
    ...accountAmount(row, accountCurrency),
    createdAt: typeof row.createdAt === "string" && Number.isFinite(Date.parse(row.createdAt)) ? new Date(row.createdAt).toISOString() : null,
  };
}
