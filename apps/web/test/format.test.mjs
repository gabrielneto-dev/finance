import assert from "node:assert/strict";
import test from "node:test";
import { displayDateWithYear, maskValue, money } from "../lib/format.ts";

test("oculta valores de saldo e fatura sem esconder ausências", () => {
  const value = money(123456, "BRL");
  assert.equal(maskValue(false, value), value);
  assert.equal(maskValue(true, value), "R$ ••••••");
  assert.ok(!maskValue(true, value).includes("1"));
  assert.equal(maskValue(true, "—"), "—");
  assert.equal(maskValue(true, null), null);
  assert.equal(maskValue(true, undefined), undefined);
});

test("identifica o ciclo da fatura com dia, mês e ano", () => {
  assert.equal(displayDateWithYear("2026-11-10"), "10 de nov. de 2026");
  assert.equal(displayDateWithYear("2025-11-10"), "10 de nov. de 2025");
  assert.equal(displayDateWithYear("2026-11-10T03:00:00Z"), "10 de nov. de 2026");
  assert.equal(displayDateWithYear(null), "—");
});
