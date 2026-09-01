import { InstallmentPlanStatus, PaymentMethod, TransactionModality, TransactionStatus, TransactionType } from "@prisma/client";
import { InstallmentPlanCreate } from "@/domain/finance";
import { monthlyInstallmentDate, splitInstallmentAmount } from "@/domain/scheduling";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { findOrCreateInvoice } from "./invoice-service";

type FinanceClient = typeof prisma;

export async function createInstallmentPlan(workspaceId: string, userId: string, input: InstallmentPlanCreate, client: FinanceClient = prisma) {
  const [card, category] = await Promise.all([
    client.card.findFirst({ where: { id: input.cardId, workspaceId, type: "CREDIT", active: true } }),
    client.category.findFirst({ where: { id: input.categoryId, workspaceId, kind: TransactionType.EXPENSE } })
  ]);
  if (!card || !category) throw new DomainError("Cartao ou categoria invalido para parcelamento.", 422);

  if (input.idempotencyKey) {
    const existing = await client.installmentPlan.findFirst({ where: { workspaceId, idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }

  return client.$transaction(async (tx) => {
    const plan = await tx.installmentPlan.create({ data: {
      workspaceId, cardId: input.cardId, categoryId: input.categoryId, createdById: userId,
      description: input.description, totalAmount: input.totalAmount, installments: input.installments,
      occurredAt: input.occurredAt, idempotencyKey: input.idempotencyKey
    } });
    const amounts = splitInstallmentAmount(input.totalAmount, input.installments);
    for (const [index, amount] of amounts.entries()) {
      const installmentNumber = index + 1;
      const occurredAt = monthlyInstallmentDate(input.occurredAt, installmentNumber);
      const invoice = await findOrCreateInvoice(tx, workspaceId, input.cardId, occurredAt);
      await tx.financialTransaction.create({ data: {
        workspaceId, cardId: input.cardId, invoiceId: invoice.id, categoryId: input.categoryId,
        installmentPlanId: plan.id, installmentNumber, createdById: userId,
        type: TransactionType.EXPENSE, modality: TransactionModality.INSTALLMENT,
        status: installmentNumber === 1 ? TransactionStatus.COMPLETED : TransactionStatus.SCHEDULED,
        paymentMethod: PaymentMethod.CREDIT_CARD, amount, description: `${input.description} (${installmentNumber}/${input.installments})`,
        occurredAt, idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${installmentNumber}` : undefined
      } });
    }
    return plan;
  });
}

export async function cancelInstallmentPlan(workspaceId: string, planId: string, client: FinanceClient = prisma) {
  return client.$transaction(async (tx) => {
    const plan = await tx.installmentPlan.findFirst({ where: { id: planId, workspaceId } });
    if (!plan) throw new DomainError("Parcelamento nao encontrado.", 404);
    if (plan.status === InstallmentPlanStatus.CANCELLED) return plan;
    await tx.financialTransaction.updateMany({
      where: { workspaceId, installmentPlanId: plan.id, status: TransactionStatus.SCHEDULED },
      data: { status: TransactionStatus.CANCELLED }
    });
    return tx.installmentPlan.update({ where: { id: plan.id }, data: { status: InstallmentPlanStatus.CANCELLED, cancelledAt: new Date() } });
  });
}
