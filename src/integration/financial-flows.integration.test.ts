import { PaymentMethod, Prisma, TransactionType } from "@prisma/client";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { transactionCreateSchema } from "@/domain/finance";
import { integrationPrisma } from "@/testing/integration-db";
import { createInstallmentPlan, cancelInstallmentPlan } from "@/server/services/installment-service";
import { generateDueRecurrences } from "@/server/services/recurrence-service";
import { createTransaction } from "@/server/services/transaction-service";

const db = integrationPrisma();
let fixture: { userId: string; workspaceId: string; accountId: string; secondAccountId: string; cardId: string; categoryId: string };

async function createFixture() {
  const user = await db.user.create({ data: { email: "integration@example.local", authSubject: "integration-user" } });
  const workspace = await db.workspace.create({ data: { name: "Integration workspace", members: { create: { userId: user.id } } } });
  const institution = await db.institution.create({ data: { workspaceId: workspace.id, name: "Integration bank" } });
  const account = await db.account.create({ data: { workspaceId: workspace.id, institutionId: institution.id, name: "Primary", type: "CHECKING", initialBalance: 1000 } });
  const secondAccount = await db.account.create({ data: { workspaceId: workspace.id, institutionId: institution.id, name: "Reserve", type: "SAVINGS", initialBalance: 0 } });
  const card = await db.card.create({ data: { workspaceId: workspace.id, institutionId: institution.id, accountId: account.id, name: "Credit", closingDay: 20, dueDay: 28, creditLimit: 5000 } });
  const category = await db.category.create({ data: { workspaceId: workspace.id, name: "Purchases", kind: "EXPENSE" } });
  return { userId: user.id, workspaceId: workspace.id, accountId: account.id, secondAccountId: secondAccount.id, cardId: card.id, categoryId: category.id };
}

beforeAll(async () => { await db.$connect(); });
beforeEach(async () => {
  await db.financialTransaction.deleteMany();
  await db.installmentPlan.deleteMany();
  await db.invoice.deleteMany();
  await db.recurringRule.deleteMany();
  await db.card.deleteMany();
  await db.account.deleteMany();
  await db.category.deleteMany();
  await db.institution.deleteMany();
  await db.workspaceMember.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();
  fixture = await createFixture();
});
afterAll(async () => { await db.$disconnect(); });

describe("financial database flows", () => {
  it("materializes exact installments in the correct monthly invoices", async () => {
    const plan = await createInstallmentPlan(fixture.workspaceId, fixture.userId, {
      cardId: fixture.cardId, categoryId: fixture.categoryId, totalAmount: 100, installments: 3,
      description: "Notebook", occurredAt: new Date("2026-01-31T00:00:00Z"), idempotencyKey: "installment-notebook-001"
    }, db);
    const transactions = await db.financialTransaction.findMany({ where: { installmentPlanId: plan.id }, include: { invoice: true }, orderBy: { installmentNumber: "asc" } });
    expect(transactions.map((item) => Number(item.amount))).toEqual([33.34, 33.33, 33.33]);
    expect(transactions.reduce((sum, item) => sum + Number(item.amount), 0)).toBe(100);
    expect(transactions.map((item) => item.occurredAt.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(transactions.map((item) => item.invoice?.reference.toISOString().slice(0, 10))).toEqual(["2026-02-01", "2026-03-01", "2026-04-01"]);
    expect(transactions[0].status).toBe("COMPLETED");
    expect(transactions.slice(1).every((item) => item.status === "SCHEDULED")).toBe(true);
  });

  it("is idempotent and cancels only future installments", async () => {
    const input = { cardId: fixture.cardId, categoryId: fixture.categoryId, totalAmount: 300, installments: 3, description: "Mesa", occurredAt: new Date("2026-02-10T00:00:00Z"), idempotencyKey: "installment-desk-0001" };
    const first = await createInstallmentPlan(fixture.workspaceId, fixture.userId, input, db);
    const replay = await createInstallmentPlan(fixture.workspaceId, fixture.userId, input, db);
    expect(replay.id).toBe(first.id);
    await cancelInstallmentPlan(fixture.workspaceId, first.id, db);
    const statuses = await db.financialTransaction.findMany({ where: { installmentPlanId: first.id }, select: { status: true }, orderBy: { installmentNumber: "asc" } });
    expect(statuses.map((item) => item.status)).toEqual(["COMPLETED", "CANCELLED", "CANCELLED"]);
  });

  it("keeps credit installments out of cash balance until invoice payment", async () => {
    const plan = await createInstallmentPlan(fixture.workspaceId, fixture.userId, { cardId: fixture.cardId, categoryId: fixture.categoryId, totalAmount: 120, installments: 2, description: "Curso", occurredAt: new Date("2026-02-10T00:00:00Z") }, db);
    const installment = await db.financialTransaction.findFirstOrThrow({ where: { installmentPlanId: plan.id, installmentNumber: 1 } });
    let balances = await db.$queryRaw<Array<{ balance: Prisma.Decimal }>>`SELECT balance FROM v_account_balances WHERE id = ${fixture.accountId}::uuid`;
    expect(Number(balances[0].balance)).toBe(1000);
    await createTransaction(fixture.workspaceId, fixture.userId, transactionCreateSchema.parse({ type: TransactionType.INVOICE_PAYMENT, paymentMethod: PaymentMethod.PIX, amount: 60, description: "Pagamento fatura", occurredAt: new Date("2026-02-28T00:00:00Z"), accountId: fixture.accountId, invoiceId: installment.invoiceId, status: "COMPLETED" }), db);
    balances = await db.$queryRaw<Array<{ balance: Prisma.Decimal }>>`SELECT balance FROM v_account_balances WHERE id = ${fixture.accountId}::uuid`;
    expect(Number(balances[0].balance)).toBe(940);
  });

  it("preserves workspace isolation, transfer neutrality, and recurrence idempotency", async () => {
    await createTransaction(fixture.workspaceId, fixture.userId, transactionCreateSchema.parse({ type: TransactionType.TRANSFER, paymentMethod: PaymentMethod.PIX, amount: 100, description: "Reserva", occurredAt: new Date("2026-02-10T00:00:00Z"), accountId: fixture.accountId, destinationAccountId: fixture.secondAccountId, status: "COMPLETED" }), db);
    const balances = await db.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>`SELECT id, balance FROM v_account_balances WHERE id IN (${fixture.accountId}::uuid, ${fixture.secondAccountId}::uuid)`;
    expect(balances.reduce((sum, item) => sum + Number(item.balance), 0)).toBe(1000);
    await db.recurringRule.create({ data: { workspaceId: fixture.workspaceId, accountId: fixture.accountId, categoryId: fixture.categoryId, type: "EXPENSE", frequency: "MONTHLY", amount: 10, description: "Teste recorrente", nextRunAt: new Date("2026-02-10T00:00:00Z") } });
    expect(await generateDueRecurrences(new Date("2026-02-10T00:00:00Z"), db)).toBe(1);
    expect(await generateDueRecurrences(new Date("2026-02-10T00:00:00Z"), db)).toBe(0);
    const other = await db.workspace.create({ data: { name: "Other", members: { create: { userId: fixture.userId } } } });
    await expect(createInstallmentPlan(other.id, fixture.userId, { cardId: fixture.cardId, categoryId: fixture.categoryId, totalAmount: 20, installments: 2, description: "Invalido", occurredAt: new Date("2026-02-10T00:00:00Z") }, db)).rejects.toThrow("Cartao ou categoria invalido");
  });
});
