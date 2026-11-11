"use client";

import { useContext } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HiddenValues } from "@/components/hidden-values";
import type { SectionProps } from "./analytics-page";
import { AXIS, axisMoney, brl, ChartCard, compact, dayLabel, Delta, Empty, GRID, Kpi, Legend, level, SEQUENTIAL, SERIES, TooltipBox } from "./kit";
import { dayDetail, groupDetail, incomeDetail, methodDetail } from "./details";
import { RankList } from "./rank-list";

const INCOME = "var(--series-1)";
const EXPENSE = "var(--series-2)";
const MASK = "R$ ••••••";
const WATERFALL_GROUPS = 6;
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function CashflowSection({ data, compare, openDetail }: SectionProps) {
  const { current, previous } = data.totals;
  const types = new Map(data.accounts.map((row) => [row.key, row.type]));
  return <div className="an-grid">
    <dl className="kpis">
      <Kpi label="Receitas" value={brl(current.income)} foot={compare && <Delta current={current.income} previous={previous.income} />} />
      <Kpi label="Despesas" value={brl(current.expense)} foot={compare && <Delta current={current.expense} previous={previous.expense} lowerIsBetter />} />
      <Kpi label="Faturas pagas" value={brl(current.neutral.pagamento_fatura)} foot={<span>Fora das despesas, para não contar em dobro</span>} />
      <Kpi label="Entre suas contas" value={brl(current.neutral.transferencia_propria)}
        foot={<span>{current.neutral.investimento > 0 ? brl(current.neutral.investimento) + " em investimentos" : "Transferências e saques próprios"}</span>} />
    </dl>
    <WaterfallCard data={data} openDetail={openDetail} />
    <ChartCard className="span-4" title="De onde veio" detail="Receitas por origem">
      <RankList rows={data.incomeSources} color={INCOME} empty="Sem receitas no período." onSelect={(row) => openDetail(incomeDetail(row.label))} />
    </ChartCard>
    <BalanceCard data={data} />
    <ChartCard className="span-5" title="Como pagou" detail="Despesas por forma de pagamento">
      <RankList rows={data.methods} color={EXPENSE} empty="Sem despesas no período."
        onSelect={(row) => openDetail(methodDetail(row.label, (key) => types.get(key)))} />
    </ChartCard>
    <CalendarCard data={data} openDetail={openDetail} />
  </div>;
}

function WaterfallCard({ data, openDetail }: Pick<SectionProps, "data" | "openDetail">) {
  const { income, expense, result } = data.totals.current;
  if (!income && !expense) return <ChartCard className="span-8" title="Do que entrou ao que sobrou"><Empty>Sem movimentação no período.</Empty></ChartCard>;
  const top = data.groups.filter((group) => group.amount > 0).slice(0, WATERFALL_GROUPS);
  const rest = expense - top.reduce((sum, group) => sum + group.amount, 0);
  const steps = [...top.map((group) => ({ id: group.id, label: group.label, amount: group.amount })),
    ...(rest > 0 ? [{ id: "", label: "Outros grupos", amount: rest }] : [])];
  let running = income;
  const bars = [{ id: "receitas", label: "Receitas", range: [0, income], amount: income, kind: "income" }];
  for (const step of steps) {
    bars.push({ id: step.id, label: step.label, range: [running - step.amount, running], amount: -step.amount, kind: "expense" });
    running -= step.amount;
  }
  bars.push({ id: "resultado", label: result >= 0 ? "Sobrou" : "Faltou", range: [Math.min(0, result), Math.max(0, result)], amount: result, kind: "result" });
  const color = (kind: string) => kind === "income" ? INCOME : kind === "expense" ? EXPENSE : "#2f3632";
  return <ChartCard className="span-8" title="Do que entrou ao que sobrou" detail="Receitas menos cada grupo de despesa até o resultado">
    <div className="an-chart" style={{ height: 36 + bars.length * 30 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: "#2f3632" }} tickLine={false} axisLine={false} width={150}
            tickFormatter={(value: string) => value.length > 24 ? value.slice(0, 23) + "…" : value} />
          <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
            ? <TooltipBox title={payload[0].payload.label} rows={[{ label: "Valor", value: brl(payload[0].payload.amount) }]} /> : null} />
          <Bar dataKey="range" radius={[4, 4, 4, 4]} isAnimationActive={false} cursor="pointer"
            onClick={(entry) => { const bar = entry.payload as (typeof bars)[number]; if (bar?.kind === "expense" && bar.id) openDetail(groupDetail(data, bar.id, bar.label)); }}>
            {bars.map((bar) => <Cell key={bar.label} fill={color(bar.kind)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </ChartCard>;
}

export function BalanceCard({ data, className = "span-7" }: { data: SectionProps["data"]; className?: string }) {
  const hidden = useContext(HiddenValues);
  const series = data.balances.filter((row) => row.points.length > 1).slice(0, SERIES.length);
  const points = series[0]?.points.map((point, index) => ({
    date: point.date, ...Object.fromEntries(series.map((row) => [row.key, row.points[index]?.balance ?? null])),
  })) ?? [];
  return <ChartCard className={className} title="Saldo das contas" detail="Reconstruído a partir do saldo atual e dos lançamentos efetivados">
    {series.length ? <>
      {series.length > 1 && <Legend items={series.map((row, index) => ({ label: row.name, color: SERIES[index], kind: "line" as const }))} />}
      <div className="an-chart" style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={dayLabel} minTickGap={28} />
            <YAxis hide={hidden} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
            <Tooltip cursor={{ stroke: "#9aa59d", strokeDasharray: "3 3" }} content={({ active, payload, label }) => active && payload?.length
              ? <TooltipBox title={dayLabel(String(label))} rows={series.map((row, index) => ({
                label: row.name, color: SERIES[index], value: hidden ? MASK : brl(Number(payload[0].payload[row.key] ?? 0)) }))} /> : null} />
            {series.map((row, index) => <Line key={row.key} dataKey={row.key} stroke={SERIES[index]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </> : <Empty>Sem saldo informado para reconstruir o período.</Empty>}
  </ChartCard>;
}

function CalendarCard({ data, openDetail }: Pick<SectionProps, "data" | "openDetail">) {
  const days = data.daily;
  const max = Math.max(...days.map((day) => day.amount), 0);
  if (!max) return <ChartCard className="span-12" title="Calendário de gastos"><Empty>Sem despesas no período.</Empty></ChartCard>;
  const offset = new Date(days[0].date + "T12:00:00Z").getUTCDay();
  const busiest = [...days].sort((a, b) => b.amount - a.amount)[0];
  const cell = (day: (typeof days)[number]) => {
    const step = level(day.amount, max);
    return <button type="button" key={day.date} className="heat-day" style={{ background: SEQUENTIAL[step] }}
      aria-label={dayLabel(day.date) + ": " + brl(day.amount)} title={dayLabel(day.date) + " · " + brl(day.amount)}
      onClick={() => day.amount && openDetail(dayDetail(day.date, "Gastos de " + dayLabel(day.date)))} />;
  };
  const long = days.length > 62;
  return <ChartCard className="span-12" title="Calendário de gastos" detail={"Dia com mais gasto: " + dayLabel(busiest.date) + ", " + brl(busiest.amount)}>
    {long
      ? <div style={{ display: "grid", gridTemplateRows: "repeat(7, 12px)", gridAutoFlow: "column", gridAutoColumns: "12px", gap: 3, overflowX: "auto", paddingBottom: 4 }}>
        {Array.from({ length: offset }, (_, index) => <span key={"o" + index} />)}{days.map(cell)}
      </div>
      : <div className="heat" style={{ maxWidth: 300 }}>
        {WEEKDAYS.map((day, index) => <span key={index} className="heat-head">{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={"o" + index} className="heat-day out" />)}{days.map(cell)}
      </div>}
    <div className="heat-scale" aria-hidden="true"><span>Menos</span>{SEQUENTIAL.map((color) => <i key={color} style={{ background: color }} />)}<span>Mais</span></div>
  </ChartCard>;
}
