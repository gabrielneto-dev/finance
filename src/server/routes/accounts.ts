import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getSingleUserId } from "../current-user.js";
import { getAccountBalanceCents } from "../../services/transaction-service.js";

const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT"]),
  aliases: z.array(z.string()).optional(),
  initialBalanceCents: z.number().int().optional(),
});

export async function accountsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => {
    const userId = await getSingleUserId();
    return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  });

  app.post("/", async (request, reply) => {
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const userId = await getSingleUserId();
    const account = await prisma.account.create({
      data: {
        userId,
        name: parsed.data.name,
        type: parsed.data.type,
        aliases: parsed.data.aliases ?? [],
        initialBalanceCents: parsed.data.initialBalanceCents ?? 0,
      },
    });
    return reply.code(201).send(account);
  });

  app.get<{ Params: { id: string } }>("/:id/balance", async (request, reply) => {
    const account = await prisma.account.findUnique({ where: { id: request.params.id } });
    if (!account) return reply.code(404).send({ error: "Conta não encontrada." });
    const balanceCents = await getAccountBalanceCents(account.id);
    return { accountId: account.id, balanceCents };
  });
}
