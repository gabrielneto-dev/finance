import { describe, expect, it } from "vitest";
import { PaymentMethod, TransactionType, transactionCreateSchema } from "./finance";
import { invoiceReferenceFor, monthlyInstallmentDate, nextRecurringDate, splitInstallmentAmount } from "./scheduling";

const id = "d90edbeb-ea9b-4051-a56f-867dbe68fc00";
describe("financial contracts", () => {
  it("requires two different accounts for a transfer", () => {
    const result = transactionCreateSchema.safeParse({ type: TransactionType.TRANSFER, paymentMethod: PaymentMethod.PIX, amount: 10, description: "Mover", occurredAt: new Date(), accountId: id, destinationAccountId: id });
    expect(result.success).toBe(false);
  });
  it("requires an invoice and account to pay an invoice", () => {
    const result = transactionCreateSchema.safeParse({ type: TransactionType.INVOICE_PAYMENT, paymentMethod: PaymentMethod.PIX, amount: 10, description: "Fatura", occurredAt: new Date() });
    expect(result.success).toBe(false);
  });
  it("requires an account for cash-based expenses", () => {
    const result = transactionCreateSchema.safeParse({ type: TransactionType.EXPENSE, paymentMethod: PaymentMethod.PIX, amount: 10, description: "Cafe", occurredAt: new Date(), categoryId: id });
    expect(result.success).toBe(false);
  });
  it("moves a card purchase after closing day into next invoice", () => {
    expect(invoiceReferenceFor(new Date("2026-02-16T00:00:00Z"), 15).toISOString().slice(0, 10)).toBe("2026-03-01");
  });
  it("advances monthly recurrences without a duplicate period", () => {
    expect(nextRecurringDate(new Date("2026-01-10T00:00:00Z"), "MONTHLY").toISOString().slice(0, 10)).toBe("2026-02-10");
  });
  it("splits cents across the first installments with an exact total", () => {
    expect(splitInstallmentAmount(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitInstallmentAmount(100, 3).reduce((sum, amount) => sum + amount, 0)).toBe(100);
  });
  it("clamps monthly installments to the last day of shorter months", () => {
    expect(monthlyInstallmentDate(new Date("2026-01-31T00:00:00Z"), 2).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(monthlyInstallmentDate(new Date("2026-01-31T00:00:00Z"), 3).toISOString().slice(0, 10)).toBe("2026-03-31");
  });
});
