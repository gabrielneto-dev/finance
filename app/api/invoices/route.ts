import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import { getSingleUserId } from "../../../src/lib/current-user";

export async function GET(request: NextRequest) {
  const userId = await getSingleUserId();
  const cardId = request.nextUrl.searchParams.get("cardId") ?? undefined;
  const invoices = await prisma.invoice.findMany({
    where: { card: { userId }, cardId },
    orderBy: { closingDate: "desc" },
  });
  return NextResponse.json(invoices);
}
