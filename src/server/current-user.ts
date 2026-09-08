import { prisma } from "../lib/prisma.js";

let cachedUserId: string | null = null;

export async function getSingleUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const user = await prisma.user.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
  });
  cachedUserId = user.id;
  return cachedUserId;
}
