import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/prisma";
import { getSingleUserId } from "../../../src/lib/current-user";
import { createInstallmentPlan } from "../../../src/services/installment-service";

const createPlanSchema = z.object({
  description: z.string().min(1),
  totalAmountCents: z.number().int().positive(),
  installmentsCount: z.number().int().min(1),
  cardId: z.string(),
  categoryId: z.string().optional().nullable(),
  firstDueDate: z.string().datetime(),
});

export async function GET() {
  const userId = await getSingleUserId();
  const plans = await prisma.installmentPlan.findMany({
    where: { userId },
    include: { installments: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = await getSingleUserId();
  const plan = await createInstallmentPlan({
    userId,
    description: parsed.data.description,
    totalAmountCents: parsed.data.totalAmountCents,
    installmentsCount: parsed.data.installmentsCount,
    cardId: parsed.data.cardId,
    categoryId: parsed.data.categoryId,
    firstDueDate: new Date(parsed.data.firstDueDate),
  });
  return NextResponse.json(plan, { status: 201 });
}
