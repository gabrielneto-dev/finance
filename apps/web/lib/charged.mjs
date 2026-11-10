// Valor efetivamente cobrado na moeda da conta. Compras em outra moeda trazem o valor
// convertido pelo próprio banco (amountInAccountCurrency); sem ele, mantém a moeda original.
/** @param {{ amount: number; currency: string; accountAmount?: number | null; accountCurrency?: string | null }} row */
export function charged(row) {
  return Number.isFinite(row.accountAmount) && row.accountCurrency
    ? { amount: /** @type {number} */ (row.accountAmount), currency: row.accountCurrency }
    : { amount: row.amount, currency: row.currency };
}
