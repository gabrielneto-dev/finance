import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getSingleUserId } from "../current-user.js";
import {
  createTransaction,
  deleteTransaction,
  getLastTransaction,
  confirmTransaction,
  updateTransactionFields,
  TransactionValidationError,
} from "../../services/transaction-service.js";
import { createInstallmentPlan } from "../../services/installment-service.js";
import { resolveAccount, resolveCard, resolveCategory } from "../../services/resolver-service.js";

const createTransactionSchema = z.object({
  date: z.string().datetime().optional(),
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  origin: z.enum(["MANUAL", "WHATSAPP", "RECURRING", "INSTALLMENT"]).optional(),
  accountId: z.string().optional().nullable(),
  accountHint: z.string().optional().nullable(),
  cardId: z.string().optional().nullable(),
  cardHint: z.string().optional().nullable(),
  destinationAccountId: z.string().optional().nullable(),
  destinationAccountHint: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  categoryHint: z.string().optional().nullable(),
  sourceMessageId: z.string().optional().nullable(),
  installments: z.number().int().min(1).optional(),
});

class ResolutionError extends Error {}

async function resolveIds(
  userId: string,
  body: z.infer<typeof createTransactionSchema>,
): Promise<{
  accountId?: string;
  cardId?: string;
  destinationAccountId?: string;
  categoryId?: string;
}> {
  const result: {
    accountId?: string;
    cardId?: string;
    destinationAccountId?: string;
    categoryId?: string;
  } = {
    accountId: body.accountId ?? undefined,
    cardId: body.cardId ?? undefined,
    destinationAccountId: body.destinationAccountId ?? undefined,
    categoryId: body.categoryId ?? undefined,
  };

  if (!result.accountId && body.accountHint) {
    const account = await resolveAccount(userId, body.accountHint);
    if (!account) {
      throw new ResolutionError(`Não encontrei conta parecida com "${body.accountHint}".`);
    }
    result.accountId = account.id;
  }

  if (!result.cardId && body.cardHint) {
    const card = await resolveCard(userId, body.cardHint);
    if (!card) {
      throw new ResolutionError(`Não encontrei cartão parecido com "${body.cardHint}".`);
    }
    result.cardId = card.id;
  }

  if (!result.destinationAccountId && body.destinationAccountHint) {
    const account = await resolveAccount(userId, body.destinationAccountHint);
    if (!account) {
      throw new ResolutionError(
        `Não encontrei conta de destino parecida com "${body.destinationAccountHint}".`,
      );
    }
    result.destinationAccountId = account.id;
  }

  if (!result.categoryId && body.categoryHint) {
    const category = await resolveCategory(userId, body.categoryHint, body.type === "TRANSFER" ? undefined : body.type);
    if (!category) {
      throw new ResolutionError(`Não encontrei categoria parecida com "${body.categoryHint}".`);
    }
    result.categoryId = category.id;
  }

  return result;
}

export async function transactionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request) => {
    const userId = await getSingleUserId();
    const query = request.query as Record<string, string | undefined>;
    return prisma.transaction.findMany({
      where: {
        userId,
        accountId: query.accountId,
        cardId: query.cardId,
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: "desc" },
      take: query.limit ? Number(query.limit) : 100,
    });
  });

  app.get("/last", async (request, reply) => {
    const userId = await getSingleUserId();
    const transaction = await getLastTransaction(userId);
    if (!transaction) return reply.code(404).send({ error: "Nenhuma transação encontrada." });
    return transaction;
  });

  app.post("/last/confirm", async (request, reply) => {
    const userId = await getSingleUserId();
    const transaction = await getLastTransaction(userId);
    if (!transaction) return reply.code(404).send({ error: "Nenhuma transação encontrada." });
    return confirmTransaction(transaction.id);
  });

  app.post("/", async (request, reply) => {
    const parsed = createTransactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const userId = await getSingleUserId();
    const date = parsed.data.date ? new Date(parsed.data.date) : new Date();

    try {
      const ids = await resolveIds(userId, parsed.data);

      if (parsed.data.installments && parsed.data.installments > 1) {
        if (!ids.cardId) {
          return reply.code(422).send({ error: "Parcelamento exige um cartão (cardId ou cardHint)." });
        }
        const plan = await createInstallmentPlan({
          userId,
          description: parsed.data.description,
          totalAmountCents: parsed.data.amountCents,
          installmentsCount: parsed.data.installments,
          cardId: ids.cardId,
          categoryId: ids.categoryId,
          firstDueDate: date,
        });
        return reply.code(201).send(plan);
      }

      const transaction = await createTransaction({
        userId,
        date,
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
        type: parsed.data.type,
        status: parsed.data.status,
        origin: parsed.data.origin,
        accountId: ids.accountId,
        cardId: ids.cardId,
        destinationAccountId: ids.destinationAccountId,
        categoryId: ids.categoryId,
        sourceMessageId: parsed.data.sourceMessageId,
      });
      return reply.code(201).send(transaction);
    } catch (error) {
      if (error instanceof ResolutionError || error instanceof TransactionValidationError) {
        return reply.code(422).send({ error: error.message });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const patchSchema = z.object({
      description: z.string().optional(),
      amountCents: z.number().int().positive().optional(),
      categoryId: z.string().optional().nullable(),
      categoryHint: z.string().optional().nullable(),
      accountId: z.string().optional().nullable(),
      accountHint: z.string().optional().nullable(),
      cardId: z.string().optional().nullable(),
      cardHint: z.string().optional().nullable(),
      date: z.string().datetime().optional(),
    });
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const userId = await getSingleUserId();

    try {
      const ids = await resolveIds(userId, {
        type: "EXPENSE",
        description: "",
        amountCents: 1,
        accountId: parsed.data.accountId,
        accountHint: parsed.data.accountHint,
        cardId: parsed.data.cardId,
        cardHint: parsed.data.cardHint,
        categoryId: parsed.data.categoryId,
        categoryHint: parsed.data.categoryHint,
      });
      const transaction = await updateTransactionFields(request.params.id, {
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
        accountId: ids.accountId,
        cardId: ids.cardId,
        categoryId: ids.categoryId,
        date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      });
      return transaction;
    } catch (error) {
      if (error instanceof ResolutionError) {
        return reply.code(422).send({ error: error.message });
      }
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await deleteTransaction(request.params.id);
    return reply.code(204).send();
  });
}
