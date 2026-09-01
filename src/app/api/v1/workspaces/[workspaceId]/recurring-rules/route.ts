import { recurringRuleCreateSchema } from "@/domain/finance";
import { currentUserId, apiError } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceEditor, requireWorkspaceMember } from "@/server/auth";
export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; await requireWorkspaceMember(await currentUserId(), workspaceId); return Response.json(await prisma.recurringRule.findMany({ where: { workspaceId }, orderBy: { nextRunAt: "asc" } })); } catch (error) { return apiError(error); } }
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); return Response.json(await prisma.recurringRule.create({ data: { ...recurringRuleCreateSchema.parse(await request.json()), workspaceId } }), { status: 201 }); } catch (error) { return apiError(error); } }
