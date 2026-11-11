import assert from "node:assert/strict";
import test from "node:test";
import { atomic, bind, claim, openDatabase } from "../lib/db.mjs";
import { investment, investmentClass, investmentLiquidity, runJob } from "../lib/sync.mjs";
import { loadPlan } from "../lib/planning/store.mjs";

const id = (number) => "00000000-0000-4000-8000-" + String(number).padStart(12, "0");

test("mapeia tipo, liquidez e saldo líquido dos investimentos da Pluggy", () => {
  assert.equal(investmentClass("FIXED_INCOME", "TREASURY"), "tesouro");
  assert.equal(investmentClass("FIXED_INCOME", "CDB"), "renda_fixa");
  assert.equal(investmentClass("EQUITY", "REAL_ESTATE_FUND"), "fiis");
  assert.equal(investmentClass("EQUITY", "STOCK"), "acoes");
  assert.equal(investmentClass("ETF", null), "acoes");
  assert.equal(investmentClass("MUTUAL_FUND", null), "fundos");
  assert.equal(investmentClass("SECURITY", "PGBL"), "previdencia");
  assert.equal(investmentClass("COE", null), "outros");
  assert.equal(investmentLiquidity("FIXED_INCOME", "2028-01-01", "2026-11-15"), "vencimento");
  assert.equal(investmentLiquidity("FIXED_INCOME", "2026-01-01", "2026-11-15"), "diaria");
  assert.equal(investmentLiquidity("SECURITY", null, "2026-11-15"), "longo");
  const row = investment({ id: id(1), name: "CDB Sintético", type: "FIXED_INCOME", subtype: "CDB", currencyCode: "BRL",
    amount: "1100.50", balance: "1080.25", dueDate: "2028-05-10T00:00:00.000Z", issuer: "Banco Emissor", status: "ACTIVE" }, "2026-11-15");
  assert.deepEqual(row, { externalId: id(1), name: "CDB Sintético", institution: "Banco Emissor", class: "renda_fixa",
    liquidity: "vencimento", balance: 108025, dueDate: "2028-05-10" });
  assert.equal(investment({ id: id(2), currencyCode: "BRL", balance: "1", status: "TOTAL_WITHDRAWAL" }, "2026-11-15"), null);
  assert.equal(investment({ id: id(3), currencyCode: "USD", balance: "1" }, "2026-11-15"), null);
  assert.equal(investment({ id: "nao-uuid", currencyCode: "BRL", balance: "1" }, "2026-11-15"), null);
});

test("sincronização importa /investments só quando o Item autorizou o produto", async (t) => {
  const db = openDatabase(":memory:");
  process.env.PLUGGY_CLIENT_ID = "sandbox-app";
  process.env.PLUGGY_CLIENT_SECRET = "test-only";
  process.env.PLUGGY_SANDBOX = "1";
  const itemId = id(10);
  const accountId = id(11);
  const item = { id: itemId, clientUserId: id(12), connector: { name: "Corretora sintética", isSandbox: true },
    products: ["ACCOUNTS", "TRANSACTIONS", "INVESTMENTS"], status: "UPDATED", executionStatus: "SUCCESS" };
  db.prepare("INSERT INTO intents VALUES(?,?,?)").run(item.clientUserId, "dono", Date.now() + 100000);
  assert.equal(atomic(db, () => bind(db, item, "dono", item.clientUserId)), true);
  let investments = [
    { id: id(20), name: "Fundo sintético", type: "MUTUAL_FUND", currencyCode: "BRL", balance: "500.00", status: "ACTIVE" },
    { id: id(21), name: "Ação sintética", type: "EQUITY", subtype: "STOCK", currencyCode: "BRL", balance: "250.10", status: "ACTIVE" },
  ];
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.origin !== "https://api.pluggy.ai") throw new Error("Host inesperado");
    if (url.pathname === "/auth") return Response.json({ apiKey: "fixture" });
    if (url.pathname === "/items/" + itemId) return Response.json(item);
    if (url.pathname === "/accounts") return Response.json({ totalPages: 1, results: [
      { id: accountId, itemId, type: "BANK", name: "Conta", balance: 10, currencyCode: "BRL" }] });
    if (url.pathname === "/v2/transactions") return Response.json({ results: [], next: null });
    if (url.pathname === "/investments" && url.searchParams.get("itemId") === itemId) {
      calls += 1;
      return Response.json({ totalPages: 1, results: investments });
    }
    throw new Error("Rota inesperada " + url.pathname);
  });

  await runJob(db, claim(db));
  let list = loadPlan(db, "dono").investments;
  assert.deepEqual(list.map((row) => [row.name, row.class, row.balance, row.source]),
    [["Ação sintética", "acoes", 25010, "pluggy"], ["Fundo sintético", "fundos", 50000, "pluggy"]]);
  assert.equal(loadPlan(db, "outro").investments.length, 0);

  // Uma nova sincronização atualiza o saldo e remove o que saiu do Item.
  investments = [{ ...investments[0], balance: "520.00" }];
  db.prepare("INSERT INTO jobs(id,item_id,kind,data,due) VALUES(?,?,?,?,?)").run("again", itemId, "item/updated", "{}", 0);
  await runJob(db, claim(db));
  list = loadPlan(db, "dono").investments;
  assert.deepEqual(list.map((row) => [row.name, row.balance]), [["Fundo sintético", 52000]]);
  assert.equal(calls, 2);

  // Sem o produto autorizado, não consulta e mantém os investimentos.
  item.products = ["ACCOUNTS", "TRANSACTIONS"];
  db.prepare("INSERT INTO jobs(id,item_id,kind,data,due) VALUES(?,?,?,?,?)").run("third", itemId, "item/updated", "{}", 0);
  await runJob(db, claim(db));
  assert.equal(calls, 2);
  assert.equal(loadPlan(db, "dono").investments.length, 1);

  // Desconectar apaga os investimentos importados daquele Item.
  db.prepare("DELETE FROM connections WHERE id=?").run(itemId);
  assert.equal(loadPlan(db, "dono").investments.length, 0);
});
