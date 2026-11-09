import { createHash, timingSafeEqual } from "node:crypto";
import { eventTypes, uuid } from "./config.mjs";

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export function checkWebhookSecret(provided, expected) {
  return Boolean(provided && expected && timingSafeEqual(digest(provided), digest(expected)));
}

export function parseWebhook(body, clientId) {
  if (!body || typeof body !== "object" || (body.clientId != null && body.clientId !== clientId)) {
    throw new Error("Aplicação inválida");
  }
  if (!eventTypes.includes(body.event)) return null;
  if (typeof body.eventId !== "string" || !uuid.test(body.eventId) ||
      typeof body.itemId !== "string" || !uuid.test(body.itemId)) throw new Error("Evento inválido");

  const data = {};
  if (body.event.startsWith("transactions/")) {
    if (typeof body.accountId !== "string" || !uuid.test(body.accountId)) throw new Error("Conta inválida");
    data.accountId = body.accountId;
    if (body.event === "transactions/created") {
      let cutoff = body.transactionsCreatedAtFrom;
      if (!cutoff && (body.createdTransactionsLinkV2 || body.createdTransactionsLink)) {
        const url = new URL(body.createdTransactionsLinkV2 || body.createdTransactionsLink);
        if (url.origin !== "https://api.pluggy.ai" || !["/v2/transactions", "/transactions"].includes(url.pathname) ||
            url.searchParams.get("accountId") !== body.accountId) throw new Error("Link de transações inválido");
        cutoff = url.searchParams.get("createdAtFrom");
      }
      if (typeof cutoff !== "string" || !Number.isFinite(Date.parse(cutoff))) throw new Error("Janela inválida");
      data.createdAtFrom = new Date(cutoff).toISOString();
    } else {
      if (!Array.isArray(body.transactionIds) || body.transactionIds.length < 1 || body.transactionIds.length > 500 ||
          body.transactionIds.some((value) => typeof value !== "string" || !uuid.test(value))) throw new Error("IDs inválidos");
      data.ids = [...new Set(body.transactionIds)];
    }
  }
  return { id: "pluggy:" + body.eventId, itemId: body.itemId, kind: body.event, data };
}
