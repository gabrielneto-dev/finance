import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteTransaction,
  updateTransactionFields,
} from "../../../../src/services/transaction-service";
import { resolveTransactionIds, ResolutionError } from "../../../../src/services/transaction-resolution";
import { getSingleUserId } from "../../../../src/lib/current-user";

const patchSchema = z.object({
  description: z.string().optional(),
  amountCents: z.number().int().positive().optional(),
  categoryId: z.string().optional().nullable(),
  categoryHint: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  accountHint: z.string().optional().nullable(),
  cardId: z.string().optional().nullable(),
  cardHint: z.string().optional().nullable(),
  date: z.string().datetime().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = await getSingleUserId();

  try {
    const ids = await resolveTransactionIds(userId, {
      type: "EXPENSE",
      accountId: parsed.data.accountId,
      accountHint: parsed.data.accountHint,
      cardId: parsed.data.cardId,
      cardHint: parsed.data.cardHint,
      categoryId: parsed.data.categoryId,
      categoryHint: parsed.data.categoryHint,
    });
    const transaction = await updateTransactionFields(id, {
      description: parsed.data.description,
      amountCents: parsed.data.amountCents,
      accountId: ids.accountId,
      cardId: ids.cardId,
      categoryId: ids.categoryId,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    });
    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof ResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteTransaction(id);
  return new NextResponse(null, { status: 204 });
}
