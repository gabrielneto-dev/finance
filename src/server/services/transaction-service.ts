import { PaymentMethod, TransactionType } from "@prisma/client";
import { TransactionCreate } from "@/domain/finance";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { findOrCreateInvoice } from "./invoice-service";

async function assertScopedReferences(workspaceId: string, input: TransactionCreate, client: typeof prisma) {
  const checks = [
    input.accountId && client.account.findFirst({ where: { id: input.accountId, workspaceId }, select: { id: true } }),
    input.destinationAccountId && client.account.findFirst({ where: { id: input.destinationAccountId, workspaceId }, select: { id: true } }),
    input.cardId && client.card.findFirst({ where: { id: input.cardId, workspaceId }, select: { id: true } }),
    input.categoryId && client.category.findFirst({ where: { id: input.categoryId, workspaceId }, select: { id: true } }),
    input.invoiceId && client.invoice.findFirst({ where: { id: input.invoiceId, workspaceId }, select: { id: true } })
  ].filter(Boolean);
  const result = await Promise.all(checks);
  if (result.some((item) => item === null)) throw new DomainError("Uma referencia financeira nao pertence ao workspace.", 422);
}

export async function createTransaction(workspaceId: string, userId: string, input: TransactionCreate, client: typeof prisma = prisma) {
  await assertScopedReferences(workspaceId, input, client);
  if (input.idempotencyKey) {
    const existing = await client.financialTransaction.findFirst({ where: { workspaceId, idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  return client.$transaction(async (tx) => {
    let invoiceId = input.invoiceId;
    if (input.paymentMethod === PaymentMethod.CREDIT_CARD && input.cardId) {
      // The invoice owns the credit-card liability; the purchase does not lower account cash now.
      invoiceId = (await findOrCreateInvoice(tx, workspaceId, input.cardId, input.occurredAt)).id;
    }
    if (input.type === TransactionType.INVOICE_PAYMENT && invoiceId) {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, workspaceId } });
      if (!invoice) throw new DomainError("Fatura nao encontrada.", 404);
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
    }
    return tx.financialTransaction.create({ data: { ...input, workspaceId, createdById: userId, invoiceId } });
  });
}
