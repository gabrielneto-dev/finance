import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getSingleUserId } from "../current-user.js";

const createRecurrenceSchema = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).optional(),
  accountId: z.string().optional().nullable(),
  cardId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export async function recurrencesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => {
    const userId = await getSingleUserId();
    return prisma.recurrence.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  });

  app.post("/", async (request, reply) => {
    const parsed = createRecurrenceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    if (!parsed.data.accountId && !parsed.data.cardId) {
      return reply.code(422).send({ error: "Recorrência exige accountId ou cardId." });
    }
    const userId = await getSingleUserId();
    const startDate = new Date(parsed.data.startDate);
    const recurrence = await prisma.recurrence.create({
      data: {
        userId,
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
        type: parsed.data.type,
        frequency: parsed.data.frequency,
        interval: parsed.data.interval ?? 1,
        accountId: parsed.data.accountId,
        cardId: parsed.data.cardId,
        categoryId: parsed.data.categoryId,
        startDate,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
        nextRunDate: startDate,
      },
    });
    return reply.code(201).send(recurrence);
  });
}
