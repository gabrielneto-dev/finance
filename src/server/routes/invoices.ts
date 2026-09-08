import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { getSingleUserId } from "../current-user.js";

export async function invoicesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request) => {
    const userId = await getSingleUserId();
    const query = request.query as { cardId?: string };
    return prisma.invoice.findMany({
      where: { card: { userId }, cardId: query.cardId },
      orderBy: { closingDate: "desc" },
    });
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: request.params.id },
      include: { transactions: true },
    });
    if (!invoice) return reply.code(404).send({ error: "Fatura não encontrada." });
    return invoice;
  });
}
