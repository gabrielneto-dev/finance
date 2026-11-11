"use client";

import type { SectionProps } from "./analytics-page";
import { brl, ChartCard, dayLabel, Delta, Empty, level, SEQUENTIAL } from "./kit";
import { merchantDetail } from "./details";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const BANDS = ["Madrugada", "Manhã", "Tarde", "Noite", "Sem horário"];
const SHORT: Record<string, string> = { Madrugada: "0–6h", "Manhã": "6–12h", Tarde: "12–18h", Noite: "18–24h", "Sem horário": "Sem hora" };

export function HabitsSection({ data, compare, openDetail }: SectionProps) {
  const annual = data.recurring.reduce((sum, row) => sum + row.annual, 0);
  return <div className="an-grid">
    <ChartCard className="span-7" title="Assinaturas e cobranças recorrentes"
      detail={data.recurring.length ? brl(annual) + " por ano · " + brl(Math.round(annual / 12)) + " por mês" : "Cobranças que se repetem todo mês"}>
      {data.recurring.length ? <ul className="detail-list">{data.recurring.map((row) => <li key={row.key}>
        <button type="button" className="text-left" onClick={() => openDetail(merchantDetail(row.key, row.label))}>
          <strong>{row.label}</strong>{" "}
          {row.isNew && <span className="tag new">nova</span>}{" "}
          {row.priceChanged && <span className="tag price">preço mudou</span>}
          <small className="block">{row.category} · última em {dayLabel(row.lastDate)} · {row.count} cobranças</small>
        </button>
        <span className="amount">{brl(row.monthly)}<small className="block" style={{ fontWeight: 500 }}>{brl(row.annual)} por ano</small></span>
      </li>)}</ul> : <Empty>Nenhuma cobrança mensal estável nos últimos 6 meses.</Empty>}
    </ChartCard>
    <ChartCard className="span-5" title="Compras pequenas" detail={"Abaixo de " + brl(data.small.threshold) + ", sem contar Pix a terceiros"}>
      {data.small.count ? <>
        <div className="big-number">{brl(data.small.amount)}</div>
        <p className="big-caption">em {data.small.count} compras no período</p>
        <ul className="detail-list" style={{ marginTop: 10 }}>{data.small.top.map((row) => <li key={row.label}>
          <div><strong>{row.label}</strong><small className="block">{row.count} vezes</small></div><span className="amount">{brl(row.amount)}</span>
        </li>)}</ul>
      </> : <Empty>Nenhuma compra pequena no período.</Empty>}
    </ChartCard>
    <ChartCard className="span-7" title="Onde você mais gasta" detail="Estabelecimentos e destinatários do período">
      {data.merchants.length ? <div className="an-table-wrap"><table className="an-table">
        <thead><tr><th>Estabelecimento</th><th className="num">Compras</th><th className="num">Ticket</th><th className="num">Total</th></tr></thead>
        <tbody>{data.merchants.map((row) => <tr key={row.key}>
          <td><button type="button" className="text-left" onClick={() => openDetail(merchantDetail(row.key, row.label))}>
            <strong>{row.label}</strong><small className="block text-xs text-muted-foreground">{row.group}</small></button></td>
          <td className="num">{row.count}</td><td className="num">{brl(row.average)}</td>
          <td className="num"><strong>{brl(row.amount)}</strong>{compare && <> <Delta current={row.amount} previous={row.previous} lowerIsBetter /></>}</td>
        </tr>)}</tbody>
      </table></div> : <Empty>Sem despesas no período.</Empty>}
    </ChartCard>
    <WeekCard data={data} />
  </div>;
}

function WeekCard({ data }: { data: SectionProps["data"] }) {
  const max = Math.max(...data.weekdays.map((cell) => cell.amount), 0);
  const withTime = data.weekdays.some((cell) => cell.band !== "Sem horário" && cell.count > 0);
  const bands = withTime ? BANDS : ["Sem horário"];
  const byDay = DAYS.map((_, day) => data.weekdays.filter((cell) => cell.weekday === day).reduce((sum, cell) => sum + cell.amount, 0));
  const peak = byDay.indexOf(Math.max(...byDay));
  return <ChartCard className="span-5" title="Quando você gasta" detail={max ? "Dia da semana com mais gasto: " + DAYS[peak] : undefined}>
    {max ? <>
      <div className="heat-grid" style={{ gridTemplateColumns: `64px repeat(${bands.length}, minmax(0, 1fr))` }}>
        <span />{bands.map((band) => <span key={band} className="top" title={band}>{withTime ? SHORT[band] : "Total"}</span>)}
        {DAYS.map((day, index) => <div key={day} style={{ display: "contents" }}>
          <span>{day}</span>
          {bands.map((band) => {
            const cell = data.weekdays.find((item) => item.weekday === index && item.band === band)!;
            const step = level(cell.amount, max);
            return <span key={band} className={"heat-cell" + (step >= 4 ? " dark" : "")} style={{ background: SEQUENTIAL[step] }}
              title={day + " · " + band + ": " + brl(cell.amount) + " em " + cell.count + " compras"}>{cell.count || ""}</span>;
          })}
        </div>)}
      </div>
      <div className="heat-scale" aria-hidden="true"><span>Menos</span>{SEQUENTIAL.map((color) => <i key={color} style={{ background: color }} />)}<span>Mais</span></div>
    </> : <Empty>Sem compras no período.</Empty>}
  </ChartCard>;
}
