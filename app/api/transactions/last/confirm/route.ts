import { NextResponse } from "next/server";
import { getSingleUserId } from "../../../../../src/lib/current-user";
import { confirmTransaction, getLastTransaction } from "../../../../../src/services/transaction-service";

export async function POST() {
  const userId = await getSingleUserId();
  const transaction = await getLastTransaction(userId);
  if (!transaction) {
    return NextResponse.json({ error: "Nenhuma transação encontrada." }, { status: 404 });
  }
  const confirmed = await confirmTransaction(transaction.id);
  return NextResponse.json(confirmed);
}
