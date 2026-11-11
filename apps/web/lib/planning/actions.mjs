// Ações de escrita do POST /api/planning (SPEC-0004, REQ-010). Separadas da rota para serem testadas sem o Next.
import { atomic } from "../db.mjs";
import * as store from "./store.mjs";
import * as validate from "./validate.mjs";
import { suggestionFor } from "./index.mjs";

/** @typedef {{ status: number; body: Record<string, unknown> }} Result */

const ok = (/** @type {Record<string, unknown>} */ body = { ok: true }, status = 200) => ({ status, body: { ok: true, ...body } });
const bad = (/** @type {string} */ error, status = 400) => ({ status, body: { error } });
const missing = () => bad("Item indisponível.", 404);

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} owner
 * @param {any} body
 * @param {string} today YYYY-MM-DD
 * @returns {Result}
 */
export function applyAction(db, owner, body, today) {
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.action !== "string") return bad("Requisição inválida.");
  /** @param {{ ok: boolean; value?: any; error?: string }} parsed @param {(value: any) => Result} run */
  const withParsed = (parsed, run) => parsed.ok ? run(parsed.value) : bad(/** @type {string} */ (parsed.error));
  try {
    switch (body.action) {
      case "bucket-save":
        return withParsed(validate.parseBucket(body), (value) => {
          const id = store.saveBucket(db, owner, value);
          return id ? ok({ id }, value.id ? 200 : 201) : missing();
        });
      case "bucket-order":
        return withParsed(validate.parseBucketOrder(body), ({ ids }) => store.orderBuckets(db, owner, ids) ? ok() : missing());
      case "bucket-delete":
        return withParsed(validate.parseId(body), ({ id }) => store.deleteBucket(db, owner, id) ? ok() : missing());
      case "bucket-month":
        return withParsed(validate.parseBucketMonth(body), (value) => store.setBucketMonth(db, owner, value) ? ok() : missing());
      case "bucket-suggest": {
        // Cria as caixinhas do Plano Consciente que faltam e ajusta o valor das que já existem.
        if (!validate.isMonth(body.month)) return bad("Mês inválido.");
        const suggestion = suggestionFor(db, owner, body.month, today);
        const plan = store.loadPlan(db, owner);
        atomic(db, () => {
          for (const item of suggestion) {
            const current = plan.buckets.find((bucket) => bucket.kind === item.kind && !bucket.archived);
            const taken = new Set(plan.buckets.filter((bucket) => bucket !== current).flatMap((bucket) => bucket.groups));
            const groups = current ? current.groups : item.groups.filter((key) => !taken.has(key));
            store.writeBucket(db, owner, {
              id: current?.id ?? null, name: current?.name ?? item.name, kind: item.kind, mode: "valor", amount: item.amount,
              rollover: current?.rollover ?? item.rollover, archived: false, sort: current?.sort ?? null, groups,
            });
          }
        });
        return ok();
      }
      case "income-set":
        return withParsed(validate.parseIncome(body), (value) => { store.setIncome(db, owner, value); return ok(); });
      case "goal-save":
        return withParsed(validate.parseGoal(body), (value) => {
          const id = store.saveGoal(db, owner, value);
          return id ? ok({ id }, value.id ? 200 : 201) : missing();
        });
      case "goal-delete":
        return withParsed(validate.parseId(body), ({ id }) => store.deleteGoal(db, owner, id) ? ok() : missing());
      case "investment-save":
        return withParsed(validate.parseInvestment(body), (value) => {
          const id = store.saveInvestment(db, owner, value, today);
          return id ? ok({ id }, value.id ? 200 : 201) : missing();
        });
      case "investment-balance":
        return withParsed(validate.parseInvestmentBalance(body), (value) => {
          if (value.date && value.date > today) return bad("A data não pode estar no futuro.");
          return store.setInvestmentBalance(db, owner, value, today) ? ok() : missing();
        });
      case "investment-delete":
        return withParsed(validate.parseId(body), ({ id }) => store.deleteInvestment(db, owner, id) ? ok() : missing());
      case "adjustment-save":
        return withParsed(validate.parseAdjustment(body), (value) => {
          const id = store.saveAdjustment(db, owner, value);
          return id ? ok({ id }, value.id ? 200 : 201) : missing();
        });
      case "adjustment-toggle":
        return withParsed(validate.parseToggle(body), (value) => store.toggleAdjustment(db, owner, value) ? ok() : missing());
      case "adjustment-delete":
        return withParsed(validate.parseId(body), ({ id }) => store.deleteAdjustment(db, owner, id) ? ok() : missing());
      case "account-business":
        return withParsed(validate.parseAccountBusiness(body), (value) => store.setAccountBusiness(db, owner, value) ? ok() : bad("Conta indisponível.", 404));
      default:
        return bad("Ação inválida.");
    }
  } catch (error) {
    if (error instanceof store.PlanError) return bad(error.message, error.status);
    throw error;
  }
}
