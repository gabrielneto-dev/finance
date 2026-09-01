import { PrismaClient } from "@prisma/client";

export function integrationDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!url.protocol.startsWith("postgres")) throw new Error("DATABASE_URL deve apontar para PostgreSQL.");
  url.searchParams.set("schema", "integration_test");
  return url.toString();
}

export function integrationPrisma() {
  return new PrismaClient({ datasources: { db: { url: integrationDatabaseUrl() } } });
}
