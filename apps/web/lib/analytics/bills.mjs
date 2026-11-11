// Faturas por cartão: histórico, fatura aberta, composição e parcelas futuras (SPEC-0003, REQ-009).
import { addMonths, monthOf } from "./dates.mjs";
import { spendingValue } from "./classify.mjs";

const HISTORY = 12;

/** Composição de uma fatura a partir dos lançamentos classificados. */
export function composition(/** @type {import("./aggregate.mjs").Row[]} */ rows) {
  const parts = { avista: 0, parcelas: 0, iof: 0, exterior: 0, estornos: 0 };
  /** @type {Record<string, number>} */
  const byGroup = {};
  for (const row of rows) {
    if (row.info.kind === "estorno") parts.estornos += row.info.amount;
    if (row.info.kind !== "despesa" && row.info.kind !== "estorno") continue;
    byGroup[row.info.groupLabel] = (byGroup[row.info.groupLabel] ?? 0) + spendingValue(row.info);
    if (row.info.kind !== "despesa") continue;
    if (row.info.category === "iof") parts.iof += row.info.amount;
    else if (row.entry.accountAmount != null) parts.exterior += row.info.amount;
    else if ((row.entry.installments ?? 1) > 1) parts.parcelas += row.info.amount;
    else parts.avista += row.info.amount;
  }
  return { ...parts, byGroup };
}

/**
 * @param {{ key: string; itemId: string; id: string; name: string; last4: string | null; type: string;
 *   limit: number | null; available: number | null; currency: string }[]} cards
 * @param {import("../types").Bill[]} bills
 * @param {import("../types").OpenBill[]} openBills
 * @param {import("../types").Installment[]} installments cronograma a partir da referência
 * @param {import("./aggregate.mjs").Row[]} rows lançamentos classificados
 * @param {string} reference
 */
export function cardBills(cards, bills, openBills, installments, rows, reference) {
  const months = Array.from({ length: 12 }, (_, index) => addMonths(monthOf(reference), index));
  return cards.filter((card) => card.type === "CREDIT").map((card) => {
    const own = bills.filter((bill) => bill.itemId === card.itemId && bill.accountId === card.id && bill.currency === "BRL" && bill.due)
      .sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(-HISTORY);
    const open = openBills.find((bill) => bill.itemId === card.itemId && bill.accountId === card.id);
    const openTotal = open?.total.find((total) => total.currency === "BRL")?.amount ?? null;
    const openKeys = new Set(open?.entries.map((entry) => entry.id) ?? []);
    const cardRows = rows.filter((row) => row.account === card.key);
    const schedule = installments.filter((row) => row.itemId === card.itemId && row.accountId === card.id && row.currency === "BRL");
    const recent = own.slice(-6);
    return {
      key: card.key, name: card.name, last4: card.last4, limit: card.limit, available: card.available,
      bills: own.map((bill) => ({
        id: bill.id, due: bill.due, closes: bill.closes, amount: bill.amount, minimumPayment: bill.minimumPayment ?? null,
        ...composition(cardRows.filter((row) => row.entry.billId === bill.id)),
      })),
      open: open ? {
        due: open.due, closes: open.closes, amount: openTotal, count: open.count,
        estimated: open.estimated.find((total) => total.currency === "BRL")?.amount ?? 0,
        ...composition(cardRows.filter((row) => openKeys.has(row.entry.id))),
      } : null,
      average: recent.length ? Math.round(recent.reduce((total, bill) => total + bill.amount, 0) / recent.length) : null,
      usage: card.limit && openTotal !== null ? openTotal / card.limit : null,
      future: months.map((month) => ({
        month,
        imported: schedule.filter((row) => row.month === month && !row.estimated).reduce((total, row) => total + row.amount, 0),
        estimated: schedule.filter((row) => row.month === month && row.estimated).reduce((total, row) => total + row.amount, 0),
      })),
    };
  });
}
