"use client";

import { createContext, useContext, useRef, useState } from "react";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORIES, GROUPS, SPECIAL_CHOICES } from "@/lib/analytics/categories.mjs";
import type { Classified } from "@/lib/analytics/classify.mjs";
import { merchantKey, merchantLabel } from "@/lib/analytics/merchant.mjs";
import type { Entry } from "@/lib/types";

export type CategoryScope = "entry" | "merchant";
type Editing = {
  analyze: (row: Entry) => Classified;
  save: (row: Entry, category: string | null, scope: CategoryScope) => Promise<void>;
};

// Disponível onde o painel permite trocar a categoria (SPEC-0003, REQ-004).
export const CategoryEditing = createContext<Editing | null>(null);

const groupLabel = new Map(GROUPS.map((group) => [group.id, group.label]));

function options(direction: Entry["direction"]) {
  // Crédito aceita categorias de entrada e de consumo, para marcar estornos.
  const list = CATEGORIES.filter((row) => direction === "CREDIT" || row.direction === "DEBIT");
  const grouped = new Map<string, typeof list>();
  for (const row of list) grouped.set(row.group, [...(grouped.get(row.group) ?? []), row]);
  return Array.from(grouped, ([group, rows]) => ({ group: groupLabel.get(group) ?? group, rows }));
}

export function CategoryPicker({ row }: { row: Entry }) {
  const editing = useContext(CategoryEditing);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<CategoryScope>("entry");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  if (!editing) return null;
  const info = editing.analyze(row);
  const current = row.choice?.value ?? null;
  const merchant = merchantLabel(merchantKey(row.description));

  async function choose(category: string | null, target: CategoryScope = scope) {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await editing.save(row, category, target);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a categoria.");
    } finally {
      setSaving(false);
    }
  }

  const item = (value: string, label: string) => (
    <button type="button" role="menuitemradio" aria-checked={current === value} className="category-option"
      disabled={saving} onClick={() => choose(value)} key={value}>
      <span>{label}</span>{current === value && <Check size={14} aria-hidden="true" />}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={(next) => {
      setContainer(trigger.current?.closest("dialog") ?? null);
      setOpen(next);
      setError("");
    }}>
      <PopoverTrigger asChild>
        <button ref={trigger} type="button" className={"category-chip" + (row.choice ? " chosen" : "")}
          aria-label={"Categoria: " + info.label + ". Alterar"}>
          {info.label}<ChevronDown size={12} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="category-menu" align="start" container={container}>
        <div className="category-scope" role="radiogroup" aria-label="Aplicar a">
          <button type="button" role="radio" aria-checked={scope === "entry"} onClick={() => setScope("entry")}>Só este lançamento</button>
          <button type="button" role="radio" aria-checked={scope === "merchant"} onClick={() => setScope("merchant")}
            title={"Todos os lançamentos de " + merchant}>Todos de {merchant}</button>
        </div>
        <div className="category-list" role="menu" aria-label="Categorias">
          {options(row.direction).map(({ group, rows }) => <div key={group} className="category-group">
            <span>{group}</span>{rows.map((option) => item(option.id, option.label))}
          </div>)}
          <div className="category-group"><span>Fora das análises</span>
            {Object.entries(SPECIAL_CHOICES).map(([value, choice]) => item(value, choice.label))}</div>
        </div>
        {row.choice && <button type="button" className="category-reset" disabled={saving}
          onClick={() => choose(null, row.choice?.source === "estabelecimento" ? "merchant" : "entry")}>
          <RotateCcw size={13} aria-hidden="true" />
          {row.choice.source === "estabelecimento" ? "Remover a regra de " + merchant : "Restaurar a categoria anterior"}
        </button>}
        {error && <p className="category-error" role="alert">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
