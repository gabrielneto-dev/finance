import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../src/lib/prisma";
import { getSingleUserId } from "../../../src/lib/current-user";

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE"]),
  aliases: z.array(z.string()).optional(),
  parentId: z.string().optional().nullable(),
  icon: z.string().optional(),
});

export async function GET() {
  const userId = await getSingleUserId();
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = await getSingleUserId();
  const category = await prisma.category.create({
    data: { userId, ...parsed.data, aliases: parsed.data.aliases ?? [] },
  });
  return NextResponse.json(category, { status: 201 });
}
