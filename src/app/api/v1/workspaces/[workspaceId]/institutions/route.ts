import { z } from "zod";
import { currentUserId, apiError } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceEditor, requireWorkspaceMember } from "@/server/auth";

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { workspaceId } = await params; await requireWorkspaceMember(await currentUserId(), workspaceId); return Response.json(await prisma.institution.findMany({ where: { workspaceId }, orderBy: { name: "asc" } })); } catch (error) { return apiError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { workspaceId } = await params; await requireWorkspaceEditor(await currentUserId(), workspaceId); const data = z.object({ name: z.string().trim().min(2).max(80), logoUrl: z.string().url().optional() }).parse(await request.json()); return Response.json(await prisma.institution.create({ data: { ...data, workspaceId } }), { status: 201 }); } catch (error) { return apiError(error); }
}
