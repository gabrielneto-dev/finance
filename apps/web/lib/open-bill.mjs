import { dateText, dayNumber } from "./card-cycle.mjs";
import { charged } from "./charged.mjs";
import { dueGap, openCycleMonth } from "./installments.mjs";
import { neutralKind } from "./analytics/categories.mjs";

const STALE_PENDING_DAYS = 31;
const sameCard = (card) => (row) => row.itemId === card.itemId && row.accountId === card.id;

function totals(rows, sign = () => 1) {
  const byCurrency = new Map();
  for (const row of rows) {
    const { amount, currency } = charged(row);
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + sign(row) * amount);
  }
  return Array.from(byCurrency, ([currency, amount]) => ({ amount, currency }));
}

// Estimativa da fatura aberta pelo ciclo do cartão, sem depender do filtro de datas (REQ-019).
// entries: lançamentos do cartão sem fatura; schedule: cronograma de parcelas a partir da referência.
export function openBill({ card, bills, entries, schedule, cycle, reference }) {
  const cardBills = bills.filter(sameCard(card));
  const month = openCycleMonth(cardBills, card, reference);
  if (!month) return null;
  const lastClosing = cycle?.lastClosing ?? null;
  // Pendente anterior ao ciclo fechado por último é autorização que não se confirmou.
  const previousClosing = lastClosing === null ? null : cardBills.map((bill) => bill.closes)
    .filter((closes) => typeof closes === "string" && closes < lastClosing).sort().at(-1) ??
    dateText(dayNumber(lastClosing) - STALE_PENDING_DAYS);
  // Pagamento da fatura não é compra nem estorno. No cartão, ele chega pelo método, pela categoria de
  // pagamento ou como transferência entre contas próprias (SPEC-0003, REQ-003).
  const purchases = entries.filter(sameCard(card)).filter((row) => !row.billId && row.method !== "Fatura" &&
    neutralKind(row.category) === null &&
    (row.installments ?? 1) <= 1 && (lastClosing === null ? row.status === "PENDING"
      : row.date > lastClosing || (row.status === "PENDING" && row.date > previousClosing)));
  const installments = schedule.filter(sameCard(card)).filter((row) => row.month === month);
  const imported = installments.filter((row) => !row.estimated);
  const estimated = installments.filter((row) => row.estimated);
  const signed = (row) => row.direction === "CREDIT" ? -1 : 1;
  // Lançamentos que compõem a fatura: compras e parcelas importadas com o registro original,
  // e o que só existe no cronograma (previsões) à parte.
  const unbilled = new Map(entries.filter(sameCard(card)).map((row) => [row.id, row]));
  const listed = [...purchases, ...imported.map((row) => unbilled.get(row.id)).filter(Boolean)]
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? ""));
  const forecast = [...imported.filter((row) => !unbilled.has(row.id)), ...estimated];

  const closes = cycle?.nextClosing ?? null;
  const gap = dueGap(cardBills, card);
  const due = closes && gap !== null ? dateText(dayNumber(closes) + gap) : null;
  return {
    itemId: card.itemId, accountId: card.id, month, closes, due: due?.slice(0, 7) === month ? due : null,
    purchases: totals(purchases, signed), imported: totals(imported), estimated: totals(estimated),
    total: totals([...purchases.map((row) => ({ ...charged(row), amount: signed(row) * charged(row).amount })), ...installments]),
    count: purchases.length + installments.length, entries: listed, forecast,
  };
}
