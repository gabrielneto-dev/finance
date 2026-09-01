import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { integrationDatabaseUrl } from "../src/testing/integration-db";

async function main() {
  const url = integrationDatabaseUrl();
  const client = new PrismaClient({ datasources: { db: { url } } });
  await client.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS "integration_test"');
  await client.$disconnect();
  const prismaCli = path.resolve("node_modules/prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "db", "push", "--skip-generate"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  execFileSync(process.execPath, [prismaCli, "db", "execute", "--url", url, "--file", "prisma/migrations/0001_init/migration.sql"], { stdio: "inherit", env: process.env });
}

void main();
