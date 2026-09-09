import type { Invoice } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveInvoicePeriod } from "../lib/date";

export async function findOrCreateInvoice(
  cardId: string,
  txDate: Date,
): Promise<Invoice> {
  const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });
  const period = resolveInvoicePeriod(txDate, card.closingDay, card.dueDay);

  return prisma.invoice.upsert({
    where: {
      cardId_referenceMonth: {
        cardId,
        referenceMonth: period.referenceMonth,
      },
    },
    update: {},
    create: {
      cardId,
      referenceMonth: period.referenceMonth,
      closingDate: period.closingDate,
      dueDate: period.dueDate,
    },
  });
}

export async function recalculateInvoiceTotal(invoiceId: string): Promise<void> {
  const result = await prisma.transaction.aggregate({
    where: { invoiceId },
    _sum: { amountCents: true },
  });
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { totalAmountCents: result._sum.amountCents ?? 0 },
  });
}

export async function closeDueInvoices(now = new Date()): Promise<number> {
  const result = await prisma.invoice.updateMany({
    where: { status: "OPEN", closingDate: { lte: now } },
    data: { status: "CLOSED" },
  });
  return result.count;
}

export async function markOverdueInvoices(now = new Date()): Promise<number> {
  const result = await prisma.invoice.updateMany({
    where: { status: "CLOSED", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });
  return result.count;
}
