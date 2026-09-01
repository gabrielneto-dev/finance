import { PaymentMethod, TransactionModality, TransactionStatus, TransactionType } from "@prisma/client";
import { z } from "zod";

export { PaymentMethod, TransactionModality, TransactionStatus, TransactionType };

const date = z.coerce.date();

export const transactionCreateSchema = z.object({
  type: z.nativeEnum(TransactionType),
  modality: z.nativeEnum(TransactionModality).default(TransactionModality.ONE_TIME),
  status: z.nativeEnum(TransactionStatus).default(TransactionStatus.COMPLETED),
  paymentMethod: z.nativeEnum(PaymentMethod),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(160),
  occurredAt: date,
  accountId: z.string().uuid().optional(),
  destinationAccountId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(120).optional()
}).superRefine((value, context) => {
  if (value.type === TransactionType.TRANSFER) {
    if (!value.accountId || !value.destinationAccountId) context.addIssue({ code: "custom", message: "Transferencia exige contas de origem e destino." });
    if (value.accountId === value.destinationAccountId) context.addIssue({ code: "custom", message: "As contas da transferencia devem ser diferentes." });
  }
  if (value.type === TransactionType.INVOICE_PAYMENT && (!value.accountId || !value.invoiceId)) {
    context.addIssue({ code: "custom", message: "Pagamento de fatura exige conta e fatura." });
  }
  if (value.paymentMethod === PaymentMethod.CREDIT_CARD && !value.cardId) {
    context.addIssue({ code: "custom", message: "Compra no credito exige cartao." });
  }
  if ((value.type === TransactionType.EXPENSE || value.type === TransactionType.INCOME || value.type === TransactionType.REFUND) && value.paymentMethod !== PaymentMethod.CREDIT_CARD && !value.accountId) {
    context.addIssue({ code: "custom", message: "Lancamento fora do credito exige uma conta." });
  }
  if ((value.type === TransactionType.EXPENSE || value.type === TransactionType.INCOME || value.type === TransactionType.REFUND) && !value.categoryId) {
    context.addIssue({ code: "custom", message: "Receitas, despesas e estornos exigem categoria." });
  }
});

export type TransactionCreate = z.infer<typeof transactionCreateSchema>;

export const installmentPlanCreateSchema = z.object({
  cardId: z.string().uuid(),
  categoryId: z.string().uuid(),
  totalAmount: z.coerce.number().positive().max(999_999_999.99),
  installments: z.coerce.number().int().min(2).max(60),
  description: z.string().trim().min(1).max(160),
  occurredAt: date,
  idempotencyKey: z.string().min(8).max(120).optional()
});

export type InstallmentPlanCreate = z.infer<typeof installmentPlanCreateSchema>;

export const budgetCreateSchema = z.object({
  scope: z.enum(["GENERAL", "CATEGORY"]),
  categoryId: z.string().uuid().optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amount: z.coerce.number().positive()
}).superRefine((value, context) => {
  if (value.scope === "CATEGORY" && !value.categoryId) context.addIssue({ code: "custom", message: "Orçamento por categoria exige uma categoria." });
  if (value.scope === "GENERAL" && value.categoryId) context.addIssue({ code: "custom", message: "Orçamento geral não aceita categoria." });
});
export type BudgetCreate = z.infer<typeof budgetCreateSchema>;

const goalAccountSchema = z.object({ accountId: z.string().uuid(), allocationPercent: z.coerce.number().min(0).max(100).default(100) });
export const goalCreateSchema = z.object({
  name: z.string().trim().min(2).max(180),
  targetAmount: z.coerce.number().positive(),
  targetDate: date.optional(),
  progressMode: z.enum(["MANUAL", "ACCOUNT_BALANCE"]),
  manualCurrentAmount: z.coerce.number().min(0).optional(),
  accounts: z.array(goalAccountSchema).max(20).default([])
}).superRefine((value, context) => {
  if (value.progressMode === "MANUAL" && value.manualCurrentAmount === undefined) context.addIssue({ code: "custom", message: "Meta manual exige o valor atual." });
  if (value.progressMode === "ACCOUNT_BALANCE" && value.accounts.length === 0) context.addIssue({ code: "custom", message: "Meta por saldo exige pelo menos uma conta." });
});
export type GoalCreate = z.infer<typeof goalCreateSchema>;

export const recurringRuleCreateSchema = z.object({
  accountId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE]),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(160),
  nextRunAt: date
}).refine((value) => Boolean(value.accountId || value.cardId), "Recorrencia exige conta ou cartao.");
