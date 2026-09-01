import { transactionCreateSchema } from "@/domain/finance";
import { currentUserId, apiError } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceEditor, requireWorkspaceMember } from "@/server/auth";
import { createTransaction } from "@/server/services/transaction-service";
export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceMember(await currentUserId(), workspaceId);
    const query = new URL(request.url).searchParams;
    const from = query.get("from"); const to = query.get("to");
    return Response.json(await prisma.financialTransaction.findMany({
      where: {
        workspaceId,
        ...(query.get("accountId") ? { accountId: query.get("accountId")! } : {}),
        ...(query.get("cardId") ? { cardId: query.get("cardId")! } : {}),
        ...(query.get("categoryId") ? { categoryId: query.get("categoryId")! } : {}),
        ...(query.get("status") ? { status: query.get("status") as never } : {}),
        ...((from || to) ? { occurredAt: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {})
      },
      include: { account: true, card: true, category: true, invoice: true }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 100
    }));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; const userId = await currentUserId(); await requireWorkspaceEditor(userId, workspaceId); return Response.json(await createTransaction(workspaceId, userId, transactionCreateSchema.parse(await request.json())), { status: 201 }); } catch (error) { return apiError(error); } }
