// Leitura e escrita das tabelas do Planejamento (SPEC-0004, REQ-010).
// Toda escrita filtra pelo dono. Um id de outro dono responde como inexistente.
import { randomUUID } from "node:crypto";
import { atomic } from "../db.mjs";
import { LIMITS } from "./validate.mjs";

/** @typedef {import("node:sqlite").DatabaseSync} Db */

const now = () => new Date().toISOString();
const bool = (/** @type {unknown} */ value) => value === 1 || value === 1n;

/** Erro de regra, como limite ou grupo em outra caixinha, com mensagem para o usuário. */
export class PlanError extends Error {
  /** @param {string} message @param {number} [status] */
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const count = (/** @type {Db} */ db, /** @type {string} */ table, /** @type {string} */ owner) =>
  Number(/** @type {any} */ (db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE owner=?`).get(owner)).total);

/**
 * Tudo o que o proprietário planejou.
 * @param {Db} db @param {string} owner
 */
export function loadPlan(db, owner) {
  const groups = new Map();
  for (const row of db.prepare("SELECT bucket_id,group_key FROM plan_bucket_groups WHERE owner=? ORDER BY group_key").all(owner)) {
    groups.set(row.bucket_id, [...(groups.get(row.bucket_id) ?? []), String(row.group_key)]);
  }
  const months = new Map();
  for (const row of db.prepare("SELECT bucket_id,month,amount FROM plan_month_amounts WHERE owner=?").all(owner)) {
    months.set(row.bucket_id, { ...(months.get(row.bucket_id) ?? {}), [String(row.month)]: Number(row.amount) });
  }
  const buckets = db.prepare("SELECT * FROM plan_buckets WHERE owner=? ORDER BY sort,created_at,id").all(owner).map((row) => ({
    id: String(row.id), name: String(row.name), kind: String(row.kind), mode: String(row.mode), amount: Number(row.amount),
    rollover: bool(row.rollover), sort: Number(row.sort), archived: bool(row.archived),
    groups: groups.get(row.id) ?? [], months: months.get(row.id) ?? {},
    // O acúmulo conta a partir do mês de criação.
    start: String(row.created_at).slice(0, 7),
  }));
  const income = Object.fromEntries(db.prepare("SELECT month,expected FROM plan_income WHERE owner=?").all(owner)
    .map((row) => [String(row.month), Number(row.expected)]));
  const goals = db.prepare("SELECT * FROM plan_goals WHERE owner=? ORDER BY priority,created_at,id").all(owner).map((row) => ({
    id: String(row.id), name: String(row.name), kind: String(row.kind), target: row.target === null ? null : Number(row.target),
    months: row.months === null ? null : Number(row.months), deadline: row.deadline === null ? null : String(row.deadline),
    monthly: Number(row.monthly), yieldRate: Number(row.yield_rate), source: String(row.source), current: Number(row.current),
    link: row.link === null ? null : JSON.parse(String(row.link)), priority: Number(row.priority),
  }));
  const adjustments = db.prepare("SELECT * FROM plan_adjustments WHERE owner=? ORDER BY created_at,id").all(owner).map((row) => ({
    id: String(row.id), kind: String(row.kind), label: String(row.label), startMonth: String(row.start_month),
    endMonth: row.end_month === null ? null : String(row.end_month), amount: row.amount === null ? null : Number(row.amount),
    percent: row.percent === null ? null : Number(row.percent), group: row.group_key === null ? null : String(row.group_key),
    enabled: bool(row.enabled),
  }));
  const snapshots = new Map();
  for (const row of db.prepare(`SELECT s.investment_id,s.date,s.balance FROM investment_snapshots s
    JOIN investments i ON i.id=s.investment_id WHERE i.owner=? ORDER BY s.date`).all(owner)) {
    snapshots.set(row.investment_id, [...(snapshots.get(row.investment_id) ?? []), { date: String(row.date), balance: Number(row.balance) }]);
  }
  // Investimentos da Pluggy só aparecem enquanto a conexão estiver ativa.
  const investments = db.prepare(`SELECT i.* FROM investments i LEFT JOIN connections c ON c.id=i.item_id
    WHERE i.owner=? AND (i.item_id IS NULL OR (c.owner=i.owner AND c.active=1)) ORDER BY i.name,i.id`).all(owner).map((row) => ({
    id: String(row.id), source: String(row.source), name: String(row.name), institution: row.institution === null ? null : String(row.institution),
    class: String(row.class), liquidity: String(row.liquidity), balance: Number(row.balance),
    dueDate: row.due_date === null ? null : String(row.due_date), updatedAt: String(row.updated_at),
    snapshots: snapshots.get(row.id) ?? [],
  }));
  return { buckets, income, goals, adjustments, investments };
}

const ownsBucket = (/** @type {Db} */ db, owner, id) => Boolean(db.prepare("SELECT 1 FROM plan_buckets WHERE id=? AND owner=?").get(id, owner));

/**
 * Cria ou altera uma caixinha. Um grupo pertence a uma só caixinha.
 * @param {Db} db @param {string} owner @param {ReturnType<typeof import("./validate.mjs").parseBucket>["value"]} bucket
 * @returns {string | null} o id, ou null se a caixinha não é do dono
 */
export const saveBucket = (db, owner, bucket) => atomic(db, () => writeBucket(db, owner, bucket));

/** saveBucket sem transação própria, para compor com outras escritas. @param {Db} db @param {string} owner @param {any} bucket */
export function writeBucket(db, owner, bucket) {
  {
    let id = bucket.id;
    if (id) {
      if (!ownsBucket(db, owner, id)) return null;
      db.prepare(`UPDATE plan_buckets SET name=?,kind=?,mode=?,amount=?,rollover=?,archived=?,sort=COALESCE(?,sort)
        WHERE id=? AND owner=?`).run(bucket.name, bucket.kind, bucket.mode, bucket.amount, bucket.rollover ? 1 : 0,
        bucket.archived ? 1 : 0, bucket.sort, id, owner);
    } else {
      if (count(db, "plan_buckets", owner) >= LIMITS.buckets) throw new PlanError("Limite de " + LIMITS.buckets + " caixinhas atingido.");
      id = randomUUID();
      const sort = bucket.sort ?? Number(/** @type {any} */ (db.prepare("SELECT COALESCE(MAX(sort)+1,0) AS next FROM plan_buckets WHERE owner=?").get(owner)).next);
      db.prepare("INSERT INTO plan_buckets VALUES(?,?,?,?,?,?,?,?,?,?)").run(id, owner, bucket.name, bucket.kind, bucket.mode,
        bucket.amount, bucket.rollover ? 1 : 0, sort, bucket.archived ? 1 : 0, now());
    }
    const taken = bucket.groups.length ? db.prepare(`SELECT g.group_key,b.name FROM plan_bucket_groups g JOIN plan_buckets b ON b.id=g.bucket_id
      WHERE g.owner=? AND g.bucket_id<>? AND g.group_key IN (${bucket.groups.map(() => "?").join(",")})`).get(owner, id, ...bucket.groups) : null;
    if (taken) throw new PlanError("Esse grupo já está na caixinha " + taken.name + ".", 409);
    db.prepare("DELETE FROM plan_bucket_groups WHERE owner=? AND bucket_id=?").run(owner, id);
    const link = db.prepare("INSERT INTO plan_bucket_groups VALUES(?,?,?)");
    for (const key of bucket.groups) link.run(owner, id, key);
    return id;
  }
}

/** @param {Db} db @param {string} owner @param {string[]} ids */
export function orderBuckets(db, owner, ids) {
  return atomic(db, () => {
    if (!ids.every((id) => ownsBucket(db, owner, id))) return false;
    const update = db.prepare("UPDATE plan_buckets SET sort=? WHERE id=? AND owner=?");
    ids.forEach((id, index) => update.run(index, id, owner));
    return true;
  });
}

/** @param {Db} db @param {string} owner @param {string} id */
export const deleteBucket = (db, owner, id) => db.prepare("DELETE FROM plan_buckets WHERE id=? AND owner=?").run(id, owner).changes === 1;

/** Ajuste do valor de uma caixinha num mês. Nulo volta ao padrão. @param {Db} db @param {string} owner */
export function setBucketMonth(db, owner, { id, month, amount }) {
  if (!ownsBucket(db, owner, id)) return false;
  if (amount === null) db.prepare("DELETE FROM plan_month_amounts WHERE owner=? AND bucket_id=? AND month=?").run(owner, id, month);
  else db.prepare(`INSERT INTO plan_month_amounts VALUES(?,?,?,?) ON CONFLICT(bucket_id,month) DO UPDATE SET amount=excluded.amount`)
    .run(owner, id, month, amount);
  return true;
}

/** Renda prevista do mês. Nula volta à estimativa automática. @param {Db} db @param {string} owner */
export function setIncome(db, owner, { month, expected }) {
  if (expected === null) db.prepare("DELETE FROM plan_income WHERE owner=? AND month=?").run(owner, month);
  else db.prepare("INSERT INTO plan_income VALUES(?,?,?) ON CONFLICT(owner,month) DO UPDATE SET expected=excluded.expected").run(owner, month, expected);
  return true;
}

/** Conta ativa do dono. @param {Db} db @param {string} owner @param {string} key itemId/accountId */
export function ownsAccount(db, owner, key) {
  const [itemId, accountId] = key.split("/");
  return Boolean(db.prepare(`SELECT 1 FROM accounts a JOIN connections c ON c.id=a.item_id
    WHERE c.owner=? AND c.active=1 AND a.item_id=? AND a.id=?`).get(owner, itemId, accountId));
}

const ownsInvestments = (/** @type {Db} */ db, owner, /** @type {string[]} */ ids) =>
  ids.every((id) => db.prepare("SELECT 1 FROM investments WHERE id=? AND owner=?").get(id, owner));

/**
 * @param {Db} db @param {string} owner @param {ReturnType<typeof import("./validate.mjs").parseGoal>["value"]} goal
 * @returns {string | null}
 */
export function saveGoal(db, owner, goal) {
  if (goal.source === "investimentos" && !ownsInvestments(db, owner, goal.link)) return null;
  if (goal.source === "conta" && !ownsAccount(db, owner, goal.link)) return null;
  return atomic(db, () => {
    const link = goal.link === null ? null : JSON.stringify(goal.link);
    if (goal.id) {
      const changed = db.prepare(`UPDATE plan_goals SET name=?,kind=?,target=?,months=?,deadline=?,monthly=?,yield_rate=?,source=?,
        current=?,link=?,priority=? WHERE id=? AND owner=?`).run(goal.name, goal.kind, goal.target, goal.months, goal.deadline,
        goal.monthly, goal.yieldRate, goal.source, goal.current, link, goal.priority, goal.id, owner).changes;
      return changed === 1 ? goal.id : null;
    }
    if (count(db, "plan_goals", owner) >= LIMITS.goals) throw new PlanError("Limite de " + LIMITS.goals + " metas atingido.");
    // Uma só reserva de emergência e uma só independência financeira.
    if (goal.kind !== "objetivo" && db.prepare("SELECT 1 FROM plan_goals WHERE owner=? AND kind=?").get(owner, goal.kind)) {
      throw new PlanError(goal.kind === "reserva" ? "Já existe uma reserva de emergência." : "Já existe uma meta de independência.", 409);
    }
    const id = randomUUID();
    db.prepare("INSERT INTO plan_goals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id, owner, goal.name, goal.kind, goal.target,
      goal.months, goal.deadline, goal.monthly, goal.yieldRate, goal.source, goal.current, link, goal.priority, now());
    return id;
  });
}

/** @param {Db} db @param {string} owner @param {string} id */
export const deleteGoal = (db, owner, id) => db.prepare("DELETE FROM plan_goals WHERE id=? AND owner=?").run(id, owner).changes === 1;

/**
 * @param {Db} db @param {string} owner @param {ReturnType<typeof import("./validate.mjs").parseAdjustment>["value"]} item
 * @returns {string | null}
 */
export function saveAdjustment(db, owner, item) {
  return atomic(db, () => {
    if (item.id) {
      const changed = db.prepare(`UPDATE plan_adjustments SET kind=?,label=?,start_month=?,end_month=?,amount=?,percent=?,group_key=?,enabled=?
        WHERE id=? AND owner=?`).run(item.kind, item.label, item.startMonth, item.endMonth, item.amount, item.percent, item.group,
        item.enabled ? 1 : 0, item.id, owner).changes;
      return changed === 1 ? item.id : null;
    }
    if (count(db, "plan_adjustments", owner) >= LIMITS.adjustments) throw new PlanError("Limite de " + LIMITS.adjustments + " ajustes atingido.");
    const id = randomUUID();
    db.prepare("INSERT INTO plan_adjustments VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id, owner, item.kind, item.label, item.startMonth,
      item.endMonth, item.amount, item.percent, item.group, item.enabled ? 1 : 0, now());
    return id;
  });
}

/** @param {Db} db @param {string} owner */
export const toggleAdjustment = (db, owner, { id, enabled }) =>
  db.prepare("UPDATE plan_adjustments SET enabled=? WHERE id=? AND owner=?").run(enabled ? 1 : 0, id, owner).changes === 1;

/** @param {Db} db @param {string} owner @param {string} id */
export const deleteAdjustment = (db, owner, id) => db.prepare("DELETE FROM plan_adjustments WHERE id=? AND owner=?").run(id, owner).changes === 1;

/**
 * Investimento manual. O da Pluggy não é editado aqui.
 * @param {Db} db @param {string} owner @param {ReturnType<typeof import("./validate.mjs").parseInvestment>["value"]} item
 * @param {string} today
 * @returns {string | null}
 */
export function saveInvestment(db, owner, item, today) {
  return atomic(db, () => {
    if (item.id) {
      const changed = db.prepare(`UPDATE investments SET name=?,institution=?,class=?,liquidity=?,due_date=?
        WHERE id=? AND owner=? AND source='manual'`).run(item.name, item.institution, item.class, item.liquidity, item.dueDate, item.id, owner).changes;
      return changed === 1 ? item.id : null;
    }
    if (count(db, "investments", owner) >= LIMITS.investments) throw new PlanError("Limite de " + LIMITS.investments + " investimentos atingido.");
    const id = randomUUID();
    db.prepare(`INSERT INTO investments (id,owner,source,external_id,item_id,name,institution,class,liquidity,balance,due_date,updated_at)
      VALUES(?,?,'manual',NULL,NULL,?,?,?,?,?,?,?)`).run(id, owner, item.name, item.institution, item.class, item.liquidity,
      item.balance, item.dueDate, now());
    db.prepare("INSERT INTO investment_snapshots VALUES(?,?,?)").run(id, today, item.balance);
    return id;
  });
}

/** Novo saldo de um investimento manual, guardado no histórico do dia. @param {Db} db @param {string} owner */
export function setInvestmentBalance(db, owner, { id, balance, date }, /** @type {string} */ today) {
  return atomic(db, () => {
    const changed = db.prepare("UPDATE investments SET balance=?,updated_at=? WHERE id=? AND owner=? AND source='manual'")
      .run(balance, now(), id, owner).changes;
    if (changed !== 1) return false;
    db.prepare("INSERT INTO investment_snapshots VALUES(?,?,?) ON CONFLICT(investment_id,date) DO UPDATE SET balance=excluded.balance")
      .run(id, date ?? today, balance);
    return true;
  });
}

/** @param {Db} db @param {string} owner @param {string} id */
export const deleteInvestment = (db, owner, id) =>
  db.prepare("DELETE FROM investments WHERE id=? AND owner=? AND source='manual'").run(id, owner).changes === 1;

/** Marca ou desmarca a conta do negócio. @param {Db} db @param {string} owner */
export function setAccountBusiness(db, owner, { itemId, accountId, business }) {
  if (!ownsAccount(db, owner, itemId + "/" + accountId)) return false;
  db.prepare(`INSERT INTO account_settings VALUES(?,?,?,?,?) ON CONFLICT(owner,item_id,account_id)
    DO UPDATE SET business=excluded.business, updated_at=excluded.updated_at`).run(owner, itemId, accountId, business ? 1 : 0, now());
  return true;
}

/**
 * Investimentos importados da Pluggy para um Item (SPEC-0004, REQ-009). Atualiza pelo id externo,
 * grava um snapshot por sincronização e remove os que sumiram do Item.
 * @param {Db} db @param {string} itemId
 * @param {{ externalId: string; name: string; institution: string | null; class: string; liquidity: string; balance: number; dueDate: string | null }[]} rows
 * @param {string} today
 */
export function writeInvestments(db, itemId, rows, today) {
  const owner = /** @type {any} */ (db.prepare("SELECT owner FROM connections WHERE id=? AND active=1").get(itemId))?.owner;
  if (!owner) return;
  const upsert = db.prepare(`INSERT INTO investments (id,owner,source,external_id,item_id,name,institution,class,liquidity,balance,due_date,updated_at)
    VALUES(?,?,'pluggy',?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,source,external_id) DO UPDATE SET item_id=excluded.item_id,name=excluded.name,
    institution=excluded.institution,class=excluded.class,liquidity=excluded.liquidity,balance=excluded.balance,due_date=excluded.due_date,
    updated_at=excluded.updated_at`);
  const idOf = db.prepare("SELECT id FROM investments WHERE owner=? AND source='pluggy' AND external_id=?");
  const snapshot = db.prepare("INSERT INTO investment_snapshots VALUES(?,?,?) ON CONFLICT(investment_id,date) DO UPDATE SET balance=excluded.balance");
  const stamp = now();
  for (const row of rows) {
    upsert.run(randomUUID(), owner, row.externalId, itemId, row.name, row.institution, row.class, row.liquidity, row.balance, row.dueDate, stamp);
    snapshot.run(String(/** @type {any} */ (idOf.get(owner, row.externalId)).id), today, row.balance);
  }
  const keep = rows.map((row) => row.externalId);
  db.prepare(`DELETE FROM investments WHERE owner=? AND source='pluggy' AND item_id=?
    ${keep.length ? "AND external_id NOT IN (" + keep.map(() => "?").join(",") + ")" : ""}`).run(owner, itemId, ...keep);
}
