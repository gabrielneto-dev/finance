import assert from "node:assert/strict";
import test from "node:test";
import { parseAnalyticsQuery } from "../lib/analytics/query.mjs";

const parse = (params) => parseAnalyticsQuery(new URLSearchParams(params));

test("aceita período, comparação e conta válidos", () => {
  assert.deepEqual(parse({ from: "2026-10-01", to: "2026-10-31" }),
    { ok: true, value: { from: "2026-10-01", to: "2026-10-31", account: "" } });
  assert.deepEqual(parse({ from: "2026-11-01", to: "2026-11-10", cfrom: "2026-10-01", cto: "2026-10-10", account: "item/conta" }).value,
    { from: "2026-11-01", to: "2026-11-10", account: "item/conta", compareFrom: "2026-10-01", compareTo: "2026-10-10" });
  // 731 dias cabem: 12 meses comparados com os 12 anteriores.
  assert.equal(parse({ from: "2024-11-11", to: "2026-11-10" }).ok, true);
});

test("recusa períodos inválidos, longos ou invertidos", () => {
  for (const params of [{}, { from: "2026-10-01" }, { from: "2026-13-01", to: "2026-13-02" }, { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-31", to: "2026-10-01" }, { from: "2024-11-09", to: "2026-11-10" }, { from: "01/10/2026", to: "2026-10-31" }]) {
    assert.deepEqual(parse(params), { ok: false, error: "Período inválido." });
  }
});

test("recusa comparação incompleta ou sobreposta e conta malformada", () => {
  assert.equal(parse({ from: "2026-11-01", to: "2026-11-10", cfrom: "2026-10-01" }).error, "Período de comparação inválido.");
  assert.equal(parse({ from: "2026-11-01", to: "2026-11-10", cfrom: "2026-10-25", cto: "2026-11-02" }).error, "Período de comparação inválido.");
  assert.equal(parse({ from: "2026-11-01", to: "2026-11-10", account: "sem-barra" }).error, "Conta inválida.");
  assert.equal(parse({ from: "2026-11-01", to: "2026-11-10", account: "a/b/c" }).error, "Conta inválida.");
});
