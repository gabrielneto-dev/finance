import { goalCreateSchema } from "@/domain/finance";
import { apiError, currentUserId } from "@/server/api";
import { requireWorkspaceEditor } from "@/server/auth";
import { archiveGoal, updateGoal } from "@/server/services/planning-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; goalId: string }> }) { try { const { workspaceId, goalId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); return Response.json(await updateGoal(workspaceId, goalId, goalCreateSchema.parse(await request.json()))); } catch (error) { return apiError(error); } }
export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; goalId: string }> }) { try { const { workspaceId, goalId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); return Response.json(await archiveGoal(workspaceId, goalId)); } catch (error) { return apiError(error); } }
