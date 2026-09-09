import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/prisma";
import { getSingleUserId } from "../../../src/lib/current-user";

const createRecurrenceSchema = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).optional(),
  accountId: z.string().optional().nullable(),
  cardId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export async function GET() {
  const userId = await getSingleUserId();
  const recurrences = await prisma.recurrence.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(recurrences);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = createRecurrenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.accountId && !parsed.data.cardId) {
    return NextResponse.json({ error: "Recorrência exige accountId ou cardId." }, { status: 422 });
  }

  const userId = await getSingleUserId();
  const startDate = new Date(parsed.data.startDate);
  const recurrence = await prisma.recurrence.create({
    data: {
      userId,
      description: parsed.data.description,
      amountCents: parsed.data.amountCents,
      type: parsed.data.type,
      frequency: parsed.data.frequency,
      interval: parsed.data.interval ?? 1,
      accountId: parsed.data.accountId,
      cardId: parsed.data.cardId,
      categoryId: parsed.data.categoryId,
      startDate,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      nextRunDate: startDate,
    },
  });
  return NextResponse.json(recurrence, { status: 201 });
}
