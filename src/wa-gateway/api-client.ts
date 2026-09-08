const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.API_KEY ?? "";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": API_KEY,
      ...init?.headers,
    },
  });
  const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  return { ok: response.ok, status: response.status, data };
}

export interface CreateTransactionPayload {
  description: string;
  amountCents: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  date?: string;
  accountHint?: string;
  cardHint?: string;
  categoryHint?: string;
  installments?: number;
  origin?: "WHATSAPP";
  status?: "PENDING" | "CONFIRMED";
  sourceMessageId?: string;
}

export function createTransaction(payload: CreateTransactionPayload) {
  return request<{ id: string } & Record<string, unknown>>("/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLastTransaction() {
  return request<{ id: string } & Record<string, unknown>>("/transactions/last");
}

export function confirmLastTransaction() {
  return request<{ id: string } & Record<string, unknown>>("/transactions/last/confirm", {
    method: "POST",
  });
}

export function deleteTransaction(id: string) {
  return request<undefined>(`/transactions/${id}`, { method: "DELETE" });
}

export function updateTransaction(id: string, patch: Record<string, unknown>) {
  return request<{ id: string } & Record<string, unknown>>(`/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getAccountBalance(accountId: string) {
  return request<{ accountId: string; balanceCents: number }>(`/accounts/${accountId}/balance`);
}

export function listAccounts() {
  return request<Array<{ id: string; name: string; aliases: string[] }>>("/accounts");
}
