"use client";

import { ArrowDownRight, ArrowUpRight, ChevronRight, Sparkles } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SectionProps } from "./analytics-page";
import type { AnalyticsSection } from "./period-bar";
import { AXIS, axisMoney, brl, ChartCard, compact, Delta, Empty, GRID, Kpi, Legend, monthLong, monthShort, percent, TooltipBox } from "./kit";
import { groupDetail } from "./details";

const INCOME = "var(--series-1)";
const EXPENSE = "var(--series-2)";

export function SummarySection({ data, compare, openDetail, go }: SectionProps) {
  const { current, previous } = data.totals;
  const rate = current.savingsRate;
  return <div className="an-grid">
    <dl className="kpis">
      <Kpi label="Receitas" value={brl(current.income)}
        foot={<>{compare && <Delta current={current.income} previous={previous.income} />}{current.yield > 0 && <span>{brl(current.yield)} de rendimentos</span>}</>} />
      <Kpi label="Despesas" value={brl(current.expense)}
        foot={<>{compare && <Delta current={current.expense} previous={previous.expense} lowerIsBetter />}<span>{brl(current.dailyAverage)} por dia</span></>} />
      <Kpi label="Resultado" lead value={brl(current.result)}
        foot={<>{compare && <Delta current={current.result} previous={previous.result} />}<span>{current.result >= 0 ? "Sobrou no período" : "Faltou no período"}
          {current.business.profit !== 0 && ", com " + brl(current.business.profit) + " do negócio"}</span></>} />
      <Kpi label="Taxa de poupança" value={rate === null ? "—" : percent(rate)} tone={rate !== null && rate < 0 ? "negative" : undefined}
        foot={rate === null ? <span>Sem receita no período</span>
          : compare && previous.savingsRate !== null ? <span>Antes: {percent(previous.savingsRate)}</span> : <span>Do que entrou, quanto ficou</span>} />
    </dl>
    <PaceCard data={data} />
    <ChartCard className="span-4" title="Destaques" detail="O que mudou e merece atenção">
      {data.insights.length ? <div className="insights">{data.insights.map((item) => {
        const Icon = item.tone === "up" ? ArrowUpRight : item.tone === "down" ? ArrowDownRight : Sparkles;
        return <button type="button" key={item.id} className="insight" onClick={() => go(item.target.section as AnalyticsSection, item.target.group)}>
          <span className={"insight-mark " + item.tone} aria-hidden="true"><Icon size={14} /></span>
          <span>{item.text}</span><ChevronRight size={14} aria-hidden="true" />
        </button>;
      })}</div> : <Empty>Nada fora do padrão neste período.</Empty>}
    </ChartCard>
    <MonthlyCard data={data} />
    <ChartCard className="span-5" title="Para onde foi o dinheiro" detail="Os cinco grupos com mais despesa"
      action={<button type="button" className="chip" onClick={() => go("categorias")}>Ver categorias</button>}>
      {data.groups.length ? <div className="rank">{data.groups.slice(0, 5).map((group) => {
        const max = data.groups[0].amount || 1;
        return <button type="button" className="rank-row" key={group.id} onClick={() => openDetail(groupDetail(data, group.id, group.label))}>
          <span className="rank-label"><span>{group.label}</span><small>{percent(group.share)} das despesas</small></span>
          <span className="rank-bar" aria-hidden="true"><span style={{ width: Math.max(0, group.amount / max * 100) + "%" }} /></span>
          <span className="rank-value">{brl(group.amount)}{compare && <small><Delta current={group.amount} previous={group.previous} lowerIsBetter /></small>}</span>
        </button>;
      })}</div> : <Empty>Sem despesas no período.</Empty>}
    </ChartCard>
  </div>;
}

function PaceCard({ data }: { data: SectionProps["data"] }) {
  const { pace } = data;
  const last = pace.days.at(-1)!;
  const detail = pace.isCurrent
    ? (pace.projection !== null ? "No ritmo atual, o mês fecha em " + brl(pace.projection) : "")
    : "Despesa acumulada dia a dia";
  return <ChartCard className="span-8" title={"Ritmo de " + monthLong(pace.month)} detail={detail}>
    <Legend items={[{ label: "Este mês", color: EXPENSE, kind: "line" }, { label: "Mês anterior", color: "#8c968f", kind: "dashed" },
      { label: "Média de 3 meses", color: "var(--seq-2)", kind: "line" }]} />
    <div className="an-chart" style={{ height: 260 }} role="img" aria-label={"Despesa acumulada em " + monthLong(pace.month) + ": " + brl(pace.spent)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pace.days} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
          <Tooltip cursor={{ stroke: "#9aa59d", strokeDasharray: "3 3" }} content={({ active, payload, label }) => active && payload?.length
            ? <TooltipBox title={"Dia " + label} rows={[
              ...(payload[0].payload.current !== null ? [{ label: "Este mês", value: brl(payload[0].payload.current), color: EXPENSE }] : []),
              { label: "Mês anterior", value: brl(payload[0].payload.previous), color: "#8c968f" },
              { label: "Média de 3 meses", value: brl(payload[0].payload.average), color: "var(--seq-2)" }]} /> : null} />
          <Line dataKey="average" stroke="var(--seq-2)" strokeWidth={6} strokeOpacity={0.55} dot={false} isAnimationActive={false} />
          <Line dataKey="previous" stroke="#8c968f" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line dataKey="current" stroke={EXPENSE} strokeWidth={2.2} dot={false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 4 }} />
          {pace.projection !== null && <ReferenceDot x={last.day} y={pace.projection} r={4} fill="var(--card)" stroke={EXPENSE} strokeWidth={2}
            label={{ value: "Projeção " + compact(pace.projection), position: "insideTopRight", fontSize: 11, fill: "#2f3632" }} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </ChartCard>;
}

function MonthlyCard({ data }: { data: SectionProps["data"] }) {
  // Começa no primeiro mês com movimentação, para não abrir o gráfico com meses vazios.
  const first = data.monthly.findIndex((item) => item.income || item.expense);
  const months = first < 0 ? [] : data.monthly.slice(first);
  return <ChartCard className="span-7" title="Receitas e despesas" detail="Últimos 12 meses, com o resultado de cada mês">
    {months.length ? <>
      <Legend items={[{ label: "Receitas", color: INCOME }, { label: "Despesas", color: EXPENSE }, { label: "Resultado", color: "#2f3632", kind: "line" }]} />
      <div className="an-chart" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
            <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[
                { label: "Receitas", value: brl(payload[0].payload.income), color: INCOME },
                { label: "Despesas", value: brl(payload[0].payload.expense), color: EXPENSE },
                { label: "Resultado", value: brl(payload[0].payload.result) }]} /> : null} />
            <Bar dataKey="income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="expense" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Line dataKey="result" stroke="#2f3632" strokeWidth={2} dot={{ r: 3, fill: "#2f3632" }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </> : <Empty>Sem movimentação nos últimos 12 meses.</Empty>}
  </ChartCard>;
}
