// Formato da resposta de GET /api/analytics, montada em lib/analytics/index.mjs (SPEC-0003).
import type { Classified } from "./classify.mjs";
import type { Entry } from "../types";

export type Totals = {
  income: number; yield: number; expense: number; refunds: number; pending: number; result: number;
  savingsRate: number | null; dailyAverage: number; purchases: number;
  neutral: Record<"pagamento_fatura" | "transferencia_propria" | "investimento" | "emprestimo" | "ignorado", number>;
  /** Negócio separado das finanças pessoais (SPEC-0004, REQ-001). */
  business: { revenue: number; costs: number; profit: number; withdrawals: number };
};
export type Ranked = { label: string; amount: number };
export type GroupRow = {
  id: string; label: string; nature: "essencial" | "estilo" | null; amount: number; previous: number; share: number;
  count: number; spark: number[];
  categories: { id: string; label: string; amount: number; count: number; previous: number; average: number }[];
};
export type BillParts = { avista: number; parcelas: number; iof: number; exterior: number; estornos: number; byGroup: Record<string, number> };
export type CardSummary = {
  key: string; name: string; last4: string | null; limit: number | null; available: number | null;
  bills: ({ id: string; due: string; closes: string | null; amount: number; minimumPayment: number | null } & BillParts)[];
  open: ({ due: string | null; closes: string | null; amount: number | null; count: number; estimated: number } & BillParts) | null;
  average: number | null; usage: number | null;
  future: { month: string; imported: number; estimated: number }[];
};
export type Insight = { id: string; tone: "up" | "down" | "neutral"; text: string; impact: number; target: { section: string; group?: string } };
export type AnalyticsEntry = Entry & { info: Classified; merchant: string };

export type AnalyticsData = {
  period: { from: string; to: string; previousFrom: string; previousTo: string; days: number; reference: string };
  accounts: { key: string; itemId: string; id: string; name: string; type: "BANK" | "CREDIT"; last4: string | null;
    currency: string; balance: number | null; limit: number | null; available: number | null; business: boolean }[];
  connections: { id: string; name: string }[];
  totals: { current: Totals; previous: Totals };
  monthly: { month: string; income: number; expense: number; business: number; result: number }[];
  monthlyByGroup: { month: string; values: Record<string, number> }[];
  pace: {
    month: string; days: { day: number; current: number | null; previous: number; average: number }[];
    elapsed: number; spent: number; isCurrent: boolean; projection: number | null; averageTotal: number;
  };
  groups: GroupRow[];
  natures: { essencial: number; estilo: number; indefinido: number };
  fixedVariable: { fixed: number; variable: number };
  incomeSources: Ranked[];
  methods: Ranked[];
  daily: { date: string; amount: number }[];
  balances: { key: string; name: string; points: { date: string; balance: number }[] }[];
  institutions: {
    id: string; name: string; inflow: number; outflow: number; income: number; expense: number; count: number; share: number;
    monthly: { month: string; amount: number }[]; methods: Ranked[];
    accounts: { key: string; name: string; type: string; last4: string | null; inflow: number; outflow: number; expense: number; count: number }[];
  }[];
  merchants: { key: string; label: string; group: string; amount: number; count: number; previous: number; average: number; previousRank: number | null }[];
  recurring: { key: string; label: string; group: string; category: string; typical: number; monthly: number; annual: number;
    lastDate: string; lastAmount: number; count: number; isNew: boolean; priceChanged: boolean }[];
  weekdays: { weekday: number; band: string; amount: number; count: number }[];
  small: { threshold: number; count: number; amount: number; top: { label: string; count: number; amount: number }[] };
  cards: CardSummary[];
  commitment: { month: string; amount: number; averageIncome: number; share: number | null };
  insights: Insight[];
  entries: AnalyticsEntry[];
  foreignExcluded: number;
};
