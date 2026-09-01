import { PaymentMethod, PrismaClient, RecurrenceFrequency, TransactionModality, TransactionStatus, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();
const demoEmail = "demo@clareira.local";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: "Conta de demonstração" },
    create: { email: demoEmail, name: "Conta de demonstração", authSubject: `local:${demoEmail}` }
  });

  let workspace = await prisma.workspace.findFirst({ where: { name: "Finanças da Casa", members: { some: { userId: user.id } } } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: "Finanças da Casa", members: { create: { userId: user.id, role: "OWNER" } } }
    });
  }

  const categoryData = [
    ["Salário", TransactionType.INCOME], ["Moradia", TransactionType.EXPENSE],
    ["Mercado", TransactionType.EXPENSE], ["Transporte", TransactionType.EXPENSE],
    ["Lazer", TransactionType.EXPENSE]
  ] as const;
  for (const [name, kind] of categoryData) {
    await prisma.category.upsert({ where: { workspaceId_name_kind: { workspaceId: workspace.id, name, kind } }, update: {}, create: { workspaceId: workspace.id, name, kind } });
  }
  const categories = await prisma.category.findMany({ where: { workspaceId: workspace.id } });
  const category = (name: string) => categories.find((item) => item.name === name)!;

  let institution = await prisma.institution.findFirst({ where: { workspaceId: workspace.id, name: "Banco Exemplo" } });
  if (!institution) institution = await prisma.institution.create({ data: { workspaceId: workspace.id, name: "Banco Exemplo" } });

  let account = await prisma.account.findFirst({ where: { workspaceId: workspace.id, name: "Conta principal" } });
  if (!account) account = await prisma.account.create({ data: { workspaceId: workspace.id, institutionId: institution.id, createdById: user.id, name: "Conta principal", type: "CHECKING", initialBalance: 1250 } });

  let card = await prisma.card.findFirst({ where: { workspaceId: workspace.id, name: "Cartão principal" } });
  if (!card) card = await prisma.card.create({ data: { workspaceId: workspace.id, institutionId: institution.id, accountId: account.id, name: "Cartão principal", lastFour: "4242", closingDay: 20, dueDay: 28, creditLimit: 3500 } });

  const invoiceReference = new Date(Date.UTC(2026, 8, 1));
  const invoice = await prisma.invoice.upsert({
    where: { cardId_reference: { cardId: card.id, reference: invoiceReference } },
    update: {},
    create: { workspaceId: workspace.id, cardId: card.id, reference: invoiceReference, dueDate: new Date(Date.UTC(2026, 8, 28)) }
  });

  const transactions = [
    { key: "demo:salary", type: TransactionType.INCOME, paymentMethod: PaymentMethod.BANK_TRANSFER, amount: 6000, description: "Salário", occurredAt: new Date(Date.UTC(2026, 8, 5)), categoryId: category("Salário").id, accountId: account.id },
    { key: "demo:rent", type: TransactionType.EXPENSE, paymentMethod: PaymentMethod.PIX, amount: 1800, description: "Aluguel", occurredAt: new Date(Date.UTC(2026, 8, 6)), categoryId: category("Moradia").id, accountId: account.id },
    { key: "demo:market", type: TransactionType.EXPENSE, paymentMethod: PaymentMethod.CREDIT_CARD, amount: 386.45, description: "Mercado semanal", occurredAt: new Date(Date.UTC(2026, 8, 8)), categoryId: category("Mercado").id, cardId: card.id, invoiceId: invoice.id }
  ];
  for (const { key, ...transaction } of transactions) {
    await prisma.financialTransaction.upsert({
      where: { workspaceId_idempotencyKey: { workspaceId: workspace.id, idempotencyKey: key } },
      update: {},
      create: { workspaceId: workspace.id, createdById: user.id, modality: TransactionModality.ONE_TIME, status: TransactionStatus.COMPLETED, idempotencyKey: key, ...transaction }
    });
  }

  const recurring = await prisma.recurringRule.findFirst({ where: { workspaceId: workspace.id, description: "Assinatura de streaming" } });
  if (!recurring) {
    await prisma.recurringRule.create({ data: { workspaceId: workspace.id, accountId: account.id, categoryId: category("Lazer").id, type: TransactionType.EXPENSE, frequency: RecurrenceFrequency.MONTHLY, amount: 39.9, description: "Assinatura de streaming", nextRunAt: new Date(Date.UTC(2026, 8, 15)) } });
  }

  console.log(`Dados de demonstração prontos. Entre com ${demoEmail} para visualizar o workspace "${workspace.name}".`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
