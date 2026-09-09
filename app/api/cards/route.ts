import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/prisma";
import { getSingleUserId } from "../../../src/lib/current-user";

const createCardSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  accountId: z.string().optional().nullable(),
  creditLimitCents: z.number().int(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
});

export async function GET() {
  const userId = await getSingleUserId();
  const cards = await prisma.card.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = createCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = await getSingleUserId();
  const card = await prisma.card.create({
    data: {
      userId,
      name: parsed.data.name,
      aliases: parsed.data.aliases ?? [],
      accountId: parsed.data.accountId,
      creditLimitCents: parsed.data.creditLimitCents,
      closingDay: parsed.data.closingDay,
      dueDay: parsed.data.dueDay,
    },
  });
  return NextResponse.json(card, { status: 201 });
}
