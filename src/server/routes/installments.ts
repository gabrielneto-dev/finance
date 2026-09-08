import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getSingleUserId } from "../current-user.js";
import { createInstallmentPlan } from "../../services/installment-service.js";

const createPlanSchema = z.object({
  description: z.string().min(1),
  totalAmountCents: z.number().int().positive(),
  installmentsCount: z.number().int().min(1),
  cardId: z.string(),
  categoryId: z.string().optional().nullable(),
  firstDueDate: z.string().datetime(),
});

export async function installmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => {
    const userId = await getSingleUserId();
    return prisma.installmentPlan.findMany({
      where: { userId },
      include: { installments: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/", async (request, reply) => {
    const parsed = createPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const userId = await getSingleUserId();
    const plan = await createInstallmentPlan({
      userId,
      description: parsed.data.description,
      totalAmountCents: parsed.data.totalAmountCents,
      installmentsCount: parsed.data.installmentsCount,
      cardId: parsed.data.cardId,
      categoryId: parsed.data.categoryId,
      firstDueDate: new Date(parsed.data.firstDueDate),
    });
    return reply.code(201).send(plan);
  });
}
