"use client";

import { brl, Empty, percent } from "./kit";

// Lista ranqueada com barra horizontal, para recortes nominais (uma só cor de série).
export function RankList({ rows, color, empty, onSelect, limit = 8 }: {
  rows: { label: string; amount: number }[]; color: string; empty: string;
  onSelect?: (row: { label: string; amount: number }) => void; limit?: number;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const max = rows[0].amount || 1;
  return <div className="rank">{rows.slice(0, limit).map((row) => {
    const content = <>
      <span className="rank-label"><span>{row.label}</span><small>{percent(total ? row.amount / total : 0)} do total</small></span>
      <span className="rank-bar" aria-hidden="true"><span style={{ width: row.amount / max * 100 + "%", background: color }} /></span>
      <span className="rank-value">{brl(row.amount)}</span>
    </>;
    return onSelect
      ? <button type="button" className="rank-row" key={row.label} onClick={() => onSelect(row)}>{content}</button>
      : <div className="rank-row" key={row.label}>{content}</div>;
  })}</div>;
}
