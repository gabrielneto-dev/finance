import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { transactions: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }
  return NextResponse.json(invoice);
}
