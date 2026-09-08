import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, createTestUser, createTestCard, testPrisma } from "../testing/db";
import {
  closeDueInvoices,
  findOrCreateInvoice,
  markOverdueInvoices,
  recalculateInvoiceTotal,
} from "./invoice-service";

let userId: string;
let cardId: string;

beforeEach(async () => {
  await resetDatabase();
  const user = await createTestUser();
  userId = user.id;
  const card = await createTestCard(userId, { closingDay: 25, dueDay: 5 });
  cardId = card.id;
});

describe("findOrCreateInvoice", () => {
  it("cria a fatura com o período correto", async () => {
    const invoice = await findOrCreateInvoice(cardId, new Date(2026, 8, 10));
    expect(invoice.referenceMonth).toBe("2026-09");
    expect(invoice.status).toBe("OPEN");
    expect(invoice.totalAmountCents).toBe(0);
  });

  it("é idempotente: chamadas repetidas no mesmo ciclo retornam a mesma invoice", async () => {
    const first = await findOrCreateInvoice(cardId, new Date(2026, 8, 5));
    const second = await findOrCreateInvoice(cardId, new Date(2026, 8, 20));
    expect(first.id).toBe(second.id);

    const count = await testPrisma.invoice.count({ where: { cardId } });
    expect(count).toBe(1);
  });
});

describe("recalculateInvoiceTotal", () => {
  it("soma o amountCents de todas as transações da invoice", async () => {
    const invoice = await findOrCreateInvoice(cardId, new Date(2026, 8, 10));
    await testPrisma.transaction.createMany({
      data: [
        {
          userId,
          date: new Date(2026, 8, 10),
          description: "a",
          amountCents: 1000,
          type: "EXPENSE",
          cardId,
          invoiceId: invoice.id,
        },
        {
          userId,
          date: new Date(2026, 8, 11),
          description: "b",
          amountCents: 2500,
          type: "EXPENSE",
          cardId,
          invoiceId: invoice.id,
        },
      ],
    });

    await recalculateInvoiceTotal(invoice.id);

    const updated = await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.totalAmountCents).toBe(3500);
  });

  it("zera o total quando não há transações", async () => {
    const invoice = await findOrCreateInvoice(cardId, new Date(2026, 8, 10));
    await recalculateInvoiceTotal(invoice.id);
    const updated = await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.totalAmountCents).toBe(0);
  });
});

describe("closeDueInvoices", () => {
  it("fecha faturas cujo closingDate já passou", async () => {
    const invoice = await findOrCreateInvoice(cardId, new Date(2026, 8, 10));
    const closed = await closeDueInvoices(new Date(2026, 9, 1));
    expect(closed).toBe(1);
    const updated = await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("CLOSED");
  });

  it("não fecha faturas cujo closingDate ainda não chegou", async () => {
    const invoice = await findOrCreateInvoice(cardId, new Date(2026, 8, 10));
    const closed = await closeDueInvoices(new Date(2026, 8, 20));
    expect(closed).toBe(0);
    const updated = await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("OPEN");
  });
});

describe("markOverdueInvoices", () => {
  it("marca como OVERDUE apenas faturas CLOSED com dueDate vencida", async () => {
    const invoice = await findOrCreateInvoice(cardId, new Date(2026, 8, 10));
    await closeDueInvoices(new Date(2026, 9, 1));

    const overdue = await markOverdueInvoices(new Date(2026, 9, 10));
    expect(overdue).toBe(1);
    const updated = await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("OVERDUE");
  });

  it("não marca faturas ainda OPEN, mesmo que a dueDate já tenha passado", async () => {
    const invoice = await findOrCreateInvoice(cardId, new Date(2026, 8, 10));
    const overdue = await markOverdueInvoices(new Date(2027, 0, 1));
    expect(overdue).toBe(0);
    const updated = await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.status).toBe("OPEN");
  });
});
