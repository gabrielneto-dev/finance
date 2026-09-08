import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getSingleUserId } from "../current-user.js";

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE"]),
  aliases: z.array(z.string()).optional(),
  parentId: z.string().optional().nullable(),
  icon: z.string().optional(),
});

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => {
    const userId = await getSingleUserId();
    return prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
  });

  app.post("/", async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const userId = await getSingleUserId();
    const category = await prisma.category.create({
      data: { userId, ...parsed.data, aliases: parsed.data.aliases ?? [] },
    });
    return reply.code(201).send(category);
  });
}
