import type { Account, Card, Category, TxType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { normalize } from "../lib/normalize.js";

function matches(hint: string, name: string, aliases: string[]): boolean {
  const normalizedHint = normalize(hint);
  if (normalize(name).includes(normalizedHint)) return true;
  return aliases.some((alias) => normalize(alias).includes(normalizedHint));
}

export async function resolveAccount(
  userId: string,
  hint: string,
): Promise<Account | null> {
  const accounts = await prisma.account.findMany({
    where: { userId, archived: false },
  });
  return accounts.find((a) => matches(hint, a.name, a.aliases)) ?? null;
}

export async function resolveCard(
  userId: string,
  hint: string,
): Promise<Card | null> {
  const cards = await prisma.card.findMany({
    where: { userId, archived: false },
  });
  return cards.find((c) => matches(hint, c.name, c.aliases)) ?? null;
}

export async function resolveCategory(
  userId: string,
  hint: string,
  type?: TxType,
): Promise<Category | null> {
  const categories = await prisma.category.findMany({
    where: { userId, ...(type ? { type } : {}) },
  });
  return categories.find((c) => matches(hint, c.name, c.aliases)) ?? null;
}

export async function defaultAccountOrCard(
  userId: string,
): Promise<{ accountId?: string; cardId?: string } | null> {
  const account = await prisma.account.findFirst({
    where: { userId, archived: false },
    orderBy: { createdAt: "asc" },
  });
  if (!account) return null;
  return { accountId: account.id };
}
