import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDatabase,
  createTestUser,
  createTestAccount,
  createTestCard,
  testPrisma,
} from "../testing/db";
import {
  confirmTransaction,
  createTransaction,
  deleteTransaction,
  getAccountBalanceCents,
  getLastTransaction,
  TransactionValidationError,
  updateTransactionFields,
} from "./transaction-service";

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  const user = await createTestUser();
  userId = user.id;
});

describe("createTransaction — validação", () => {
  it("rejeita transação sem conta e sem cartão", async () => {
    await expect(
      createTransaction({
        userId,
        date: new Date(),
        description: "teste",
        amountCents: 100,
        type: "EXPENSE",
      }),
    ).rejects.toThrow(TransactionValidationError);
  });

  it("rejeita transação com conta E cartão ao mesmo tempo", async () => {
    const account = await createTestAccount(userId);
    const card = await createTestCard(userId);
    await expect(
      createTransaction({
        userId,
        date: new Date(),
        description: "teste",
        amountCents: 100,
        type: "EXPENSE",
        accountId: account.id,
        cardId: card.id,
      }),
    ).rejects.toThrow(TransactionValidationError);
  });

  it("rejeita TRANSFER sem conta de destino", async () => {
    const account = await createTestAccount(userId);
    await expect(
      createTransaction({
        userId,
        date: new Date(),
        description: "teste",
        amountCents: 100,
        type: "TRANSFER",
        accountId: account.id,
      }),
    ).rejects.toThrow(TransactionValidationError);
  });

  it("aceita TRANSFER com origem e destino", async () => {
    const from = await createTestAccount(userId, { name: "Origem" });
    const to = await createTestAccount(userId, { name: "Destino" });
    const transaction = await createTransaction({
      userId,
      date: new Date(),
      description: "transferência",
      amountCents: 5000,
      type: "TRANSFER",
      accountId: from.id,
      destinationAccountId: to.id,
    });
    expect(transaction.type).toBe("TRANSFER");
  });
});

describe("createTransaction — cartão gera fatura", () => {
  it("cria uma invoice associada quando a transação é no cartão", async () => {
    const card = await createTestCard(userId, { closingDay: 25, dueDay: 5 });
    const transaction = await createTransaction({
      userId,
      date: new Date(2026, 8, 10),
      description: "compra",
      amountCents: 5000,
      type: "EXPENSE",
      cardId: card.id,
    });

    expect(transaction.invoiceId).not.toBeNull();
    const invoice = await testPrisma.invoice.findUniqueOrThrow({
      where: { id: transaction.invoiceId! },
    });
    expect(invoice.referenceMonth).toBe("2026-09");
    expect(invoice.totalAmountCents).toBe(5000);
  });

  it("reaproveita a mesma invoice para duas compras no mesmo ciclo", async () => {
    const card = await createTestCard(userId, { closingDay: 25, dueDay: 5 });
    const t1 = await createTransaction({
      userId,
      date: new Date(2026, 8, 5),
      description: "compra 1",
      amountCents: 3000,
      type: "EXPENSE",
      cardId: card.id,
    });
    const t2 = await createTransaction({
      userId,
      date: new Date(2026, 8, 20),
      description: "compra 2",
      amountCents: 2000,
      type: "EXPENSE",
      cardId: card.id,
    });

    expect(t1.invoiceId).toBe(t2.invoiceId);
    const invoice = await testPrisma.invoice.findUniqueOrThrow({ where: { id: t1.invoiceId! } });
    expect(invoice.totalAmountCents).toBe(5000);
  });

  it("compra após o fechamento cai na fatura do próximo ciclo", async () => {
    const card = await createTestCard(userId, { closingDay: 25, dueDay: 5 });
    const before = await createTransaction({
      userId,
      date: new Date(2026, 8, 20),
      description: "antes do fechamento",
      amountCents: 1000,
      type: "EXPENSE",
      cardId: card.id,
    });
    const after = await createTransaction({
      userId,
      date: new Date(2026, 8, 26),
      description: "depois do fechamento",
      amountCents: 1000,
      type: "EXPENSE",
      cardId: card.id,
    });

    expect(before.invoiceId).not.toBe(after.invoiceId);
  });
});

describe("getAccountBalanceCents", () => {
  it("soma initialBalance + income - expense", async () => {
    const account = await createTestAccount(userId, { initialBalanceCents: 10000 });
    await createTransaction({
      userId,
      date: new Date(),
      description: "receita",
      amountCents: 5000,
      type: "INCOME",
      accountId: account.id,
    });
    await createTransaction({
      userId,
      date: new Date(),
      description: "despesa",
      amountCents: 2000,
      type: "EXPENSE",
      accountId: account.id,
    });

    expect(await getAccountBalanceCents(account.id)).toBe(10000 + 5000 - 2000);
  });

  it("transferência sai da origem e entra no destino", async () => {
    const from = await createTestAccount(userId, { name: "Origem", initialBalanceCents: 10000 });
    const to = await createTestAccount(userId, { name: "Destino", initialBalanceCents: 0 });
    await createTransaction({
      userId,
      date: new Date(),
      description: "transferência",
      amountCents: 4000,
      type: "TRANSFER",
      accountId: from.id,
      destinationAccountId: to.id,
    });

    expect(await getAccountBalanceCents(from.id)).toBe(6000);
    expect(await getAccountBalanceCents(to.id)).toBe(4000);
  });

  it("compra no cartão não afeta o saldo da conta de débito", async () => {
    const account = await createTestAccount(userId, { initialBalanceCents: 10000 });
    const card = await createTestCard(userId, { accountId: account.id });
    await createTransaction({
      userId,
      date: new Date(),
      description: "compra no crédito",
      amountCents: 5000,
      type: "EXPENSE",
      cardId: card.id,
    });

    expect(await getAccountBalanceCents(account.id)).toBe(10000);
  });
});

describe("deleteTransaction", () => {
  it("recalcula o total da invoice após remover a única transação", async () => {
    const card = await createTestCard(userId);
    const transaction = await createTransaction({
      userId,
      date: new Date(),
      description: "compra",
      amountCents: 5000,
      type: "EXPENSE",
      cardId: card.id,
    });
    const invoiceId = transaction.invoiceId!;

    await deleteTransaction(transaction.id);

    const invoice = await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.totalAmountCents).toBe(0);
  });
});

describe("updateTransactionFields", () => {
  it("recalcula a invoice quando o valor muda", async () => {
    const card = await createTestCard(userId);
    const transaction = await createTransaction({
      userId,
      date: new Date(),
      description: "compra",
      amountCents: 5000,
      type: "EXPENSE",
      cardId: card.id,
    });

    await updateTransactionFields(transaction.id, { amountCents: 8000 });

    const invoice = await testPrisma.invoice.findUniqueOrThrow({
      where: { id: transaction.invoiceId! },
    });
    expect(invoice.totalAmountCents).toBe(8000);
  });
});

describe("getLastTransaction / confirmTransaction", () => {
  it("retorna a transação criada mais recentemente", async () => {
    const account = await createTestAccount(userId);
    await createTransaction({
      userId,
      date: new Date(),
      description: "primeira",
      amountCents: 100,
      type: "EXPENSE",
      accountId: account.id,
    });
    const second = await createTransaction({
      userId,
      date: new Date(),
      description: "segunda",
      amountCents: 200,
      type: "EXPENSE",
      accountId: account.id,
    });

    const last = await getLastTransaction(userId);
    expect(last?.id).toBe(second.id);
  });

  it("confirmTransaction muda o status para CONFIRMED", async () => {
    const account = await createTestAccount(userId);
    const transaction = await createTransaction({
      userId,
      date: new Date(),
      description: "pendente",
      amountCents: 100,
      type: "EXPENSE",
      accountId: account.id,
      status: "PENDING",
    });

    const confirmed = await confirmTransaction(transaction.id);
    expect(confirmed.status).toBe("CONFIRMED");
  });
});
