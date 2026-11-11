"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/category-picker";
import { businessValue, spendingValue } from "@/lib/analytics/classify.mjs";
import { merchantLabel } from "@/lib/analytics/merchant.mjs";
import type { AnalyticsData, AnalyticsEntry } from "@/lib/analytics/types";
import { brl, dayLabel, monthShort, Spark } from "./kit";

export type DetailSpec = {
  title: string; subtitle?: string;
  filter: (entry: AnalyticsEntry) => boolean;
  series?: { month: string; amount: number }[];
  /** Soma como despesa (padrão), pelo valor bruto, para entradas, ou como lucro do negócio. */
  mode?: "spending" | "amount" | "business";
};

const MAX_ROWS = 200;

// Painel lateral com a série, os estabelecimentos e os lançamentos de um recorte (SPEC-0003, 2.1).
export function DetailSheet({ spec, entries, accounts, onClose }: {
  spec: DetailSpec | null; entries: AnalyticsEntry[]; accounts: AnalyticsData["accounts"]; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (spec && !element.open) element.showModal();
    if (!spec && element.open) element.close();
  }, [spec]);

  const rows = spec ? entries.filter(spec.filter).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const value = (row: AnalyticsEntry) => spec?.mode === "amount" ? row.info.amount
    : spec?.mode === "business" ? (row.info.kind === "negocio_custo" ? -businessValue(row.info) : businessValue(row.info))
    : spendingValue(row.info);
  const total = rows.reduce((sum, row) => sum + value(row), 0);
  const places = new Map<string, number>();
  for (const row of rows) places.set(row.merchant, (places.get(row.merchant) ?? 0) + value(row));
  const top = Array.from(places).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const names = new Map(accounts.map((row) => [row.key, row.name]));

  return <dialog ref={dialog} className="detail" aria-labelledby="detail-title" onClose={onClose}
    onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
    {spec && <>
      <header className="detail-head">
        <div><h2 id="detail-title">{spec.title}</h2>
          <p>{brl(total)} · {rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}{spec.subtitle ? " · " + spec.subtitle : ""}</p></div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhe"><X /></Button>
      </header>
      <div className="detail-body">
        {spec.series && spec.series.length > 1 && <section>
          <h3>Últimos meses</h3>
          <Spark values={spec.series.map((item) => item.amount)} width={460} height={56} />
          <p className="an-note">{spec.series.map((item) => monthShort(item.month) + " " + brl(item.amount)).join(" · ")}</p>
        </section>}
        {top.length > 1 && <section>
          <h3>Onde mais gastou</h3>
          <ul className="detail-list">{top.map(([key, amount]) => <li key={key}>
            <strong>{merchantLabel(key)}</strong><span className="amount">{brl(amount)}</span>
          </li>)}</ul>
        </section>}
        <section>
          <h3>Lançamentos</h3>
          {!rows.length && <p className="an-note">Nenhum lançamento neste recorte.</p>}
          <ul className="detail-list">{rows.slice(0, MAX_ROWS).map((row) => <li key={row.itemId + row.accountId + row.id}>
            <div><strong>{row.description}</strong>
              <small>{dayLabel(row.date)} · {names.get(row.itemId + "/" + row.accountId)}{row.method ? " · " + row.method : ""}</small>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryPicker row={row} />
                {row.status === "PENDING" && <Badge variant="outline">Pendente</Badge>}
                {row.info.kind === "estorno" && <Badge variant="secondary">Estorno</Badge>}
              </div>
            </div>
            <span className={"amount" + (row.info.kind === "estorno" || row.direction === "CREDIT" ? " positive" : "")}>
              {row.direction === "CREDIT" ? "+" : "−"}{brl(row.info.amount)}</span>
          </li>)}</ul>
          {rows.length > MAX_ROWS && <p className="an-note">Mostrando os {MAX_ROWS} mais recentes.</p>}
        </section>
      </div>
    </>}
  </dialog>;
}
