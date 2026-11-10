import assert from "node:assert/strict";
import test from "node:test";
import { claim, enqueue, openDatabase } from "../lib/db.mjs";
import { pollSettings, schedulePolls, watchConnection } from "../lib/poll.mjs";
import { processJob } from "../lib/sync.mjs";

const MINUTE = 60_000;
const id = (suffix) => "00000000-0000-4000-8000-" + String(suffix).padStart(12, "0");
const itemId = id(1);
const accountId = id(2);
const NOW = Date.parse("2026-11-10T12:00:00.000Z");
const settings = pollSettings({});

function database(t, extra = {}) {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline,synced_at,details,provider_updated_at,polled_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(itemId, "owner", "MeuPluggy", "CONECTADA", "2026-09-15", "2026-11-09T10:00:00.000Z",
      JSON.stringify({ nextAutoSyncAt: extra.next ?? "2026-11-11T09:00:00.000Z" }),
      extra.seen ?? "2026-11-10T09:00:00.000Z", extra.polled ?? null);
  return db;
}
const polls = (db) => db.prepare("SELECT count(*) AS n FROM jobs WHERE kind='poll' AND done=0").get().n;

test("usa uma hora por padrão e não aceita intervalo menor que 15 minutos", () => {
  assert.equal(pollSettings({}).interval, 60 * MINUTE);
  assert.equal(pollSettings({ PLUGGY_POLL_MINUTES: "30" }).interval, 30 * MINUTE);
  assert.equal(pollSettings({ PLUGGY_POLL_MINUTES: "5" }).interval, 60 * MINUTE);
});

test("agenda a consulta de hora em hora e não duplica tarefa pendente", (t) => {
  const db = database(t, { polled: NOW - 30 * MINUTE });
  assert.equal(schedulePolls(db, NOW, settings), 0);
  assert.equal(schedulePolls(db, NOW + 31 * MINUTE, settings), 1);
  assert.equal(schedulePolls(db, NOW + 200 * MINUTE, settings), 0, "já existe consulta pendente");
  assert.equal(polls(db), 1);
});

test("ignora conexões inativas ou ainda sem importação", (t) => {
  const db = database(t);
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline,active,synced_at) VALUES(?,?,?,?,?,?,?)")
    .run(id(8), "owner", "MeuPluggy", "REMOVENDO", "2026-09-15", 0, "2026-11-09T10:00:00.000Z");
  db.prepare("INSERT INTO connections(id,owner,name,status,baseline) VALUES(?,?,?,?,?)")
    .run(id(9), "owner", "MeuPluggy", "IMPORTANDO", "2026-09-15");
  assert.equal(schedulePolls(db, NOW, settings), 1);
  assert.deepEqual(db.prepare("SELECT item_id FROM jobs").all().map((row) => row.item_id), [itemId]);
});

test("consulta a cada 10 minutos depois do horário previsto até ver a sincronização", (t) => {
  const db = database(t, { next: "2026-11-10T11:55:00.000Z", polled: NOW - 11 * MINUTE });
  assert.equal(schedulePolls(db, NOW, settings), 1);

  const seen = database(t, { next: "2026-11-10T11:55:00.000Z", seen: "2026-11-10T11:56:00.000Z", polled: NOW - 11 * MINUTE });
  assert.equal(schedulePolls(seen, NOW, settings), 0, "sincronização já importada volta ao intervalo normal");

  const late = database(t, { next: "2026-11-10T09:00:00.000Z", polled: NOW - 11 * MINUTE });
  assert.equal(schedulePolls(late, NOW, settings), 0, "fora da janela de duas horas volta ao intervalo normal");
});

test("consulta a cada 2 minutos depois de atualizar no Meu Pluggy", (t) => {
  const db = database(t, { polled: NOW - MINUTE });
  assert.equal(watchConnection(db, "outro", itemId, NOW), false);
  assert.equal(watchConnection(db, "owner", itemId, NOW), true);
  assert.equal(schedulePolls(db, NOW, settings), 1, "a primeira consulta sai na hora");
  db.prepare("UPDATE jobs SET done=1").run();
  assert.equal(schedulePolls(db, NOW + MINUTE, settings), 0);
  assert.equal(schedulePolls(db, NOW + 2 * MINUTE, settings), 1);
  db.prepare("UPDATE jobs SET done=1").run();
  assert.equal(schedulePolls(db, NOW + 40 * MINUTE, settings), 0, "a vigilância dura 30 minutos");
});

test("apaga consultas concluídas há mais de um dia", (t) => {
  const db = database(t);
  enqueue(db, { itemId, kind: "poll", delay: -2 * 24 * 60 * MINUTE });
  enqueue(db, { itemId, kind: "refresh", delay: -2 * 24 * 60 * MINUTE });
  db.prepare("UPDATE jobs SET done=1").run();
  schedulePolls(db, Date.now(), settings);
  assert.deepEqual(db.prepare("SELECT kind FROM jobs WHERE done<>0").all().map((row) => row.kind), ["refresh"]);
});

function pluggy(t, item) {
  process.env.PLUGGY_CLIENT_ID = "sandbox-app";
  process.env.PLUGGY_CLIENT_SECRET = "test-only";
  process.env.PLUGGY_SANDBOX = "1";
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, init = {}) => {
    const url = new URL(input);
    calls.push((init.method ?? "GET") + " " + url.pathname);
    if (url.pathname === "/auth") return Response.json({ apiKey: "fixture" });
    if (url.pathname === "/items/" + itemId) return typeof item === "function" ? item() : Response.json(item);
    if (url.pathname === "/accounts") return Response.json({ totalPages: 1, results: [
      { id: accountId, itemId, type: "BANK", name: "Conta", balance: 10, currencyCode: "BRL" },
    ] });
    if (url.pathname === "/v2/transactions") return Response.json({ results: [], next: null });
    throw new Error("Rota inesperada");
  });
  return calls;
}
const item = (extra) => ({
  id: itemId, connector: { name: "MeuPluggy", isSandbox: true }, status: "UPDATED", executionStatus: "SUCCESS",
  lastUpdatedAt: "2026-11-10T09:00:00.000Z", nextAutoSyncAt: "2026-11-11T09:00:00.000Z", ...extra,
});
const logger = { warn() {}, error() {} };
async function runPoll(db) {
  enqueue(db, { itemId, kind: "poll" });
  await processJob(db, claim(db), logger);
  return db.prepare("SELECT done FROM jobs WHERE kind='poll'").get().done;
}
const row = (db) => db.prepare("SELECT status,synced_at,provider_updated_at,details FROM connections WHERE id=?").get(itemId);

test("sem sincronização nova só guarda os detalhes do Item", async (t) => {
  const db = database(t);
  const calls = pluggy(t, item({ nextAutoSyncAt: "2026-11-11T10:00:00.000Z" }));
  assert.equal(await runPoll(db), 1);
  assert.ok(!calls.some((call) => call.startsWith("PATCH") || call.includes("/accounts")));
  assert.equal(JSON.parse(row(db).details).nextAutoSyncAt, "2026-11-11T10:00:00.000Z");
  assert.equal(row(db).synced_at, "2026-11-09T10:00:00.000Z");
});

test("importa quando a Pluggy sincronizou de novo", async (t) => {
  const db = database(t);
  watchConnection(db, "owner", itemId, NOW);
  const calls = pluggy(t, item({ lastUpdatedAt: "2026-11-10T11:58:00.000Z" }));
  assert.equal(await runPoll(db), 1);
  assert.ok(calls.includes("GET /accounts"));
  assert.ok(!calls.some((call) => call.startsWith("PATCH")));
  assert.equal(row(db).provider_updated_at, "2026-11-10T11:58:00.000Z");
  assert.notEqual(row(db).synced_at, "2026-11-09T10:00:00.000Z");
  assert.equal(db.prepare("SELECT watch_until FROM connections").get().watch_until, null);
});

test("não importa enquanto a Pluggy sincroniza e reflete erro na conexão", async (t) => {
  const busy = database(t);
  const calls = pluggy(t, item({ status: "UPDATING", lastUpdatedAt: "2026-11-10T11:58:00.000Z" }));
  assert.equal(await runPoll(busy), 1);
  assert.ok(!calls.includes("GET /accounts"));
  assert.equal(row(busy).provider_updated_at, "2026-11-10T09:00:00.000Z");

  t.mock.restoreAll();
  const failed = database(t);
  pluggy(t, item({ status: "LOGIN_ERROR", executionStatus: "INVALID_CREDENTIALS" }));
  assert.equal(await runPoll(failed), 1);
  assert.equal(row(failed).status, "RECONECTAR");
});

test("adia a consulta quando a Pluggy limita as chamadas", async (t) => {
  const db = database(t);
  pluggy(t, () => Response.json({ message: "Too many requests" }, { status: 429 }));
  assert.equal(await runPoll(db), 0);
});
