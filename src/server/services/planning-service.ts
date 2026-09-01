import { BudgetScope, GoalProgressMode, GoalStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { BudgetCreate, GoalCreate } from "@/domain/finance";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type FinanceClient = typeof prisma;
type BalanceRow = { id: string; balance: Prisma.Decimal };

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthNumber - 1, 1)), end: new Date(Date.UTC(year, monthNumber, 0)) };
}

function monthFromDate(date: Date) { return date.toISOString().slice(0, 7); }

async function budgetProgress(budget: { id: string; workspaceId: string; categoryId: string | null; amount: Prisma.Decimal; periodStart: Date; periodEnd: Date }, client: FinanceClient) {
  const transactions = await client.financialTransaction.findMany({
    where: { workspaceId: budget.workspaceId, occurredAt: { gte: budget.periodStart, lte: budget.periodEnd }, status: { in: [TransactionStatus.PAID, TransactionStatus.COMPLETED] }, type: { in: [TransactionType.EXPENSE, TransactionType.REFUND] }, ...(budget.categoryId ? { categoryId: budget.categoryId } : {}) },
    select: { amount: true, type: true }
  });
  const spentAmount = transactions.reduce((sum, item) => sum + Number(item.amount) * (item.type === TransactionType.REFUND ? -1 : 1), 0);
  const amount = Number(budget.amount); const usedPercent = amount === 0 ? 0 : (spentAmount / amount) * 100;
  return { spentAmount, remainingAmount: Math.max(0, amount - spentAmount), usedPercent, alert: usedPercent >= 90 ? "CRITICAL" : usedPercent >= 70 ? "WARNING" : "OK" };
}

async function assertBudgetCategory(workspaceId: string, scope: BudgetScope, categoryId: string | undefined, client: FinanceClient) {
  if (scope === BudgetScope.GENERAL) return;
  const category = await client.category.findFirst({ where: { id: categoryId, workspaceId, kind: TransactionType.EXPENSE } });
  if (!category) throw new DomainError("Categoria de despesa inválida.", 422);
}

export async function listBudgets(workspaceId: string, month: string, client: FinanceClient = prisma) {
  const { start, end } = monthRange(month);
  const budgets = await client.budget.findMany({ where: { workspaceId, periodStart: start, periodEnd: end }, include: { category: true }, orderBy: { createdAt: "asc" } });
  return Promise.all(budgets.map(async (budget) => ({ ...budget, month: monthFromDate(budget.periodStart), ...(await budgetProgress(budget, client)) })));
}

export async function createBudget(workspaceId: string, input: BudgetCreate, client: FinanceClient = prisma) {
  await assertBudgetCategory(workspaceId, input.scope, input.categoryId, client);
  const { start, end } = monthRange(input.month);
  const duplicate = await client.budget.findFirst({ where: { workspaceId, scope: input.scope, categoryId: input.scope === BudgetScope.CATEGORY ? input.categoryId : null, periodStart: start } });
  if (duplicate) throw new DomainError("Já existe um orçamento para este período e escopo.", 409);
  return client.budget.create({ data: { workspaceId, scope: input.scope, categoryId: input.scope === BudgetScope.CATEGORY ? input.categoryId : null, periodStart: start, periodEnd: end, amount: input.amount } });
}

export async function updateBudget(workspaceId: string, budgetId: string, input: BudgetCreate, client: FinanceClient = prisma) {
  const budget = await client.budget.findFirst({ where: { id: budgetId, workspaceId } });
  if (!budget) throw new DomainError("Orçamento não encontrado.", 404);
  await assertBudgetCategory(workspaceId, input.scope, input.categoryId, client);
  const { start, end } = monthRange(input.month);
  return client.budget.update({ where: { id: budget.id }, data: { scope: input.scope, categoryId: input.scope === BudgetScope.CATEGORY ? input.categoryId : null, periodStart: start, periodEnd: end, amount: input.amount } });
}

export async function deleteBudget(workspaceId: string, budgetId: string, client: FinanceClient = prisma) {
  const result = await client.budget.deleteMany({ where: { id: budgetId, workspaceId } });
  if (!result.count) throw new DomainError("Orçamento não encontrado.", 404);
}

async function assertGoalAccounts(workspaceId: string, accounts: GoalCreate["accounts"], client: FinanceClient) {
  const ids = accounts.map((item) => item.accountId);
  if (new Set(ids).size !== ids.length) throw new DomainError("Uma conta só pode aparecer uma vez na meta.", 422);
  const found = await client.account.count({ where: { workspaceId, id: { in: ids } } });
  if (found !== ids.length) throw new DomainError("Uma conta vinculada não pertence ao workspace.", 422);
}

async function goalProgress(goal: { progressMode: GoalProgressMode; manualCurrentAmount: Prisma.Decimal | null; targetAmount: Prisma.Decimal; accounts: Array<{ accountId: string; allocationPercent: Prisma.Decimal }> }, client: FinanceClient) {
  let currentAmount = Number(goal.manualCurrentAmount ?? 0);
  if (goal.progressMode === GoalProgressMode.ACCOUNT_BALANCE && goal.accounts.length) {
    const ids = goal.accounts.map((item) => item.accountId);
    const balances = await client.$queryRaw<BalanceRow[]>`SELECT id, balance FROM v_account_balances WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`;
    const byId = new Map(balances.map((item) => [item.id, Number(item.balance)]));
    currentAmount = goal.accounts.reduce((sum, item) => sum + (byId.get(item.accountId) ?? 0) * (Number(item.allocationPercent) / 100), 0);
  }
  const targetAmount = Number(goal.targetAmount); return { currentAmount, remainingAmount: Math.max(0, targetAmount - currentAmount), progressPercent: targetAmount === 0 ? 0 : (currentAmount / targetAmount) * 100, achieved: currentAmount >= targetAmount };
}

export async function listGoals(workspaceId: string, status: GoalStatus = GoalStatus.ACTIVE, client: FinanceClient = prisma) {
  const goals = await client.goal.findMany({ where: { workspaceId, status }, include: { accounts: { include: { account: true } } }, orderBy: { createdAt: "asc" } });
  return Promise.all(goals.map(async (goal) => ({ ...goal, ...(await goalProgress(goal, client)) })));
}

export async function createGoal(workspaceId: string, input: GoalCreate, client: FinanceClient = prisma) {
  if (input.progressMode === GoalProgressMode.ACCOUNT_BALANCE) await assertGoalAccounts(workspaceId, input.accounts, client);
  return client.goal.create({ data: { workspaceId, name: input.name, targetAmount: input.targetAmount, targetDate: input.targetDate, progressMode: input.progressMode, manualCurrentAmount: input.progressMode === GoalProgressMode.MANUAL ? input.manualCurrentAmount : null, accounts: input.progressMode === GoalProgressMode.ACCOUNT_BALANCE ? { create: input.accounts } : undefined } });
}

export async function archiveGoal(workspaceId: string, goalId: string, client: FinanceClient = prisma) {
  const goal = await client.goal.findFirst({ where: { id: goalId, workspaceId } });
  if (!goal) throw new DomainError("Meta não encontrada.", 404);
  return client.goal.update({ where: { id: goal.id }, data: { status: GoalStatus.ARCHIVED } });
}

export async function updateGoal(workspaceId: string, goalId: string, input: GoalCreate, client: FinanceClient = prisma) {
  const goal = await client.goal.findFirst({ where: { id: goalId, workspaceId } });
  if (!goal) throw new DomainError("Meta não encontrada.", 404);
  if (input.progressMode === GoalProgressMode.ACCOUNT_BALANCE) await assertGoalAccounts(workspaceId, input.accounts, client);
  return client.$transaction(async (tx) => {
    await tx.goalAccount.deleteMany({ where: { goalId: goal.id } });
    return tx.goal.update({ where: { id: goal.id }, data: { name: input.name, targetAmount: input.targetAmount, targetDate: input.targetDate, progressMode: input.progressMode, manualCurrentAmount: input.progressMode === GoalProgressMode.MANUAL ? input.manualCurrentAmount : null, accounts: input.progressMode === GoalProgressMode.ACCOUNT_BALANCE ? { create: input.accounts } : undefined } });
  });
}
