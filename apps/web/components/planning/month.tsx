"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, CircleX, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl, ChartCard, Empty, Kpi, percent } from "@/components/analytics/kit";
import { merchantLabel } from "@/lib/analytics/merchant.mjs";
import { spendingValue } from "@/lib/analytics/classify.mjs";
import { BUCKET_COLOR, UNASSIGNED_COLOR } from "@/lib/planning/format";
import type { BucketRow, BucketStatus, PlanningData, PlanningEntry } from "@/lib/planning/types";
import type { DetailSpec } from "@/components/analytics/detail-sheet";
import type { PlanningProps } from "./planning-page";

export const STATUS: Record<BucketStatus, { label: string; Icon: typeof CircleCheck }> = {
  dentro: { label: "Dentro", Icon: CircleCheck }, atencao: { label: "Atenção", Icon: CircleAlert }, estourou: { label: "Estourou", Icon: CircleX },
};

const value = (row: PlanningEntry) => row.info.kind === "investimento" ? (row.direction === "DEBIT" ? row.info.amount : -row.info.amount) : spendingValue(row.info);

export function bucketDetail(bucket: { id: string | null; name: string; kind?: string }): DetailSpec {
  return { title: bucket.name, mode: bucket.kind === "investir" ? "amount" : "spending",
    filter: (entry) => (entry as PlanningEntry).bucket === bucket.id };
}

/** Pede a sugestão pelo Plano Consciente, com mensagem de erro no lugar. */
export function SuggestButton({ act, month, label = "Sugerir pelo Plano Consciente" }: { act: PlanningProps["act"]; month: string; label?: string }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <span className="pl-inline">
    <Button size="sm" onClick={async () => {
      setSaving(true); setError("");
      try { await act({ action: "bucket-suggest", month }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível sugerir."); }
      finally { setSaving(false); }
    }} disabled={saving}><Sparkles />{saving ? "Calculando…" : label}</Button>
    {error && <span className="pl-error" role="alert">{error}</span>}
  </span>;
}

export function MonthSection({ data, secret, act, edit, openDetail, go }: PlanningProps) {
  const { budget, income } = data;
  const unallocated = budget.unallocated;
  return <div className="an-grid">
    <dl className="kpis">
      <Kpi label="Renda prevista" value={brl(income.expected)}
        foot={<><span>{income.manual !== null ? "Definida por você" : "Estimada pelos últimos 3 meses"}</span>
          <button type="button" className="pl-link" onClick={() => edit({ type: "income" })}>Alterar</button></>} />
      <Kpi label="Planejado" value={brl(budget.planned)} foot={<span>{budget.buckets.length} {budget.buckets.length === 1 ? "caixinha" : "caixinhas"}</span>} />
      <Kpi label={budget.clock.current ? "Gasto até hoje" : budget.clock.past ? "Gasto no mês" : "Gasto"} value={brl(budget.spent)}
        foot={budget.unassigned > 0 ? <span>{brl(budget.unassigned)} sem caixinha</span> : undefined} />
      <Kpi label="Renda sem destino" lead value={brl(unallocated)}
        foot={<span>{unallocated === 0 ? "Toda a renda tem destino" : unallocated > 0 ? "Divida entre as caixinhas até zerar" : "Planejado acima da renda"}</span>} />
    </dl>
    <ChartCard className="span-8" title="Caixinhas do mês" detail={budget.clock.current ? "Quanto ainda pode gastar em cada uma até o fim do mês" : undefined}
      action={budget.buckets.length ? <button type="button" className="chip" onClick={() => go("caixinhas")}>Editar divisão</button> : undefined}>
      {budget.buckets.length ? <div className="pl-buckets">
        {budget.buckets.map((bucket) => <BucketCard key={bucket.id} bucket={bucket} data={data} onOpen={() => openDetail(bucketDetail(bucket))}
          onAdjust={() => edit({ type: "bucket-month", bucket })} />)}
        {budget.unassigned !== 0 && <button type="button" className="pl-bucket muted" onClick={() => openDetail(bucketDetail({ id: null, name: "Sem caixinha" }))}>
          <div className="pl-bucket-head"><span className="pl-dot" style={{ background: UNASSIGNED_COLOR }} /><strong>Sem caixinha</strong></div>
          <div className="pl-bucket-figures"><span>Gasto</span><b>{brl(budget.unassigned)}</b></div>
          <small>Despesas de grupos que não estão em nenhuma caixinha.</small>
        </button>}
      </div> : <Empty><div className="pl-empty">
        <p>Divida a renda em caixinhas para saber quanto ainda pode gastar.</p>
        <SuggestButton act={act} month={data.month} />
        <Button size="sm" variant="outline" onClick={() => edit({ type: "bucket" })}>Criar do zero</Button>
      </div></Empty>}
    </ChartCard>
    <FrameworkCard data={data} />
    <TopSpending data={data} openDetail={openDetail} secret={secret} />
  </div>;
}

function BucketCard({ bucket, data, onOpen, onAdjust }: { bucket: BucketRow; data: PlanningData; onOpen: () => void; onAdjust: () => void }) {
  const { label, Icon } = STATUS[bucket.status];
  const scale = Math.max(bucket.planned, bucket.spent, 1);
  const clock = data.budget.clock;
  return <div className={"pl-bucket " + bucket.status}>
    <div className="pl-bucket-head">
      <span className="pl-dot" style={{ background: BUCKET_COLOR[bucket.kind] ?? UNASSIGNED_COLOR }} />
      <button type="button" className="pl-bucket-name" onClick={onOpen}>{bucket.name}</button>
      <span className={"pl-status " + bucket.status}><Icon size={14} aria-hidden="true" />{label}</span>
      <Button variant="ghost" size="icon-xs" onClick={onAdjust} aria-label={"Ajustar " + bucket.name + " só neste mês"} title="Ajustar só neste mês"><Pencil /></Button>
    </div>
    <div className="pl-meter" role="img" aria-label={brl(bucket.spent) + " de " + brl(bucket.planned)}>
      <span className="fill" style={{ width: Math.min(100, bucket.spent / scale * 100) + "%", background: BUCKET_COLOR[bucket.kind] ?? UNASSIGNED_COLOR }} />
      {bucket.planned > 0 && bucket.spent > bucket.planned && <span className="over" style={{ left: bucket.planned / scale * 100 + "%" }} />}
      {clock.current && bucket.planned > 0 && <span className="pace" style={{ left: Math.min(100, bucket.expectedToday / scale * 100) + "%" }} title="Ritmo esperado para hoje" />}
    </div>
    <div className="pl-bucket-figures">
      <span>{brl(bucket.spent)} de {brl(bucket.planned)}</span>
      <b className={bucket.available < 0 ? "negative" : undefined}>{bucket.available < 0 ? brl(-bucket.available) + " acima" : brl(bucket.available) + " livre"}</b>
    </div>
    <small>
      {bucket.perDay !== null && bucket.available > 0 ? brl(bucket.perDay) + " por dia até o fim do mês" : clock.past ? "Mês encerrado" : clock.current ? "Nada disponível até o fim do mês" : "Mês ainda não começou"}
      {bucket.carry > 0 && " · inclui " + brl(bucket.carry) + " acumulados"}
      {bucket.adjusted && " · valor ajustado neste mês"}
    </small>
  </div>;
}

function FrameworkCard({ data }: { data: PlanningData }) {
  const income = data.budget.income;
  return <ChartCard className="span-4" title="Plano Consciente" detail="Cada fatia contra a faixa recomendada da renda">
    {income > 0 ? <div className="pl-framework">{data.framework.map((item) => {
      const max = 0.7;
      const share = item.share ?? 0;
      return <div key={item.kind}>
        <div className="pl-framework-head"><strong>{item.name}</strong>
          <span>{percent(share)} <small>· faixa {percent(item.min)}{item.max !== item.min ? "–" + percent(item.max) : ""}</small></span></div>
        <div className="pl-range" role="img" aria-label={item.name + ": " + percent(share) + ", faixa de " + percent(item.min) + " a " + percent(item.max)}>
          <span className="band" style={{ left: item.min / max * 100 + "%", width: (item.max - item.min) / max * 100 + "%" }} />
          <span className={"mark " + (item.position ?? "")} style={{ left: Math.min(100, share / max * 100) + "%", background: BUCKET_COLOR[item.kind] }} />
        </div>
        <small className={"pl-position " + (item.position ?? "")}>{item.position === "dentro" ? "Dentro da faixa" : item.position === "acima" ? "Acima da faixa" : "Abaixo da faixa"}
          {item.kind === "reservas" ? " (planejado)" : item.kind === "investir" ? " (aportado)" : " (gasto)"}</small>
      </div>;
    })}</div> : <Empty>Sem renda prevista para comparar.</Empty>}
  </ChartCard>;
}

function TopSpending({ data, openDetail }: { data: PlanningData; openDetail: PlanningProps["openDetail"]; secret: PlanningProps["secret"] }) {
  const groups = [...data.budget.buckets.map((bucket) => ({ id: bucket.id as string | null, name: bucket.name, kind: bucket.kind })),
    { id: null, name: "Sem caixinha", kind: "" }];
  const lists = groups.map((bucket) => {
    const places = new Map<string, number>();
    for (const row of data.entries) if (row.bucket === bucket.id) places.set(row.merchant, (places.get(row.merchant) ?? 0) + value(row));
    return { bucket, top: Array.from(places).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]).slice(0, 3) };
  }).filter((item) => item.top.length);
  return <ChartCard className="span-12" title="Maiores gastos de cada caixinha" detail="Abra para ver os lançamentos e trocar a categoria">
    {lists.length ? <div className="pl-top">{lists.map(({ bucket, top }) => <section key={bucket.id ?? "sem"}>
      <h3><span className="pl-dot" style={{ background: BUCKET_COLOR[bucket.kind] ?? UNASSIGNED_COLOR }} />{bucket.name}</h3>
      <ul>{top.map(([key, amount]) => <li key={key}><button type="button" onClick={() => openDetail({ ...bucketDetail(bucket),
        title: merchantLabel(key), subtitle: bucket.name, filter: (entry) => (entry as PlanningEntry).bucket === bucket.id && entry.merchant === key })}>
        <span>{merchantLabel(key)}</span><b>{brl(amount)}</b></button></li>)}</ul>
    </section>)}</div> : <Empty>Sem gastos neste mês.</Empty>}
  </ChartCard>;
}
