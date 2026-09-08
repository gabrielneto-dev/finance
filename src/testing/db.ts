import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function resetDatabase(): Promise<void> {
  await testPrisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "transactions",
      "installments",
      "installment_plans",
      "invoices",
      "recurrences",
      "categories",
      "cards",
      "accounts",
      "whatsapp_messages",
      "users"
    RESTART IDENTITY CASCADE
  `);
}

let userCounter = 0;

export async function createTestUser(overrides: { phone?: string; name?: string } = {}) {
  userCounter += 1;
  return testPrisma.user.create({
    data: {
      name: overrides.name ?? "Usuário Teste",
      phone: overrides.phone ?? `55110000000${userCounter}`,
    },
  });
}

export async function createTestAccount(
  userId: string,
  overrides: Partial<{
    name: string;
    aliases: string[];
    type: "CHECKING" | "SAVINGS" | "CASH" | "INVESTMENT";
    initialBalanceCents: number;
    archived: boolean;
  }> = {},
) {
  return testPrisma.account.create({
    data: {
      userId,
      name: overrides.name ?? "Conta Teste",
      aliases: overrides.aliases ?? [],
      type: overrides.type ?? "CHECKING",
      initialBalanceCents: overrides.initialBalanceCents ?? 0,
      archived: overrides.archived ?? false,
    },
  });
}

export async function createTestCard(
  userId: string,
  overrides: Partial<{
    name: string;
    aliases: string[];
    accountId: string;
    creditLimitCents: number;
    closingDay: number;
    dueDay: number;
  }> = {},
) {
  return testPrisma.card.create({
    data: {
      userId,
      name: overrides.name ?? "Cartão Teste",
      aliases: overrides.aliases ?? [],
      accountId: overrides.accountId,
      creditLimitCents: overrides.creditLimitCents ?? 500000,
      closingDay: overrides.closingDay ?? 25,
      dueDay: overrides.dueDay ?? 5,
    },
  });
}

export async function createTestCategory(
  userId: string,
  overrides: Partial<{
    name: string;
    aliases: string[];
    type: "INCOME" | "EXPENSE";
  }> = {},
) {
  return testPrisma.category.create({
    data: {
      userId,
      name: overrides.name ?? "Categoria Teste",
      aliases: overrides.aliases ?? [],
      type: overrides.type ?? "EXPENSE",
    },
  });
}
