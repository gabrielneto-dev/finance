import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/prisma";
import { getSingleUserId } from "../../../src/lib/current-user";
import {
  createTransaction,
  TransactionValidationError,
} from "../../../src/services/transaction-service";
import { createInstallmentPlan } from "../../../src/services/installment-service";
import { resolveTransactionIds, ResolutionError } from "../../../src/services/transaction-resolution";

const createTransactionSchema = z.object({
  date: z.string().datetime().optional(),
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  origin: z.enum(["MANUAL", "WHATSAPP", "RECURRING", "INSTALLMENT"]).optional(),
  accountId: z.string().optional().nullable(),
  accountHint: z.string().optional().nullable(),
  cardId: z.string().optional().nullable(),
  cardHint: z.string().optional().nullable(),
  destinationAccountId: z.string().optional().nullable(),
  destinationAccountHint: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  categoryHint: z.string().optional().nullable(),
  sourceMessageId: z.string().optional().nullable(),
  installments: z.number().int().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const userId = await getSingleUserId();
  const query = request.nextUrl.searchParams;
  const accountId = query.get("accountId") ?? undefined;
  const cardId = query.get("cardId") ?? undefined;
  const from = query.get("from");
  const to = query.get("to");
  const limit = query.get("limit");

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      accountId,
      cardId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "desc" },
    take: limit ? Number(limit) : 100,
  });
  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = await getSingleUserId();
  const date = parsed.data.date ? new Date(parsed.data.date) : new Date();

  try {
    const ids = await resolveTransactionIds(userId, parsed.data);

    if (parsed.data.installments && parsed.data.installments > 1) {
      if (!ids.cardId) {
        return NextResponse.json(
          { error: "Parcelamento exige um cartão (cardId ou cardHint)." },
          { status: 422 },
        );
      }
      const plan = await createInstallmentPlan({
        userId,
        description: parsed.data.description,
        totalAmountCents: parsed.data.amountCents,
        installmentsCount: parsed.data.installments,
        cardId: ids.cardId,
        categoryId: ids.categoryId,
        firstDueDate: date,
      });
      return NextResponse.json(plan, { status: 201 });
    }

    const transaction = await createTransaction({
      userId,
      date,
      description: parsed.data.description,
      amountCents: parsed.data.amountCents,
      type: parsed.data.type,
      status: parsed.data.status,
      origin: parsed.data.origin,
      accountId: ids.accountId,
      cardId: ids.cardId,
      destinationAccountId: ids.destinationAccountId,
      categoryId: ids.categoryId,
      sourceMessageId: parsed.data.sourceMessageId,
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof ResolutionError || error instanceof TransactionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
