import type { TxType } from "@prisma/client";
import { resolveAccount, resolveCard, resolveCategory } from "./resolver-service";

export class ResolutionError extends Error {}

export interface ResolutionInput {
  type: TxType;
  accountId?: string | null;
  accountHint?: string | null;
  cardId?: string | null;
  cardHint?: string | null;
  destinationAccountId?: string | null;
  destinationAccountHint?: string | null;
  categoryId?: string | null;
  categoryHint?: string | null;
}

export interface ResolvedIds {
  accountId?: string;
  cardId?: string;
  destinationAccountId?: string;
  categoryId?: string;
}

export async function resolveTransactionIds(
  userId: string,
  input: ResolutionInput,
): Promise<ResolvedIds> {
  const result: ResolvedIds = {
    accountId: input.accountId ?? undefined,
    cardId: input.cardId ?? undefined,
    destinationAccountId: input.destinationAccountId ?? undefined,
    categoryId: input.categoryId ?? undefined,
  };

  if (!result.accountId && input.accountHint) {
    const account = await resolveAccount(userId, input.accountHint);
    if (!account) {
      throw new ResolutionError(`Não encontrei conta parecida com "${input.accountHint}".`);
    }
    result.accountId = account.id;
  }

  if (!result.cardId && input.cardHint) {
    const card = await resolveCard(userId, input.cardHint);
    if (!card) {
      throw new ResolutionError(`Não encontrei cartão parecido com "${input.cardHint}".`);
    }
    result.cardId = card.id;
  }

  if (!result.destinationAccountId && input.destinationAccountHint) {
    const account = await resolveAccount(userId, input.destinationAccountHint);
    if (!account) {
      throw new ResolutionError(
        `Não encontrei conta de destino parecida com "${input.destinationAccountHint}".`,
      );
    }
    result.destinationAccountId = account.id;
  }

  if (!result.categoryId && input.categoryHint) {
    const category = await resolveCategory(
      userId,
      input.categoryHint,
      input.type === "TRANSFER" ? undefined : input.type,
    );
    if (!category) {
      throw new ResolutionError(`Não encontrei categoria parecida com "${input.categoryHint}".`);
    }
    result.categoryId = category.id;
  }

  return result;
}
