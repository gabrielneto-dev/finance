import { z } from "zod";
import { currentUserId, apiError } from "@/server/api";
import { prisma } from "@/lib/prisma";
import { createWorkspaceForUser } from "@/server/services/workspace-service";

export async function GET() {
  try {
    const userId = await currentUserId();
    return Response.json(await prisma.workspace.findMany({ where: { members: { some: { userId } } }, orderBy: { createdAt: "asc" } }));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const userId = await currentUserId();
    const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(await request.json());
    return Response.json(await createWorkspaceForUser(userId, name), { status: 201 });
  } catch (error) { return apiError(error); }
}
