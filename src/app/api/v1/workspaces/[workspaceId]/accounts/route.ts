import { z } from "zod";
import { currentUserId, apiError } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceEditor, requireWorkspaceMember } from "@/server/auth";

const schema = z.object({ name: z.string().trim().min(2), type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "OTHER"]), institutionId: z.string().uuid().optional(), currency: z.string().length(3).default("BRL"), initialBalance: z.coerce.number().default(0) });
export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; await requireWorkspaceMember(await currentUserId(), workspaceId); return Response.json(await prisma.account.findMany({ where: { workspaceId }, include: { institution: true }, orderBy: { name: "asc" } })); } catch (error) { return apiError(error); } }
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try { const { workspaceId } = await params; const userId = await currentUserId(); await requireWorkspaceEditor(userId, workspaceId); const data = schema.parse(await request.json()); return Response.json(await prisma.account.create({ data: { ...data, workspaceId, createdById: userId } }), { status: 201 }); } catch (error) { return apiError(error); } }
