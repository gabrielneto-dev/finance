"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, axisMoney, brl, ChartCard, Delta, Empty, GRID, Kpi, Legend, monthLong, monthShort, percent, TooltipBox } from "@/components/analytics/kit";
import { RankList } from "@/components/analytics/rank-list";
import { businessDetail } from "@/components/analytics/details";
import type { PlanningData } from "@/lib/planning/types";
import type { PlanningProps } from "./planning-page";

const REVENUE = "var(--series-1)";
const COSTS = "var(--series-3)";
const COST_LABEL: Record<string, string> = {
  negocio_mercadoria: "Compra de mercadoria", negocio_frete: "Frete e envio", negocio_taxas: "Taxas e plataformas", negocio_outros: "Outros custos",
};
const SPLIT_LABEL: Record<string, string> = {
  reposicao: "Reposição de mercadoria", impostos: "Impostos e taxas", operacao: "Operação", retirada: "Retirada para você", lucro: "Lucro guardado",
};

export function BusinessSection({ data, act, openDetail }: PlanningProps) {
  const report = data.business;
  if (!report.hasData) return <div className="an-grid">
    <ChartCard className="span-12" title="Sua revenda dá lucro?">
      <div className="pl-empty-row"><Store aria-hidden="true" />
        <div><p>Nenhuma venda ou custo do negócio marcado nos últimos 12 meses.</p>
          <ol className="pl-steps">
            <li>No Extrato ou nas Análises, abra a categoria de um lançamento.</li>
            <li>Escolha <b>Vendas do negócio</b> para o que recebeu e <b>Compra de mercadoria</b>, <b>Frete e envio</b> ou <b>Taxas e plataformas</b> para o que pagou.</li>
            <li>Use <b>Retirada do negócio</b> quando passar dinheiro da revenda para a vida pessoal.</li>
            <li>Com uma conta só do negócio, marque-a abaixo: créditos viram vendas e débitos viram custos.</li>
          </ol></div>
      </div>
    </ChartCard>
    <BusinessAccounts data={data} act={act} />
  </div>;
  const { current, previous } = report;
  const months = report.monthly.slice(report.monthly.findIndex((row) => row.revenue || row.cost));
  const costs = Object.entries(current.costs).filter(([, amount]) => amount > 0).map(([id, amount]) => ({ label: COST_LABEL[id] ?? id, amount }))
    .sort((a, b) => b.amount - a.amount);
  return <div className="an-grid">
    <dl className="kpis">
      <Kpi label="Vendas" value={brl(current.revenue)} foot={<>{previous && <Delta current={current.revenue} previous={previous.revenue} />}
        <span>{current.sales} {current.sales === 1 ? "venda" : "vendas"}{current.ticket !== null ? " · ticket " + brl(current.ticket) : ""}</span></>} />
      <Kpi label="Custos" value={brl(current.cost)} foot={previous ? <Delta current={current.cost} previous={previous.cost} lowerIsBetter /> : undefined} />
      <Kpi label="Lucro" lead value={brl(current.profit)} tone={current.profit < 0 ? "negative" : undefined}
        foot={<>{previous && <Delta current={current.profit} previous={previous.profit} />}<span>Entra no resultado das Análises</span></>} />
      <Kpi label="Margem" value={current.margin === null ? "—" : percent(current.margin)} tone={current.margin !== null && current.margin < 0 ? "negative" : undefined}
        foot={<span>Retirado para você: {brl(current.withdrawals)}</span>} />
    </dl>
    <ChartCard className="span-8" title="Vendas, custos e lucro" detail="Últimos 12 meses"
      action={<button type="button" className="chip" onClick={() => openDetail(businessDetail("Lançamentos do negócio"))}>Ver lançamentos do mês</button>}>
      <Legend items={[{ label: "Vendas", color: REVENUE }, { label: "Custos", color: COSTS }, { label: "Lucro", color: "#2f3632", kind: "line" }]} />
      <div className="an-chart" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
            <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[
                { label: "Vendas", value: brl(payload[0].payload.revenue), color: REVENUE },
                { label: "Custos", value: brl(payload[0].payload.cost), color: COSTS },
                { label: "Lucro", value: brl(payload[0].payload.profit) },
                { label: "Vendas no mês", value: String(payload[0].payload.sales) }]} /> : null} />
            <Bar dataKey="revenue" fill={REVENUE} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="cost" fill={COSTS} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Line dataKey="profit" stroke="#2f3632" strokeWidth={2} dot={{ r: 3, fill: "#2f3632" }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
    <ChartCard className="span-4" title="Composição dos custos" detail={monthLong(current.month)}>
      <RankList rows={costs} color={COSTS} empty="Sem custos neste mês." />
    </ChartCard>
    <ChartCard className="span-6" title="Profit First" detail={"De cada R$ 100 vendidos, hoje contra a sugestão" + (report.splitBasis === "tres_meses" ? " (últimos 3 meses)" : "")}>
      {report.split ? <table className="an-table">
        <thead><tr><th>Destino</th><th className="num">Hoje</th><th className="num">Sugerido</th></tr></thead>
        <tbody>{report.split.map((item) => <tr key={item.id}><td>{SPLIT_LABEL[item.id] ?? item.id}</td>
          <td className={"num" + (item.actualPer100 < 0 ? " negative" : "")}>{brl(item.actualPer100)}</td><td className="num">{brl(item.suggestedPer100)}</td></tr>)}</tbody>
      </table> : <Empty>Sem vendas para dividir.</Empty>}
      <p className="an-note">A sugestão mantém a reposição de mercadoria e divide o resto em 5% de lucro, 50% de retirada, 15% de impostos e 30% de operação.</p>
    </ChartCard>
    <BusinessAccounts data={data} act={act} />
  </div>;
}

function BusinessAccounts({ data, act }: { data: PlanningData; act: PlanningProps["act"] }) {
  const [error, setError] = useState("");
  const accounts = data.accounts;
  return <ChartCard className="span-6" title="Conta do negócio" detail="Créditos viram vendas e débitos viram custos. Pagamento de fatura e transferências seguem fora.">
    {accounts.length ? <ul className="pl-adjustments">{accounts.map((row) => {
      const [itemId, accountId] = row.key.split("/");
      return <li key={row.key}>
        <button type="button" className="an-compare" aria-pressed={row.business} aria-label={(row.business ? "Desmarcar " : "Marcar ") + row.name + " como conta do negócio"}
          onClick={async () => { setError(""); try { await act({ action: "account-business", itemId, accountId, business: !row.business }); }
            catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); } }}><span aria-hidden="true" /></button>
        <div><strong>{row.name}</strong><small>{row.type === "CREDIT" ? "Cartão" : "Conta"}{row.last4 ? " · " + row.last4 : ""}</small></div>
        <span />
      </li>;
    })}</ul> : <Empty>Nenhuma conta conectada.</Empty>}
    {error && <p className="pl-error" role="alert">{error}</p>}
  </ChartCard>;
}
