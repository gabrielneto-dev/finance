import { currentUserId, apiError } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/auth";
export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceMember(await currentUserId(), workspaceId);
    const [accounts, transactions, invoices] = await Promise.all([
      prisma.account.findMany({ where: { workspaceId } }),
      prisma.financialTransaction.findMany({ where: { workspaceId, status: { in: ["PAID", "RECEIVED", "COMPLETED"] } } }),
      prisma.invoice.findMany({ where: { workspaceId, status: { in: ["OPEN", "CLOSED", "OVERDUE"] } }, include: { transactions: true } })
    ]);
    const balance = accounts.reduce<number>((sum, account) => sum + Number(account.initialBalance), 0) + transactions.reduce<number>((sum, transaction) => {
      if (transaction.type === "INCOME" || transaction.type === "REFUND") return sum + Number(transaction.amount);
      if (transaction.type === "TRANSFER") return sum;
      if (transaction.paymentMethod === "CREDIT_CARD" && transaction.type === "EXPENSE") return sum;
      return sum - Number(transaction.amount);
    }, 0);
    const invoiceTotal = invoices.reduce<number>((sum, invoice) => sum + invoice.transactions.filter((item) => item.type === "EXPENSE" && item.status !== "CANCELLED").reduce<number>((sub, item) => sub + Number(item.amount), 0), 0);
    return Response.json({ balance, invoiceTotal, accountCount: accounts.length, recentTransactions: transactions.slice(-5).reverse() });
  } catch (error) { return apiError(error); }
}
