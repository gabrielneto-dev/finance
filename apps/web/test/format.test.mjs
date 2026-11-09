import assert from "node:assert/strict";
import test from "node:test";
import { displayDateWithYear } from "../lib/format.ts";

test("identifica o ciclo da fatura com dia, mês e ano", () => {
  assert.equal(displayDateWithYear("2026-11-10"), "10 de nov. de 2026");
  assert.equal(displayDateWithYear("2025-11-10"), "10 de nov. de 2025");
  assert.equal(displayDateWithYear("2026-11-10T03:00:00Z"), "10 de nov. de 2026");
  assert.equal(displayDateWithYear(null), "—");
});
