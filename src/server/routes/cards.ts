import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getSingleUserId } from "../current-user.js";

const createCardSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  accountId: z.string().optional().nullable(),
  creditLimitCents: z.number().int(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
});

export async function cardsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => {
    const userId = await getSingleUserId();
    return prisma.card.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  });

  app.post("/", async (request, reply) => {
    const parsed = createCardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const userId = await getSingleUserId();
    const card = await prisma.card.create({
      data: {
        userId,
        name: parsed.data.name,
        aliases: parsed.data.aliases ?? [],
        accountId: parsed.data.accountId,
        creditLimitCents: parsed.data.creditLimitCents,
        closingDay: parsed.data.closingDay,
        dueDay: parsed.data.dueDay,
      },
    });
    return reply.code(201).send(card);
  });
}
