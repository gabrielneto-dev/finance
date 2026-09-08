import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, createTestUser, createTestAccount, testPrisma } from "../testing/db.js";
import { generateDueRecurrences } from "./recurrence-service.js";

let userId: string;
let accountId: string;

beforeEach(async () => {
  await resetDatabase();
  const user = await createTestUser();
  userId = user.id;
  const account = await createTestAccount(userId, { name: "Conta" });
  accountId = account.id;
});

describe("generateDueRecurrences", () => {
  it("não gera nada para recorrência com nextRunDate no futuro", async () => {
    const now = new Date(2026, 8, 1);
    await testPrisma.recurrence.create({
      data: {
        userId,
        description: "Salário",
        amountCents: 300000,
        type: "INCOME",
        frequency: "MONTHLY",
        interval: 1,
        accountId,
        startDate: new Date(2026, 8, 15),
        nextRunDate: new Date(2026, 8, 15),
      },
    });

    const generated = await generateDueRecurrences(now);
    expect(generated).toBe(0);
  });

  it("gera uma transação e avança nextRunDate em um mês", async () => {
    const now = new Date(2026, 8, 10);
    const recurrence = await testPrisma.recurrence.create({
      data: {
        userId,
        description: "Salário",
        amountCents: 300000,
        type: "INCOME",
        frequency: "MONTHLY",
        interval: 1,
        accountId,
        startDate: new Date(2026, 8, 5),
        nextRunDate: new Date(2026, 8, 5),
      },
    });

    const generated = await generateDueRecurrences(now);
    expect(generated).toBe(1);

    const transactions = await testPrisma.transaction.findMany({ where: { recurrenceId: recurrence.id } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amountCents).toBe(300000);

    const updated = await testPrisma.recurrence.findUniqueOrThrow({ where: { id: recurrence.id } });
    expect(updated.nextRunDate.getMonth()).toBe(9);
  });

  it("faz catch-up de múltiplas ocorrências atrasadas", async () => {
    // nextRunDate cai todo dia 5; "now" no dia 10/dez cobre set, out, nov e dez.
    const now = new Date(2026, 11, 10);
    const recurrence = await testPrisma.recurrence.create({
      data: {
        userId,
        description: "Aluguel",
        amountCents: 150000,
        type: "EXPENSE",
        frequency: "MONTHLY",
        interval: 1,
        accountId,
        startDate: new Date(2026, 8, 5),
        nextRunDate: new Date(2026, 8, 5),
      },
    });

    const generated = await generateDueRecurrences(now);
    expect(generated).toBe(4);

    const transactions = await testPrisma.transaction.findMany({
      where: { recurrenceId: recurrence.id },
      orderBy: { date: "asc" },
    });
    expect(transactions).toHaveLength(4);
    expect(transactions[0].date.getMonth()).toBe(8);
    expect(transactions[3].date.getMonth()).toBe(11);
  });

  it("desativa a recorrência quando ultrapassa endDate", async () => {
    const now = new Date(2026, 10, 1);
    const recurrence = await testPrisma.recurrence.create({
      data: {
        userId,
        description: "Assinatura",
        amountCents: 5000,
        type: "EXPENSE",
        frequency: "MONTHLY",
        interval: 1,
        accountId,
        startDate: new Date(2026, 8, 5),
        nextRunDate: new Date(2026, 8, 5),
        endDate: new Date(2026, 9, 10),
      },
    });

    await generateDueRecurrences(now);

    const updated = await testPrisma.recurrence.findUniqueOrThrow({ where: { id: recurrence.id } });
    expect(updated.active).toBe(false);
  });

  it("respeita interval maior que 1 (a cada 2 meses)", async () => {
    // nextRunDate cai dia 5; "now" no dia 10/dez cobre set (iter 1) e nov (iter 2).
    const now = new Date(2026, 11, 10);
    const recurrence = await testPrisma.recurrence.create({
      data: {
        userId,
        description: "Bimestral",
        amountCents: 1000,
        type: "EXPENSE",
        frequency: "MONTHLY",
        interval: 2,
        accountId,
        startDate: new Date(2026, 8, 5),
        nextRunDate: new Date(2026, 8, 5),
      },
    });

    await generateDueRecurrences(now);

    const updated = await testPrisma.recurrence.findUniqueOrThrow({ where: { id: recurrence.id } });
    // set -> nov -> jan (pulando de 2 em 2 meses)
    expect(updated.nextRunDate.getMonth()).toBe(0);
    expect(updated.nextRunDate.getFullYear()).toBe(2027);
  });
});
