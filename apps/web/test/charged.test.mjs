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

test("conta a parcela na data da cobrança e guarda a data da compra", () => {
  const parcel = (installmentNumber, date, transactionDateTime) => normalizeTransaction({
    id: id(10 + installmentNumber), accountId, date, description: "Compra sintética",
    currencyCode: "BRL", amount: "10.00", type: "DEBIT", status: "PENDING",
    creditCardMetadata: { installmentNumber, totalInstallments: 5, transactionDateTime },
  }, accountId, "BRL");
  const fields = ({ date, purchaseDate, time }) => [date, purchaseDate, time];
  // Parcela futura enviada com a data da cobrança e a hora da compra.
  assert.deepEqual(fields(parcel(3, "2027-01-06T03:00:00.000Z", "2026-10-22T14:11:24.000Z")),
    ["2027-01-06", "2026-10-22", null]);
  // A 1ª parcela continua na data e hora da compra.
  assert.deepEqual(fields(parcel(1, "2026-10-22T03:00:00.000Z", "2026-10-22T14:11:24.000Z")),
    ["2026-10-22", undefined, "11:11"]);
  // Sem data de compra diferente, nada muda.
  assert.deepEqual(fields(parcel(2, "2026-11-06T00:00:00.000Z")), ["2026-11-06", undefined, null]);
});
