"use client";

import { useState } from "react";
import { Pencil, Plus, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { AXIS, axisMoney, brl, ChartCard, Empty, GRID, Kpi, Legend, monthLong, monthShort, percent, Spark, TooltipBox } from "@/components/analytics/kit";
import { categoryDetail, groupDetail, merchantDetail } from "@/components/analytics/details";
import type { AnalyticsData } from "@/lib/analytics/types";
import type { Trend } from "@/lib/planning/types";
import type { PlanningProps } from "./planning-page";
import { MASK } from "./planning-page";

const BASE = "#8c968f";
const ADJUSTED = "var(--series-1)";

export function ProjectionsSection({ data, hidden, secret, act, edit, openDetail, go }: PlanningProps) {
  const { projection } = data;
  const [error, setError] = useState("");
  const end = projection.adjusted.at(-1);
  const baseEnd = projection.base.at(-1);
  const start = data.networth.total;
  const points = projection.months.map((month, index) => ({ month, base: projection.base[index].networth, adjusted: projection.adjusted[index].networth,
    surplus: projection.adjusted[index].surplus }));
  const anyEnabled = data.adjustments.some((item) => item.enabled);
  async function toggle(id: string, enabled: boolean) {
    setError("");
    try { await act({ action: "adjustment-toggle", id, enabled }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); }
  }
  const effect = (id: string) => projection.effects.find((item) => item.id === id)?.delta ?? 0;
  return <div className="an-grid">
    <dl className="kpis">
      <Kpi label="Patrimônio hoje" value={secret(start)} />
      <Kpi label={"Em " + monthLong(projection.months.at(-1) ?? data.month) + ", sem ajustes"} value={secret(baseEnd?.networth ?? 0)} />
      <Kpi label="Com os ajustes ligados" lead value={secret(end?.networth ?? 0)}
        foot={<span>{anyEnabled ? (projection.difference >= 0 ? "+" : "−") + (hidden ? MASK : brl(Math.abs(projection.difference))) + " contra o cenário base" : "Nenhum ajuste ligado"}</span>} />
      <Kpi label="Sobra média por mês" value={brl(Math.round(projection.adjusted.reduce((total, row) => total + row.surplus, 0) / Math.max(1, projection.adjusted.length)))}
        foot={<span>Investimentos rendendo {percent(projection.assumedYield / 10000)} ao ano</span>} />
    </dl>
    <ChartCard className="span-8" title="Patrimônio projetado" detail="Contas mais investimentos, menos parcelas que ainda vão vencer">
      <Legend items={[{ label: "Cenário base", color: BASE, kind: "dashed" }, { label: "Com ajustes", color: ADJUSTED, kind: "line" }]} />
      <div className="an-chart" style={{ height: 250 }} role="img" aria-label={"Patrimônio projetado em " + (projection.months.length) + " meses"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} minTickGap={12} />
            <YAxis hide={hidden} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={52} />
            <Tooltip cursor={{ stroke: "#9aa59d", strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[
                { label: "Cenário base", value: secret(payload[0].payload.base), color: BASE },
                { label: "Com ajustes", value: secret(payload[0].payload.adjusted), color: ADJUSTED }]} /> : null} />
            <Line dataKey="base" stroke={BASE} strokeWidth={1.6} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="adjusted" stroke={ADJUSTED} strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3 className="pl-subtitle">Sobra de cada mês, com os ajustes</h3>
      <div className="an-chart" style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} minTickGap={12} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={52} />
            <ReferenceLine y={0} stroke="#9aa59d" />
            <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[{ label: "Sobra", value: brl(payload[0].payload.surplus) }]} /> : null} />
            <Bar dataKey="surplus" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false}>
              {points.map((point) => <Cell key={point.month} fill={point.surplus >= 0 ? "var(--series-1)" : "var(--destructive)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
    <ChartCard className="span-4" title="E se…" detail="Ligue e desligue para ver o efeito no fim do horizonte"
      action={<Button size="sm" variant="outline" onClick={() => edit({ type: "adjustment" })}><Plus />Novo</Button>}>
      {data.adjustments.length ? <ul className="pl-adjustments">{data.adjustments.map((item) => {
        const delta = effect(item.id);
        return <li key={item.id}>
          <button type="button" className="an-compare" aria-pressed={item.enabled} onClick={() => toggle(item.id, !item.enabled)}
            aria-label={(item.enabled ? "Desligar " : "Ligar ") + item.label}><span aria-hidden="true" /></button>
          <div><strong>{item.label}</strong>
            <small>{delta === 0 ? "Sem efeito no patrimônio" : (delta > 0 ? "+" : "−") + (hidden ? MASK : brl(Math.abs(delta))) + " no fim"}</small></div>
          <Button variant="ghost" size="icon-xs" onClick={() => edit({ type: "adjustment", adjustment: item })} aria-label={"Editar " + item.label}><Pencil /></Button>
        </li>;
      })}</ul> : <div className="pl-empty-col">
        <p className="an-note">Experimente:</p>
        <div className="chips">
          <button type="button" className="chip" onClick={() => edit({ type: "adjustment", preset: { kind: "renda", label: "Salário +10%", percent: 1000 } })}>Salário +10%</button>
          <button type="button" className="chip" onClick={() => edit({ type: "adjustment", preset: { kind: "corte", label: "Cortar Alimentação fora em 20%", percent: 2000, group: "g:alimentacao" } })}>Cortar alimentação fora</button>
          <button type="button" className="chip" onClick={() => edit({ type: "adjustment", preset: { kind: "evento", label: "IPVA" } })}>Evento pontual</button>
          <button type="button" className="chip" onClick={() => edit({ type: "adjustment", preset: { kind: "aporte", label: "Aporte extra" } })}>Aporte extra</button>
        </div>
      </div>}
      {error && <p className="pl-error" role="alert">{error}</p>}
    </ChartCard>
    <ChartCard className="span-12" title="Mês a mês" detail="Cenário com os ajustes ligados">
      <div className="an-table-wrap"><table className="an-table">
        <thead><tr><th>Mês</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Parcelas</th>
          <th className="num">Investido</th><th className="num">Sobra</th><th className="num">Saldo em conta</th></tr></thead>
        <tbody>{projection.adjusted.map((row) => <tr key={row.month}>
          <td>{monthLong(row.month)}</td><td className="num">{brl(row.income)}</td><td className="num">{brl(row.outflow)}</td>
          <td className="num">{brl(row.installments)}</td><td className="num">{brl(row.invested)}</td>
          <td className={"num" + (row.surplus < 0 ? " negative" : "")}>{brl(row.surplus)}</td><td className="num">{secret(row.cash)}</td>
        </tr>)}</tbody>
      </table></div>
    </ChartCard>
    <TrendsCard data={data} openDetail={openDetail} edit={edit} go={go} />
  </div>;
}

function TrendsCard({ data, openDetail, edit, go }: Pick<PlanningProps, "data" | "openDetail" | "edit" | "go">) {
  const fake = { monthlyByGroup: [] } as unknown as AnalyticsData;
  const describe = (item: Trend) => item.kind === "subindo" ? "Sobe " + percent(item.change ?? 0) + " ao mês nos últimos 6 meses"
    : item.kind === "acima" ? "Acima do planejado há " + item.months + " meses seguidos" : "Nova despesa recorrente de " + brl(item.monthly ?? 0) + " por mês";
  const bucketFor = (item: Trend) => item.bucket ? data.budget.buckets.find((row) => row.id === item.bucket)
    : data.budget.buckets.find((row) => item.group && row.groups.includes("g:" + item.group));
  return <ChartCard className="span-12" title="Tendências" detail="O que está subindo, passando do planejado ou começou a se repetir">
    {data.trends.length ? <ul className="pl-trends">{data.trends.map((item) => {
      const bucket = bucketFor(item);
      return <li key={item.id}>
        <span className="insight-mark up" aria-hidden="true"><TrendingUp size={14} /></span>
        <div><strong>{item.label}</strong><small>{describe(item)}{item.kind === "subindo" && item.groupLabel && item.key.startsWith("c:") ? " · " + item.groupLabel : ""}</small></div>
        {item.spark.length > 1 ? <Spark values={item.spark} /> : <span />}
        <div className="pl-trend-actions">
          {bucket ? <Button size="xs" variant="outline" onClick={() => edit({ type: "bucket", bucket })}>Ajustar caixinha</Button>
            : <Button size="xs" variant="outline" onClick={() => go("caixinhas")}>Criar caixinha</Button>}
          <Button size="xs" variant="ghost" onClick={() => openDetail(item.kind === "recorrente" && item.merchant ? merchantDetail(item.merchant, item.label)
            : item.kind === "subindo" && item.group ? (item.key.startsWith("c:") ? categoryDetail(item.group, item.label) : groupDetail(fake, item.group, item.label))
            : { title: item.label, filter: (entry) => (entry as { bucket?: string | null }).bucket === item.bucket })}>Ver lançamentos</Button>
        </div>
      </li>;
    })}</ul> : <Empty>Nada subindo de forma consistente nos últimos 6 meses.</Empty>}
  </ChartCard>;
}
