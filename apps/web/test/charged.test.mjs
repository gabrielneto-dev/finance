import assert from "node:assert/strict";
import test from "node:test";
import { moneyTotals } from "../lib/format.ts";
import { normalizeTransaction } from "../lib/pluggy.mjs";

const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const accountId = id(2);
const foreign = (extra = {}) => ({
  id: id(3), accountId, date: "2026-11-06T00:00:00Z", description: "Assinatura sintética",
  currencyCode: "USD", amount: "10.00", amountInAccountCurrency: "55.30", type: "DEBIT", status: "PENDING", ...extra,
});

test("guarda o valor cobrado na moeda da conta e o usa nos totais", () => {
  const row = normalizeTransaction(foreign(), accountId, "BRL");
  assert.equal(row.amount, 1000);
  assert.equal(row.currency, "USD");
  assert.equal(row.accountAmount, 5530);
  assert.equal(row.accountCurrency, "BRL");
  assert.equal(moneyTotals([row, { amount: 1000, currency: "BRL" }]).replace(/\s/g, " "), "R$ 65,30");

  // Sem moeda da conta, mesma moeda ou valor inválido: nada é convertido.
  for (const [extra, currency] of [[{}, null], [{ currencyCode: "BRL" }, "BRL"], [{ amountInAccountCurrency: "abc" }, "BRL"]]) {
    const plain = normalizeTransaction(foreign(extra), accountId, currency);
    assert.equal(plain.accountAmount, undefined);
  }
  assert.equal(moneyTotals([normalizeTransaction(foreign(), accountId)]).replace(/\s/g, " "), "US$ 10,00");
});
