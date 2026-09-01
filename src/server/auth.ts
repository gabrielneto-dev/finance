import { MemberRole } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function requireWorkspaceMember(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!member) throw new DomainError("Voce nao possui acesso a este workspace.", 403);
  return member;
}

export async function requireWorkspaceEditor(userId: string, workspaceId: string) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  if (member.role === MemberRole.VIEWER) throw new DomainError("Seu perfil e somente leitura.", 403);
  return member;
}
