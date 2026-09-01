import { budgetCreateSchema } from "@/domain/finance";
import { apiError, currentUserId } from "@/server/api";
import { requireWorkspaceEditor } from "@/server/auth";
import { deleteBudget, updateBudget } from "@/server/services/planning-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; budgetId: string }> }) { try { const { workspaceId, budgetId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); return Response.json(await updateBudget(workspaceId, budgetId, budgetCreateSchema.parse(await request.json()))); } catch (error) { return apiError(error); } }
export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; budgetId: string }> }) { try { const { workspaceId, budgetId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); await deleteBudget(workspaceId, budgetId); return new Response(null, { status: 204 }); } catch (error) { return apiError(error); } }
