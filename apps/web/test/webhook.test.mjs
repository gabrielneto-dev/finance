import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { atomic, bind, bindExisting, claim, complete, dashboard, enqueue, openDatabase, retry } from "../lib/db.mjs";
import { checkWebhookSecret, parseWebhook } from "../lib/webhook.mjs";
import { runJob } from "../lib/sync.mjs";
import { registerDevice } from "../lib/push.mjs";

const id = (suffix) => "00000000-0000-4000-8000-" + String(suffix).padStart(12, "0");
const itemId = id(1);
const accountId = id(2);
const created = "2026-11-08T10:00:00.000Z";

function event(eventId) {
  return {
    event: "transactions/created", eventId, itemId, accountId, clientId: "sandbox-app",
    createdTransactionsLink: "https://api.pluggy.ai/transactions?accountId=" + accountId + "&createdAtFrom=" + created,
  };
}

test("valida segredo, escopo e formato do webhook legado", () => {
  assert.equal(checkWebhookSecret("correct", "correct"), true);
  assert.equal(checkWebhookSecret("incorrect", "correct"), false);
  assert.equal(checkWebhookSecret(null, "correct"), false);
  assert.equal(parseWebhook(event(id(3)), "sandbox-app").data.createdAtFrom, created);
  assert.throws(() => parseWebhook(event(id(3)), "another-app"), /Aplicação/);
  assert.throws(() => parseWebhook({ ...event(id(3)), createdTransactionsLink: "https://outside.invalid/transactions" }, "sandbox-app"), /Link/);
});

test("webhook sobrevive ao reinício, importa Pix e gera somente um aviso por transferência", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "finance-test-"));
  const path = join(dir, "finance.sqlite");
  let db = openDatabase(path);
  t.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
  process.env.PLUGGY_CLIENT_ID = "sandbox-app";
  process.env.PLUGGY_CLIENT_SECRET = "test-only";
  process.env.PLUGGY_SANDBOX = "1";

  const cardId = id(11);
  const item = { id: itemId, clientUserId: id(5), connector: {
    name: "Banco sintético", isSandbox: true, products: ["ACCOUNTS", "CREDIT_CARDS", "INVESTMENTS"],
  }, products: ["ACCOUNTS", "CREDIT_CARDS"], createdAt: created, status: "UPDATED", executionStatus: "SUCCESS" };
  db.prepare("INSERT INTO intents VALUES(?,?,?)").run(item.clientUserId, "owner", Date.now() + 100000);
  assert.equal(atomic(db, () => bind(db, item, "another-owner", item.clientUserId)), false);
  assert.equal(atomic(db, () => bind(db, item, "owner", item.clientUserId)), true);
  const transfer = { id: id(4), accountId, description: "Pix sintético", date: created, createdAt: created, amount: 30.29,
    type: "CREDIT", currencyCode: "BRL", status: "POSTED", operationType: "PIX" };
  const historical = { ...transfer, id: id(8), createdAt: new Date().toISOString() };
  const read = t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.origin !== "https://api.pluggy.ai") throw new Error("Host inesperado");
    if (url.pathname === "/auth") return Response.json({ apiKey: "fixture" });
    if (url.pathname === "/items/" + itemId) return Response.json(item);
    if (url.pathname === "/accounts") return Response.json({ totalPages: 1, results: [
      { id: accountId, itemId, type: "BANK", name: "Conta", balance: 30.29, currencyCode: "BRL" },
      { id: cardId, itemId, type: "CREDIT", marketingName: "Cartão sintético", balance: 10.5, currencyCode: "BRL", number: "12345678",
        creditData: { brand: "VISA", creditLimit: 100.25, availableCreditLimit: 0, minimumPayment: null } },
    ] });
    if (url.pathname === "/v2/transactions" && url.searchParams.get("accountId") === accountId) {
      return Response.json({ results: url.searchParams.has("createdAtFrom") ? [transfer, historical] : [historical], next: null });
    }
    if (url.searchParams.get("accountId") === cardId) {
      if (url.pathname === "/v2/transactions") return Response.json({ results: [], next: null });
      if (url.pathname === "/bills") return Response.json({ totalPages: 1, results: [
        { id: id(12), accountId: cardId, totalAmount: 30.29, totalAmountCurrencyCode: "BRL", minimumPaymentAmount: 3.01, allowsInstallments: false },
      ] });
    }
    throw new Error("Rota inesperada");
  });

  await runJob(db, claim(db));
  const range = ["2026-11-01", "2026-11-30"];
  const initial = dashboard(db, "owner", ...range);
  assert.equal(initial.unread, 0);
  assert.equal(initial.entries.length, 1);
  assert.deepEqual(initial.connections[0].details.products, ["ACCOUNTS", "CREDIT_CARDS"]);
  assert.ok(initial.connections[0].details.connectorProducts.includes("INVESTMENTS"));
  const card = initial.accounts.find((account) => account.id === cardId);
  assert.equal(card.name, "Cartão sintético");
  assert.equal(card.last4, "5678");
  assert.equal(card.credit.limit, 10025);
  assert.equal(card.credit.availableLimit, 0);
  assert.equal(card.credit.minimumPayment, null);
  assert.equal(initial.bills[0].minimumPayment, 301);
  assert.equal(initial.bills[0].allowsInstallments, false);
  transfer.createdAt = new Date(Date.parse(initial.connections[0].syncedAt) + 1000).toISOString();
  const job = { ...parseWebhook(event(id(3)), "sandbox-app"), receivedAt: transfer.createdAt };
  assert.equal(enqueue(db, job), true);
  assert.equal(enqueue(db, { ...job, receivedAt: new Date(Date.parse(job.receivedAt) + 1000).toISOString() }), false);
  assert.equal(dashboard(db, "owner", ...range).connections[0].webhookStatus, "queued");
  db.close();
  db = openDatabase(path);
  // Aparelho do dono para o push de transferência (SPEC-0005, REQ-005).
  assert.equal(registerDevice(db, "owner", "fcm-token-sintetico:" + "z".repeat(30)), true);
  await runJob(db, claim(db));
  const push = claim(db);
  assert.equal(push?.kind, "push", "a transferência nova gera um push para o aparelho do dono");
  // Sem FIREBASE_SERVICE_ACCOUNT no ambiente, o push encerra sem rede.
  await runJob(db, push);
  assert.equal(dashboard(db, "owner", ...range).connections[0].webhookStatus, "processed");
  assert.equal(dashboard(db, "owner", ...range).connections[0].webhookReceivedAt, job.receivedAt);
  assert.equal(enqueue(db, parseWebhook(event(id(6)), "sandbox-app")), true);
  await runJob(db, claim(db));
  const result = dashboard(db, "owner", ...range);
  assert.equal(result.entries.length, 2);
  assert.equal(result.unread, 1);
  assert.equal(result.notifications[0].amount, 3029);
  assert.equal(result.notifications[0].method, "Pix");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind='push'").get().n, 1, "só um push por transferência");
  assert.equal(dashboard(db, "another-owner", ...range).entries.length, 0);
  assert.equal(dashboard(db, "another-owner", ...range).unread, 0);
  assert.equal(dashboard(db, "another-owner", ...range).connections.length, 0);
  assert.equal(dashboard(db, "another-owner", ...range).accounts.length, 0);
  assert.equal(dashboard(db, "another-owner", ...range).bills.length, 0);
  assert.equal(claim(db), null);
  assert.ok(read.mock.calls.some(({ arguments: [url] }) => String(url).includes("createdAtFrom=")));

  enqueue(db, { itemId, kind: "initial" });
  const old = claim(db);
  db.prepare("UPDATE jobs SET until=0 WHERE id=?").run(old.id);
  const renewed = claim(db);
  assert.equal(complete(db, old, () => assert.fail("Lease vencido")), false);
  assert.equal(complete(db, renewed), true);
});

test("migra fila existente e importa apenas o Item autorizado, sem transferir a propriedade", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "finance-test-"));
  const path = join(dir, "finance.sqlite");
  const oldDb = new DatabaseSync(path);
  oldDb.exec(`CREATE TABLE connections (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
    synced_at TEXT, baseline TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY, item_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL,
    due INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, lease TEXT,
    until INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0
  )`);
  oldDb.prepare("INSERT INTO jobs(id,item_id,kind,data,due,done) VALUES(?,?,?,?,?,1)")
    .run("pluggy:" + id(3), itemId, "item/updated", "{}", 0);
  oldDb.prepare("INSERT INTO connections(id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(id(8), "old-owner", "Banco anterior", "CONECTADA", created);
  oldDb.close();
  const db = openDatabase(path);
  t.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal(dashboard(db, "old-owner", "2026-11-01", "2026-11-30").connections[0].details, null);

  const item = { id: itemId, connector: { name: "Banco sintético" } };
  const importItem = (owner, allowed) => atomic(db, () => bindExisting(db, item, owner, allowed));
  assert.equal(importItem("owner", null), false);
  assert.equal(importItem("owner", id(7)), false);
  assert.equal(importItem("owner", itemId), true);
  assert.equal(importItem("another-owner", itemId), false);
  assert.equal(importItem("owner", itemId), true);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM jobs WHERE kind='initial'").get().total, 1);

  const getConnection = () => dashboard(db, "owner", "2026-11-01", "2026-11-30").connections[0];
  assert.equal(getConnection().webhookReceivedAt, null);
  assert.equal(enqueue(db, { id: "pluggy:" + id(3), itemId, kind: "item/updated", receivedAt: created }), false);
  const initial = claim(db);
  complete(db, initial);
  enqueue(db, { id: "pluggy:" + id(4), itemId, kind: "item/updated", receivedAt: created });
  retry(db, claim(db));
  assert.equal(getConnection().webhookStatus, "retry");
});
