import { PaymentMethod, TransactionModality, TransactionStatus } from "@prisma/client";
import { nextRecurringDate } from "@/domain/scheduling";
import { prisma } from "@/lib/prisma";

export function nextDate(date: Date, frequency: string): Date {
  return nextRecurringDate(date, frequency);
}

export async function generateDueRecurrences(now = new Date(), client: typeof prisma = prisma) {
  const rules = await client.recurringRule.findMany({ where: { active: true, nextRunAt: { lte: now } } });
  let generated = 0;
  for (const rule of rules) {
    const key = `recurrence:${rule.id}:${rule.nextRunAt.toISOString().slice(0, 10)}`;
    await client.$transaction(async (tx) => {
      const exists = await tx.financialTransaction.findFirst({ where: { workspaceId: rule.workspaceId, idempotencyKey: key } });
      if (!exists) {
        await tx.financialTransaction.create({ data: {
          workspaceId: rule.workspaceId, accountId: rule.accountId, cardId: rule.cardId, categoryId: rule.categoryId,
          recurringRuleId: rule.id, type: rule.type, modality: TransactionModality.RECURRING,
          status: TransactionStatus.PENDING, paymentMethod: rule.cardId ? PaymentMethod.CREDIT_CARD : PaymentMethod.OTHER,
          amount: rule.amount, description: rule.description, occurredAt: rule.nextRunAt, idempotencyKey: key
        } });
        generated++;
      }
      await tx.recurringRule.update({ where: { id: rule.id }, data: { nextRunAt: nextDate(rule.nextRunAt, rule.frequency) } });
    });
  }
  return generated;
}
