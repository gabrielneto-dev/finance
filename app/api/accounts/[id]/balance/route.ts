import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/prisma";
import { getAccountBalanceCents } from "../../../../../src/services/transaction-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }
  const balanceCents = await getAccountBalanceCents(account.id);
  return NextResponse.json({ accountId: account.id, balanceCents });
}
