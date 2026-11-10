import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { installmentSchedule } from "./installments.mjs";
import { cardCycle } from "./card-cycle.mjs";
import { openBill } from "./open-bill.mjs";

export function openDatabase(filename) {
  if (filename !== ":memory:") mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS local_sessions (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
      synced_at TEXT, baseline TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, details TEXT
    );
    CREATE INDEX IF NOT EXISTS owner_connections ON connections(owner, active);
    CREATE TABLE IF NOT EXISTS accounts (
      item_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(item_id,id)
    );
    CREATE TABLE IF NOT EXISTS entries (
      item_id TEXT NOT NULL, account_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY(item_id,account_id,id),
      FOREIGN KEY(item_id,account_id) REFERENCES accounts(item_id,id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS entries_date ON entries(item_id,date);
    CREATE TABLE IF NOT EXISTS bills (
      item_id TEXT NOT NULL, account_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY(item_id,account_id,id),
      FOREIGN KEY(item_id,account_id) REFERENCES accounts(item_id,id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL, entry_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL,
      read_at TEXT, UNIQUE(item_id,account_id,entry_id)
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, item_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL,
      due INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, lease TEXT, until INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0, received_at TEXT
    );
    CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(done,due,until);
  `);
  const hasReceivedAt = () => db.prepare("PRAGMA table_info(jobs)").all().some(({ name }) => name === "received_at");
  if (!hasReceivedAt()) atomic(db, () => {
    if (!hasReceivedAt()) db.exec("ALTER TABLE jobs ADD COLUMN received_at TEXT");
  });
  const hasDetails = () => db.prepare("PRAGMA table_info(connections)").all().some(({ name }) => name === "details");
  if (!hasDetails()) atomic(db, () => {
    if (!hasDetails()) db.exec("ALTER TABLE connections ADD COLUMN details TEXT");
  });
  const hasLabel = () => db.prepare("PRAGMA table_info(connections)").all().some(({ name }) => name === "label");
  if (!hasLabel()) atomic(db, () => {
    if (!hasLabel()) db.exec("ALTER TABLE connections ADD COLUMN label TEXT");
  });
  db.exec("CREATE INDEX IF NOT EXISTS jobs_webhooks ON jobs(item_id, received_at DESC) WHERE received_at IS NOT NULL");
  return db;
}

let instance;
export function database() {
  return instance ??= openDatabase(process.env.FINANCE_DB_PATH || "./data/finance.sqlite");
}

export function atomic(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function connection(db, id) {
  return db.prepare("SELECT * FROM connections WHERE id=?").get(id);
}

/** @param {{id?: string, itemId: string, kind: string, data?: object, delay?: number, receivedAt?: string}} job */
export function enqueue(db, job) {
  const { id, itemId, kind, data = {}, delay = 0, receivedAt = null } = job;
  return db.prepare("INSERT OR IGNORE INTO jobs(id,item_id,kind,data,due,received_at) VALUES(?,?,?,?,?,?)")
    .run(id ?? randomUUID(), itemId, kind, JSON.stringify(data), Date.now() + delay, receivedAt).changes > 0;
}

export function claim(db) {
  const now = Date.now();
  return atomic(db, () => {
    const job = db.prepare(`
      SELECT j.* FROM jobs j WHERE j.done=0 AND j.due<=? AND j.until<=?
      AND NOT EXISTS (SELECT 1 FROM jobs held WHERE held.item_id=j.item_id AND held.done=0 AND held.until>?)
      ORDER BY j.due,j.rowid LIMIT 1
    `).get(now, now, now);
    if (!job) return null;
    job.lease = randomUUID();
    db.prepare("UPDATE jobs SET lease=?, until=?, tries=tries+1 WHERE id=?")
      .run(job.lease, now + 15 * 60_000, job.id);
    return { ...job, data: JSON.parse(job.data), tries: job.tries + 1 };
  });
}

export function complete(db, job, fn = () => {}, outcome = 1) {
  return atomic(db, () => {
    if (!db.prepare("SELECT 1 FROM jobs WHERE id=? AND lease=? AND done=0").get(job.id, job.lease)) return false;
    fn();
    db.prepare("UPDATE jobs SET done=?, until=0, data='{}' WHERE id=?").run(outcome, job.id);
    return true;
  });
}

export function retry(db, job) {
  db.prepare("UPDATE jobs SET until=0, due=? WHERE id=? AND lease=? AND done=0")
    .run(Date.now() + Math.min(60 * 60_000, 5000 * 2 ** Math.min(job.tries, 10)), job.id, job.lease);
}

export function bind(db, item, owner, intent) {
  if (item.clientUserId !== intent) return false;
  const request = db.prepare("SELECT owner,expires FROM intents WHERE id=?").get(intent);
  if (request?.owner !== owner || request.expires < Date.now()) return false;
  const linked = connection(db, item.id);
  if (linked) return linked.owner === owner && linked.active === 1;
  return createConnection(db, item, owner);
}

export function bindExisting(db, item, owner, allowedId) {
  if (!allowedId || item?.id !== allowedId) return false;
  const linked = connection(db, item.id);
  if (linked) return linked.owner === owner && linked.active === 1;
  return createConnection(db, item, owner);
}

function createConnection(db, item, owner) {
  db.prepare("INSERT INTO connections (id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(item.id, owner, String(item.connector?.name || "Instituição").slice(0, 120), "IMPORTANDO", new Date().toISOString());
  saveConnectionDetails(db, item);
  enqueue(db, { itemId: item.id, kind: "initial" });
  return true;
}

export const CONNECTION_LABEL_MAX = 40;

// Nome escolhido pelo proprietário; vazio restaura o nome do conector (REQ-020).
export function normalizeLabel(value) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  const label = value.replace(/\s+/g, " ").trim();
  if (label.length > CONNECTION_LABEL_MAX) return undefined;
  return label || null;
}

export function renameConnection(db, owner, itemId, label) {
  return db.prepare("UPDATE connections SET label=? WHERE id=? AND owner=? AND active=1")
    .run(label, itemId, owner).changes === 1;
}

export function saveConnectionDetails(db, item) {
  const products = (values) => Array.isArray(values)
    ? [...new Set(values.filter((value) => typeof value === "string" && /^[A-Z][A-Z_]{0,59}$/.test(value)))].slice(0, 30)
    : null;
  const date = (value) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
  const details = {
    products: products(item.products),
    connectorProducts: products(item.connector?.products),
    createdAt: date(item.createdAt),
    consentExpiresAt: date(item.consentExpiresAt),
    nextAutoSyncAt: date(item.nextAutoSyncAt),
  };
  const name = typeof item.connector?.name === "string" ? item.connector.name.trim().slice(0, 120) : "";
  db.prepare("UPDATE connections SET details=?, name=COALESCE(NULLIF(?,''),name) WHERE id=? AND active=1")
    .run(JSON.stringify(details), name, item.id);
}

export function writeBatch(db, itemId, accounts, entries, bills) {
  const account = db.prepare(`INSERT INTO accounts VALUES(?,?,?) ON CONFLICT(item_id,id) DO UPDATE SET data=excluded.data`);
  const entry = db.prepare(`INSERT INTO entries VALUES(?,?,?,?,?) ON CONFLICT(item_id,account_id,id)
    DO UPDATE SET date=excluded.date, data=excluded.data`);
  const bill = db.prepare(`INSERT INTO bills VALUES(?,?,?,?) ON CONFLICT(item_id,account_id,id) DO UPDATE SET data=excluded.data`);
  for (const row of accounts) account.run(itemId, row.id, JSON.stringify(row));
  for (const row of entries) entry.run(itemId, row.accountId, row.id, row.date, JSON.stringify(row));
  for (const row of bills) bill.run(itemId, row.accountId, row.id, JSON.stringify(row));
}

export function notifyTransfers(db, itemId, entries) {
  const linked = connection(db, itemId);
  if (!linked?.active || !linked.synced_at) return;
  const insert = db.prepare("INSERT OR IGNORE INTO notices(item_id,account_id,entry_id,data,created_at) VALUES(?,?,?,?,?)");
  for (const row of entries) {
    if (row.transfer && row.status === "POSTED" && row.createdAt && row.createdAt > linked.baseline) {
      insert.run(itemId, row.accountId, row.id, JSON.stringify({
        direction: row.direction, amount: row.amount, currency: row.currency, method: row.method,
      }), new Date().toISOString());
    }
  }
}

export function dashboard(db, owner, from, to, scheduleFrom = "", billId = "", cycleDate = "", openDate = "") {
  const owned = "JOIN connections c ON c.id=t.item_id WHERE c.owner=? AND c.active=1";
  const select = (table) => db.prepare(`SELECT t.item_id,t.data FROM ${table} t ${owned}`).all(owner)
    .map((row) => ({ ...JSON.parse(row.data), itemId: row.item_id }));
  const bills = select("bills");
  const accounts = select("accounts");
  const cycleReference = cycleDate || openDate;
  const cardCycles = cycleReference ? accounts.filter((card) => card.type === "CREDIT").map((card) => {
    const cardBills = bills.filter((bill) => bill.itemId === card.itemId && bill.accountId === card.id);
    // Compra parcelada posterior pode conservar a data original da compra.
    const activity = card.closes || cardBills.some((bill) => bill.closes) ? [] : db.prepare(`
      SELECT b.id AS billId, MIN(t.date) AS first, MAX(t.date) AS last
      FROM entries t
      JOIN bills b ON b.item_id=t.item_id AND b.account_id=t.account_id AND b.id=json_extract(t.data,'$.billId')
      ${owned} AND t.item_id=? AND t.account_id=? AND json_extract(t.data,'$.direction')='DEBIT'
        AND json_extract(t.data,'$.method') IS NOT 'Fatura'
        AND COALESCE(json_extract(t.data,'$.installment'),1)<=1
        AND t.date<=?
      GROUP BY b.id
    `).all(owner, card.itemId, card.id, cycleReference);
    return cardCycle(card, cardBills, activity, cycleReference);
  }) : null;
  const installmentEntries = scheduleFrom || openDate ? db.prepare(`
    SELECT t.item_id,t.data FROM entries t
    JOIN accounts a ON a.item_id=t.item_id AND a.id=t.account_id
    ${owned} AND json_extract(a.data,'$.type')='CREDIT' AND json_extract(t.data,'$.installments')>1
  `).all(owner).map((row) => ({ ...JSON.parse(row.data), itemId: row.item_id })) : [];
  const openBills = openDate ? (() => {
    const unbilled = db.prepare(`
      SELECT t.item_id,t.data FROM entries t
      JOIN accounts a ON a.item_id=t.item_id AND a.id=t.account_id
      ${owned} AND json_extract(a.data,'$.type')='CREDIT' AND json_extract(t.data,'$.billId') IS NULL
    `).all(owner).map((row) => ({ ...JSON.parse(row.data), itemId: row.item_id }));
    const schedule = installmentSchedule(installmentEntries, bills, openDate);
    return accounts.filter((card) => card.type === "CREDIT").flatMap((card) => {
      const cycle = cardCycles.find((row) => row.itemId === card.itemId && row.accountId === card.id);
      const bill = openBill({ card, bills, entries: unbilled, schedule, cycle, reference: openDate });
      return bill ? [bill] : [];
    });
  })() : null;
  const billPurchases = billId ? db.prepare(`
    SELECT t.item_id,t.data FROM entries t
    JOIN bills b ON b.item_id=t.item_id AND b.account_id=t.account_id AND b.id=json_extract(t.data,'$.billId')
    ${owned} AND b.id=?
    ORDER BY t.date DESC,json_extract(t.data,'$.time') DESC,t.id
  `).all(owner, billId).map((row) => ({ ...JSON.parse(row.data), itemId: row.item_id })) : [];
  return {
    connections: db.prepare(`SELECT c.id,c.name,c.label,c.status,c.synced_at AS syncedAt,c.active,c.details,
      j.kind AS webhookEvent,j.received_at AS webhookReceivedAt,
      CASE WHEN j.id IS NULL THEN NULL WHEN j.done=1 THEN 'processed' WHEN j.done=2 THEN 'ignored'
        WHEN j.tries>0 AND j.until=0 THEN 'retry' ELSE 'queued' END AS webhookStatus
      FROM connections c LEFT JOIN jobs j ON j.rowid=(
        SELECT rowid FROM jobs WHERE item_id=c.id AND received_at IS NOT NULL
        ORDER BY received_at DESC,rowid DESC LIMIT 1
      ) WHERE c.owner=? ORDER BY COALESCE(c.label,c.name),c.id`).all(owner)
      .map(({ details, ...row }) => ({ ...row, details: details ? JSON.parse(details) : null })),
    accounts,
    bills,
    ...(cycleDate ? { cardCycles } : {}),
    ...(openBills ? { openBills } : {}),
    ...(scheduleFrom ? { installments: installmentSchedule(installmentEntries, bills, scheduleFrom) } : {}),
    ...(billId ? { billPurchases: { id: billId, entries: billPurchases } } : {}),
    entries: db.prepare(`SELECT t.data,t.item_id FROM entries t ${owned} AND t.date BETWEEN ? AND ?
      ORDER BY t.date DESC,json_extract(t.data,'$.time') DESC,t.id`)
      .all(owner, from, to).map((row) => ({ ...JSON.parse(row.data), itemId: row.item_id })),
    notifications: db.prepare(`SELECT t.id,t.data,t.created_at,t.read_at FROM notices t ${owned} ORDER BY t.id DESC LIMIT 50`)
      .all(owner).map((row) => ({ ...JSON.parse(row.data), id: row.id, date: row.created_at, read: row.read_at !== null })),
    unread: db.prepare(`SELECT COUNT(*) AS total FROM notices t ${owned} AND t.read_at IS NULL`).get(owner).total,
  };
}
