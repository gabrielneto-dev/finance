import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDatabase,
  createTestUser,
  createTestAccount,
  createTestCard,
  createTestCategory,
  testPrisma,
} from "../testing/db.js";
import { resolveAccount, resolveCard, resolveCategory } from "./resolver-service.js";

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  const user = await createTestUser();
  userId = user.id;
});

describe("resolveAccount", () => {
  it("encontra por nome exato ignorando maiúsculas e acentos", async () => {
    await createTestAccount(userId, { name: "Nubank Conta" });
    const result = await resolveAccount(userId, "NUBANK CONTA");
    expect(result?.name).toBe("Nubank Conta");
  });

  it("encontra por substring do nome", async () => {
    await createTestAccount(userId, { name: "Nubank Conta" });
    const result = await resolveAccount(userId, "nubank");
    expect(result?.name).toBe("Nubank Conta");
  });

  it("encontra por alias mesmo quando o nome não bate", async () => {
    await createTestAccount(userId, { name: "Conta Principal", aliases: ["nu", "nubank"] });
    const result = await resolveAccount(userId, "nu");
    expect(result?.name).toBe("Conta Principal");
  });

  it("retorna null quando não encontra nenhuma correspondência", async () => {
    await createTestAccount(userId, { name: "Nubank Conta" });
    const result = await resolveAccount(userId, "banco-inexistente");
    expect(result).toBeNull();
  });

  it("ignora contas arquivadas", async () => {
    await createTestAccount(userId, { name: "Conta Antiga", archived: true });
    const result = await resolveAccount(userId, "conta antiga");
    expect(result).toBeNull();
  });

  it("não retorna conta de outro usuário", async () => {
    const otherUser = await createTestUser();
    await createTestAccount(otherUser.id, { name: "Nubank Conta" });
    const result = await resolveAccount(userId, "nubank");
    expect(result).toBeNull();
  });
});

describe("resolveCard", () => {
  it("encontra cartão por alias", async () => {
    await createTestCard(userId, { name: "Nubank Crédito", aliases: ["credito", "nu"] });
    const result = await resolveCard(userId, "credito");
    expect(result?.name).toBe("Nubank Crédito");
  });

  it("ignora cartões arquivados", async () => {
    const card = await createTestCard(userId, { name: "Cartão Cancelado" });
    await testPrisma.card.update({ where: { id: card.id }, data: { archived: true } });
    const result = await resolveCard(userId, "cancelado");
    expect(result).toBeNull();
  });
});

describe("resolveCategory", () => {
  it("encontra categoria por nome respeitando o tipo", async () => {
    await createTestCategory(userId, { name: "Alimentação", type: "EXPENSE" });
    await createTestCategory(userId, { name: "Salário", type: "INCOME" });

    const expenseMatch = await resolveCategory(userId, "alimentacao", "EXPENSE");
    expect(expenseMatch?.name).toBe("Alimentação");

    const noMatch = await resolveCategory(userId, "alimentacao", "INCOME");
    expect(noMatch).toBeNull();
  });

  it("sem filtro de tipo, encontra a categoria independente do tipo", async () => {
    await createTestCategory(userId, { name: "Salário", type: "INCOME" });
    const result = await resolveCategory(userId, "salario");
    expect(result?.name).toBe("Salário");
  });
});
