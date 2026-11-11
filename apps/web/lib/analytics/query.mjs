// Validação dos parâmetros de GET /api/analytics (SPEC-0003, REQ-005).
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
// Até 24 meses, para comparar 12 meses com os 12 anteriores.
export const MAX_ANALYTICS_DAYS = 731;
const ACCOUNT = /^[^/\s]{1,100}\/[^/\s]{1,100}$/;

const valid = (/** @type {string} */ value) => DATE.test(value) && Number.isFinite(Date.parse(value)) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const range = (/** @type {string} */ from, /** @type {string} */ to) =>
  valid(from) && valid(to) && from <= to && (Date.parse(to) - Date.parse(from)) / DAY < MAX_ANALYTICS_DAYS;

/**
 * @param {URLSearchParams} query
 * @returns {{ ok: true; value: { from: string; to: string; compareFrom?: string; compareTo?: string; account: string } } | { ok: false; error: string }}
 */
export function parseAnalyticsQuery(query) {
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  if (!range(from, to)) return { ok: false, error: "Período inválido." };
  const compareFrom = query.get("cfrom") ?? "";
  const compareTo = query.get("cto") ?? "";
  if ((compareFrom || compareTo) && (!range(compareFrom, compareTo) || compareTo >= from)) {
    return { ok: false, error: "Período de comparação inválido." };
  }
  const account = query.get("account") ?? "";
  if (account && !ACCOUNT.test(account)) return { ok: false, error: "Conta inválida." };
  return { ok: true, value: { from, to, account, ...(compareFrom ? { compareFrom, compareTo } : {}) } };
}
