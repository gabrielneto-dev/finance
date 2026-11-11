// Passa os dados do dono local para o usuário Supabase (SPEC-0005, REQ-002).
// Sem --apply, só mostra as contagens. Com --apply, faz backup com VACUUM INTO antes de trocar.
// Pare o web e o worker antes de aplicar.
//   npm --prefix apps/web run migrate-owner -- --to <UID do Supabase>            (simulação)
//   npm --prefix apps/web run migrate-owner -- --to <UID do Supabase> --apply    (aplica)
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { openDatabase } from "../lib/db.mjs";
import { applyOwnerMigration, LOCAL_OWNER, planOwnerMigration } from "../lib/owner-migration.mjs";

const { values } = parseArgs({ options: {
  to: { type: "string" }, from: { type: "string", default: LOCAL_OWNER }, apply: { type: "boolean", default: false },
} });
const file = resolve(process.env.FINANCE_DB_PATH || "./data/finance.sqlite");
if (!existsSync(file)) {
  console.error("Banco não encontrado em " + file + ". Confira FINANCE_DB_PATH.");
  process.exit(1);
}

const db = openDatabase(file);
const plan = planOwnerMigration(db, { from: values.from, to: values.to });
const show = (title, counts) => {
  console.log(title);
  for (const [table, count] of Object.entries(counts ?? {})) console.log("  " + table.padEnd(22) + count);
};
if (!plan.ok) {
  console.error(plan.error);
  if (plan.target) show("Linhas já no destino:", plan.target);
  process.exit(1);
}
show("Linhas que mudam de dono:", plan.source);
if (!values.apply) {
  console.log("Simulação: nada foi alterado. Repita com --apply para aplicar.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = join(dirname(file), "backup-owner-" + stamp + ".sqlite");
db.prepare("VACUUM INTO ?").run(backup);
console.log("Backup criado em " + backup);
const result = applyOwnerMigration(db, { from: values.from, to: values.to });
if (!result.ok) {
  console.error("Migração desfeita: " + result.error + " O banco ficou como antes.");
  process.exit(1);
}
show("Migração concluída. Linhas do novo dono:", result.moved);
