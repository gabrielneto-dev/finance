import { currentUserId, apiError } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/server/auth";
export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; await requireWorkspaceMember(await currentUserId(), workspaceId); return Response.json(await prisma.category.findMany({ where: { workspaceId }, orderBy: [{ kind: "asc" }, { name: "asc" }] })); } catch (error) { return apiError(error); } }
