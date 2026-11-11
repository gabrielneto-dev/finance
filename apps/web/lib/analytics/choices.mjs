// Escolhas de categoria do proprietário (SPEC-0003, REQ-004).
// Valem para um lançamento ou para todos do mesmo estabelecimento. Ficam em tabelas próprias,
// fora de entries, para que a reimportação da Pluggy não as apague.
import { isChoice } from "./categories.mjs";
import { merchantKey } from "./merchant.mjs";

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} owner
 * @returns {{ entries: Map<string, string>; rules: Map<string, string> }}
 */
export function loadChoices(db, owner) {
  const entries = new Map(db.prepare("SELECT item_id,account_id,entry_id,category FROM category_overrides WHERE owner=?")
    .all(owner).map((row) => [row.item_id + "/" + row.account_id + "/" + row.entry_id, String(row.category)]));
  const rules = new Map(db.prepare("SELECT merchant_key,category FROM category_rules WHERE owner=?")
    .all(owner).map((row) => [String(row.merchant_key), String(row.category)]));
  return { entries, rules };
}

/** Lançamento do proprietário, numa conexão ativa. */
function ownedEntry(db, owner, itemId, accountId, entryId) {
  const row = db.prepare(`SELECT t.data FROM entries t JOIN connections c ON c.id=t.item_id
    WHERE c.owner=? AND c.active=1 AND t.item_id=? AND t.account_id=? AND t.id=?`).get(owner, itemId, accountId, entryId);
  return row ? JSON.parse(String(row.data)) : null;
}

/**
 * Valida o pedido vindo da API. Vazio remove a escolha.
 * @returns {{ itemId: string; accountId: string; entryId: string; category: string | null } | null}
 */
export function parseChoice(body) {
  if (!body || typeof body !== "object") return null;
  const { itemId, accountId, entryId, category } = body;
  const id = (/** @type {unknown} */ value) => typeof value === "string" && value.length > 0 && value.length <= 100;
  if (!id(itemId) || !id(accountId) || !id(entryId)) return null;
  if (category === "" || category === null) return { itemId, accountId, entryId, category: null };
  return isChoice(category) ? { itemId, accountId, entryId, category } : null;
}

/**
 * Define a categoria de um lançamento. Devolve false quando o lançamento não é do proprietário.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} owner
 * @param {NonNullable<ReturnType<typeof parseChoice>>} choice
 */
export function setEntryChoice(db, owner, { itemId, accountId, entryId, category }) {
  if (!ownedEntry(db, owner, itemId, accountId, entryId)) return false;
  if (category === null) {
    db.prepare("DELETE FROM category_overrides WHERE owner=? AND item_id=? AND account_id=? AND entry_id=?")
      .run(owner, itemId, accountId, entryId);
  } else {
    db.prepare(`INSERT INTO category_overrides VALUES(?,?,?,?,?,?)
      ON CONFLICT(owner,item_id,account_id,entry_id) DO UPDATE SET category=excluded.category, updated_at=excluded.updated_at`)
      .run(owner, itemId, accountId, entryId, category, new Date().toISOString());
  }
  return true;
}

/**
 * Define a categoria de todos os lançamentos do mesmo estabelecimento do lançamento indicado.
 * A chave vem da descrição gravada, nunca do pedido. A escolha própria desse lançamento é
 * removida, para que a regra nova apareça nele.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} owner
 * @param {NonNullable<ReturnType<typeof parseChoice>>} choice
 * @returns {string | null} a chave do estabelecimento, ou null se o lançamento não é do proprietário
 */
export function setRuleChoice(db, owner, { itemId, accountId, entryId, category }) {
  const entry = ownedEntry(db, owner, itemId, accountId, entryId);
  if (!entry) return null;
  const key = merchantKey(entry.description);
  db.prepare("DELETE FROM category_overrides WHERE owner=? AND item_id=? AND account_id=? AND entry_id=?")
    .run(owner, itemId, accountId, entryId);
  if (category === null) db.prepare("DELETE FROM category_rules WHERE owner=? AND merchant_key=?").run(owner, key);
  else db.prepare(`INSERT INTO category_rules VALUES(?,?,?,?)
    ON CONFLICT(owner,merchant_key) DO UPDATE SET category=excluded.category, updated_at=excluded.updated_at`)
    .run(owner, key, category, new Date().toISOString());
  return key;
}
