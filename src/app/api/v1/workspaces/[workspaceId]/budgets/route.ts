import { budgetCreateSchema } from "@/domain/finance";
import { apiError, currentUserId } from "@/server/api";
import { requireWorkspaceEditor, requireWorkspaceMember } from "@/server/auth";
import { createBudget, listBudgets } from "@/server/services/planning-service";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { workspaceId } = await params; await requireWorkspaceMember(await currentUserId(), workspaceId); const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7); return Response.json(await listBudgets(workspaceId, month)); } catch (error) { return apiError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { workspaceId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); return Response.json(await createBudget(workspaceId, budgetCreateSchema.parse(await request.json())), { status: 201 }); } catch (error) { return apiError(error); }
}
