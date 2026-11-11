"use client";

import { useContext, useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HiddenValues } from "@/components/hidden-values";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BillParts, CardSummary } from "@/lib/analytics/types";
import type { SectionProps } from "./analytics-page";
import { AXIS, axisMoney, brl, ChartCard, compact, dayLabel, Empty, GRID, Kpi, Legend, monthLong, monthShort, percent, TooltipBox } from "./kit";

const OFFICIAL = "var(--series-2)";
const MASK = "R$ ••••••";
const OPEN = "aberta";
const PART_COLORS = { avista: "var(--series-2)", parcelas: "var(--series-4)", iof: "var(--series-3)", exterior: "var(--series-5)" };
const PART_LABELS = { avista: "À vista", parcelas: "Parcelas", iof: "IOF e tarifas", exterior: "Compras no exterior" };

type BillOption = { id: string; label: string; due: string | null; amount: number | null; parts: BillParts; estimated: boolean; forecast: number };

function options(card: CardSummary): BillOption[] {
  const official = card.bills.map((bill) => ({ id: bill.id, label: "Vence " + dayLabel(bill.due), due: bill.due, amount: bill.amount, parts: bill, estimated: false, forecast: 0 }));
  return card.open ? [...official, { id: OPEN, label: "Aberta" + (card.open.due ? " · vence " + dayLabel(card.open.due) : ""),
    due: card.open.due, amount: card.open.amount, parts: card.open, estimated: true, forecast: card.open.estimated }] : official;
}

export function BillsSection({ data }: SectionProps) {
  const hidden = useContext(HiddenValues);
  const mask = (value: string) => hidden ? MASK : value;
  const [cardKey, setCardKey] = useState(data.cards[0]?.key ?? "");
  const card = data.cards.find((row) => row.key === cardKey) ?? data.cards[0];
  const [selected, setSelected] = useState(OPEN);
  if (!card) return <div className="an-grid"><ChartCard className="span-12" title="Faturas"><Empty>Nenhum cartão nesta seleção.</Empty></ChartCard></div>;
  const list = options(card);
  const bill = list.find((row) => row.id === selected) ?? list.at(-1);
  const next = card.future[1];
  const share = data.commitment.averageIncome > 0 && next ? (next.imported + next.estimated) / data.commitment.averageIncome : null;

  return <div className="an-grid">
    {data.cards.length > 1 && <div className="span-12 chips" role="group" aria-label="Cartão">{data.cards.map((row) =>
      <button type="button" key={row.key} className="chip" aria-pressed={row.key === card.key}
        onClick={() => { setCardKey(row.key); setSelected(OPEN); }}>{row.name}{row.last4 ? " · " + row.last4 : ""}</button>)}</div>}
    <dl className="kpis">
      <Kpi label="Fatura aberta" lead value={card.open?.amount != null ? mask(brl(card.open.amount)) : "—"}
        foot={<span>{card.open?.due ? "Estimativa · vence " + dayLabel(card.open.due) : "Sem ciclo aberto"}</span>} />
      <Kpi label="Média das últimas 6" value={card.average !== null ? mask(brl(card.average)) : "—"} foot={<span>Faturas oficiais</span>} />
      <Kpi label="Uso do limite" value={card.usage !== null ? (hidden ? "••%" : percent(card.usage)) : "—"}
        tone={card.usage !== null && card.usage > 0.8 ? "negative" : undefined}
        foot={<span>{card.limit ? "Limite de " + mask(brl(card.limit)) : "Limite não informado"}</span>} />
      <Kpi label={"Parcelas de " + (next ? monthLong(next.month) : "próximo mês")} value={next ? brl(next.imported + next.estimated) : "—"}
        foot={<span>{share !== null ? percent(share) + " da renda média" : "Já comprometido"}</span>} />
    </dl>
    <HistoryCard list={list} selected={bill?.id ?? ""} onSelect={setSelected} hidden={hidden} />
    <ChartCard className="span-4" title="Composição" detail={bill ? bill.label + (bill.estimated ? " · estimativa" : "") : undefined}>
      {bill ? <Parts parts={bill.parts} forecast={bill.forecast} total={bill.amount} mask={mask} /> : <Empty>Sem fatura para detalhar.</Empty>}
    </ChartCard>
    <FutureCard card={card} />
    <CompareCard list={list} />
  </div>;
}

function HistoryCard({ list, selected, onSelect, hidden }: { list: BillOption[]; selected: string; onSelect: (id: string) => void; hidden: boolean }) {
  const rows = list.filter((row) => row.amount !== null).map((row) => ({ ...row, month: row.due ? row.due.slice(0, 7) : "" }));
  return <ChartCard className="span-8" title="Faturas por vencimento" detail="Escolha uma fatura para ver a composição">
    {rows.length ? <>
      <Legend items={[{ label: "Oficial", color: OFFICIAL }, { label: "Aberta (estimada)", color: "var(--seq-3)" }]} />
      <div className="an-chart" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="24%">
            <defs><pattern id="bill-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--seq-1)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--seq-4)" strokeWidth="2" /></pattern></defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(value: string) => value ? monthShort(value) : ""} />
            <YAxis hide={hidden} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
            <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={payload[0].payload.label} rows={[{ label: payload[0].payload.estimated ? "Estimativa" : "Valor",
                value: hidden ? MASK : brl(payload[0].payload.amount) }]} /> : null} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false} cursor="pointer"
              onClick={(entry) => { const id = (entry.payload as BillOption | undefined)?.id; if (id) onSelect(id); }}>
              {rows.map((row) => <Cell key={row.id} fill={row.estimated ? "url(#bill-hatch)" : OFFICIAL}
                stroke={row.id === selected ? "#171a18" : "none"} strokeWidth={row.id === selected ? 2 : 0} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </> : <Empty>O banco ainda não devolveu faturas deste cartão.</Empty>}
  </ChartCard>;
}

function Parts({ parts, forecast, total, mask }: { parts: BillParts; forecast: number; total: number | null; mask: (value: string) => string }) {
  const keys = (Object.keys(PART_LABELS) as (keyof typeof PART_LABELS)[]).filter((key) => parts[key] > 0);
  if (!keys.length && !parts.estornos && !forecast) return <Empty>Sem compras vinculadas a esta fatura.</Empty>;
  return <div className="parts">
    {keys.map((key) => <div key={key}><i style={{ background: PART_COLORS[key] }} aria-hidden="true" /><span>{PART_LABELS[key]}</span><b>{brl(parts[key])}</b></div>)}
    {forecast > 0 && <div><i style={{ backgroundImage: "repeating-linear-gradient(45deg, var(--seq-4) 0 2px, var(--seq-1) 2px 5px)" }} aria-hidden="true" />
      <span>Parcelas previstas</span><b>{brl(forecast)}</b></div>}
    {parts.estornos > 0 && <div><i style={{ background: "var(--series-1)" }} aria-hidden="true" /><span>Estornos</span><b>−{brl(parts.estornos)}</b></div>}
    {total !== null && <div className="total"><i aria-hidden="true" /><span>Total da fatura</span><b>{mask(brl(total))}</b></div>}
  </div>;
}

function FutureCard({ card }: { card: CardSummary }) {
  const rows = card.future.filter((row) => row.imported || row.estimated);
  return <ChartCard className="span-5" title="Parcelas já comprometidas" detail="Quanto das próximas faturas já está decidido">
    {rows.length ? <>
      <Legend items={[{ label: "Importadas", color: "var(--series-4)" }, { label: "Previstas", color: "var(--seq-3)" }]} />
      <div className="an-chart" style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={card.future} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="24%">
            <defs><pattern id="future-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--seq-1)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--seq-4)" strokeWidth="2" /></pattern></defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={monthShort} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={48} />
            <Tooltip cursor={{ fill: "#f1f5f2" }} content={({ active, payload }) => active && payload?.length
              ? <TooltipBox title={monthLong(payload[0].payload.month)} rows={[
                { label: "Importadas", value: brl(payload[0].payload.imported), color: "var(--series-4)" },
                { label: "Previstas", value: brl(payload[0].payload.estimated), color: "var(--seq-3)" }]} /> : null} />
            <Bar dataKey="imported" stackId="f" fill="var(--series-4)" stroke="var(--card)" strokeWidth={1} maxBarSize={30} isAnimationActive={false} />
            <Bar dataKey="estimated" stackId="f" fill="url(#future-hatch)" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </> : <Empty>Nenhuma parcela futura neste cartão.</Empty>}
  </ChartCard>;
}

function CompareCard({ list }: { list: BillOption[] }) {
  const firstId = useId();
  const secondId = useId();
  const [first, setFirst] = useState(list.at(-2)?.id ?? "");
  const [second, setSecond] = useState(list.at(-1)?.id ?? "");
  if (list.length < 2) return <ChartCard className="span-7" title="Comparar faturas"><Empty>É preciso ter duas faturas para comparar.</Empty></ChartCard>;
  const a = list.find((row) => row.id === first) ?? list.at(-2)!;
  const b = list.find((row) => row.id === second) ?? list.at(-1)!;
  const groups = Array.from(new Set([...Object.keys(a.parts.byGroup), ...Object.keys(b.parts.byGroup)]))
    .map((label) => ({ label, a: a.parts.byGroup[label] ?? 0, b: b.parts.byGroup[label] ?? 0 }))
    .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
  const picker = (id: string, label: string, value: string, onChange: (value: string) => void) => <div className="field">
    <span id={id}>{label}</span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-labelledby={id} className="select-trigger"><SelectValue /></SelectTrigger>
      <SelectContent>{list.map((row) => <SelectItem key={row.id} value={row.id}>{row.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
  return <ChartCard className="span-7" title="Comparar faturas" detail="O que mudou de uma fatura para outra, por grupo">
    <div className="flex flex-wrap gap-2" style={{ marginBottom: 10 }}>
      {picker(firstId, "Fatura A", a.id, setFirst)}{picker(secondId, "Fatura B", b.id, setSecond)}
    </div>
    {groups.length ? <div className="an-table-wrap"><table className="an-table">
      <thead><tr><th>Grupo</th><th className="num">A</th><th className="num">B</th><th className="num">Diferença</th></tr></thead>
      <tbody>{groups.map((row) => <tr key={row.label}>
        <td>{row.label}</td><td className="num">{brl(row.a)}</td><td className="num">{brl(row.b)}</td>
        <td className="num" style={{ color: row.b > row.a ? "var(--destructive)" : row.b < row.a ? "var(--primary)" : undefined }}>
          {row.b - row.a > 0 ? "+" : ""}{brl(row.b - row.a)}</td>
      </tr>)}</tbody>
    </table></div> : <Empty>Sem compras vinculadas a essas faturas.</Empty>}
  </ChartCard>;
}
