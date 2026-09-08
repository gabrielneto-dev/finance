import type { Transaction, TxOrigin, TxStatus, TxType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { findOrCreateInvoice, recalculateInvoiceTotal } from "./invoice-service";

export interface CreateTransactionInput {
  userId: string;
  date: Date;
  description: string;
  amountCents: number;
  type: TxType;
  status?: TxStatus;
  origin?: TxOrigin;
  accountId?: string | null;
  cardId?: string | null;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  recurrenceId?: string | null;
  sourceMessageId?: string | null;
}

export class TransactionValidationError extends Error {}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const hasAccount = Boolean(input.accountId);
  const hasCard = Boolean(input.cardId);

  if (input.type === "TRANSFER") {
    if (!hasAccount || !input.destinationAccountId) {
      throw new TransactionValidationError(
        "Transferência requer accountId (origem) e destinationAccountId (destino).",
      );
    }
  } else if (hasAccount === hasCard) {
    throw new TransactionValidationError(
      "Transação precisa de exatamente uma origem: accountId OU cardId.",
    );
  }

  let invoiceId: string | undefined;
  if (input.cardId) {
    const invoice = await findOrCreateInvoice(input.cardId, input.date);
    invoiceId = invoice.id;
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      date: input.date,
      description: input.description,
      amountCents: input.amountCents,
      type: input.type,
      status: input.status ?? "CONFIRMED",
      origin: input.origin ?? "MANUAL",
      accountId: input.accountId ?? null,
      cardId: input.cardId ?? null,
      destinationAccountId: input.destinationAccountId ?? null,
      categoryId: input.categoryId ?? null,
      recurrenceId: input.recurrenceId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      invoiceId: invoiceId ?? null,
    },
  });

  if (invoiceId) {
    await recalculateInvoiceTotal(invoiceId);
  }

  return transaction;
}

export async function getLastTransaction(
  userId: string,
): Promise<Transaction | null> {
  return prisma.transaction.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const transaction = await prisma.transaction.delete({ where: { id } });
  if (transaction.invoiceId) {
    await recalculateInvoiceTotal(transaction.invoiceId);
  }
}

export async function confirmTransaction(id: string): Promise<Transaction> {
  return prisma.transaction.update({
    where: { id },
    data: { status: "CONFIRMED" },
  });
}

export async function updateTransactionFields(
  id: string,
  patch: Partial<
    Pick<
      Transaction,
      "description" | "amountCents" | "categoryId" | "accountId" | "cardId" | "date"
    >
  >,
): Promise<Transaction> {
  const before = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  const transaction = await prisma.transaction.update({ where: { id }, data: patch });

  const affectedInvoiceIds = new Set<string>();
  if (before.invoiceId) affectedInvoiceIds.add(before.invoiceId);
  if (transaction.invoiceId) affectedInvoiceIds.add(transaction.invoiceId);
  for (const invoiceId of affectedInvoiceIds) {
    await recalculateInvoiceTotal(invoiceId);
  }

  return transaction;
}

export async function getAccountBalanceCents(accountId: string): Promise<number> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

  const [income, expense, transferOut, transferIn] = await Promise.all([
    prisma.transaction.aggregate({
      where: { accountId, type: "INCOME" },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: { accountId, type: "EXPENSE" },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: { accountId, type: "TRANSFER" },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: { destinationAccountId: accountId, type: "TRANSFER" },
      _sum: { amountCents: true },
    }),
  ]);

  return (
    account.initialBalanceCents +
    (income._sum.amountCents ?? 0) -
    (expense._sum.amountCents ?? 0) -
    (transferOut._sum.amountCents ?? 0) +
    (transferIn._sum.amountCents ?? 0)
  );
}
