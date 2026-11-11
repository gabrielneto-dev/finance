"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

// Cores das séries (definidas em app/analytics.css e validadas pelo dataviz).
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
export const OTHER = "var(--series-other)";
export const SEQUENTIAL = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)", "var(--seq-6)"];
export const AXIS = { fontSize: 11, fill: "#5b645e" };
export const GRID = "#e9edea";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const whole = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const monthShortFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const monthLongFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

/** Valores em centavos. */
export const brl = (cents: number) => currency.format(cents / 100);
export const brlWhole = (cents: number) => whole.format(Math.round(cents / 100));
export const compact = (cents: number) => "R$ " + compactFormat.format(cents / 100);
/** Rótulo curto para eixos: "4,5 mil". */
export const axisMoney = (cents: number) => compactFormat.format(cents / 100);
export const percent = (value: number, digits = 0) => (value * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits }) + "%";
export const monthShort = (month: string) => monthShortFormat.format(new Date(month + "-15T12:00:00Z")).replace(".", "");
export const monthLong = (month: string) => monthLongFormat.format(new Date(month + "-15T12:00:00Z"));
export const dayLabel = (date: string) => dayFormat.format(new Date(date + "T12:00:00Z")).replace(".", "");

/** Variação do atual contra o anterior. Para despesas, subir é pior. */
export function Delta({ current, previous, lowerIsBetter = false, hidden = false }: {
  current: number; previous: number; lowerIsBetter?: boolean; hidden?: boolean;
}) {
  if (hidden || !previous) return null;
  const change = (current - previous) / Math.abs(previous);
  if (!Number.isFinite(change)) return null;
  const rounded = Math.round(change * 100);
  if (rounded === 0) return <span className="delta">0%</span>;
  const worse = lowerIsBetter ? change > 0 : change < 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={"delta " + (worse ? "worse" : "better")} title={"Antes: " + brl(previous)}>
    <Icon size={11} aria-hidden="true" />{Math.abs(rounded)}%<span className="sr-only">{change > 0 ? " a mais" : " a menos"} que o período anterior</span>
  </span>;
}

export function Kpi({ label, value, foot, tone, lead = false }: {
  label: string; value: ReactNode; foot?: ReactNode; tone?: "positive" | "negative"; lead?: boolean;
}) {
  return <div className={"kpi" + (lead ? " lead" : "")}>
    <dt>{label}</dt>
    <dd><span className={"kpi-value" + (tone ? " " + tone : "")}>{value}</span>{foot && <span className="kpi-foot">{foot}</span>}</dd>
  </div>;
}

export function ChartCard({ title, detail, action, className = "", children, id }: {
  title: string; detail?: ReactNode; action?: ReactNode; className?: string; children: ReactNode; id?: string;
}) {
  return <section className={"an-card " + className} aria-labelledby={id ? id + "-title" : undefined} id={id}>
    <header className="an-card-head">
      <div><h2 id={id ? id + "-title" : undefined}>{title}</h2>{detail && <p>{detail}</p>}</div>
      {action && <div className="an-card-action">{action}</div>}
    </header>
    {children}
  </section>;
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="an-empty">{children}</div>;

export function Legend({ items }: { items: { label: string; color: string; kind?: "box" | "line" | "dashed" }[] }) {
  return <div className="an-legend">{items.map((item) => <span key={item.label}>
    <i className={item.kind === "line" ? "line" : item.kind === "dashed" ? "dashed" : undefined}
      style={item.kind === "dashed" ? { color: item.color } : { background: item.color }} aria-hidden="true" />{item.label}
  </span>)}</div>;
}

type TooltipRow = { label: string; value: string; color?: string };
/** Conteúdo da dica dos gráficos, com rótulos em texto e a cor só como marca. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return <div className="an-tooltip" role="tooltip">
    <strong>{title}</strong>
    <ul>{rows.map((row) => <li key={row.label}><span>{row.color && <i style={{ background: row.color }} aria-hidden="true" />}{row.label}</span><b>{row.value}</b></li>)}</ul>
  </div>;
}

/** Minigráfico de tendência, sem eixo. */
export function Spark({ values, width = 64, height = 20 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  if (values.length < 2) return null;
  const points = values.map((value, index) => [index / (values.length - 1) * (width - 4) + 2, height - 2 - value / max * (height - 4)]);
  const last = points.at(-1)!;
  return <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <polyline points={points.map((point) => point.join(",")).join(" ")} fill="none" stroke="var(--seq-4)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={last[0]} cy={last[1]} r="2.2" fill="var(--seq-6)" />
  </svg>;
}

/** Nível da escala sequencial para um valor entre 0 e o máximo. */
export const level = (value: number, max: number) => value <= 0 || max <= 0 ? 0 : Math.min(6, Math.max(1, Math.ceil(value / max * 6)));
