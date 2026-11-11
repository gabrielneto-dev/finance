"use client";

import "@/app/analytics.css";
import "@/app/planning.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { HIDDEN_VALUES_KEY, HiddenValues } from "@/components/hidden-values";
import { CategoryEditing, type CategoryScope } from "@/components/category-picker";
import { DetailSheet, type DetailSpec } from "@/components/analytics/detail-sheet";
import { brl, monthLong } from "@/components/analytics/kit";
import { today } from "@/lib/format";
import { HORIZONS, SECTIONS, type PlanningSection } from "@/lib/planning/sections";
import type { PlanningData } from "@/lib/planning/types";
import type { AnalyticsData, AnalyticsEntry } from "@/lib/analytics/types";
import type { Entry } from "@/lib/types";
import { EditorSheet, type EditorState } from "./editors";
import { MonthSection } from "./month";
import { BucketsSection } from "./buckets";
import { GoalsSection } from "./goals";
import { ProjectionsSection } from "./projections";
import { NetworthSection } from "./networth";
import { BusinessSection } from "./business";

export const MASK = "R$ ••••••";

export type PlanningProps = {
  data: PlanningData; hidden: boolean;
  /** Valor em reais que segue o botão de ocultar. */
  secret: (cents: number) => string;
  act: (body: Record<string, unknown>) => Promise<void>;
  edit: (editor: EditorState) => void;
  openDetail: (spec: DetailSpec) => void;
  go: (section: PlanningSection) => void;
};

const shiftMonth = (month: string, delta: number) => {
  const [year, value] = month.split("-").map(Number);
  const index = year * 12 + value - 1 + delta;
  return Math.floor(index / 12) + "-" + String(index % 12 + 1).padStart(2, "0");
};

function toUrl(section: PlanningSection, month: string, horizon: number) {
  const query = new URLSearchParams({ secao: section });
  if (month !== today().slice(0, 7)) query.set("mes", month);
  if (horizon !== 12) query.set("horizonte", String(horizon));
  return "/planejamento?" + query;
}

export function PlanningPage({ initialSection, initialMonth, initialHorizon }: {
  initialSection: PlanningSection; initialMonth: string; initialHorizon: number;
}) {
  const [section, setSection] = useState(initialSection);
  const [month, setMonth] = useState(initialMonth || today().slice(0, 7));
  const [horizon, setHorizon] = useState(initialHorizon);
  const [data, setData] = useState<PlanningData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [detail, setDetail] = useState<DetailSpec | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const version = useRef(0);
  const main = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/planning?" + new URLSearchParams({ month, horizon: String(horizon) }), { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/login"; return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar o planejamento.");
      if (current === version.current) setData(body);
    } catch (reason) {
      if (current === version.current) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o planejamento.");
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [month, horizon]);

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
  const go = useCallback((next: PlanningSection) => {
    setSection(next);
    window.history.pushState(null, "", toUrl(next, month, horizon));
    main.current?.scrollTo({ top: 0 });
  }, [month, horizon]);
  function changeMonth(next: string) {
    setMonth(next);
    window.history.replaceState(null, "", toUrl(section, next, horizon));
  }
  function changeHorizon(next: number) {
    setHorizon(next);
    window.history.replaceState(null, "", toUrl(section, month, next));
  }

  const act = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/planning", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.href = "/login"; return; }
    if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
    await load();
  }, [load]);

  const categoryEditing = useMemo(() => ({
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

  const secret = useCallback((cents: number) => hidden ? MASK : brl(cents), [hidden]);
  const props: PlanningProps | null = data ? { data, hidden, secret, act, edit: setEditor, openDetail: setDetail, go } : null;
  const title = SECTIONS.find(([id]) => id === section)?.[1] ?? "Mês";
  const isCurrent = month === today().slice(0, 7);

  return <HiddenValues.Provider value={hidden}><CategoryEditing.Provider value={categoryEditing}><div className="shell analytics planning">
    <AppSidebar current="planejamento" />
    <div className="workspace">
      <header className="topbar"><div className="topbar-label"><span>Planejamento financeiro</span></div>
        <div className="top-actions">
          <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Recarregar planejamento" title="Recarregar planejamento"><RefreshCw /></Button>
          <Button variant="outline" size="icon" aria-pressed={hidden} onClick={toggleHidden}
            aria-label={hidden ? "Mostrar saldos e faturas" : "Ocultar saldos e faturas"}
            title={hidden ? "Mostrar saldos e faturas" : "Ocultar saldos e faturas"}>{hidden ? <EyeOff /> : <Eye />}</Button>
        </div>
      </header>
      <main className="analytics-main" ref={main}><div className="content">
        <div className="an-head">
          <div className="an-title">
            <div><span className="eyebrow">PLANEJAMENTO</span><h1>{title}</h1></div>
            {section === "projecoes" && <span className="an-period-label" aria-live="polite">Próximos {horizon} meses</span>}
          </div>
          <div className="an-bar">
            <nav className="an-subnav" aria-label="Páginas do planejamento">
              {SECTIONS.map(([id, label]) => <a key={id} href={"/planejamento?secao=" + id} aria-current={section === id ? "page" : undefined}
                onClick={(event) => { event.preventDefault(); go(id); }}>{label}</a>)}
            </nav>
            <div className="an-controls">
              {section === "projecoes"
                ? <div className="pl-segment" role="radiogroup" aria-label="Horizonte da projeção">
                  {HORIZONS.map((value) => <button key={value} type="button" role="radio" aria-checked={horizon === value}
                    onClick={() => changeHorizon(value)}>{value} meses</button>)}
                </div>
                : <div className="pl-month" role="group" aria-label="Mês">
                  <Button variant="outline" size="icon-sm" onClick={() => changeMonth(shiftMonth(month, -1))} aria-label="Mês anterior"><ChevronLeft /></Button>
                  <span>{monthLong(month)}</span>
                  <Button variant="outline" size="icon-sm" onClick={() => changeMonth(shiftMonth(month, 1))} aria-label="Próximo mês"
                    disabled={month >= shiftMonth(today().slice(0, 7), 12)}><ChevronRight /></Button>
                  {!isCurrent && <button type="button" className="chip" onClick={() => changeMonth(today().slice(0, 7))}>Hoje</button>}
                </div>}
            </div>
          </div>
        </div>
        {error && <p className="feedback error" role="alert">{error}</p>}
        {!data && loading && <p className="text-sm text-muted-foreground" role="status">Carregando planejamento…</p>}
        {props && <div aria-busy={loading}>
          {section === "mes" && <MonthSection {...props} />}
          {section === "caixinhas" && <BucketsSection {...props} />}
          {section === "metas" && <GoalsSection {...props} />}
          {section === "projecoes" && <ProjectionsSection {...props} />}
          {section === "patrimonio" && <NetworthSection {...props} />}
          {section === "negocio" && <BusinessSection {...props} />}
        </div>}
      </div></main>
    </div>
    <DetailSheet spec={detail} entries={data?.entries ?? []} accounts={(data?.accounts ?? []) as unknown as AnalyticsData["accounts"]}
      onClose={() => setDetail(null)} />
    {data && <EditorSheet editor={editor} data={data} act={act} onClose={() => setEditor(null)} />}
  </div></CategoryEditing.Provider></HiddenValues.Provider>;
}
