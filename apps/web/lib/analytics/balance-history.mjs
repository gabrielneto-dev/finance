// Saldo reconstruído das contas (SPEC-0003, 1.5). Não há histórico gravado de saldos:
// parte do saldo atual e desfaz os lançamentos efetivados posteriores, dia a dia.
import { charged } from "../charged.mjs";
import { daysBetween, shiftDays } from "./dates.mjs";

const MAX_POINTS = 400;

/**
 * @param {{ key: string; name: string; type: string; balance: number | null; currency: string }[]} accounts
 * @param {(import("../types").Entry & { account: string })[]} entries lançamentos até a data de referência
 * @param {string} from @param {string} to @param {string} reference
 */
export function balanceHistory(accounts, entries, from, to, reference) {
  const end = to < reference ? to : reference;
  if (end < from) return [];
  const length = Math.min(daysBetween(from, end), MAX_POINTS);
  const start = shiftDays(end, -(length - 1));
  return accounts.filter((account) => account.type === "BANK" && account.balance !== null).map((account) => {
    const flows = new Map();
    for (const entry of entries) {
      if (entry.account !== account.key || entry.status !== "POSTED" || entry.date > reference) continue;
      const { amount, currency } = charged(entry);
      if (currency !== account.currency) continue;
      flows.set(entry.date, (flows.get(entry.date) ?? 0) + (entry.direction === "CREDIT" ? amount : -amount));
    }
    // Saldo no fim de cada dia = saldo atual menos o fluxo dos dias seguintes até a referência.
    let after = 0;
    for (const [date, value] of flows) if (date > end) after += value;
    let balance = /** @type {number} */ (account.balance) - after;
    const points = [];
    for (let index = length - 1; index >= 0; index -= 1) {
      const date = shiftDays(start, index);
      points.push({ date, balance });
      balance -= flows.get(date) ?? 0;
    }
    return { key: account.key, name: account.name, points: points.reverse() };
  });
}
