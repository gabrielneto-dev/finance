import assert from "node:assert/strict";
import test from "node:test";
import { resolvePeriod } from "../lib/analytics/periods.mjs";

test("resolve os períodos e a comparação equivalente", () => {
  assert.deepEqual(resolvePeriod("mes", "2026-03-31"), { from: "2026-03-01", to: "2026-03-31", compareFrom: "2026-02-01", compareTo: "2026-02-28" });
  assert.deepEqual(resolvePeriod("anterior", "2026-01-15"), { from: "2025-12-01", to: "2025-12-31", compareFrom: "2025-11-01", compareTo: "2025-11-30" });
  assert.deepEqual(resolvePeriod("3m", "2026-11-10"), { from: "2026-09-01", to: "2026-11-10", compareFrom: "2026-06-01", compareTo: "2026-08-10" });
  assert.deepEqual(resolvePeriod("12m", "2026-11-10"), { from: "2025-12-01", to: "2026-11-10", compareFrom: "2024-12-01", compareTo: "2025-11-10" });
  assert.deepEqual(resolvePeriod("ano", "2028-02-29"), { from: "2028-01-01", to: "2028-02-29", compareFrom: "2027-01-01", compareTo: "2027-02-28" });
  assert.deepEqual(resolvePeriod("custom", "2026-11-10", { from: "2026-10-05", to: "2026-10-20" }), { from: "2026-10-05", to: "2026-10-20" });
  // Personalizado inválido e preset desconhecido voltam para este mês.
  assert.equal(resolvePeriod("custom", "2026-11-10", { from: "2026-10-20", to: "2026-10-05" }).from, "2026-11-01");
  assert.equal(resolvePeriod("xyz", "2026-11-10").from, "2026-11-01");
});
