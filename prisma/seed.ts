import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { phone: process.env.ALLOWED_PHONES?.split(",")[0]?.trim() ?? "5511999999999" },
    update: {},
    create: {
      name: "Gabriel",
      phone: process.env.ALLOWED_PHONES?.split(",")[0]?.trim() ?? "5511999999999",
    },
  });

  const checking = await prisma.account.upsert({
    where: { id: "seed-account-nubank" },
    update: {},
    create: {
      id: "seed-account-nubank",
      userId: user.id,
      name: "Nubank Conta",
      aliases: ["nubank", "nu"],
      type: "CHECKING",
      initialBalanceCents: 0,
    },
  });

  const wallet = await prisma.account.upsert({
    where: { id: "seed-account-carteira" },
    update: {},
    create: {
      id: "seed-account-carteira",
      userId: user.id,
      name: "Carteira",
      aliases: ["dinheiro", "carteira"],
      type: "CASH",
      initialBalanceCents: 0,
    },
  });

  await prisma.card.upsert({
    where: { id: "seed-card-nubank" },
    update: {},
    create: {
      id: "seed-card-nubank",
      userId: user.id,
      name: "Nubank Crédito",
      aliases: ["nubank", "nu", "credito"],
      accountId: checking.id,
      creditLimitCents: 500000,
      closingDay: 25,
      dueDay: 5,
    },
  });

  const categories: Array<{ name: string; aliases: string[]; type: "INCOME" | "EXPENSE" }> = [
    { name: "Alimentação", aliases: ["comida", "mercado", "ifood", "restaurante"], type: "EXPENSE" },
    { name: "Transporte", aliases: ["uber", "combustivel", "onibus"], type: "EXPENSE" },
    { name: "Lazer", aliases: ["cinema", "streaming", "jogos"], type: "EXPENSE" },
    { name: "Moradia", aliases: ["aluguel", "condominio", "luz", "agua", "internet"], type: "EXPENSE" },
    { name: "Saúde", aliases: ["farmacia", "plano", "medico"], type: "EXPENSE" },
    { name: "Salário", aliases: ["salario", "pagamento"], type: "INCOME" },
  ];

  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name: category.name },
    });
    if (!existing) {
      await prisma.category.create({ data: { userId: user.id, ...category } });
    }
  }

  console.log("Seed concluído:", { user: user.name, accounts: [checking.name, wallet.name] });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
