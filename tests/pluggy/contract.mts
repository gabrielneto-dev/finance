import { DatabaseSync } from 'node:sqlite';

type JsonObject = Record<string, unknown>;
export type Request = (path: string) => Promise<unknown>;

export function object(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: objeto inválido`);
  }
  return value as JsonObject;
}

export function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field}: texto ausente ou inválido`);
  }
  return value;
}

export function parsePayload(text: string): unknown {
  return JSON.parse(text, (key, value, context) => {
    if ((key === 'amount' || key === 'balance') && typeof value === 'number') {
      return context.source;
    }
    return value;
  });
}

const currencies = new Set(Intl.supportedValuesOf('currency'));

export function minorUnits(value: unknown, currency: string): number {
  const decimal = typeof value === 'string'
    ? /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value)
    : null;
  if (!decimal || !currencies.has(currency)) {
    throw new Error('Valor decimal ou moeda inválida');
  }

  const [, sign, integer, fraction = '', exponent = '0'] = decimal;
  const scale = new Intl.NumberFormat('en', { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits;
  const shift = Number(exponent) + scale - fraction.length;
  const digits = (integer + fraction).replace(/^0+/, '');
  if (!digits) return 0;
  if (!Number.isSafeInteger(shift) || digits.length + shift > 16) {
    throw new Error('Valor fora do intervalo seguro');
  }
  if (shift < 0 && (digits.length + shift <= 0 || /[^0]/.test(digits.slice(shift)))) {
    throw new Error('Valor excede a precisão da moeda');
  }

  const normalized = shift < 0 ? digits.slice(0, shift) : digits + '0'.repeat(shift);
  const result = Number(sign + normalized);
  if (!Number.isSafeInteger(result)) throw new Error('Valor fora do intervalo seguro');
  return result;
}

function results(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Resposta sem lista results');
  return value;
}

function normalizeTransaction(value: unknown, accountId: string) {
  const row = object(value, 'Transação');
  if (row.accountId !== accountId) throw new Error('Transação de outra conta');
  const direction = row.type;
  const status = row.status;
  if (direction !== 'DEBIT' && direction !== 'CREDIT') throw new Error('Direção desconhecida');
  if (status !== 'PENDING' && status !== 'POSTED') throw new Error('Status desconhecido');
  const currency = string(row.currencyCode, 'Moeda da transação');
  const date = string(row.date, 'Data da transação');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date))) {
    throw new Error('Data da transação inválida');
  }

  return {
    id: string(row.id, 'ID da transação'),
    accountId,
    amountMinor: Math.abs(minorUnits(row.amount, currency)),
    currency,
    direction,
    status,
    date,
  };
}

export async function readImport(request: Request, itemId: string) {
  const accountQuery = new URLSearchParams({ itemId });
  const accountPage = object(await request(`/accounts?${accountQuery}`), 'Contas');
  if (!Number.isSafeInteger(accountPage.totalPages) || Number(accountPage.totalPages) > 1) {
    throw new Error('A prova espera uma única página de contas');
  }
  const accounts = results(accountPage.results).map((value) => {
    const row = object(value, 'Conta');
    if (row.itemId !== itemId) throw new Error('Conta de outro Item');
    if (row.type !== 'BANK' && row.type !== 'CREDIT') throw new Error('Tipo de conta desconhecido');
    const currency = string(row.currencyCode, 'Moeda da conta');

    return {
      id: string(row.id, 'ID da conta'),
      type: row.type,
      currency,
      balanceMinor: row.balance == null ? null : minorUnits(row.balance, currency),
    };
  });

  let pages = 0;
  const transactions: ReturnType<typeof normalizeTransaction>[] = [];
  for (const { id: accountId } of accounts) {
    const query = new URLSearchParams({ accountId });
    let next: string | null = `?${query}`;
    const seen = new Set<string>();
    while (next !== null) {
      const params = new URLSearchParams(next);
      if (!next.startsWith('?') || params.getAll('accountId').length !== 1
          || params.get('accountId') !== accountId || seen.has(next)) {
        throw new Error('Cursor inválido, repetido ou fora da conta esperada');
      }
      seen.add(next);

      const page = object(await request(`/v2/transactions${next}`), 'Página de transações');
      for (const row of results(page.results)) transactions.push(normalizeTransaction(row, accountId));
      pages++;
      next = page.next === null ? null : string(page.next, 'Cursor next');
    }
  }

  return { accounts, transactions, pages };
}

type Batch = Awaited<ReturnType<typeof readImport>>;

export function openTestDatabase() {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, currency TEXT NOT NULL, balance_minor INTEGER
    ) STRICT;
    CREATE TABLE transactions (
      account_id TEXT NOT NULL REFERENCES accounts(id),
      id TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      currency TEXT NOT NULL, direction TEXT NOT NULL, status TEXT NOT NULL, date TEXT NOT NULL,
      PRIMARY KEY (account_id, id)
    ) STRICT;
  `);
  return db;
}

export function publish(db: DatabaseSync, batch: Batch) {
  const account = db.prepare(`
    INSERT INTO accounts VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE
    SET type=excluded.type, currency=excluded.currency, balance_minor=excluded.balance_minor
  `);
  const transaction = db.prepare(`
    INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, id) DO UPDATE
    SET amount_minor=excluded.amount_minor, currency=excluded.currency,
        direction=excluded.direction, status=excluded.status, date=excluded.date
  `);
  db.exec('BEGIN');
  try {
    for (const row of batch.accounts) account.run(row.id, row.type, row.currency, row.balanceMinor);
    for (const row of batch.transactions) {
      transaction.run(row.accountId, row.id, row.amountMinor, row.currency, row.direction, row.status, row.date);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
