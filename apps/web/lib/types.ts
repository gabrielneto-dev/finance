export type Account = {
  id: string; itemId: string; name: string; type: "BANK" | "CREDIT"; subtype?: string;
  last4: string | null; currency: string; balance: number | null; closes: string | null; due: string | null;
  bank?: {
    closingBalance: number | null; investedBalance: number | null; overdraftLimit: number | null;
    overdraftUsed: number | null; unarrangedOverdraft: number | null;
  } | null;
  credit?: {
    brand: string | null; level: string | null; status: string | null; holderType: string | null;
    limit: number | null; availableLimit: number | null; minimumPayment: number | null; foreignBalance: number | null;
  } | null;
};
export type Entry = {
  id: string; itemId: string; accountId: string; description: string;
  date: string; time: string | null; status: "POSTED" | "PENDING";
  direction: "CREDIT" | "DEBIT"; amount: number; currency: string; method: string | null; category: string | null;
  billId: string | null; installment: number | null; installments: number | null;
  accountAmount?: number | null; accountCurrency?: string | null; purchaseDate?: string | null;
  choice?: { value: string; source: "lancamento" | "estabelecimento" } | null;
};
export type Bill = {
  id: string; itemId: string; accountId: string; closes: string | null; due: string | null; currency: string; amount: number;
  minimumPayment?: number | null; allowsInstallments?: boolean | null;
};
export type Notice = { id: number; date: string; read: boolean; method: string; direction: Entry["direction"]; amount: number; currency: string };
export type Connection = {
  id: string; name: string; label?: string | null; status: string; syncedAt: string | null; active: number;
  webhookEvent?: string | null; webhookReceivedAt?: string | null;
  webhookStatus?: "queued" | "retry" | "processed" | "ignored" | null;
  details?: {
    products: string[] | null; connectorProducts: string[] | null;
    createdAt: string | null; consentExpiresAt: string | null; nextAutoSyncAt: string | null;
    lastUpdatedAt?: string | null;
  } | null;
};
export type Installment = {
  id: string; itemId: string; accountId: string; description: string;
  installment: number; installments: number; month: string; amount: number; currency: string; estimated: boolean;
  billId: string | null;
};
export type CardCycle = {
  itemId: string; accountId: string; nextClosing: string | null; lastClosing: string | null;
  source: "card" | "bill" | "history" | "transactions" | null;
};
type Totals = { amount: number; currency: string }[];
export type OpenBill = {
  itemId: string; accountId: string; month: string; closes: string | null; due: string | null;
  purchases: Totals; imported: Totals; estimated: Totals; total: Totals; count: number;
  entries: Entry[]; forecast: Installment[];
};
export type DashboardData = {
  accounts: Account[]; entries: Entry[]; bills: Bill[]; connections: Connection[];
  notifications: Notice[]; unread: number; installments?: Installment[];
  billPurchases?: { id: string; entries: Entry[] };
  cardCycles?: CardCycle[];
  openBills?: OpenBill[];
};
