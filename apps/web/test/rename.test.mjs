import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { dashboard, normalizeLabel, openDatabase, renameConnection, saveConnectionDetails } from "../lib/db.mjs";

test("normaliza o nome da conexão e recusa valores inválidos", () => {
  assert.equal(normalizeLabel("  Cartão   Santander "), "Cartão Santander");
  assert.equal(normalizeLabel("   "), null);
  assert.equal(normalizeLabel(""), null);
  assert.equal(normalizeLabel("a".repeat(40)), "a".repeat(40));
  assert.equal(normalizeLabel("a".repeat(41)), undefined);
  assert.equal(normalizeLabel("Nome\u0007"), undefined);
  assert.equal(normalizeLabel(42), undefined);
});

test("migra a coluna, renomeia com escopo do proprietário e preserva o nome após sincronizar", () => {
  const dir = mkdtempSync(join(tmpdir(), "finance-rename-"));
  const path = join(dir, "finance.sqlite");
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(`CREATE TABLE connections (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
      synced_at TEXT, baseline TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, details TEXT)`);
    legacy.prepare("INSERT INTO connections (id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
      .run("item-1", "owner-a", "MeuPluggy", "CONECTADA", "2026-11-01T00:00:00Z");
    legacy.prepare("INSERT INTO connections (id,owner,name,status,baseline,active) VALUES(?,?,?,?,?,0)")
      .run("item-2", "owner-a", "MeuPluggy", "REMOVENDO", "2026-11-01T00:00:00Z");
    legacy.close();

    const db = openDatabase(path);
    const names = () => dashboard(db, "owner-a", "2026-11-01", "2026-11-10").connections
      .map(({ id, name, label }) => ({ id, name, label }));
    assert.deepEqual(names().find((row) => row.id === "item-1"), { id: "item-1", name: "MeuPluggy", label: null });

    assert.equal(renameConnection(db, "owner-b", "item-1", "Alheio"), false);
    assert.equal(renameConnection(db, "owner-a", "item-2", "Inativa"), false);
    assert.equal(renameConnection(db, "owner-a", "item-1", "Santander"), true);
    saveConnectionDetails(db, { id: "item-1", connector: { name: "MeuPluggy" } });
    assert.deepEqual(names().find((row) => row.id === "item-1"), { id: "item-1", name: "MeuPluggy", label: "Santander" });

    assert.equal(renameConnection(db, "owner-a", "item-1", null), true);
    assert.equal(names().find((row) => row.id === "item-1").label, null);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
