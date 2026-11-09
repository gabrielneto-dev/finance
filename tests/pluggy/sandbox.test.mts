import { openSync, closeSync, fstatSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { object, openTestDatabase, parsePayload, publish, readImport, string } from './contract.mts';

function readConfig(path: string) {
  let body: unknown;
  try {
    const file = openSync(path, 'r');
    try {
      const stat = fstatSync(file);
      if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 8192) {
        throw new Error('Configuração inválida');
      }
      body = JSON.parse(readFileSync(file, 'utf8'));
    } finally {
      closeSync(file);
    }
  } catch {
    throw new Error('Não foi possível ler a configuração privada do sandbox. Use um arquivo com modo 0400 ou 0600.');
  }

  return object(body, 'Configuração');
}

function sandboxCredentials(config: Record<string, unknown>) {
  const itemId = string(config.itemId, 'itemId');
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(itemId)) {
    throw new Error('itemId deve ser um UUID de um Item Sandbox existente');
  }
  return {
    itemId,
    clientId: string(config.clientId, 'clientId'),
    clientSecret: string(config.clientSecret, 'clientSecret'),
  };
}

const configPath = process.env.PLUGGY_SANDBOX_CONFIG;
const envConfig = {
  clientId: process.env.PLUGGY_CLIENT_ID,
  clientSecret: process.env.PLUGGY_CLIENT_SECRET,
  itemId: process.env.PLUGGY_SANDBOX_ITEM_ID,
};
const configured = Boolean(configPath) || Object.values(envConfig).some((value) => value !== undefined);

test('Pluggy Sandbox: valida Connect Token, leitura e reimportação em SQLite', {
  skip: !configured && 'Credenciais ou Item do sandbox ainda não configurados',
  timeout: 90_000,
}, async (context) => {
  const { itemId, clientId, clientSecret } = sandboxCredentials(configPath ? readConfig(configPath) : envConfig);

  const safeRoute = (path: string) => path.split('?')[0].replace(/\/items\/.+/, '/items/{id}');
  async function send(path: string, init: RequestInit) {
    try {
      return await fetch(`https://api.pluggy.ai${path}`, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.any([context.signal, AbortSignal.timeout(15_000)]),
      });
    } catch {
      throw new Error(`Falha de transporte em ${safeRoute(path)}`);
    }
  }

  async function api(path: string, init: RequestInit = {}) {
    const response = await send(path, init);
    const route = safeRoute(path);
    if (!response.ok) throw new Error(`Pluggy HTTP ${response.status} em ${route}`);
    try {
      return parsePayload(await response.text());
    } catch {
      throw new Error(`Resposta inválida em ${route}`);
    }
  }

  const auth = object(await api('/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  }), 'Autenticação');
  const apiKey = string(auth.apiKey, 'apiKey');
  const request = (path: string) => api(path, { headers: { 'X-API-KEY': apiKey } });
  const item = object(await request(`/items/${itemId}`), 'Item');
  if (item.id !== itemId || object(item.connector, 'Conector').isSandbox !== true) {
    throw new Error('Item não confirmado como Sandbox. Leitura financeira interrompida.');
  }
  if (item.status !== 'UPDATED' || item.executionStatus !== 'SUCCESS') {
    throw new Error('Use um Item Sandbox com sincronização concluída com sucesso');
  }

  const batch = await readImport(request, itemId);
  if (batch.accounts.length === 0 || batch.transactions.length === 0) {
    throw new Error('A amostra Sandbox precisa conter contas e transações');
  }

  const token = object(await api('/connect_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ itemId, options: { oauthRedirectUri: 'finance-sandbox://pluggy/callback' } }),
  }), 'Connect Token');
  const widgetHeaders = { 'X-API-KEY': string(token.accessToken, 'accessToken') };
  const scopedItem = object(await api(`/items/${itemId}`, { headers: widgetHeaders }), 'Item do token');
  if (scopedItem.id !== itemId) throw new Error('Connect Token retornou um Item inesperado');
  const accountQuery = new URLSearchParams({ accountId: batch.accounts[0].id });
  const restricted = await send(`/v2/transactions?${accountQuery}`, { headers: widgetHeaders });
  if (restricted.status !== 403) throw new Error('A consulta de transações com Connect Token deveria retornar HTTP 403');
  await restricted.body?.cancel();
  context.diagnostic('Connect Token emitido com deep link; leitura do Item permitida e transações bloqueadas.');

  using db = openTestDatabase();
  const counts = db.prepare(`
    SELECT (SELECT COUNT(*) FROM accounts) AS accounts,
           (SELECT COUNT(*) FROM transactions) AS transactions
  `);
  publish(db, batch);
  const first = counts.get();
  publish(db, batch);
  const second = counts.get();
  const uniqueTransactions = new Set(batch.transactions.map(({ accountId, id }) => JSON.stringify([accountId, id]))).size;
  if (first?.accounts !== batch.accounts.length || first.transactions !== uniqueTransactions
      || second?.accounts !== first.accounts || second.transactions !== first.transactions) {
    throw new Error('Contagem inesperada após reimportação');
  }

  context.diagnostic(`Contas: ${first.accounts}, transações: ${first.transactions}, páginas: ${batch.pages}.`);
  if (batch.pages === batch.accounts.length) {
    context.diagnostic('Uma página por conta nesta amostra. Continuação validada apenas no teste local.');
  }
});
