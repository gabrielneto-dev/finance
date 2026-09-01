import { goalCreateSchema } from "@/domain/finance";
import { apiError, currentUserId } from "@/server/api";
import { requireWorkspaceEditor, requireWorkspaceMember } from "@/server/auth";
import { createGoal, listGoals } from "@/server/services/planning-service";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; await requireWorkspaceMember(await currentUserId(), workspaceId); const archived = new URL(request.url).searchParams.get("status") === "ARCHIVED"; return Response.json(await listGoals(workspaceId, archived ? "ARCHIVED" : "ACTIVE")); } catch (error) { return apiError(error); } }
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); return Response.json(await createGoal(workspaceId, goalCreateSchema.parse(await request.json())), { status: 201 }); } catch (error) { return apiError(error); } }
