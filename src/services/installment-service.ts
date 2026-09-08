import type { InstallmentPlan } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { addMonths } from "../lib/date";
import { splitEvenly } from "../lib/money";
import { createTransaction } from "./transaction-service";

export interface CreateInstallmentPlanInput {
  userId: string;
  description: string;
  totalAmountCents: number;
  installmentsCount: number;
  cardId: string;
  categoryId?: string | null;
  firstDueDate: Date;
}

export class InstallmentValidationError extends Error {}

export async function createInstallmentPlan(
  input: CreateInstallmentPlanInput,
): Promise<InstallmentPlan> {
  if (input.installmentsCount < 1) {
    throw new InstallmentValidationError("Parcelamento precisa de ao menos 1 parcela.");
  }

  const plan = await prisma.installmentPlan.create({
    data: {
      userId: input.userId,
      description: input.description,
      totalAmountCents: input.totalAmountCents,
      installmentsCount: input.installmentsCount,
      cardId: input.cardId,
      categoryId: input.categoryId ?? null,
      firstDueDate: input.firstDueDate,
    },
  });

  const amounts = splitEvenly(input.totalAmountCents, input.installmentsCount);

  for (let i = 0; i < input.installmentsCount; i++) {
    const dueDate = addMonths(input.firstDueDate, i);
    const installment = await prisma.installment.create({
      data: {
        installmentPlanId: plan.id,
        number: i + 1,
        amountCents: amounts[i],
        dueDate,
      },
    });

    const transaction = await createTransaction({
      userId: input.userId,
      date: dueDate,
      description: `${input.description} (${i + 1}/${input.installmentsCount})`,
      amountCents: amounts[i],
      type: "EXPENSE",
      origin: "INSTALLMENT",
      cardId: input.cardId,
      categoryId: input.categoryId ?? null,
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { installmentId: installment.id },
    });

    await prisma.installment.update({
      where: { id: installment.id },
      data: { invoiceId: transaction.invoiceId, status: "BILLED" },
    });
  }

  return plan;
}
