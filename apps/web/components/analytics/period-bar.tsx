"use client";

import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { PRESETS } from "@/lib/analytics/periods.mjs";
import { today } from "@/lib/format";
import type { AnalyticsData } from "@/lib/analytics/types";

import { SECTIONS, type AnalyticsSection } from "@/lib/analytics/sections";
export { SECTIONS, type AnalyticsSection };
export type PeriodState = { preset: string; from: string; to: string; account: string; compare: boolean };

const ALL = "__all";
const MAX_DAYS = 730;
const shift = (date: string, days: number) => new Date(Date.parse(date + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);

// Subnavegação à esquerda e controles do período à direita, numa só linha (SPEC-0003, REQ-005).
export function PeriodBar({ section, onSection, period, onPeriod, accounts }: {
  section: AnalyticsSection; onSection: (section: AnalyticsSection) => void;
  period: PeriodState; onPeriod: (period: PeriodState) => void; accounts: AnalyticsData["accounts"];
}) {
  const periodId = useId();
  const accountId = useId();
  const current = today();
  const set = (patch: Partial<PeriodState>) => onPeriod({ ...period, ...patch });
  return <div className="an-bar">
    <nav className="an-subnav" aria-label="Páginas das análises">
      {SECTIONS.map(([id, label]) => <a key={id} href={"/analises?secao=" + id} aria-current={section === id ? "page" : undefined}
        onClick={(event) => { event.preventDefault(); onSection(id); }}>{label}</a>)}
    </nav>
    <div className="an-controls">
      <span id={periodId} className="sr-only">Período</span>
      <Select value={period.preset} onValueChange={(preset) => set(preset === "custom" && !period.from
        ? { preset, from: shift(current, -29), to: current } : { preset })}>
        <SelectTrigger aria-labelledby={periodId} className="select-trigger"><SelectValue /></SelectTrigger>
        <SelectContent>{PRESETS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>
      {period.preset === "custom" && <div className="an-custom">
        <DatePicker aria-label="Início do período" value={period.from} today={current} max={period.to || current}
          min={period.to ? shift(period.to, -MAX_DAYS) : undefined} onChange={(from) => set({ from })} />
        <DatePicker aria-label="Fim do período" value={period.to} today={current} min={period.from}
          max={period.from && shift(period.from, MAX_DAYS) < current ? shift(period.from, MAX_DAYS) : current} onChange={(to) => set({ to })} />
      </div>}
      <span id={accountId} className="sr-only">Conta ou cartão</span>
      <Select value={period.account || ALL} onValueChange={(value) => set({ account: value === ALL ? "" : value })}>
        <SelectTrigger aria-labelledby={accountId} className="select-trigger"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as contas e cartões</SelectItem>
          {accounts.map((row) => <SelectItem key={row.key} value={row.key}>{row.name.trim() + (row.last4 ? " · " + row.last4 : "")}</SelectItem>)}
        </SelectContent>
      </Select>
      <button type="button" className="an-compare" aria-pressed={period.compare} onClick={() => set({ compare: !period.compare })}>
        <span aria-hidden="true" />Comparar
      </button>
    </div>
  </div>;
}
