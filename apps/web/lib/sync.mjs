import { bind, connection, complete, enqueue, notifyTransfers, retry, saveConnectionDetails, writeBatch } from "./db.mjs";
import { sandbox, uuid } from "./config.mjs";
import { list, minor, pluggy, PluggyError, transactions } from "./pluggy.mjs";

function optionalMoney(value, currency) {
  if (value == null) return null;
  try { return minor(value, currency); } catch { return null; }
}

function optionalDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value))
    ? value.slice(0, 10) : null;
}

function optionalLabel(value) {
  return typeof value === "string" ? value.trim().slice(0, 100) || null : null;
}

function account(row, itemId) {
  if (!uuid.test(row.id) || row.itemId !== itemId || !["BANK", "CREDIT"].includes(row.type)) throw new Error("Conta inválida");
  const credit = row.type === "CREDIT" ? row.creditData : null;
  const bank = row.type === "BANK" ? row.bankData : null;
  const currency = row.currencyCode;
  const mask = typeof row.number === "string" ? row.number.replace(/\D/g, "").slice(-4) : "";
  return {
    id: row.id, type: row.type, subtype: row.subtype, name: String(row.marketingName || row.name || "Conta").slice(0, 100),
    last4: mask.length === 4 ? mask : null,
    currency, balance: row.balance == null ? null : minor(row.balance, currency),
    closes: optionalDate(credit?.balanceCloseDate), due: optionalDate(credit?.balanceDueDate),
    credit: credit ? {
      brand: optionalLabel(credit.brand === "OTHER" ? credit.brandAdditionalInfo : credit.brand),
      level: optionalLabel(credit.level), status: optionalLabel(credit.status), holderType: optionalLabel(credit.holderType),
      limit: optionalMoney(credit.creditLimit, currency), availableLimit: optionalMoney(credit.availableCreditLimit, currency),
      minimumPayment: optionalMoney(credit.minimumPayment, currency), foreignBalance: optionalMoney(credit.balanceForeignCurrency, "USD"),
    } : null,
    bank: bank ? {
      closingBalance: optionalMoney(bank.closingBalance, currency), investedBalance: optionalMoney(bank.automaticallyInvestedBalance, currency),
      overdraftLimit: optionalMoney(bank.overdraftContractedLimit, currency), overdraftUsed: optionalMoney(bank.overdraftUsedLimit, currency),
      unarrangedOverdraft: optionalMoney(bank.unarrangedOverdraftAmount, currency),
    } : null,
  };
}

async function fetchBills(card) {
  if (card.type !== "CREDIT" || (card.subtype && card.subtype !== "CREDIT_CARD")) return [];
  try {
    return (await list("/bills", { accountId: card.id })).map((bill) => {
      if (!uuid.test(bill.id) || (bill.accountId && bill.accountId !== card.id)) throw new Error("Fatura fora da conta");
      return {
        id: bill.id, accountId: card.id, due: optionalDate(bill.dueDate),
        closes: optionalDate(bill.billClosingDate),
        currency: bill.totalAmountCurrencyCode, amount: minor(bill.totalAmount, bill.totalAmountCurrencyCode),
        minimumPayment: optionalMoney(bill.minimumPaymentAmount, bill.totalAmountCurrencyCode),
        allowsInstallments: typeof bill.allowsInstallments === "boolean" ? bill.allowsInstallments : null,
      };
    });
  } catch (error) {
    if (error instanceof PluggyError && [403, 404].includes(error.status)) return [];
    throw error;
  }
}

async function retrieve(itemId) {
  const item = await pluggy("/items/" + itemId);
  if (item?.id !== itemId || item.connector?.isSandbox !== sandbox()) throw new Error("Item fora do ambiente configurado");
  return item;
}

function setState(db, id, status) {
  db.prepare("UPDATE connections SET status=? WHERE id=? AND active=1").run(status, id);
}

function activeWrite(db, job, fn) {
  complete(db, job, () => { if (connection(db, job.item_id)?.active) fn(); });
}

async function fullSync(db, job, item) {
  const itemId = job.item_id;
  if (item.status !== "UPDATED" || item.executionStatus !== "SUCCESS") {
    const waiting = ["UPDATING", "CREATED", "CREATING", "QUEUED", "LOGIN_IN_PROGRESS"].includes(item.status);
    if (waiting) throw new Error("Importação em processamento");
    const status = item.executionStatus === "PARTIAL_SUCCESS" ? "PARCIAL" :
      ["LOGIN_ERROR", "WAITING_USER_INPUT", "WAITING_USER_ACTION"].includes(item.status) ? "RECONECTAR" : "ATENÇÃO";
    activeWrite(db, job, () => setState(db, itemId, status));
    return;
  }
  const accounts = (await list("/accounts", { itemId })).map((row) => account(row, itemId));
  const entries = [];
  const bills = [];
  for (const row of accounts) {
    entries.push(...await transactions(row.id));
    bills.push(...await fetchBills(row));
  }
  activeWrite(db, job, () => {
    writeBatch(db, itemId, accounts, entries, bills);
    saveConnectionDetails(db, item);
    const now = new Date().toISOString();
    db.prepare("UPDATE connections SET status='CONECTADA',baseline=CASE WHEN synced_at IS NULL THEN ? ELSE baseline END,synced_at=? WHERE id=?")
      .run(now, now, itemId);
  });
}

export async function runJob(db, job) {
  const itemId = job.item_id;
  const linked = connection(db, itemId);
  if (job.kind === "disconnect") {
    if (!linked || linked.active) return complete(db, job);
    try { await retrieve(itemId); await pluggy("/items/" + itemId, "DELETE"); }
    catch (error) { if (!(error instanceof PluggyError && error.status === 404)) throw error; }
    return complete(db, job, () => { db.prepare("DELETE FROM connections WHERE id=? AND active=0").run(itemId); });
  }

  if (job.kind === "item/deleted") {
    return complete(db, job, () => { db.prepare("DELETE FROM connections WHERE id=?").run(itemId); });
  }

  if (!linked) {
    if (!["item/created", "item/updated"].includes(job.kind)) {
      if (job.kind.startsWith("transactions/") && job.tries <= 7) throw new Error("Vínculo ainda não importado");
      return complete(db, job);
    }
    const item = await retrieve(itemId);
    const intent = db.prepare("SELECT owner FROM intents WHERE id=? AND expires>=?").get(item.clientUserId ?? "", Date.now());
    return complete(db, job, () => { if (intent) bind(db, item, intent.owner, item.clientUserId); });
  }
  if (!linked.active) return complete(db, job, undefined, 2);

  if (job.kind === "refresh") {
    await retrieve(itemId);
    try {
      await pluggy("/items/" + itemId, "PATCH", {});
    } catch (error) {
      // Conexões MeuPluggy recusam atualização manual; reimporta o que a Pluggy já sincronizou.
      if (!(error instanceof PluggyError && error.status === 400)) throw error;
    }
    return activeWrite(db, job, () => {
      setState(db, itemId, "IMPORTANDO");
      enqueue(db, { itemId, kind: "initial", delay: 3000 });
    });
  }

  if (job.kind.startsWith("transactions/")) {
    if (!linked.synced_at) {
      if (job.tries <= 12) throw new Error("Importação inicial pendente");
      return complete(db, job, undefined, 2);
    }
    const { accountId, createdAtFrom, ids } = job.data;
    if (!db.prepare("SELECT 1 FROM accounts WHERE item_id=? AND id=?").get(itemId, accountId)) {
      if (job.tries <= 12) throw new Error("Conta ainda não importada");
      return complete(db, job, undefined, 2);
    }
    if (job.kind === "transactions/deleted") {
      return activeWrite(db, job, () => {
        const remove = db.prepare("DELETE FROM entries WHERE item_id=? AND account_id=? AND id=?");
        const removeNotice = db.prepare("DELETE FROM notices WHERE item_id=? AND account_id=? AND entry_id=?");
        for (const id of ids) { remove.run(itemId, accountId, id); removeNotice.run(itemId, accountId, id); }
      });
    }
    const entries = await transactions(accountId, job.kind === "transactions/created"
      ? { createdAtFrom } : { ids: ids.join(",") });
    return activeWrite(db, job, () => {
      writeBatch(db, itemId, [], entries, []);
      notifyTransfers(db, itemId, entries);
    });
  }

  const item = await retrieve(itemId);
  if (["item/error", "item/waiting_user_input", "item/waiting_user_action"].includes(job.kind)) {
    return activeWrite(db, job, () => {
      if (item.status === "UPDATED" && item.executionStatus === "SUCCESS") return;
      setState(db, itemId, item.executionStatus === "PARTIAL_SUCCESS" ? "PARCIAL" :
        item.status === "OUTDATED" ? "ATENÇÃO" : "RECONECTAR");
    });
  }
  return fullSync(db, job, item);
}

const TRANSIENT_STATUSES = new Set([401, 408, 425, 429]);

// Erros 4xx da Pluggy não se resolvem com novas tentativas.
function isPermanent(error) {
  return error instanceof PluggyError && error.status >= 400 && error.status < 500 && !TRANSIENT_STATUSES.has(error.status);
}

export async function processJob(db, job, logger = console) {
  try {
    await runJob(db, job);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (isPermanent(error)) {
      complete(db, job, undefined, 2);
      logger.error("Tarefa Pluggy encerrada: %s (%s)", job.kind, reason);
      return;
    }
    retry(db, job);
    logger.warn("Tarefa Pluggy adiada: %s (tentativa %d, %s)", job.kind, job.tries, reason);
  }
}
