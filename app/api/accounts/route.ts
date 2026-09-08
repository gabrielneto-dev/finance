import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/prisma";
import { getSingleUserId } from "../../../src/lib/current-user";

const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT"]),
  aliases: z.array(z.string()).optional(),
  initialBalanceCents: z.number().int().optional(),
});

export async function GET() {
  const userId = await getSingleUserId();
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = await getSingleUserId();
  const account = await prisma.account.create({
    data: {
      userId,
      name: parsed.data.name,
      type: parsed.data.type,
      aliases: parsed.data.aliases ?? [],
      initialBalanceCents: parsed.data.initialBalanceCents ?? 0,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
