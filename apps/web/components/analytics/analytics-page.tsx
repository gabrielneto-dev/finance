"use client";

import "@/app/analytics.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { HIDDEN_VALUES_KEY, HiddenValues } from "@/components/hidden-values";
import { CategoryEditing, type CategoryScope } from "@/components/category-picker";
import { PeriodBar, SECTIONS, type AnalyticsSection, type PeriodState } from "@/components/analytics/period-bar";
import { DetailSheet, type DetailSpec } from "@/components/analytics/detail-sheet";
import { SummarySection } from "@/components/analytics/summary";
import { CashflowSection } from "@/components/analytics/cashflow";
import { CategoriesSection } from "@/components/analytics/categories";
import { BillsSection } from "@/components/analytics/bills";
import { InstitutionsSection } from "@/components/analytics/institutions";
import { HabitsSection } from "@/components/analytics/habits";
import { resolvePeriod } from "@/lib/analytics/periods.mjs";
import { today } from "@/lib/format";
import type { AnalyticsData, AnalyticsEntry } from "@/lib/analytics/types";
import type { Entry } from "@/lib/types";

export type SectionProps = {
  data: AnalyticsData; compare: boolean;
  openDetail: (spec: DetailSpec) => void;
  go: (section: AnalyticsSection, focus?: string) => void;
  focus?: string;
};

const PERIOD_LABEL = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const periodLabel = (from: string, to: string) =>
  PERIOD_LABEL.format(new Date(from + "T12:00:00Z")) + " – " + PERIOD_LABEL.format(new Date(to + "T12:00:00Z"));

function toUrl(section: AnalyticsSection, period: PeriodState) {
  const query = new URLSearchParams({ secao: section, periodo: period.preset });
  if (period.preset === "custom") { query.set("de", period.from); query.set("ate", period.to); }
  if (period.account) query.set("conta", period.account);
  if (!period.compare) query.set("comparar", "0");
  return "/analises?" + query;
}

export function AnalyticsPage({ initialSection, initialPeriod }: { initialSection: AnalyticsSection; initialPeriod: PeriodState }) {
  const [section, setSection] = useState(initialSection);
  const [period, setPeriod] = useState(initialPeriod);
  const [focus, setFocus] = useState<string>();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [detail, setDetail] = useState<DetailSpec | null>(null);
  const version = useRef(0);
  const main = useRef<HTMLElement>(null);
  const range = useMemo(() => resolvePeriod(period.preset, today(), period), [period]);

  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ from: range.from, to: range.to });
    if (range.compareFrom && range.compareTo) { query.set("cfrom", range.compareFrom); query.set("cto", range.compareTo); }
    if (period.account) query.set("account", period.account);
    try {
      const response = await fetch("/api/analytics?" + query, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/login"; return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar as análises.");
      if (current === version.current) setData(body);
    } catch (reason) {
      if (current === version.current) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as análises.");
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [range, period.account]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    try { setHidden(localStorage.getItem(HIDDEN_VALUES_KEY) === "1"); } catch { /* armazenamento indisponível */ }
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      const next = SECTIONS.find(([id]) => id === query.get("secao"))?.[0];
      if (next) setSection(next);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function toggleHidden() {
    setHidden((value) => {
      try { localStorage.setItem(HIDDEN_VALUES_KEY, value ? "0" : "1"); } catch { /* armazenamento indisponível */ }
      return !value;
    });
  }
  function changePeriod(next: PeriodState) {
    setPeriod(next);
    window.history.replaceState(null, "", toUrl(section, next));
  }
  const go = useCallback((next: AnalyticsSection, target?: string) => {
    setSection(next);
    setFocus(target);
    window.history.pushState(null, "", toUrl(next, period));
    main.current?.scrollTo({ top: 0 });
  }, [period]);

  const editing = useMemo(() => ({
    analyze: (row: Entry) => (row as AnalyticsEntry).info,
    save: async (row: Entry, category: string | null, scope: CategoryScope) => {
      const response = await fetch("/api/connections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: scope === "entry" ? "categorize" : "categorize-rule", itemId: row.itemId,
          accountId: row.accountId, entryId: row.id, category: category ?? "" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar a categoria.");
      await load();
    },
  }), [load]);

  const props: SectionProps | null = data ? { data, compare: period.compare, openDetail: setDetail, go, focus } : null;
  const title = SECTIONS.find(([id]) => id === section)?.[1] ?? "Resumo";

  return <HiddenValues.Provider value={hidden}><CategoryEditing.Provider value={editing}><div className="shell analytics">
    <AppSidebar current="analises" />
    <div className="workspace">
      <header className="topbar"><div className="topbar-label"><span>Análises financeiras</span></div>
        <div className="top-actions">
          <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Recarregar análises" title="Recarregar análises"><RefreshCw /></Button>
          <Button variant="outline" size="icon" aria-pressed={hidden} onClick={toggleHidden}
            aria-label={hidden ? "Mostrar saldos e faturas" : "Ocultar saldos e faturas"}
            title={hidden ? "Mostrar saldos e faturas" : "Ocultar saldos e faturas"}>{hidden ? <EyeOff /> : <Eye />}</Button>
        </div>
      </header>
      <main className="analytics-main" ref={main}><div className="content">
        <div className="an-head">
          <div className="an-title">
            <div><span className="eyebrow">ANÁLISES</span><h1>{title}</h1></div>
            <span className="an-period-label" aria-live="polite">{periodLabel(range.from, range.to)}
              {period.compare && data && " · comparado a " + periodLabel(data.period.previousFrom, data.period.previousTo)}</span>
          </div>
          <PeriodBar section={section} onSection={(next) => go(next)} period={period} onPeriod={changePeriod}
            accounts={data?.accounts ?? []} />
        </div>
        {error && <p className="feedback error" role="alert">{error}</p>}
        {!data && loading && <p className="text-sm text-muted-foreground" role="status">Carregando análises…</p>}
        {props && <div aria-busy={loading}>
          {section === "resumo" && <SummarySection {...props} />}
          {section === "fluxo" && <CashflowSection {...props} />}
          {section === "categorias" && <CategoriesSection {...props} />}
          {section === "faturas" && <BillsSection {...props} />}
          {section === "instituicoes" && <InstitutionsSection {...props} />}
          {section === "habitos" && <HabitsSection {...props} />}
        </div>}
      </div></main>
    </div>
    <DetailSheet spec={detail} entries={data?.entries ?? []} accounts={data?.accounts ?? []} onClose={() => setDetail(null)} />
  </div></CategoryEditing.Provider></HiddenValues.Provider>;
}
