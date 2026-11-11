"use client";

import { Fragment } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SectionProps } from "./analytics-page";
import { AXIS, axisMoney, brl, ChartCard, compact, Empty, GRID, Legend, monthLong, monthShort, percent, SERIES, TooltipBox } from "./kit";
import { BalanceCard } from "./cashflow";
import { RankList } from "./rank-list";

export function InstitutionsSection({ data }: SectionProps) {
  const banks = data.institutions.slice(0, SERIES.length);
  return <div className="an-grid">
    <ChartCard className="span-12" title="Uso de cada instituição" detail="Entradas e saídas brutas, e quanto delas é despesa de fato">
      {banks.length ? <div className="an-table-wrap"><table className="an-table">
        <thead><tr><th>Instituição e conta</th><th className="num">Entradas</th><th className="num">Saídas</th>
          <th className="num">Despesas</th><th className="num">Lançamentos</th><th className="num">Das despesas</th></tr></thead>
        <tbody>{banks.map((bank, index) => <Fragment key={bank.id}>
          <tr>
            <td><span className="inline-flex items-center gap-2"><i style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[index] }} aria-hidden="true" />
              <strong>{bank.name}</strong></span></td>
            <td className="num">{brl(bank.inflow)}</td><td className="num">{brl(bank.outflow)}</td>
            <td className="num"><strong>{brl(bank.expense)}</strong></td><td className="num">{bank.count}</td><td className="num">{percent(bank.share)}</td>
          </tr>
          {bank.accounts.map((account) => <tr className="sub" key={account.key}>
            <td>{account.name}{account.last4 ? " · " + account.last4 : ""} · {account.type === "CREDIT" ? "cartão" : "conta"}</td>
            <td className="num">{brl(account.inflow)}</td><td className="num">{brl(account.outflow)}</td>
            <td className="num">{brl(account.expense)}</td><td className="num">{account.count}</td><td className="num" />
          </tr>)}
        </Fragment>)}</tbody>
      </table></div> : <Empty>Nenhuma instituição com lançamentos no período.</Empty>}
    </ChartCard>
    <MonthlyByBank data={data} />
    <BalanceCard data={data} className="span-5" />
    {banks.map((bank, index) => <ChartCard key={bank.id} className={banks.length > 1 ? "span-6" : "span-12"}
      title={"Como paga no " + bank.name} detail="Despesas por forma de pagamento">
      <RankList rows={bank.methods} color={SERIES[index]} empty="Sem despesas no período." />
    </ChartCard>)}
  </div>;
}

function MonthlyByBank({ data }: { data: SectionProps["data"] }) {
  const banks = data.institutions.slice(0, SERIES.length);
  const months = banks[0]?.monthly.map((row, index) => ({
    month: row.month, ...Object.fromEntries(banks.map((bank) => [bank.id, bank.monthly[index]?.amount ?? 0])),
  })) ?? [];
  const first = months.findIndex((row) => banks.some((bank) => Number((row as Record<string, unknown>)[bank.id]) > 0));
  return <ChartCard className="span-7" title="Despesa mensal por instituição" detail="Últimos 12 meses">
    {first >= 0 ? <>
      <Legend items={banks.map((bank, index) => ({ label: bank.name, color: SERIES[index] }))} />
      <div className="an-chart" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months.slice(first)} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
            <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={banks.map((bank, index) => ({
                label: bank.name, color: SERIES[index], value: brl(Number(payload[0].payload[bank.id] ?? 0)) }))} /> : null} />
            {banks.map((bank, index) => <Bar key={bank.id} dataKey={bank.id} fill={SERIES[index]} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </> : <Empty>Sem despesas nos últimos 12 meses.</Empty>}
  </ChartCard>;
}
