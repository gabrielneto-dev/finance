"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CalendarRange, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl, ChartCard, Empty, percent } from "@/components/analytics/kit";
import { BUCKET_COLOR, BUCKET_KIND_LABEL, keyLabel, UNASSIGNED_COLOR } from "@/lib/planning/format";
import type { BucketRow, PlanningData } from "@/lib/planning/types";
import type { PlanningProps } from "./planning-page";
import { SuggestButton } from "./month";

/** Barra da renda dividida entre as caixinhas, com o que sobra em cinza. */
export function IncomeBar({ data }: { data: PlanningData }) {
  const income = data.budget.income;
  const rows = data.budget.buckets.filter((bucket) => bucket.base > 0);
  const planned = rows.reduce((total, bucket) => total + bucket.base, 0);
  const scale = Math.max(income, planned, 1);
  const rest = Math.max(0, income - planned);
  return <div className="split">
    <div className="split-head"><span>Renda prevista {brl(income)}</span><span>{planned > income ? "Planejado passa a renda em " + brl(planned - income) : "Sem destino " + brl(rest)}</span></div>
    <div className="split-bar" role="img" aria-label={"Renda dividida: " + rows.map((row) => row.name + " " + brl(row.base)).join(", ") + (rest ? ", sem destino " + brl(rest) : "")}>
      {rows.map((bucket) => <span key={bucket.id} title={bucket.name + " · " + brl(bucket.base)}
        style={{ width: bucket.base / scale * 100 + "%", background: BUCKET_COLOR[bucket.kind] ?? UNASSIGNED_COLOR }} />)}
      {rest > 0 && <span style={{ width: rest / scale * 100 + "%", background: UNASSIGNED_COLOR }} title={"Sem destino · " + brl(rest)} />}
    </div>
    <dl className="split-legend">
      {rows.map((bucket) => <div key={bucket.id}><dt><i style={{ background: BUCKET_COLOR[bucket.kind] ?? UNASSIGNED_COLOR }} />{bucket.name}</dt>
        <dd>{brl(bucket.base)}<small>{income > 0 ? percent(bucket.base / income) : ""}</small></dd></div>)}
      <div><dt><i style={{ background: UNASSIGNED_COLOR }} />Sem destino</dt><dd>{brl(rest)}<small>{income > 0 ? percent(rest / income) : ""}</small></dd></div>
    </dl>
  </div>;
}

export function BucketsSection({ data, act, edit }: PlanningProps) {
  const [error, setError] = useState("");
  const buckets = data.budget.buckets;
  async function run(body: Record<string, unknown>) {
    setError("");
    try { await act(body); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); }
  }
  const move = (index: number, delta: number) => {
    const ids = buckets.map((row) => row.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    run({ action: "bucket-order", ids });
  };
  return <div className="an-grid">
    <ChartCard className="span-12" title="Divisão da renda" detail="Base zero: divida a renda entre as caixinhas até não sobrar nada sem destino"
      action={<div className="pl-actions"><SuggestButton act={act} month={data.month} label={buckets.length ? "Ajustar pelo Plano Consciente" : undefined} />
        <Button size="sm" variant="outline" onClick={() => edit({ type: "bucket" })}><Plus />Nova caixinha</Button></div>}>
      <IncomeBar data={data} />
      {error && <p className="pl-error" role="alert">{error}</p>}
    </ChartCard>
    <ChartCard className="span-8" title="Suas caixinhas" detail="Planejado contra a média real dos últimos 3 meses">
      {buckets.length ? <ul className="pl-list">{buckets.map((bucket, index) => <BucketItem key={bucket.id} bucket={bucket}
        first={index === 0} last={index === buckets.length - 1} onUp={() => move(index, -1)} onDown={() => move(index, 1)}
        onEdit={() => edit({ type: "bucket", bucket })} onMonth={() => edit({ type: "bucket-month", bucket })} />)}</ul>
        : <Empty>Nenhuma caixinha ainda. Use a sugestão pelo Plano Consciente ou crie uma do zero.</Empty>}
      {data.archived.length > 0 && <details className="pl-archived"><summary>Arquivadas ({data.archived.length})</summary>
        <ul>{data.archived.map((bucket) => <li key={bucket.id}><span>{bucket.name}</span>
          <Button size="xs" variant="outline" onClick={() => run({ action: "bucket-save", id: bucket.id, name: bucket.name, kind: bucket.kind,
            mode: bucket.mode, amount: bucket.amount, rollover: bucket.rollover, groups: [], archived: false })}>Restaurar</Button>
          <Button size="xs" variant="ghost" className="pl-danger" onClick={() => run({ action: "bucket-delete", id: bucket.id })}>Excluir</Button></li>)}</ul>
      </details>}
    </ChartCard>
    <ChartCard className="span-4" title="Sugestão do Plano Consciente" detail="Média dos 3 meses encaixada na faixa de cada fatia">
      <ul className="pl-list compact">{data.suggestion.map((item) => <li key={item.kind}>
        <div><strong>{item.name}</strong><small>Faixa {percent(item.min)}–{percent(item.max)} · média {brl(item.average)}</small></div>
        <b>{brl(item.amount)}</b>
      </li>)}</ul>
      <p className="an-note">Aplicar a sugestão cria as caixinhas que faltam e ajusta o valor das existentes do mesmo tipo.</p>
    </ChartCard>
  </div>;
}

function BucketItem({ bucket, first, last, onUp, onDown, onEdit, onMonth }: {
  bucket: BucketRow; first: boolean; last: boolean; onUp: () => void; onDown: () => void; onEdit: () => void; onMonth: () => void;
}) {
  const definition = bucket.mode === "valor" ? brl(bucket.amount) : percent(bucket.amount / 10000, 2) + " da renda";
  return <li className="pl-item">
    <span className="pl-dot" style={{ background: BUCKET_COLOR[bucket.kind] ?? UNASSIGNED_COLOR }} />
    <div className="pl-item-main">
      <strong>{bucket.name}</strong>
      <small>{BUCKET_KIND_LABEL[bucket.kind] ?? bucket.kind} · {definition} · {bucket.rollover ? "acumula a sobra" : "zera a sobra"}{bucket.adjusted ? " · ajustada neste mês" : ""}</small>
      <small className="pl-keys">{bucket.groups.length ? bucket.groups.map(keyLabel).join(", ") : "Nenhum grupo ligado"}</small>
    </div>
    <div className="pl-item-figures"><b>{brl(bucket.base)}</b><small>média {brl(bucket.average)}</small></div>
    <div className="pl-item-actions">
      <Button variant="ghost" size="icon-xs" onClick={onUp} disabled={first} aria-label={"Subir " + bucket.name}><ArrowUp /></Button>
      <Button variant="ghost" size="icon-xs" onClick={onDown} disabled={last} aria-label={"Descer " + bucket.name}><ArrowDown /></Button>
      <Button variant="ghost" size="icon-xs" onClick={onMonth} aria-label={"Ajustar " + bucket.name + " só neste mês"} title="Ajustar só neste mês"><CalendarRange /></Button>
      <Button variant="ghost" size="icon-xs" onClick={onEdit} aria-label={"Editar " + bucket.name}><Pencil /></Button>
    </div>
  </li>;
}
