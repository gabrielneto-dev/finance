import assert from "node:assert/strict";
import test from "node:test";
import { claim, dashboard, enqueue, openDatabase } from "../lib/db.mjs";
import { processJob } from "../lib/sync.mjs";

const id = (suffix) => "00000000-0000-4000-8000-" + String(suffix).padStart(12, "0");
const itemId = id(1);
const accountId = id(2);
const item = {
  id: itemId, connector: { name: "MeuPluggy", isSandbox: true, products: ["ACCOUNTS"] },
  products: ["ACCOUNTS"], createdAt: "2026-09-15T20:00:00.000Z", status: "UPDATED", executionStatus: "SUCCESS",
};
const purchase = {
  id: id(3), accountId, description: "Compra sintética", date: "2026-11-07T15:00:00.000Z", createdAt: "2026-11-08T20:00:00.000Z",
  amount: 12.5, type: "DEBIT", currencyCode: "BRL", status: "POSTED", operationType: "PIX",
};

function setup(t, patch) {
  process.env.PLUGGY_CLIENT_ID = "sandbox-app";
  process.env.PLUGGY_CLIENT_SECRET = "test-only";
  process.env.PLUGGY_SANDBOX = "1";
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline,synced_at) VALUES(?,?,?,?,?,?)")
    .run(itemId, "owner", "MeuPluggy", "CONECTADA", "2026-09-15", "2026-11-08T10:00:00.000Z");
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, init = {}) => {
    const url = new URL(input);
    calls.push((init.method ?? "GET") + " " + url.pathname);
    if (url.pathname === "/auth") return Response.json({ apiKey: "fixture" });
    if (url.pathname === "/items/" + itemId) return init.method === "PATCH" ? patch() : Response.json(item);
    if (url.pathname === "/accounts") return Response.json({ totalPages: 1, results: [
      { id: accountId, itemId, type: "BANK", name: "Conta", balance: 10, currencyCode: "BRL" },
    ] });
    if (url.pathname === "/v2/transactions") return Response.json({ results: [purchase], next: null });
    throw new Error("Rota inesperada");
  });
  const logs = [];
  const logger = { warn: (...args) => logs.push(["warn", ...args]), error: (...args) => logs.push(["error", ...args]) };
  return { db, calls, logs, logger };
}

const job = (db, kind) => db.prepare("SELECT kind, done, tries FROM jobs WHERE kind=?").get(kind);
const runDue = async (db, logger) => {
  db.prepare("UPDATE jobs SET due=0 WHERE done=0").run();
  await processJob(db, claim(db), logger);
};

test("atualiza conexão MeuPluggy com os dados já sincronizados quando a Pluggy recusa o pedido", async (t) => {
  const { db, calls, logs, logger } = setup(t, () => Response.json({ code: 400, message: "MeuPluggy item cant be updated" }, { status: 400 }));
  enqueue(db, { itemId, kind: "refresh" });

  await runDue(db, logger);
  assert.equal(job(db, "refresh").done, 1);
  assert.ok(calls.includes("PATCH /items/" + itemId));

  await runDue(db, logger);
  assert.equal(job(db, "initial").done, 1);
  const rows = dashboard(db, "owner", "2026-11-01", "2026-11-30").entries;
  assert.deepEqual(rows.map((row) => row.date), ["2026-11-07"]);
  assert.equal(dashboard(db, "owner", "2026-11-01", "2026-11-30").connections[0].status, "CONECTADA");
  assert.deepEqual(logs, []);
});

test("encerra a tarefa e registra o motivo quando a Pluggy recusa o pedido de forma definitiva", async (t) => {
  const { db, logs, logger } = setup(t, () => Response.json({ code: 403, message: "Sem permissão para atualizar" }, { status: 403 }));
  enqueue(db, { itemId, kind: "refresh" });

  await runDue(db, logger);
  assert.equal(job(db, "refresh").done, 2);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], "error");
  assert.match(logs[0].join(" "), /refresh.*403.*Sem permissão para atualizar/);
});

test("adia e registra o motivo quando a falha da Pluggy é temporária", async (t) => {
  const { db, logs, logger } = setup(t, () => Response.json({ message: "Indisponível" }, { status: 503 }));
  enqueue(db, { itemId, kind: "refresh" });

  await runDue(db, logger);
  const pending = job(db, "refresh");
  assert.equal(pending.done, 0);
  assert.equal(pending.tries, 1);
  assert.equal(logs[0][0], "warn");
  assert.match(logs[0].join(" "), /refresh.*503.*Indisponível/);
});
