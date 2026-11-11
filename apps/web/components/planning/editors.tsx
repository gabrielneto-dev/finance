"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthLong } from "@/components/analytics/kit";
import { today } from "@/lib/format";
import { bucketOptions, BUCKET_KIND_LABEL, keyLabel, moneyInput, parseMoney, parsePercent, percentInput } from "@/lib/planning/format";
import type { Adjustment, BucketRow, Goal, Investment, PlanningData } from "@/lib/planning/types";

export type EditorState =
  | { type: "bucket"; bucket?: BucketRow }
  | { type: "bucket-month"; bucket: BucketRow }
  | { type: "income" }
  | { type: "goal"; goal?: Goal; kind?: Goal["kind"] }
  | { type: "adjustment"; adjustment?: Adjustment; preset?: Partial<Adjustment> }
  | { type: "investment"; investment?: Investment }
  | { type: "balance"; investment: Investment };

type Act = (body: Record<string, unknown>) => Promise<void>;

const CLASSES = [["renda_fixa", "Renda fixa"], ["tesouro", "Tesouro Direto"], ["acoes", "Ações"], ["fiis", "Fundos imobiliários"],
  ["fundos", "Fundos"], ["previdencia", "Previdência"], ["cripto", "Cripto"], ["outros", "Outros"]] as const;
const LIQUIDITY = [["diaria", "Liquidez diária"], ["vencimento", "No vencimento"], ["longo", "Longo prazo"]] as const;
const ADJUSTMENT_KINDS = [["renda", "Mudança de renda"], ["corte", "Corte em um grupo"], ["evento", "Evento pontual"], ["aporte", "Aporte extra"]] as const;

/** Campo com rótulo e dica, ligado por id. */
function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return <div className="pl-field">
    <label htmlFor={id}>{label}</label>
    {children(id)}
    {hint && <small>{hint}</small>}
  </div>;
}

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void;
}) {
  return <fieldset className="pl-field"><legend>{label}</legend>
    <div className="pl-segment wrap" role="radiogroup" aria-label={label}>{options.map(([id, text]) =>
      <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}>{text}</button>)}</div>
  </fieldset>;
}

function NativeSelect({ id, value, onChange, children }: { id: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <select id={id} className="pl-select" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>;
}

/** Painel lateral de edição: formulário curto, validação e Salvar/Cancelar (SPEC-0004, 2.1). */
export function EditorSheet({ editor, data, act, onClose }: { editor: EditorState | null; data: PlanningData; act: Act; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (editor && !element.open) element.showModal();
    if (!editor && element.open) element.close();
  }, [editor]);
  const key = editor ? JSON.stringify([editor.type, "bucket" in editor ? editor.bucket?.id : "", "goal" in editor ? editor.goal?.id ?? editor.kind : "",
    "adjustment" in editor ? editor.adjustment?.id ?? editor.preset?.kind : "", "investment" in editor ? editor.investment?.id : ""]) : "";
  return <dialog ref={dialog} className="detail pl-editor" aria-labelledby="editor-title" onClose={onClose}
    onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
    {editor && <EditorForm key={key} editor={editor} data={data} act={act} onClose={onClose} />}
  </dialog>;
}

function EditorForm({ editor, data, act, onClose }: { editor: EditorState; data: PlanningData; act: Act; onClose: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const form = forms[editor.type];
  const [values, setValues] = useState<Record<string, unknown>>(() => form.init(editor as never, data));
  const set = (patch: Record<string, unknown>) => setValues((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const built = form.build(values as never, editor as never, data);
    if (typeof built === "string") { setError(built); return; }
    setSaving(true);
    setError("");
    try {
      await act(built);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    const body = form.remove?.(editor as never, data);
    if (!body) return;
    setSaving(true);
    setError("");
    try { await act(body); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir."); } finally { setSaving(false); }
  }
  const removable = form.remove?.(editor as never, data);
  return <form onSubmit={submit} className="pl-form" noValidate>
    <header className="detail-head">
      <div><h2 id="editor-title">{form.title(editor as never)}</h2>{form.subtitle && <p>{form.subtitle(editor as never, data)}</p>}</div>
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X /></Button>
    </header>
    <div className="detail-body">{form.fields(values as never, set, data, editor as never)}</div>
    <footer className="pl-form-foot">
      {error && <p className="pl-error" role="alert">{error}</p>}
      <div>
        {removable && <Button type="button" variant="ghost" className="pl-danger" onClick={remove} disabled={saving}>{form.removeLabel ?? "Excluir"}</Button>}
        <span />
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </div>
    </footer>
  </form>;
}

type FormSpec<E, V> = {
  title: (editor: E) => string;
  subtitle?: (editor: E, data: PlanningData) => string;
  init: (editor: E, data: PlanningData) => V;
  fields: (values: V, set: (patch: Partial<V>) => void, data: PlanningData, editor: E) => ReactNode;
  build: (values: V, editor: E, data: PlanningData) => Record<string, unknown> | string;
  remove?: (editor: E, data: PlanningData) => Record<string, unknown> | null;
  removeLabel?: string;
};
const spec = <E, V>(value: FormSpec<E, V>) => value;

const bucketForm = spec<Extract<EditorState, { type: "bucket" }>, {
  name: string; kind: string; mode: "valor" | "percentual"; amount: string; rollover: boolean; groups: string[];
}>({
  title: (editor) => editor.bucket ? "Editar caixinha" : "Nova caixinha",
  init: ({ bucket }) => ({
    name: bucket?.name ?? "", kind: bucket?.kind ?? "livre", mode: bucket?.mode ?? "valor",
    amount: bucket ? (bucket.mode === "valor" ? moneyInput(bucket.amount) : percentInput(bucket.amount)) : "",
    rollover: bucket?.rollover ?? false, groups: bucket?.groups ?? [],
  }),
  fields: (values, set, data, { bucket }) => {
    const taken = new Map(data.budget.buckets.filter((row) => row.id !== bucket?.id).flatMap((row) => row.groups.map((key) => [key, row.name] as const)));
    const toggle = (key: string) => set({ groups: values.groups.includes(key) ? values.groups.filter((item) => item !== key) : [...values.groups, key] });
    const option = (key: string, label: string, sub = false) => {
      const owner = taken.get(key);
      return <label key={key} className={"pl-check" + (sub ? " sub" : "")}>
        <input type="checkbox" checked={values.groups.includes(key)} disabled={Boolean(owner)} onChange={() => toggle(key)} />
        <span>{label}{owner && <small> · em {owner}</small>}</span>
      </label>;
    };
    return <>
      <Field label="Nome">{(id) => <Input id={id} value={values.name} maxLength={60} onChange={(event) => set({ name: event.target.value })} required />}</Field>
      <Field label="Tipo">{(id) => <NativeSelect id={id} value={values.kind} onChange={(kind) => set({ kind })}>
        {Object.entries(BUCKET_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </NativeSelect>}</Field>
      <Choice label="Definir por" value={values.mode} options={[["valor", "Valor"], ["percentual", "% da renda"]] as const}
        onChange={(mode) => set({ mode, amount: "" })} />
      <Field label={values.mode === "valor" ? "Valor por mês (R$)" : "Percentual da renda"}
        hint={values.mode === "percentual" && data.income.expected ? "Renda prevista: " + moneyInput(data.income.expected) : undefined}>
        {(id) => <Input id={id} inputMode="decimal" value={values.amount} onChange={(event) => set({ amount: event.target.value })}
          placeholder={values.mode === "valor" ? "0,00" : "0"} />}</Field>
      <Choice label="Sobra do mês" value={values.rollover ? "acumula" : "zera"} options={[["zera", "Zera"], ["acumula", "Acumula"]] as const}
        onChange={(value) => set({ rollover: value === "acumula" })} />
      <fieldset className="pl-field"><legend>O que entra nesta caixinha</legend>
        <small>Cada grupo fica em uma só caixinha. Uma categoria marcada vence o grupo dela.</small>
        <div className="pl-checks">
          {option("k:investimento", keyLabel("k:investimento"))}
          {bucketOptions().map((group) => <div key={group.key}>
            {option(group.key, group.label)}
            {group.categories.length > 1 && <details className="pl-sub"><summary>Categorias</summary>
              {group.categories.map((row) => option(row.key, row.label, true))}</details>}
          </div>)}
        </div>
      </fieldset>
    </>;
  },
  build: (values, { bucket }) => {
    const amount = values.mode === "valor" ? parseMoney(values.amount) : parsePercent(values.amount);
    if (!values.name.trim()) return "Dê um nome à caixinha.";
    if (amount === null || amount < 0) return values.mode === "valor" ? "Informe um valor válido." : "Informe um percentual válido.";
    if (values.mode === "percentual" && amount > 10000) return "Use um percentual de até 100%.";
    return { action: "bucket-save", id: bucket?.id, name: values.name, kind: values.kind, mode: values.mode, amount,
      rollover: values.rollover, groups: values.groups };
  },
  remove: ({ bucket }) => bucket ? { action: "bucket-save", id: bucket.id, name: bucket.name, kind: bucket.kind, mode: bucket.mode,
    amount: bucket.amount, rollover: bucket.rollover, groups: [], archived: true } : null,
  removeLabel: "Arquivar",
});

const bucketMonthForm = spec<Extract<EditorState, { type: "bucket-month" }>, { amount: string }>({
  title: ({ bucket }) => "Ajustar " + bucket.name,
  subtitle: (_, data) => "Só em " + monthLong(data.month) + ". O padrão da caixinha não muda.",
  init: ({ bucket }) => ({ amount: moneyInput(bucket.base) }),
  fields: (values, set, _, { bucket }) => <>
    <Field label="Valor neste mês (R$)" hint={"Padrão: " + (bucket.mode === "valor" ? moneyInput(bucket.amount) : percentInput(bucket.amount) + "% da renda")}>
      {(id) => <Input id={id} inputMode="decimal" value={values.amount} onChange={(event) => set({ amount: event.target.value })} />}</Field>
  </>,
  build: (values, { bucket }, data) => {
    const amount = parseMoney(values.amount);
    if (amount === null || amount < 0) return "Informe um valor válido.";
    return { action: "bucket-month", id: bucket.id, month: data.month, amount };
  },
  remove: ({ bucket }, data) => bucket.adjusted ? { action: "bucket-month", id: bucket.id, month: data.month, amount: null } : null,
  removeLabel: "Voltar ao padrão",
});

const incomeForm = spec<Extract<EditorState, { type: "income" }>, { expected: string }>({
  title: () => "Renda prevista",
  subtitle: (_, data) => monthLong(data.month),
  init: (_, data) => ({ expected: data.income.manual === null ? "" : moneyInput(data.income.manual) }),
  fields: (values, set, data) => <>
    <Field label="Renda do mês (R$)" hint={"Estimativa pelos últimos 3 meses: " + moneyInput(data.income.estimated) + ". Deixe vazio para usar a estimativa."}>
      {(id) => <Input id={id} inputMode="decimal" value={values.expected} placeholder={moneyInput(data.income.estimated)}
        onChange={(event) => set({ expected: event.target.value })} />}</Field>
    <dl className="pl-facts">
      <div><dt>Salário (mediana)</dt><dd>{moneyInput(data.income.parts.salary)}</dd></div>
      <div><dt>Outras receitas (média)</dt><dd>{moneyInput(data.income.parts.other)}</dd></div>
      <div><dt>Lucro do negócio (média)</dt><dd>{moneyInput(data.income.parts.business)}</dd></div>
    </dl>
  </>,
  build: (values, _, data) => {
    if (!values.expected.trim()) return { action: "income-set", month: data.month, expected: null };
    const expected = parseMoney(values.expected);
    return expected === null || expected < 0 ? "Informe uma renda válida." : { action: "income-set", month: data.month, expected };
  },
});

const goalForm = spec<Extract<EditorState, { type: "goal" }>, {
  name: string; kind: Goal["kind"]; target: string; months: string; deadline: string; monthly: string; yieldRate: string;
  source: Goal["source"]; current: string; investments: string[]; account: string;
}>({
  title: ({ goal, kind }) => goal ? "Editar meta" : (kind ?? "objetivo") === "reserva" ? "Reserva de emergência"
    : kind === "independencia" ? "Independência financeira" : "Nova meta",
  init: ({ goal, kind }, data) => ({
    name: goal?.name ?? (kind === "reserva" ? "Reserva de emergência" : kind === "independencia" ? "Independência financeira" : ""),
    kind: goal?.kind ?? kind ?? "objetivo",
    target: goal && !goal.automaticTarget ? moneyInput(goal.target) : "", months: String(goal?.months ?? (kind === "reserva" || goal?.kind === "reserva" ? 6 : "")),
    deadline: goal?.deadline ?? "", monthly: goal ? moneyInput(goal.monthly) : "", yieldRate: goal ? percentInput(goal.yieldRate) : "",
    source: goal?.source ?? "manual", current: goal?.source === "manual" ? moneyInput(goal.current) : "",
    investments: Array.isArray(goal?.link) ? goal.link : [],
    account: typeof goal?.link === "string" ? goal.link : data.accounts.find((row) => row.type === "BANK")?.key ?? "",
  }),
  fields: (values, set, data) => <>
    <Field label="Nome">{(id) => <Input id={id} value={values.name} maxLength={60} onChange={(event) => set({ name: event.target.value })} />}</Field>
    {values.kind === "reserva" && <Field label="Meses de gasto essencial" hint={"Gasto essencial médio: " + moneyInput(data.essentialAverage) + " por mês. Renda mista pede 6 meses."}>
      {(id) => <Input id={id} inputMode="numeric" value={values.months} onChange={(event) => set({ months: event.target.value })} />}</Field>}
    <Field label="Valor da meta (R$)" hint={values.kind === "reserva" ? "Vazio usa gasto essencial × meses."
      : values.kind === "independencia" ? "Vazio usa 25 vezes o gasto anual (regra dos 4%): " + moneyInput(data.annualSpending * 25) + "." : undefined}>
      {(id) => <Input id={id} inputMode="decimal" value={values.target} onChange={(event) => set({ target: event.target.value })} />}</Field>
    <Field label="Prazo" hint="Opcional.">{(id) => <Input id={id} type="month" value={values.deadline} min={today().slice(0, 7)}
      onChange={(event) => set({ deadline: event.target.value })} />}</Field>
    <Field label="Aporte planejado por mês (R$)">{(id) => <Input id={id} inputMode="decimal" value={values.monthly}
      onChange={(event) => set({ monthly: event.target.value })} />}</Field>
    <Field label="Rendimento ao ano (%)" hint="Opcional. Juros compostos sobre o valor guardado.">{(id) => <Input id={id} inputMode="decimal"
      value={values.yieldRate} onChange={(event) => set({ yieldRate: event.target.value })} />}</Field>
    <Choice label="De onde vem o valor atual" value={values.source}
      options={[["manual", "Informado"], ["investimentos", "Investimentos"], ["conta", "Saldo de conta"]] as const} onChange={(source) => set({ source })} />
    {values.source === "manual" && <Field label="Valor atual (R$)">{(id) => <Input id={id} inputMode="decimal" value={values.current}
      onChange={(event) => set({ current: event.target.value })} />}</Field>}
    {values.source === "investimentos" && <fieldset className="pl-field"><legend>Investimentos</legend>
      {data.investments.length ? <div className="pl-checks">{data.investments.map((row) => <label key={row.id} className="pl-check">
        <input type="checkbox" checked={values.investments.includes(row.id)}
          onChange={() => set({ investments: values.investments.includes(row.id) ? values.investments.filter((id) => id !== row.id) : [...values.investments, row.id] })} />
        <span>{row.name}<small> · {row.classLabel}</small></span>
      </label>)}</div> : <small>Cadastre um investimento em Patrimônio para ligar à meta.</small>}
    </fieldset>}
    {values.source === "conta" && <Field label="Conta">{(id) => <NativeSelect id={id} value={values.account} onChange={(account) => set({ account })}>
      {data.accounts.filter((row) => row.type === "BANK").map((row) => <option key={row.key} value={row.key}>{row.name}{row.last4 ? " · " + row.last4 : ""}</option>)}
    </NativeSelect>}</Field>}
  </>,
  build: (values, { goal }) => {
    const target = values.target.trim() ? parseMoney(values.target) : null;
    if (values.target.trim() && (target === null || target <= 0)) return "Informe o valor da meta.";
    if (values.kind === "objetivo" && target === null) return "Informe o valor da meta.";
    const monthly = values.monthly.trim() ? parseMoney(values.monthly) : 0;
    const yieldRate = values.yieldRate.trim() ? parsePercent(values.yieldRate) : 0;
    const current = values.current.trim() ? parseMoney(values.current) : 0;
    const months = values.kind === "reserva" ? Number(values.months || 6) : null;
    if (monthly === null || monthly < 0) return "Informe um aporte válido.";
    if (yieldRate === null || yieldRate < 0 || yieldRate > 5000) return "Use um rendimento entre 0% e 50% ao ano.";
    if (current === null || current < 0) return "Informe um valor atual válido.";
    if (months !== null && (!Number.isInteger(months) || months < 1 || months > 36)) return "Use de 1 a 36 meses.";
    if (values.source === "investimentos" && !values.investments.length) return "Escolha ao menos um investimento.";
    return { action: "goal-save", id: goal?.id, name: values.name, kind: values.kind, target, months, deadline: values.deadline || null,
      monthly, yieldRate, source: values.source, current,
      link: values.source === "investimentos" ? values.investments : values.source === "conta" ? values.account : null, priority: goal?.priority ?? 0 };
  },
  remove: ({ goal }) => goal ? { action: "goal-delete", id: goal.id } : null,
});

const adjustmentForm = spec<Extract<EditorState, { type: "adjustment" }>, {
  kind: Adjustment["kind"]; label: string; startMonth: string; endMonth: string; by: "percentual" | "valor"; value: string; direction: "saida" | "entrada"; group: string;
}>({
  title: ({ adjustment }) => adjustment ? "Editar ajuste" : "Novo ajuste",
  subtitle: () => "O ajuste muda só o cenário ajustado da projeção.",
  init: ({ adjustment, preset }) => {
    const item = { ...preset, ...adjustment };
    const next = (() => { const [year, month] = today().slice(0, 7).split("-").map(Number); return month === 12 ? year + 1 + "-01" : year + "-" + String(month + 1).padStart(2, "0"); })();
    return {
      kind: item.kind ?? "renda", label: item.label ?? "", startMonth: item.startMonth ?? next, endMonth: item.endMonth ?? "",
      by: item.amount != null ? "valor" : "percentual",
      value: item.amount != null ? moneyInput(Math.abs(item.amount)) : item.percent != null ? percentInput(item.percent) : "",
      direction: (item.amount ?? 0) < 0 ? "entrada" : "saida", group: item.group ?? "g:alimentacao",
    };
  },
  fields: (values, set) => <>
    <Field label="Tipo">{(id) => <NativeSelect id={id} value={values.kind} onChange={(kind) => set({ kind: kind as Adjustment["kind"], value: "" })}>
      {ADJUSTMENT_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
    <Field label="Descrição">{(id) => <Input id={id} value={values.label} maxLength={80} placeholder={values.kind === "renda" ? "Salário +10%"
      : values.kind === "corte" ? "Cortar Alimentação fora em 20%" : values.kind === "evento" ? "IPVA em janeiro" : "Aporte extra"}
      onChange={(event) => set({ label: event.target.value })} />}</Field>
    {values.kind === "corte" && <Field label="Grupo">{(id) => <NativeSelect id={id} value={values.group} onChange={(group) => set({ group })}>
      {bucketOptions().map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}</NativeSelect>}</Field>}
    {values.kind === "renda" && <Choice label="Mudança por" value={values.by} options={[["percentual", "Percentual"], ["valor", "Valor"]] as const}
      onChange={(by) => set({ by, value: "" })} />}
    {values.kind === "evento" && <Choice label="O evento é" value={values.direction} options={[["saida", "Um gasto"], ["entrada", "Uma entrada"]] as const}
      onChange={(direction) => set({ direction })} />}
    <Field label={values.kind === "corte" ? "Corte (%)" : values.kind === "renda" && values.by === "percentual" ? "Mudança (%)" : "Valor (R$)"}
      hint={values.kind === "renda" ? "Use número negativo para uma queda." : undefined}>
      {(id) => <Input id={id} inputMode="decimal" value={values.value} onChange={(event) => set({ value: event.target.value })} />}</Field>
    <Field label={values.kind === "evento" ? "Mês" : "A partir de"}>{(id) => <Input id={id} type="month" value={values.startMonth}
      onChange={(event) => set({ startMonth: event.target.value })} />}</Field>
    {values.kind !== "evento" && <Field label="Até" hint="Vazio vale até o fim do horizonte.">{(id) => <Input id={id} type="month" value={values.endMonth}
      min={values.startMonth} onChange={(event) => set({ endMonth: event.target.value })} />}</Field>}
  </>,
  build: (values, { adjustment }) => {
    if (!values.label.trim()) return "Descreva o ajuste.";
    if (!/^\d{4}-\d{2}$/.test(values.startMonth)) return "Escolha o mês.";
    const percentMode = values.kind === "corte" || (values.kind === "renda" && values.by === "percentual");
    const parsed = percentMode ? parsePercent(values.value) : parseMoney(values.value);
    if (parsed === null || parsed === 0) return "Informe um valor.";
    if (values.kind === "corte" && (parsed < 1 || parsed > 10000)) return "Use um corte entre 1% e 100%.";
    if (values.kind === "aporte" && parsed < 0) return "O aporte deve ser positivo.";
    const amount = percentMode ? null : values.kind === "evento" ? (values.direction === "entrada" ? -Math.abs(parsed) : Math.abs(parsed)) : parsed;
    return { action: "adjustment-save", id: adjustment?.id, kind: values.kind, label: values.label, startMonth: values.startMonth,
      endMonth: values.kind === "evento" ? null : values.endMonth || null, amount, percent: percentMode ? parsed : null,
      group: values.kind === "corte" ? values.group : null, enabled: adjustment?.enabled ?? true };
  },
  remove: ({ adjustment }) => adjustment ? { action: "adjustment-delete", id: adjustment.id } : null,
});

const investmentForm = spec<Extract<EditorState, { type: "investment" }>, {
  name: string; institution: string; class: string; liquidity: string; dueDate: string; balance: string;
}>({
  title: ({ investment }) => investment ? "Editar investimento" : "Novo investimento",
  subtitle: ({ investment }) => investment ? "Para mudar o saldo, use Atualizar saldo, que guarda o histórico." : "Lançamento manual. Os da Pluggy chegam pela sincronização.",
  init: ({ investment }) => ({
    name: investment?.name ?? "", institution: investment?.institution ?? "", class: investment?.class ?? "renda_fixa",
    liquidity: investment?.liquidity ?? "diaria", dueDate: investment?.dueDate ?? "", balance: "",
  }),
  fields: (values, set, _, { investment }) => <>
    <Field label="Nome">{(id) => <Input id={id} value={values.name} maxLength={80} placeholder="CDB 110% do CDI" onChange={(event) => set({ name: event.target.value })} />}</Field>
    <Field label="Instituição" hint="Opcional.">{(id) => <Input id={id} value={values.institution} maxLength={60} onChange={(event) => set({ institution: event.target.value })} />}</Field>
    <Field label="Classe">{(id) => <NativeSelect id={id} value={values.class} onChange={(value) => set({ class: value })}>
      {CLASSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
    <Field label="Liquidez">{(id) => <NativeSelect id={id} value={values.liquidity} onChange={(liquidity) => set({ liquidity })}>
      {LIQUIDITY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
    <Field label="Vencimento" hint="Opcional.">{(id) => <Input id={id} type="date" value={values.dueDate} onChange={(event) => set({ dueDate: event.target.value })} />}</Field>
    {!investment && <Field label="Saldo atual (R$)">{(id) => <Input id={id} inputMode="decimal" value={values.balance} onChange={(event) => set({ balance: event.target.value })} />}</Field>}
  </>,
  build: (values, { investment }) => {
    if (!values.name.trim()) return "Dê um nome ao investimento.";
    const balance = investment ? null : parseMoney(values.balance);
    if (!investment && (balance === null || balance < 0)) return "Informe o saldo atual.";
    return { action: "investment-save", id: investment?.id, name: values.name, institution: values.institution || null, class: values.class,
      liquidity: values.liquidity, dueDate: values.dueDate || null, ...(investment ? {} : { balance }) };
  },
  remove: ({ investment }) => investment ? { action: "investment-delete", id: investment.id } : null,
});

const balanceForm = spec<Extract<EditorState, { type: "balance" }>, { balance: string; date: string }>({
  title: ({ investment }) => "Atualizar " + investment.name,
  subtitle: () => "O saldo anterior fica no histórico do patrimônio.",
  init: ({ investment }) => ({ balance: moneyInput(investment.balance), date: today() }),
  fields: (values, set) => <>
    <Field label="Saldo (R$)">{(id) => <Input id={id} inputMode="decimal" value={values.balance} onChange={(event) => set({ balance: event.target.value })} />}</Field>
    <Field label="Data do saldo">{(id) => <Input id={id} type="date" value={values.date} max={today()} onChange={(event) => set({ date: event.target.value })} />}</Field>
  </>,
  build: (values, { investment }) => {
    const balance = parseMoney(values.balance);
    if (balance === null || balance < 0) return "Informe o saldo.";
    if (values.date > today()) return "A data não pode estar no futuro.";
    return { action: "investment-balance", id: investment.id, balance, date: values.date || null };
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const forms: Record<EditorState["type"], FormSpec<any, any>> = {
  bucket: bucketForm, "bucket-month": bucketMonthForm, income: incomeForm, goal: goalForm,
  adjustment: adjustmentForm, investment: investmentForm, balance: balanceForm,
};
