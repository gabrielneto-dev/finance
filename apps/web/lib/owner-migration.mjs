// Troca do dono dos dados ao passar da chave local para o Supabase (SPEC-0005, REQ-002).
// As tabelas com coluna `owner` são descobertas no próprio banco, para incluir as criadas depois.

export const LOCAL_OWNER = "local-owner";
const SUPABASE_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** Tabelas que têm a coluna `owner`, em ordem alfabética. */
export function ownerTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(({ name }) => name)
    .filter((name) => db.prepare(`PRAGMA table_info("${name}")`).all().some((column) => column.name === "owner"));
}

/** Quantas linhas de cada dono existem por tabela. Só contagens, sem conteúdo. */
export function ownerCounts(db, owner) {
  return Object.fromEntries(ownerTables(db).map((table) =>
    [table, db.prepare(`SELECT COUNT(*) AS total FROM "${table}" WHERE owner=?`).get(owner).total]));
}

const total = (counts) => Object.values(counts).reduce((sum, value) => sum + value, 0);

/**
 * Confere a migração sem alterar nada. Recusa destino inválido, igual à origem ou que já tenha dados,
 * para não misturar dois conjuntos nem violar chaves que incluem o dono.
 */
export function planOwnerMigration(db, { from = LOCAL_OWNER, to }) {
  if (typeof to !== "string" || !SUPABASE_ID.test(to)) return { ok: false, error: "Informe o id do usuário Supabase (UUID)." };
  if (typeof from !== "string" || !from || from === to) return { ok: false, error: "A origem precisa ser diferente do destino." };
  const source = ownerCounts(db, from);
  const target = ownerCounts(db, to);
  if (total(target) > 0) return { ok: false, error: "O destino já tem dados. Nada foi alterado.", source, target };
  if (total(source) === 0) return { ok: false, error: "A origem não tem dados para migrar.", source, target };
  return { ok: true, from, to, source };
}

/** Aplica a migração numa transação e confere as contagens antes de confirmar. */
export function applyOwnerMigration(db, options) {
  const plan = planOwnerMigration(db, options);
  if (!plan.ok) return plan;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of Object.keys(plan.source)) {
      db.prepare(`UPDATE "${table}" SET owner=? WHERE owner=?`).run(plan.to, plan.from);
    }
    const moved = ownerCounts(db, plan.to);
    const left = total(ownerCounts(db, plan.from));
    const same = Object.entries(plan.source).every(([table, count]) => moved[table] === count);
    if (!same || left !== 0) throw new Error("As contagens não conferem depois da troca.");
    db.exec("COMMIT");
    return { ok: true, from: plan.from, to: plan.to, moved };
  } catch (error) {
    db.exec("ROLLBACK");
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
