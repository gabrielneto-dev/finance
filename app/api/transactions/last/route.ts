import { NextResponse } from "next/server";
import { getSingleUserId } from "../../../../src/lib/current-user";
import { getLastTransaction } from "../../../../src/services/transaction-service";

export async function GET() {
  const userId = await getSingleUserId();
  const transaction = await getLastTransaction(userId);
  if (!transaction) {
    return NextResponse.json({ error: "Nenhuma transação encontrada." }, { status: 404 });
  }
  return NextResponse.json(transaction);
}
