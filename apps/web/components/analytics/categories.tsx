"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SectionProps } from "./analytics-page";
import { AXIS, axisMoney, brl, ChartCard, compact, Delta, Empty, GRID, Legend, monthLong, monthShort, OTHER, percent, SERIES, Spark, TooltipBox } from "./kit";
import { categoryDetail, groupDetail } from "./details";

const STACKED_GROUPS = 4;
const THIRD_PARTY = "terceiros";

export function CategoriesSection({ data, compare, openDetail, focus }: SectionProps) {
  const [withPix, setWithPix] = useState(true);
  const [open, setOpen] = useState<Set<string>>(() => new Set(focus ? [focus] : []));
  const groups = data.groups.filter((group) => group.amount > 0 && (withPix || group.id !== THIRD_PARTY));
  const total = groups.reduce((sum, group) => sum + group.amount, 0);
  const max = Math.max(...groups.map((group) => group.amount), 1);
  const thirdParty = data.groups.find((group) => group.id === THIRD_PARTY)?.amount ?? 0;
  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <div className="an-grid">
    <ChartCard className="span-8" title="Onde você gasta" detail={"Total de " + brl(total) + (compare ? " · variação contra o período anterior" : "")}
      action={thirdParty > 0 && <button type="button" className="chip" aria-pressed={withPix} onClick={() => setWithPix(!withPix)}>
        Incluir Pix a terceiros</button>}>
      {groups.length ? <div className="rank">{groups.map((group) => {
        const expanded = open.has(group.id);
        return <div key={group.id}>
          <button type="button" className="rank-row with-spark" aria-expanded={expanded} onClick={() => toggle(group.id)}>
            <span className="rank-label"><span>{expanded ? <ChevronDown size={13} className="inline" aria-hidden="true" /> : <ChevronRight size={13} className="inline" aria-hidden="true" />} {group.label}</span>
              <small>{percent(total ? group.amount / total : 0)} · {group.count} {group.count === 1 ? "compra" : "compras"}</small></span>
            <span className="rank-bar" aria-hidden="true"><span style={{ width: Math.max(0, group.amount / max * 100) + "%" }} /></span>
            <Spark values={group.spark} />
            <span className="rank-value">{brl(group.amount)}{compare && <small><Delta current={group.amount} previous={group.previous} lowerIsBetter /></small>}</span>
          </button>
          {expanded && <div className="rank-children">
            {group.categories.map((category) => <button type="button" className="rank-row" key={category.label}
              onClick={() => openDetail(categoryDetail(group.id, category.label))}>
              <span className="rank-label"><span>{category.label}</span><small>{category.count} · ticket médio {brl(category.average)}</small></span>
              <span className="rank-bar" aria-hidden="true"><span style={{ width: Math.max(0, category.amount / max * 100) + "%" }} /></span>
              <span className="rank-value">{brl(category.amount)}{compare && <small><Delta current={category.amount} previous={category.previous} lowerIsBetter /></small>}</span>
            </button>)}
            <button type="button" className="chip" style={{ margin: "6px 0 4px" }} onClick={() => openDetail(groupDetail(data, group.id, group.label))}>
              Ver lançamentos de {group.label}</button>
          </div>}
        </div>;
      })}</div> : <Empty>Sem despesas no período.</Empty>}
    </ChartCard>
    <ChartCard className="span-4" title="Composição" detail="Quanto é necessário e quanto é escolha">
      <Split title="Essencial × estilo de vida" parts={[
        { label: "Essencial", amount: data.natures.essencial, color: "var(--series-1)" },
        { label: "Estilo de vida", amount: data.natures.estilo, color: "var(--series-2)" },
        { label: withPix ? "Pix e sem categoria" : "Sem categoria", amount: withPix ? data.natures.indefinido : data.natures.indefinido - thirdParty, color: OTHER },
      ]} />
      <Split title="Fixos × variáveis" parts={[
        { label: "Fixos (recorrentes)", amount: data.fixedVariable.fixed, color: "var(--series-4)" },
        { label: "Variáveis", amount: data.fixedVariable.variable, color: OTHER },
      ]} />
    </ChartCard>
    <StackedCard data={data} />
    <ChartCard className="span-5" title="Ticket médio" detail="Valor típico de cada compra por categoria">
      <TicketTable data={data} />
    </ChartCard>
  </div>;
}

function Split({ title, parts }: { title: string; parts: { label: string; amount: number; color: string }[] }) {
  const shown = parts.filter((part) => part.amount > 0);
  const total = shown.reduce((sum, part) => sum + part.amount, 0);
  return <div className="split">
    <div className="split-head"><span>{title}</span><span>{brl(total)}</span></div>
    {total > 0 ? <>
      <div className="split-bar" role="img" aria-label={shown.map((part) => part.label + " " + percent(part.amount / total)).join(", ")}>
        {shown.map((part) => <span key={part.label} style={{ width: part.amount / total * 100 + "%", background: part.color }} />)}
      </div>
      <dl className="split-legend">{shown.map((part) => <div key={part.label}>
        <dt><i style={{ background: part.color }} aria-hidden="true" />{part.label}</dt>
        <dd>{brl(part.amount)}<small>{percent(part.amount / total)}</small></dd>
      </div>)}</dl>
    </> : <Empty>Sem despesas no período.</Empty>}
  </div>;
}

function StackedCard({ data }: { data: SectionProps["data"] }) {
  // Os quatro grupos com mais despesa nos 12 meses ganham cor fixa; o resto vira "Outros".
  const totals = new Map<string, number>();
  for (const row of data.monthlyByGroup) for (const [id, value] of Object.entries(row.values)) totals.set(id, (totals.get(id) ?? 0) + value);
  const leaders = Array.from(totals).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, STACKED_GROUPS).map(([id]) => id);
  const labels = new Map(data.groups.map((group) => [group.id, group.label]));
  const name = (id: string) => labels.get(id) ?? id;
  const rows = data.monthlyByGroup.map((row) => {
    const values: Record<string, number> = {};
    let other = 0;
    for (const [id, value] of Object.entries(row.values)) if (leaders.includes(id)) values[id] = Math.max(0, value); else other += value;
    return { month: row.month, ...values, outros: Math.max(0, other) };
  });
  const first = rows.findIndex((row) => leaders.some((id) => (row as Record<string, number | string>)[id]) || row.outros);
  if (first < 0) return <ChartCard className="span-7" title="Evolução por grupo"><Empty>Sem despesas nos últimos 12 meses.</Empty></ChartCard>;
  const keys = [...leaders, "outros"];
  const color = (id: string) => id === "outros" ? OTHER : SERIES[leaders.indexOf(id)];
  return <ChartCard className="span-7" title="Evolução por grupo" detail="Despesa mensal dos grupos que mais pesam, nos últimos 12 meses">
    <Legend items={keys.map((id) => ({ label: id === "outros" ? "Outros" : name(id), color: color(id) }))} />
    <div className="an-chart" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows.slice(first)} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
          <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
            ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[...keys].reverse().map((id) => ({
              label: id === "outros" ? "Outros" : name(id), color: color(id), value: brl(Number(payload[0].payload[id] ?? 0)) }))} /> : null} />
          {keys.map((id, index) => <Bar key={id} dataKey={id} stackId="g" fill={color(id)} stroke="var(--card)" strokeWidth={1}
            radius={index === keys.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={26} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </ChartCard>;
}

function TicketTable({ data }: { data: SectionProps["data"] }) {
  const rows = data.groups.flatMap((group) => group.categories.filter((category) => category.count > 0)
    .map((category) => ({ ...category, group: group.label }))).sort((a, b) => b.count - a.count).slice(0, 8);
  if (!rows.length) return <Empty>Sem compras no período.</Empty>;
  return <div className="an-table-wrap"><table className="an-table">
    <thead><tr><th>Categoria</th><th className="num">Compras</th><th className="num">Ticket</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.group + row.label}>
      <td>{row.label}<small className="block text-xs text-muted-foreground">{row.group}</small></td>
      <td className="num">{row.count}</td><td className="num">{brl(row.average)}</td>
    </tr>)}</tbody>
  </table></div>;
}
