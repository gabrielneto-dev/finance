import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../lib/db.mjs";
import { applyOwnerMigration, LOCAL_OWNER, ownerCounts, ownerTables, planOwnerMigration } from "../lib/owner-migration.mjs";

// Dados sintéticos: ids e valores inventados (SPEC-0005, REQ-002).
const TARGET = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-8888-4777-8666-555555555555";

function seed(db, owner, item) {
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline,active) VALUES(?,?,?,?,?,1)").run(item, owner, "Banco Teste", "CONECTADA", "2026-11-01T00:00:00Z");
  db.prepare("INSERT INTO intents VALUES(?,?,?)").run("intent-" + item, owner, Date.now() + 60_000);
  db.prepare("INSERT INTO category_rules(owner,merchant_key,category,updated_at) VALUES(?,?,?,?)").run(owner, "mercado-" + item, "Mercado", "2026-11-01");
  db.prepare("INSERT INTO plan_income(owner,month,expected) VALUES(?,?,?)").run(owner, "2026-11", 100000);
}

function fresh() {
  const db = openDatabase(":memory:");
  seed(db, LOCAL_OWNER, "aaaaaaaa-0000-4000-8000-000000000001");
  seed(db, OTHER, "aaaaaaaa-0000-4000-8000-000000000002");
  return db;
}

test("descobre todas as tabelas com dono, inclusive as do Planejamento", () => {
  const tables = ownerTables(openDatabase(":memory:"));
  for (const table of ["connections", "intents", "category_overrides", "category_rules", "account_settings", "plan_buckets", "plan_income", "investments"]) {
    assert.ok(tables.includes(table), table);
  }
  assert.ok(!tables.includes("entries"));
  assert.ok(!tables.includes("local_sessions"));
});

test("simulação não altera nada e recusa destino inválido, igual ou já com dados", () => {
  const db = fresh();
  const before = ownerCounts(db, LOCAL_OWNER);
  const plan = planOwnerMigration(db, { to: TARGET });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.source, before);
  assert.deepEqual(ownerCounts(db, LOCAL_OWNER), before);
  assert.equal(planOwnerMigration(db, { to: "nao-e-uuid" }).ok, false);
  assert.equal(planOwnerMigration(db, { from: TARGET, to: TARGET }).ok, false);
  assert.equal(planOwnerMigration(db, { to: OTHER }).ok, false, "destino com dados");
  assert.equal(planOwnerMigration(db, { from: "ninguem", to: TARGET }).ok, false, "origem vazia");
});

test("aplica a troca só nas linhas do dono local e preserva as de outro dono", () => {
  const db = fresh();
  const local = ownerCounts(db, LOCAL_OWNER);
  const other = ownerCounts(db, OTHER);
  const result = applyOwnerMigration(db, { to: TARGET });
  assert.equal(result.ok, true);
  assert.deepEqual(result.moved, local);
  assert.equal(Object.values(ownerCounts(db, LOCAL_OWNER)).reduce((a, b) => a + b, 0), 0);
  assert.deepEqual(ownerCounts(db, OTHER), other);
  assert.equal(db.prepare("SELECT owner FROM connections WHERE id=?").get("aaaaaaaa-0000-4000-8000-000000000001").owner, TARGET);
});

test("o script simula por padrão e, com --apply, faz backup antes de migrar", () => {
  const dir = mkdtempSync(join(tmpdir(), "finance-owner-"));
  try {
    const file = join(dir, "finance.sqlite");
    const db = openDatabase(file);
    seed(db, LOCAL_OWNER, "aaaaaaaa-0000-4000-8000-000000000003");
    db.close();
    const run = (...args) => execFileSync(process.execPath, ["scripts/migrate-owner.mjs", "--to", TARGET, ...args],
      { env: { ...process.env, FINANCE_DB_PATH: file }, encoding: "utf8" });

    // No Windows, cada banco aberto precisa ser fechado para a pasta temporária sair.
    const count = (path, owner) => { const copy = openDatabase(path); try { return ownerCounts(copy, owner).connections; } finally { copy.close(); } };
    assert.match(run(), /Simulação/);
    assert.equal(count(file, TARGET), 0);

    assert.match(run("--apply"), /Migração concluída/);
    const backups = readdirSync(dir).filter((name) => name.startsWith("backup-owner-"));
    assert.equal(backups.length, 1);
    assert.equal(count(join(dir, backups[0]), LOCAL_OWNER), 1, "backup guarda o estado anterior");
    assert.equal(count(file, TARGET), 1);
    assert.throws(() => run("--apply"), "segunda execução recusa: destino já tem dados");
    assert.ok(existsSync(file));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
