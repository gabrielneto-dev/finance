import assert from 'node:assert/strict';
import test from 'node:test';
import {
  minorUnits, openTestDatabase, parsePayload, publish, readImport,
} from './contract.mts';

const date = '2026-11-08T00:00:00.000Z';
const accountPage = {
  totalPages: 1,
  results: [
    { id: 'card', itemId: 'item', type: 'CREDIT', currencyCode: 'BRL', balance: 42.90 },
    { id: 'bank', itemId: 'item', type: 'BANK', currencyCode: 'BRL', balance: -18.05 },
  ],
};

function fixture(purchaseStatus = 'PENDING') {
  const pages = new Map([
    ['/accounts?itemId=item', accountPage],
    ['/v2/transactions?accountId=card', {
      results: [
        { id: 'purchase', accountId: 'card', type: 'DEBIT', status: purchaseStatus, amount: 42.90, currencyCode: 'BRL', date },
        { id: 'purchase-usd', accountId: 'card', type: 'DEBIT', status: 'POSTED', amount: 10.01, currencyCode: 'USD', date },
      ],
      next: '?accountId=card&after=opaque%3D',
    }],
    ['/v2/transactions?accountId=card&after=opaque%3D', {
      results: [
        { id: 'payment', accountId: 'card', type: 'CREDIT', status: 'POSTED', amount: -42.90, currencyCode: 'BRL', date },
      ],
      next: null,
    }],
    ['/v2/transactions?accountId=bank', { results: [], next: null }],
  ]);

  return async (path: string) => {
    assert.ok(pages.has(path), 'Rota ou cursor inesperado');
    return parsePayload(JSON.stringify(pages.get(path)));
  };
}

test('converte valores sem arredondar nem perder precisão do JSON', () => {
  assert.equal(minorUnits('42.90', 'BRL'), 4290);
  assert.equal(minorUnits('-1.805e1', 'BRL'), -1805);
  assert.equal(minorUnits('300', 'JPY'), 300);
  assert.throws(() => minorUnits('1.1', 'JPY'), /precisão/);
  assert.throws(() => minorUnits('90071992547409.92', 'BRL'), /intervalo/);
  assert.throws(() => minorUnits('10.00', 'ZZZ'), /moeda/);

  const payload = parsePayload('{"amount":0.10000000000000001}') as { amount: string };
  assert.throws(() => minorUnits(payload.amount, 'BRL'), /precisão/);
});

test('pagina, reimporta, preserva datas e separa moeda e status', async () => {
  using db = openTestDatabase();
  const batch = await readImport(fixture(), 'item');
  assert.equal(batch.pages, 3);
  publish(db, batch);
  publish(db, batch);

  const totals = db.prepare(`
    SELECT currency, direction, SUM(amount_minor) AS amount
    FROM transactions WHERE account_id = 'card' AND status = 'POSTED'
    GROUP BY currency, direction ORDER BY currency, direction
  `);
  assert.deepEqual(totals.all().map((row) => Object.values(row)), [
    ['BRL', 'CREDIT', 4290], ['USD', 'DEBIT', 1001],
  ]);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM transactions').get()?.count, 3);
  assert.equal(db.prepare("SELECT date FROM transactions WHERE id='purchase'").get()?.date, date);
  assert.equal(db.prepare("SELECT balance_minor FROM accounts WHERE id='bank'").get()?.balance_minor, -1805);

  publish(db, await readImport(fixture('POSTED'), 'item'));
  assert.deepEqual(totals.all().map((row) => Object.values(row)), [
    ['BRL', 'CREDIT', 4290], ['BRL', 'DEBIT', 4290], ['USD', 'DEBIT', 1001],
  ]);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM transactions').get()?.count, 3);
});

test('recusa cursor externo, fora da conta ou repetido', async () => {
  const request = fixture();
  for (const next of [
    'https://outside.invalid/?accountId=card',
    '?accountId=bank&after=x',
    '?accountId=card',
  ]) {
    await assert.rejects(readImport(async (path) =>
      path === '/v2/transactions?accountId=card'
        ? { results: [], next }
        : request(path), 'item'), /Cursor inválido/);
  }
});

test('rejeita conta e transação fora do escopo solicitado', async () => {
  const request = fixture();
  await assert.rejects(readImport(async () => ({
    totalPages: 1, results: [{ ...accountPage.results[0], itemId: 'other' }],
  }), 'item'), /Conta de outro Item/);

  await assert.rejects(readImport(async (path) =>
    path === '/v2/transactions?accountId=card'
      ? { results: [{ accountId: 'bank' }], next: null }
      : request(path), 'item'), /Transação de outra conta/);
});

test('reverte o lote inteiro quando a gravação falha', async () => {
  using db = openTestDatabase();
  const batch = await readImport(fixture(), 'item');
  publish(db, batch);
  const updated = await readImport(fixture('POSTED'), 'item');
  updated.transactions.push({ ...updated.transactions[0], accountId: 'unknown' });

  assert.throws(() => publish(db, updated), /FOREIGN KEY/);
  assert.equal(db.prepare("SELECT status FROM transactions WHERE id='purchase'").get()?.status, 'PENDING');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM transactions').get()?.count, 3);
});
