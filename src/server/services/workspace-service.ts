import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const defaultCategories = [
  ["Moradia", TransactionType.EXPENSE], ["Alimentacao", TransactionType.EXPENSE],
  ["Transporte", TransactionType.EXPENSE], ["Saude", TransactionType.EXPENSE],
  ["Lazer", TransactionType.EXPENSE], ["Salario", TransactionType.INCOME],
  ["Freelance", TransactionType.INCOME]
] as const;

export async function createWorkspaceForUser(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({ data: { name, members: { create: { userId, role: "OWNER" } } } });
    await tx.category.createMany({ data: defaultCategories.map(([categoryName, kind]) => ({ workspaceId: workspace.id, name: categoryName, kind })) });
    return workspace;
  });
}
