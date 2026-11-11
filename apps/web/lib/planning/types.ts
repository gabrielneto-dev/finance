// Formato da resposta de GET /api/planning, montada em lib/planning/index.mjs (SPEC-0004).
import type { AnalyticsEntry } from "../analytics/types";

export type BucketStatus = "dentro" | "atencao" | "estourou";
export type BucketRow = {
  id: string; name: string; kind: string; mode: "valor" | "percentual"; amount: number; rollover: boolean; groups: string[]; sort: number;
  adjusted: boolean; base: number; carry: number; planned: number; spent: number; available: number; projected: number;
  expectedToday: number; perDay: number | null; status: BucketStatus; share: number | null; average: number;
};
export type Goal = {
  id: string; name: string; kind: "reserva" | "objetivo" | "independencia"; target: number; months: number | null; deadline: string | null;
  monthly: number; yieldRate: number; source: "manual" | "investimentos" | "conta"; current: number; link: string[] | string | null; priority: number;
  automaticTarget: boolean; reserveMonths: number; remaining: number; progress: number; monthsLeft: number | null; required: number | null;
  eta: number | null; etaMonth: string | null; situation: "concluida" | "sem_aporte" | "sem_prazo" | "atrasada" | "no_prazo"; delay: number;
  covered: number | null;
};
export type Adjustment = {
  id: string; kind: "renda" | "corte" | "evento" | "aporte"; label: string; startMonth: string; endMonth: string | null;
  amount: number | null; percent: number | null; group: string | null; enabled: boolean;
};
export type ProjectionRow = {
  month: string; income: number; outflow: number; installments: number; invested: number; surplus: number;
  cash: number; investments: number; networth: number;
};
export type Investment = {
  id: string; source: "manual" | "pluggy"; name: string; institution: string | null; class: string; liquidity: string; balance: number;
  dueDate: string | null; updatedAt: string; snapshots: { date: string; balance: number }[]; classLabel: string; liquidityLabel: string;
};
export type Trend = {
  id: string; key: string; kind: "subindo" | "acima" | "recorrente"; label: string; groupLabel?: string; group?: string;
  change?: number; months?: number; monthly?: number; bucket?: string; merchant?: string; spark: number[]; latest: number;
};
export type BusinessMonth = {
  month: string; revenue: number; costs: Record<string, number>; cost: number; profit: number; sales: number; withdrawals: number;
  margin: number | null; ticket: number | null;
};
export type PlanningEntry = AnalyticsEntry & { bucket: string | null };

export type PlanningData = {
  month: string; reference: string; horizon: number;
  accounts: { key: string; name: string; type: "BANK" | "CREDIT"; last4: string | null; balance: number | null; business: boolean }[];
  income: {
    month: string; estimated: number; manual: number | null; expected: number; basis: string[];
    parts: { salary: number; other: number; business: number };
    history: { month: string; salary: number; other: number; business: number }[];
  };
  budget: {
    month: string; income: number; buckets: BucketRow[]; unassigned: number; planned: number; spent: number; unallocated: number;
    clock: { days: number; elapsed: number; remaining: number; current: boolean; past: boolean };
  };
  framework: { kind: string; name: string; min: number; max: number; planned: number; spent: number;
    plannedShare: number | null; share: number | null; position: "abaixo" | "dentro" | "acima" | null }[];
  suggestion: { kind: string; name: string; groups: string[]; rollover: boolean; average: number; amount: number; min: number; max: number }[];
  archived: { id: string; name: string; kind: string; mode: "valor" | "percentual"; amount: number; rollover: boolean }[];
  entries: PlanningEntry[];
  goals: Goal[]; essentialAverage: number; annualSpending: number;
  adjustments: Adjustment[];
  projection: { months: string[]; assumedYield: number; base: ProjectionRow[]; adjusted: ProjectionRow[];
    effects: { id: string; delta: number }[]; difference: number };
  trends: Trend[];
  networth: {
    total: number; cash: number; invested: number; cardDebt: number; installmentsDebt: number;
    byClass: { id: string; label: string; amount: number; share: number }[];
    byLiquidity: { id: string; label: string; amount: number; share: number }[];
    contributions: { month: string; amount: number }[]; monthContribution: number; investmentRate: number | null;
    reserveMonths: number | null; liquid: number;
    history: { month: string; accounts: number | null; investments: number; total: number | null }[];
  };
  investments: Investment[];
  business: { hasData: boolean; monthly: BusinessMonth[]; current: BusinessMonth; previous: BusinessMonth | null;
    split: { id: string; actual: number; suggested: number; actualPer100: number; suggestedPer100: number }[] | null;
    splitBasis: "mes" | "tres_meses" };
  foreignExcluded: number;
};
