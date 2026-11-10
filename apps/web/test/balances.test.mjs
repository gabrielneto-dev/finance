import assert from "node:assert/strict";
import test from "node:test";
import { blockedBalances, blockedDeposits } from "../lib/balances.ts";

const bank = (balance, closingBalance, currency = "BRL", id = "a1") => ({ id, itemId: "i1", balance, currency, bank: { closingBalance } });
let sequence = 0;
const deposit = (amount, date, extra = {}) => ({
  id: "e" + ++sequence, itemId: "i1", accountId: "a1", description: "DEP CHEQUE ATM", category: "Transfer - Check",
  date, time: "10:00", direction: "CREDIT", amount, currency: "BRL", ...extra,
});
const key = (row) => row.itemId + "/" + row.accountId + "/" + row.id;

test("separa o valor bloqueado quando o saldo contábil supera o disponível", () => {
  assert.deepEqual(blockedBalances([bank(50000, 70000)]), {
    blocked: [{ amount: 20000, currency: "BRL" }], ledger: [{ amount: 70000, currency: "BRL" }],
  });
  const none = { blocked: [], ledger: [] };
  assert.deepEqual(blockedBalances([bank(50000, 50000), bank(50000, 40000), bank(null, 70000), bank(50000, null)]), none);
  assert.deepEqual(blockedBalances([{ id: "a1", itemId: "i1", balance: 50000, currency: "BRL", bank: null }]), none);
  assert.deepEqual(blockedBalances([bank(100, 300), bank(1000, 1500, "USD")]).blocked,
    [{ amount: 200, currency: "BRL" }, { amount: 500, currency: "USD" }]);
});

test("marca como bloqueado o cheque recente que cabe no valor bloqueado", () => {
  const cheque = deposit(20000, "2026-11-09");
  assert.deepEqual(blockedDeposits([bank(50000, 70000)], [cheque], "2026-11-10"), new Set([key(cheque)]));
  assert.equal(blockedDeposits([bank(70000, 70000)], [cheque], "2026-11-10").size, 0);
});

test("atribui o bloqueio do cheque mais novo ao mais antigo e para no primeiro que não cabe", () => {
  const newest = deposit(10000, "2026-11-09");
  const middle = deposit(30000, "2026-11-08");
  const oldest = deposit(5000, "2026-11-07");
  const marked = blockedDeposits([bank(0, 15000)], [oldest, middle, newest], "2026-11-10");
  assert.deepEqual(marked, new Set([key(newest)]));
});

test("ignora débitos, outras contas, outras moedas, lançamentos sem cheque e cheques antigos", () => {
  const ignored = [
    deposit(1000, "2026-11-09", { direction: "DEBIT" }),
    deposit(1000, "2026-11-09", { accountId: "a2" }),
    deposit(1000, "2026-11-09", { currency: "USD" }),
    deposit(1000, "2026-11-09", { description: "PIX RECEBIDO", category: "Transfer - PIX" }),
    deposit(1000, "2026-11-02"),
    deposit(1000, "2026-11-11"),
  ];
  assert.equal(blockedDeposits([bank(0, 100000)], ignored, "2026-11-10").size, 0);
  const byDescription = deposit(1000, "2026-11-03", { category: null, description: "Depósito em cheque" });
  assert.deepEqual(blockedDeposits([bank(0, 100000)], [byDescription], "2026-11-10"), new Set([key(byDescription)]));
});
