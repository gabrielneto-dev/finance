"use client";

import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AXIS, axisMoney, brl, ChartCard, dayLabel, Empty, GRID, Kpi, monthLong, monthShort, percent, SERIES, TooltipBox } from "@/components/analytics/kit";
import type { PlanningProps } from "./planning-page";

export function NetworthSection({ data, hidden, secret, edit }: PlanningProps) {
  const worth = data.networth;
  const debt = worth.cardDebt + worth.installmentsDebt;
  const history = worth.history.filter((row) => row.total !== null);
  const flows = worth.contributions.filter((row, index, list) => row.amount !== 0 || list.slice(0, index).some((item) => item.amount !== 0));
  return <div className="an-grid">
    <dl className="kpis">
      <Kpi label="Patrimônio líquido" lead value={secret(worth.total)} foot={<span>Contas + investimentos − dívidas do cartão</span>} />
      <Kpi label="Investido" value={secret(worth.invested)} foot={<span>{data.investments.length} {data.investments.length === 1 ? "investimento" : "investimentos"}</span>} />
      <Kpi label="Em conta" value={secret(worth.cash)} foot={<span>Dívidas do cartão: {secret(debt)}</span>} />
      <Kpi label="Taxa de investimento" value={worth.investmentRate === null ? "—" : percent(worth.investmentRate)}
        foot={<span>{worth.reserveMonths === null ? "Sem gasto essencial para medir a reserva" : "Liquidez diária cobre " + worth.reserveMonths.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " meses"}</span>} />
    </dl>
    <ChartCard className="span-8" title="Evolução do patrimônio" detail="Contas e investimentos no fim de cada mês, sem descontar o cartão. O saldo das contas é reconstruído pelos lançamentos">
      {history.length > 1 ? <div className="an-chart" style={{ height: 240 }} role="img" aria-label="Evolução do patrimônio nos últimos meses">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} />
            <YAxis hide={hidden} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={52} />
            <Tooltip cursor={{ stroke: "#9aa59d", strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[
                { label: "Contas", value: secret(payload[0].payload.accounts ?? 0), color: SERIES[1] },
                { label: "Investimentos", value: secret(payload[0].payload.investments), color: SERIES[3] },
                { label: "Total", value: secret(payload[0].payload.total ?? 0) }]} /> : null} />
            <Line dataKey="total" stroke="var(--series-1)" strokeWidth={2.2} dot={{ r: 2.5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div> : <Empty>Sem saldo de conta para reconstruir a evolução.</Empty>}
    </ChartCard>
    <ChartCard className="span-4" title="Alocação" detail="Por classe e por liquidez">
      {worth.invested > 0 ? <>
        <Allocation rows={worth.byClass} hidden={hidden} />
        <h3 className="pl-subtitle">Liquidez</h3>
        <Allocation rows={worth.byLiquidity} hidden={hidden} />
      </> : <Empty>Cadastre investimentos para ver a alocação.</Empty>}
    </ChartCard>
    <ChartCard className="span-5" title="Aportes por mês" detail="Aplicações menos resgates, pelos lançamentos marcados como investimento">
      {flows.length ? <div className="an-chart" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={flows} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
            <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[{ label: "Aporte líquido", value: brl(payload[0].payload.amount) }]} /> : null} />
            <Bar dataKey="amount" fill="var(--series-4)" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div> : <Empty>Nenhum aporte nos últimos 12 meses. Marque aplicações como &quot;Aporte em investimento&quot; no Extrato.</Empty>}
    </ChartCard>
    <ChartCard className="span-7" title="Investimentos" detail="Manuais e importados da Pluggy"
      action={<Button size="sm" variant="outline" onClick={() => edit({ type: "investment" })}><Plus />Novo</Button>}>
      {data.investments.length ? <ul className="pl-list">{data.investments.map((row) => <li key={row.id} className="pl-item">
        <div className="pl-item-main"><strong>{row.name}</strong>
          <small>{row.classLabel} · {row.liquidityLabel}{row.institution ? " · " + row.institution : ""}</small>
          <small>Atualizado em {dayLabel(row.updatedAt.slice(0, 10))}{row.dueDate ? " · vence " + dayLabel(row.dueDate) : ""}</small></div>
        <Badge variant={row.source === "pluggy" ? "secondary" : "outline"}>{row.source === "pluggy" ? "Pluggy" : "Manual"}</Badge>
        <div className="pl-item-figures"><b>{secret(row.balance)}</b></div>
        {row.source === "manual" && <div className="pl-item-actions">
          <Button variant="ghost" size="icon-xs" onClick={() => edit({ type: "balance", investment: row })} aria-label={"Atualizar saldo de " + row.name} title="Atualizar saldo"><RefreshCw /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => edit({ type: "investment", investment: row })} aria-label={"Editar " + row.name}><Pencil /></Button>
        </div>}
      </li>)}</ul> : <Empty>Nenhum investimento. Cadastre manualmente ou reautorize a conexão para importar pela Pluggy.</Empty>}
    </ChartCard>
  </div>;
}

function Allocation({ rows, hidden }: { rows: { id: string; label: string; amount: number; share: number }[]; hidden: boolean }) {
  return <div className="rank">{rows.map((row, index) => <div className="rank-row" key={row.id}>
    <span className="rank-label"><span>{row.label}</span></span>
    <span className="rank-bar" aria-hidden="true"><span style={{ width: row.share * 100 + "%", background: SERIES[index % SERIES.length] }} /></span>
    <span className="rank-value">{percent(row.share)}{!hidden && <small>{brl(row.amount)}</small>}</span>
  </div>)}</div>;
}
