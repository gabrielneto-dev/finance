import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, createTestUser, createTestCard, testPrisma } from "../testing/db";
import { createInstallmentPlan, InstallmentValidationError } from "./installment-service";

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  const user = await createTestUser();
  userId = user.id;
});

describe("createInstallmentPlan", () => {
  it("rejeita menos de 1 parcela", async () => {
    const card = await createTestCard(userId);
    await expect(
      createInstallmentPlan({
        userId,
        description: "compra",
        totalAmountCents: 1000,
        installmentsCount: 0,
        cardId: card.id,
        firstDueDate: new Date(),
      }),
    ).rejects.toThrow(InstallmentValidationError);
  });

  it("distribui o valor em parcelas iguais, com resto na última", async () => {
    const card = await createTestCard(userId);
    const plan = await createInstallmentPlan({
      userId,
      description: "notebook",
      totalAmountCents: 100037,
      installmentsCount: 3,
      cardId: card.id,
      firstDueDate: new Date(2026, 8, 8),
    });

    const installments = await testPrisma.installment.findMany({
      where: { installmentPlanId: plan.id },
      orderBy: { number: "asc" },
    });

    expect(installments).toHaveLength(3);
    expect(installments.map((i) => i.amountCents)).toEqual([33345, 33345, 33347]);
    expect(installments.reduce((sum, i) => sum + i.amountCents, 0)).toBe(100037);
  });

  it("agenda cada parcela em um mês subsequente", async () => {
    const card = await createTestCard(userId);
    const plan = await createInstallmentPlan({
      userId,
      description: "geladeira",
      totalAmountCents: 300000,
      installmentsCount: 3,
      cardId: card.id,
      firstDueDate: new Date(2026, 8, 8),
    });

    const installments = await testPrisma.installment.findMany({
      where: { installmentPlanId: plan.id },
      orderBy: { number: "asc" },
    });

    expect(installments[0].dueDate.getMonth()).toBe(8);
    expect(installments[1].dueDate.getMonth()).toBe(9);
    expect(installments[2].dueDate.getMonth()).toBe(10);
  });

  it("cada parcela cria uma transação vinculada com origin INSTALLMENT", async () => {
    const card = await createTestCard(userId);
    const plan = await createInstallmentPlan({
      userId,
      description: "celular",
      totalAmountCents: 200000,
      installmentsCount: 2,
      cardId: card.id,
      firstDueDate: new Date(2026, 8, 8),
    });

    const transactions = await testPrisma.transaction.findMany({
      where: { userId, origin: "INSTALLMENT" },
      orderBy: { date: "asc" },
    });

    expect(transactions).toHaveLength(2);
    expect(transactions[0].description).toBe("celular (1/2)");
    expect(transactions[1].description).toBe("celular (2/2)");
    expect(transactions.every((t) => t.cardId === card.id)).toBe(true);
    expect(transactions.every((t) => t.invoiceId !== null)).toBe(true);

    const installments = await testPrisma.installment.findMany({
      where: { installmentPlanId: plan.id },
    });
    expect(installments.every((i) => i.status === "BILLED")).toBe(true);
  });

  it("distribui as parcelas em faturas diferentes", async () => {
    const card = await createTestCard(userId, { closingDay: 25, dueDay: 5 });
    await createInstallmentPlan({
      userId,
      description: "sofá",
      totalAmountCents: 300000,
      installmentsCount: 3,
      cardId: card.id,
      firstDueDate: new Date(2026, 8, 8),
    });

    const invoices = await testPrisma.invoice.findMany({ where: { cardId: card.id } });
    expect(invoices).toHaveLength(3);
    expect(invoices.every((i) => i.totalAmountCents === 100000)).toBe(true);
  });
});
