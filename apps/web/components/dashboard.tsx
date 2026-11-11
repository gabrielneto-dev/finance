"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, CreditCard, ExternalLink, Eye, EyeOff, Filter, Landmark, Link2, List, Pencil, Plus, ReceiptText, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CreditCardSummary } from "@/components/credit-card-summary";
import { CardClosing } from "@/components/card-closing";
import { InstallmentList } from "@/components/installment-list";
import { ConnectionDetails } from "@/components/connection-details";
import { HIDDEN_VALUES_KEY, HiddenValues } from "@/components/hidden-values";
import { EmptyState, FinancialOverview, PanelHeading } from "@/components/dashboard-panels";
import { CategoryEditing, CategoryPicker, type CategoryScope } from "@/components/category-picker";
import { AppSidebar, SECTIONS, type DashboardView } from "@/components/app-sidebar";
import { blockedBalances, blockedDeposits } from "@/lib/balances";
import { charged } from "@/lib/charged.mjs";
import { displayDate, displayDateWithYear, maskValue, money, moneyTotals, monthRange, timestamp, today } from "@/lib/format";
import { filterLedger, UNKNOWN_METHOD } from "@/lib/ledger-filter";
import { analyzer, spendingEntries, spendingTotals, type Analyzed } from "@/lib/analytics/spending";
import { spendingValue } from "@/lib/analytics/classify.mjs";
import type { Account, Connection, DashboardData, Entry, Notice } from "@/lib/types";

const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((mod) => mod.PluggyConnect), { ssr: false });

type View = DashboardView;
const empty: DashboardData = { accounts: [], entries: [], bills: [], connections: [], notifications: [], unread: 0 };
const accountKey = (row: { itemId: string; accountId?: string; id?: string }) => row.itemId + "/" + (row.accountId ?? row.id);
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (month: string) => monthName.format(new Date(month + "-01T12:00:00Z"));
const connectionName = (row: Connection) => row.label || row.name;
const stateLabels: Record<string, string> = {
  CONECTADA: "Conectada", IMPORTANDO: "Importando", RECONECTAR: "Reconectar",
  "ATENÇÃO": "Atenção", PARCIAL: "Importação parcial", REMOVENDO: "Removendo",
};
const webhookLabels = {
  queued: "Aguardando processamento", retry: "Aguardando nova tentativa",
  processed: "Processado", ignored: "Ignorado",
};

// O Radix Select não aceita valor vazio; ALL representa "todos" nos filtros.
const ALL = "__all";
const accountLabel = (row: Account) => row.name.trim() + (row.last4 ? " · " + row.last4 : "");

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : next)}>
        <SelectTrigger aria-labelledby={id} className="select-trigger"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value || ALL} value={option.value || ALL}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// A API recusa períodos acima de 366 dias.
const MAX_RANGE_DAYS = 366;
const shiftDate = (date: string, days: number) => new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);

function DateField({ label, value, onChange, min, max }: {
  label: string; value: string; onChange: (value: string) => void; min?: string; max?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <DatePicker id={id + "-date"} aria-labelledby={id + " " + id + "-date"} value={value} onChange={onChange} min={min} max={max} today={today()} />
    </div>
  );
}

function noticeLabel(row: Notice) {
  return (row.method === "Pix" ? "Pix " : row.method + " · ") + (row.direction === "CREDIT" ? "recebido" : "enviado");
}

function EntryStatus({ row, blocked }: { row: Entry; blocked: boolean }) {
  if (blocked) return <Badge variant="outline" className="entry-blocked"
    title="Lançado na conta, mas fora do saldo disponível até a compensação">Bloqueado</Badge>;
  return <Badge variant={row.status === "PENDING" ? "outline" : "secondary"}>{row.status === "PENDING" ? "Pendente" : "Efetivada"}</Badge>;
}

function Ledger({ rows, accounts, blocked }: { rows: Entry[]; accounts: Account[]; blocked?: Set<string> }) {
  if (!rows.length) return <EmptyState icon={List}>Nenhum lançamento para esta seleção.</EmptyState>;
  const accountNames = new Map(accounts.map((row) => [accountKey(row), row.name]));
  return <ScrollArea className="table-wrap" role="region" aria-label="Tabela de lançamentos" tabIndex={0}><table>
    <thead><tr><th>Lançamento</th><th>Data e horário</th><th>Situação</th><th>Valor</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={accountKey(row) + "/" + row.id}>
      <td><div className="entry-cell">
        <span className={row.direction === "CREDIT" ? "entry-icon inflow" : "entry-icon"}>
          {row.direction === "CREDIT" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
        </span>
        <div><strong>{row.description}</strong><small>{accountNames.get(accountKey(row))}{row.method && " · " + row.method}
          {row.installment && row.installments ? " · " + row.installment + "/" + row.installments : ""}
          {row.purchaseDate && " · compra em " + displayDate(row.purchaseDate)}</small><CategoryPicker row={row} /></div>
      </div></td>
      <td className="entry-date">{displayDate(row.date)} <small>{row.time ?? "Sem horário"}</small></td>
      <td><EntryStatus row={row} blocked={!!blocked?.has(accountKey(row) + "/" + row.id)} /></td>
      <td className={row.direction === "CREDIT" ? "amount positive" : "amount"}>{row.direction === "CREDIT" ? "+" : "−"}{money(row.amount, row.currency)}
        {charged(row).currency !== row.currency && <small className="charged">{money(charged(row).amount, charged(row).currency)} cobrados</small>}</td>
    </tr>)}</tbody>
  </table></ScrollArea>;
}

// Gastos por categoria: despesas menos estornos, pela classificação das Análises (SPEC-0003, REQ-003).
function SpendList({ rows, includePending = false }: { rows: Analyzed[]; includePending?: boolean }) {
  const groups = new Map<string, { label: string; currency: string; amount: number; pending: number }>();
  for (const { row, info } of rows) {
    if (!includePending && row.status !== "POSTED") continue;
    const key = info.currency + "/" + info.label;
    const group = groups.get(key) ?? { label: info.label, currency: info.currency, amount: 0, pending: 0 };
    group.amount += spendingValue(info);
    if (row.status === "PENDING") group.pending += spendingValue(info);
    groups.set(key, group);
  }
  const sorted = Array.from(groups.values()).filter((group) => group.amount > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount);
  if (!sorted.length) return <EmptyState icon={Activity}>
    {includePending ? "Nenhum gasto para esta seleção." : "Sem gastos efetivados neste período."}
  </EmptyState>;
  const max = new Map<string, number>();
  for (const group of sorted) if (!max.has(group.currency)) max.set(group.currency, group.amount);
  return <ul className="spend-list">{sorted.map((group) => <li key={group.currency + "/" + group.label}>
    <div><span>{group.label}</span><strong>{money(group.amount, group.currency)}</strong></div>
    {group.pending > 0 && <small className="block text-xs text-muted-foreground">
      {money(group.pending, group.currency)} pendentes
    </small>}
    <div className="bar" aria-hidden="true"><span style={{ width: (max.get(group.currency) ? group.amount / max.get(group.currency)! * 100 : 0) + "%" }} /></div>
  </li>)}</ul>;
}

export function Dashboard({ importExisting, initial, initialInstallments }: {
  importExisting: boolean; initial: View; initialInstallments: boolean;
}) {
  const [view, setView] = useState<View>(initial);
  const [data, setData] = useState(empty);
  const [valuesHidden, setValuesHidden] = useState(false);
  const mask = <T extends string | null | undefined>(value: T) => maskValue(valuesHidden, value);
  const [range, setRange] = useState(monthRange);
  const [selected, setSelected] = useState("");
  const [method, setMethod] = useState("");
  const [hours, setHours] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cardId, setCardId] = useState("");
  const [billId, setBillId] = useState("");
  const [openBillShown, setOpenBillShown] = useState(false);
  const [installmentsSelected, setInstallmentsSelected] = useState(initialInstallments);
  const [notifications, setNotifications] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [expandedConnection, setExpandedConnection] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [widget, setWidget] = useState<{ accessToken: string; sandbox: boolean; itemId?: string } | null>(null);
  const latest = useRef<number | null>(null);
  const noticeButton = useRef<HTMLButtonElement>(null);
  const refreshVersion = useRef(0);
  const canSwitchInstallments = view === "ledger" || view === "spending" || view === "bills";
  const showInstallmentPanel = canSwitchInstallments && installmentsSelected;
  const includeInstallments = view === "cards" || showInstallmentPanel;
  const includeCycles = view === "cards" || view === "spending";
  const includeOpenBill = view === "bills" && !showInstallmentPanel;
  const openedBill = includeOpenBill ? billId : "";

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const activeRange = includeInstallments ? monthRange() : range;
    if (!activeRange.from || !activeRange.to || activeRange.from > activeRange.to) {
      setError("Escolha um período válido.");
      return;
    }
    try {
      const query = new URLSearchParams(activeRange);
      if (includeInstallments) query.set("installments", "1");
      if (includeCycles) query.set("cycles", "1");
      if (includeOpenBill) query.set("open", "1");
      if (openedBill) query.set("bill", openedBill);
      const response = await fetch("/api/dashboard?" + query, { cache: "no-store" });
      if (version !== refreshVersion.current) return;
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (!response.ok) throw new Error("Não foi possível atualizar o painel. Confira o período e tente novamente.");
      const next: DashboardData = await response.json();
      if (version !== refreshVersion.current) return;
      const first = next.notifications[0];
      if (first && latest.current !== null && first.id > latest.current && !first.read) setToast(first);
      latest.current = Math.max(latest.current ?? 0, first?.id ?? 0);
      setData(next);
      setError("");
    } catch (err) {
      if (version === refreshVersion.current) setError(err instanceof Error ? err.message : "Falha ao carregar o painel.");
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }, [range, includeInstallments, includeCycles, includeOpenBill, openedBill]);

  // Lido antes da primeira resposta da API, para os saldos não aparecerem por um instante.
  useEffect(() => { setValuesHidden(localStorage.getItem(HIDDEN_VALUES_KEY) === "1"); }, []);

  function toggleValues() {
    const next = !valuesHidden;
    setValuesHidden(next);
    localStorage.setItem(HIDDEN_VALUES_KEY, next ? "1" : "0");
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 12000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 7500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (openedBill) document.getElementById("bill-" + openedBill)?.scrollIntoView({ block: "nearest" });
  }, [openedBill]);

  const cards = data.accounts.filter((row) => row.type === "CREDIT");
  const card = cards.find((row) => accountKey(row) === cardId) ?? cards[0];
  const cyclesByCard = new Map(data.cardCycles?.map((cycle) => [accountKey(cycle), cycle]));
  const cardConnection = data.connections.find((connection) => connection.id === card?.itemId);
  const cardInstitution = cardConnection && connectionName(cardConnection);
  const bills = card ? data.bills.filter((row) => accountKey(row) === accountKey(card)).sort((a, b) => (b.due ?? "").localeCompare(a.due ?? "")) : [];
  const cardInstallments = card ? data.installments?.filter((row) => accountKey(row) === accountKey(card)) : [];
  const selectedInstallments = data.installments?.filter((row) => !selected || accountKey(row) === selected);
  const installmentCardLabels = new Map(cards.map((row) => [
    accountKey(row), row.name + (row.last4 ? " · " + row.last4 : ""),
  ]));
  const openBill = card ? data.openBills?.find((row) => accountKey(row) === accountKey(card)) : undefined;
  const openBillParts = openBill ? ([["Compras", openBill.purchases], ["Parcelas importadas", openBill.imported],
    ["Parcelas previstas", openBill.estimated]] as const).filter(([, totals]) => totals.length) : [];
  const chosen = data.accounts.find((row) => accountKey(row) === selected);
  const selectedRows = data.entries.filter((row) => !selected || accountKey(row) === selected);
  const ledgerRows = useMemo(() => filterLedger(data.entries, { account: selected, method, hours }),
    [data.entries, selected, method, hours]);
  const analyze = useMemo(() => analyzer(data.accounts), [data.accounts]);
  const spending = useMemo(() => spendingEntries(ledgerRows, analyze), [ledgerRows, analyze]);
  const spendingRows = spending.map(({ row }) => row);
  const bankKeys = new Set(data.accounts.filter((row) => row.type === "BANK").map(accountKey));
  const balanceAccounts = chosen ? [chosen] : data.accounts.filter((row) => row.type === "BANK");
  const accountBalances = balanceAccounts
    .flatMap((row) => row.balance === null ? [] : [{ amount: row.balance, currency: row.currency }]);
  const blocked = blockedBalances(balanceAccounts);
  const blockedEntries = useMemo(() => blockedDeposits(data.accounts, data.entries, today()), [data.accounts, data.entries]);
  const overviewRows = chosen ? selectedRows : selectedRows.filter((row) => bankKeys.has(accountKey(row)));
  const posted = overviewRows.filter((row) => row.status === "POSTED");
  const methods = [...new Set(["Pix", "Débito", "Crédito", "Boleto", "TED", "Transferência", UNKNOWN_METHOD,
    ...data.entries.map((row) => row.method ?? UNKNOWN_METHOD)])].sort((a,b) => a.localeCompare(b, "pt-BR"));
  const lastSync = data.connections.reduce<string | null>((last, row) => row.syncedAt && (!last || row.syncedAt > last) ? row.syncedAt : last, null);

  async function operation(action: string, itemId?: string, extra: Record<string, unknown> = {}) {
    const response = await fetch("/api/connections", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extra, action, itemId }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível executar a ação.");
    return body;
  }

  async function run(action: string, itemId?: string, extra?: Record<string, unknown>) {
    setMessage("");
    setBusy(true);
    try {
      const result = await operation(action, itemId, extra);
      if (action === "token") setWidget({ accessToken: result.accessToken, sandbox: result.sandbox, itemId });
      else {
        if (action === "rename") { setRenaming(null); setMessage("Nome da conexão atualizado."); }
        if (action === "refresh") setMessage("Atualização solicitada.");
        if (action === "watch") setMessage("Depois de atualizar no Meu Pluggy, os dados novos chegam aqui em poucos minutos.");
        if (action === "import-existing") setMessage(result.alreadyLinked ? "A conexão já está vinculada." : "Importação solicitada.");
        if (action === "disconnect") { setConfirm(null); setMessage("Remoção solicitada."); }
        await refresh();
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : "A ação falhou."); }
    finally { setBusy(false); }
  }

  // Troca de categoria pelo Extrato, Gastos e Faturas (SPEC-0003, REQ-004).
  const categoryEditing = useMemo(() => ({
    analyze,
    save: async (row: Entry, category: string | null, scope: CategoryScope) => {
      await operation(scope === "entry" ? "categorize" : "categorize-rule", row.itemId,
        { accountId: row.accountId, entryId: row.id, category: category ?? "" });
      await refresh();
    },
  // operation só depende de fetch; refresh já é estável.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [analyze, refresh]);

  async function widgetSuccess(itemId: string) {
    setWidget(null);
    setView("connections");
    await run("link", itemId);
  }

  function navigate(target: View) {
    setMessage("");
    setInstallmentsSelected(false);
    setView(target);
  }

  function openConnectionAccount(target: "ledger" | "cards" | "bills", account: Account) {
    if (target === "ledger") {
      setSelected(accountKey(account));
      setMethod("");
      setHours("");
    } else {
      setCardId(accountKey(account));
      setBillId("");
    }
    navigate(target);
  }

  const openConnection = expandedConnection ?? data.connections.find((row) => row.active)?.id;

  const cardSelector = card && (
    <SelectField label="Cartão" value={accountKey(card)} onChange={(value) => { setCardId(value); setBillId(""); }}
      options={cards.map((row) => ({ value: accountKey(row), label: accountLabel(row) }))} />
  );
  const accountSelector = <SelectField label="Conta" value={selected} onChange={setSelected} options={[
    { value: "", label: view === "overview" ? "Todas as contas bancárias" : "Todas as contas e cartões" },
    ...data.accounts.map((row) => ({ value: accountKey(row), label: accountLabel(row) })),
  ]} />;
  const spendingCards = view === "spending" ? cards.filter((row) => !selected || accountKey(row) === selected) : [];
  const spendingClosings = spendingCards.length > 0 && <section className="my-3 space-y-2 rounded-lg border p-3" aria-label="Fechamento dos cartões">
    <h3 className="text-sm font-semibold">Próximo fechamento dos cartões</h3>
    <dl className="space-y-2 text-sm">
      {spendingCards.map((row) => <div className="flex flex-wrap items-start justify-between gap-x-3" key={accountKey(row)}>
        <dt>{row.name}{row.last4 ? " · " + row.last4 : ""}</dt>
        <dd className="font-medium"><CardClosing cycle={cyclesByCard.get(accountKey(row))} /></dd>
      </div>)}
    </dl>
  </section>;

  return <HiddenValues.Provider value={valuesHidden}><CategoryEditing.Provider value={categoryEditing}><div className="shell">
    <AppSidebar current={view} onNavigate={navigate} />
    <div className="workspace">
      <header className="topbar"><div className="topbar-label">
        <span>Painel financeiro</span>
      </div><div className="top-actions">
        {lastSync && <small><span className="status-dot" /> Sincronizado em {timestamp(lastSync)}</small>}
        <Button variant="outline" size="icon" aria-pressed={valuesHidden} onClick={toggleValues}
          aria-label={valuesHidden ? "Mostrar saldos e faturas" : "Ocultar saldos e faturas"}
          title={valuesHidden ? "Mostrar saldos e faturas" : "Ocultar saldos e faturas"}>{valuesHidden ? <EyeOff /> : <Eye />}</Button>
        <Button ref={noticeButton} variant="outline" size="icon" className="notice-trigger" aria-label={data.unread + " notificações não lidas"} aria-expanded={notifications}
          onClick={() => setNotifications(!notifications)}><Bell />{data.unread > 0 && <span>{data.unread > 99 ? "99+" : data.unread}</span>}</Button>
      </div>
      {notifications && <Card className="notice-pop" aria-label="Notificações">
        <CardHeader className="notice-head"><PanelHeading icon={Bell} title="Notificações" /><Button variant="ghost" size="icon" aria-label="Fechar notificações"
          onClick={() => { setNotifications(false); noticeButton.current?.focus(); }}><X /></Button></CardHeader>
        <CardContent className="notice-content">
          {!data.notifications.length && <p className="text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>}
          {data.notifications.length > 0 && <ScrollArea asChild><ul className="panel-scroll" aria-label="Avisos recebidos" tabIndex={0}>{data.notifications.map((row) => <li key={row.id} className={row.read ? "" : "unread"}>
            <span className="panel-symbol">{row.direction === "CREDIT" ? <ArrowDownLeft size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}</span>
            <div><strong>{noticeLabel(row)}</strong><small>{timestamp(row.date)}</small></div>
            <strong className="notice-value">{money(row.amount, row.currency)}</strong>
          </li>)}</ul></ScrollArea>}
          {data.unread > 0 && <Button variant="ghost" onClick={() => run("read-notices")} disabled={busy}><Check /> Marcar como lidas</Button>}
        </CardContent>
      </Card>}
      </header>
      <main className="content">
        <ScrollArea className="page-controls" overflow="layout">
          <div className="page-heading">
            <div><span className="eyebrow">FINANÇAS PESSOAIS</span><h1>{SECTIONS.find(([id]) => id === view)?.[1]}</h1>
              <p>{{ overview: "Saldos e movimentações em um só lugar.", ledger: "Consulte e filtre os lançamentos das suas contas.", spending: "Veja onde seu dinheiro foi no período.", cards: "Acompanhe os cartões vinculados às suas instituições.", bills: "Confira vencimentos, valores e compras por fatura.", connections: "Gerencie suas instituições e acompanhe a sincronização." }[view]}</p></div>
            {view === "connections" && <Button onClick={() => run("token")} disabled={busy}><Plus /> Conectar instituição</Button>}
            {canSwitchInstallments && <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de consulta">
              <Button type="button" variant={showInstallmentPanel ? "outline" : "default"} aria-pressed={!showInstallmentPanel}
                onClick={() => setInstallmentsSelected(false)}>{view === "bills" ? "Faturas oficiais" : "Lançamentos"}</Button>
              <Button type="button" variant={showInstallmentPanel ? "default" : "outline"} aria-pressed={showInstallmentPanel}
                onClick={() => setInstallmentsSelected(true)}><CalendarDays /> Parcelas por mês</Button>
            </div>}
          </div>
          {error && <p className="feedback error" role="alert">{error}</p>}
          {message && <p className="feedback" role="status">{message}</p>}
          {loading && <p className="text-sm text-muted-foreground" role="status">Carregando…</p>}

          {!showInstallmentPanel && (view === "overview" || view === "ledger" || view === "spending" || view === "bills") && <>
            <Button type="button" variant="outline" className="filter-toggle" aria-controls="dashboard-filters" aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}><Filter /> {filtersOpen ? "Recolher filtros" : "Filtros"}</Button>
            <div id="dashboard-filters" className="filters" data-open={filtersOpen}>
            {view !== "bills" && accountSelector}
            <DateField label="De" value={range.from} onChange={(from) => setRange({ ...range, from })}
              min={shiftDate(range.to, -MAX_RANGE_DAYS)} max={range.to} />
            <DateField label="Até" value={range.to} onChange={(to) => setRange({ ...range, to })}
              min={range.from} max={shiftDate(range.from, MAX_RANGE_DAYS)} />
            {(view === "ledger" || view === "spending") && <>
              <SelectField label="Horário" value={hours} onChange={setHours} options={[
                { value: "", label: "Todos" }, { value: "morning", label: "Manhã · 06h–11h" },
                { value: "afternoon", label: "Tarde · 12h–17h" }, { value: "night", label: "Noite · 18h–05h" },
                { value: "unknown", label: "Sem horário" },
              ]} />
              <SelectField label="Forma de pagamento" value={method} onChange={setMethod}
                options={[{ value: "", label: "Todas as formas" }, ...methods.map((value) => ({ value, label: value }))]} />
            </>}
            </div>
          </>}
        </ScrollArea>

        {view === "overview" && <ScrollArea className="overview-body" overflow="layout">
          <FinancialOverview
            balanceLabel={chosen?.type === "CREDIT" ? "Valor em aberto" : "Saldo atual"}
            balance={mask(moneyTotals(accountBalances))}
            blocked={blocked.blocked.length ? { amount: mask(moneyTotals(blocked.blocked)), ledger: mask(moneyTotals(blocked.ledger)) } : undefined}
            income={moneyTotals(posted.filter((row) => row.direction === "CREDIT"))}
            expense={moneyTotals(posted.filter((row) => row.direction === "DEBIT"))}
          />
          <ScrollArea className="panel-grid" overflow="layout">
            <Card className="panel-card"><CardHeader className="section-header"><PanelHeading icon={List} title="Movimentações recentes" /><Button variant="outline" onClick={() => navigate("ledger")}>Ver extrato <ArrowRight /></Button></CardHeader>
              <CardContent className="table-panel"><Ledger rows={overviewRows.slice(0, 7)} accounts={data.accounts} blocked={blockedEntries} /></CardContent></Card>
            <Card className="panel-card"><CardHeader><PanelHeading icon={Activity} title="Gastos por categoria" detail="Saídas efetivadas no período" /></CardHeader><ScrollArea asChild><CardContent className="panel-scroll" role="region" aria-label="Resumo de gastos por categoria" tabIndex={0}><SpendList rows={spendingEntries(overviewRows, analyze)} /></CardContent></ScrollArea></Card>
          </ScrollArea>
        </ScrollArea>}
        {view === "ledger" && !showInstallmentPanel && <Card className="panel-card">
          <CardHeader className="section-header"><PanelHeading icon={List} title="Lançamentos do período" />
            <Badge variant="secondary">{ledgerRows.length} {ledgerRows.length === 1 ? "lançamento" : "lançamentos"}</Badge>
          </CardHeader>
          <CardContent className="table-panel"><Ledger rows={ledgerRows} accounts={data.accounts} blocked={blockedEntries} /></CardContent>
        </Card>}
        {view === "spending" && !showInstallmentPanel && <ScrollArea className="panel-grid spending-grid" overflow="layout">
          <Card className="panel-card">
            <CardHeader><PanelHeading icon={Activity} title="Gastos por categoria" detail="Total dos lançamentos da lista" />
            </CardHeader>
            <ScrollArea asChild><CardContent className="panel-scroll" role="region" aria-label="Resumo de gastos por categoria" tabIndex={0}>
              {spendingRows.length > 0 && <>
                <strong className="spending-total">{spendingTotals(spending)}</strong>
                <dl className="mb-4 grid gap-1 text-sm">
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <dt className="text-muted-foreground">Efetivados</dt>
                    <dd>{spendingTotals(spending.filter(({ row }) => row.status === "POSTED"))}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <dt className="text-muted-foreground">Pendentes</dt>
                    <dd>{spendingTotals(spending.filter(({ row }) => row.status === "PENDING"))}</dd>
                  </div>
                </dl>
              </>}
              {spendingClosings}
              <SpendList rows={spending} includePending />
            </CardContent></ScrollArea>
          </Card>
          <Card className="panel-card">
            <CardHeader className="section-header"><PanelHeading icon={List} title="Lançamentos de gastos" />
              <Badge variant="secondary">{spendingRows.length} {spendingRows.length === 1 ? "lançamento" : "lançamentos"}</Badge>
            </CardHeader>
            <CardContent className="table-panel"><Ledger rows={spendingRows} accounts={data.accounts} blocked={blockedEntries} /></CardContent>
          </Card>
        </ScrollArea>}

        {view === "cards" && <CreditCardSummary
          card={card}
          institution={cardInstitution}
          installments={cardInstallments}
          cycle={card && cyclesByCard.get(accountKey(card))}
          selector={cards.length > 1 ? cardSelector : undefined}
          onOpenBills={() => navigate("bills")}
        />}

        {showInstallmentPanel && <Card className="panel-card">
          <CardHeader className="section-header">
            <PanelHeading icon={CalendarDays} title="Cronograma" detail={view === "bills" ? card?.name : "Parcelas de cartão da conta selecionada"} />
            {view === "bills" ? cards.length > 1 && cardSelector : accountSelector}
          </CardHeader>
          <ScrollArea asChild><CardContent className="panel-scroll" role="region" aria-label="Cronograma de parcelas" tabIndex={0}>
            {spendingClosings}
            <InstallmentList installments={view === "bills" ? cardInstallments : selectedInstallments}
              accountLabels={view === "bills" ? undefined : installmentCardLabels}
              onOpenBill={view === "bills" ? (id) => { setBillId(id); setInstallmentsSelected(false); } : undefined} />
          </CardContent></ScrollArea>
        </Card>}

        {view === "bills" && !showInstallmentPanel && <Card className="panel-card">
          <CardHeader className="section-header"><PanelHeading icon={ReceiptText} title="Faturas do cartão" detail={card?.name} />{cards.length > 1 && cardSelector}</CardHeader>
          <ScrollArea asChild><CardContent className="panel-scroll bill-list" role="region" aria-label="Lista de faturas" tabIndex={0}>{!card ? <EmptyState icon={CreditCard}>Nenhum cartão disponível nas instituições conectadas.</EmptyState> : <>
            {openBill && openBill.count > 0 && <div className="bill-item bill-estimate"><div className="bill-row">
              <div>
                <PanelHeading icon={Activity} title="Fatura aberta" detail={[
                  openBill.closes && "Fecha " + displayDateWithYear(openBill.closes),
                  openBill.due ? "vence " + displayDateWithYear(openBill.due) : "vence em " + monthLabel(openBill.month),
                ].filter(Boolean).join(" · ")} />
                <small className="mt-1">{openBillParts.map(([label, totals]) => label + " " + mask(moneyTotals([...totals]))).join(" · ")}</small>
                <small>Pode mudar até o banco fechar a fatura.</small>
              </div>
              <Badge variant="outline">Estimativa</Badge>
              <strong className="amount">{mask(moneyTotals(openBill.total))}</strong>
              <Button variant="outline" aria-expanded={openBillShown} aria-controls="open-bill-purchases"
                onClick={() => setOpenBillShown(!openBillShown)}>{openBillShown ? "Ocultar compras" : "Ver compras"} <ChevronDown aria-hidden="true" /></Button>
            </div>
            {openBillShown && <div className="bill-purchases" id="open-bill-purchases">
              <Ledger rows={openBill.entries} accounts={data.accounts} />
              {openBill.forecast.length > 0 && <InstallmentList installments={openBill.forecast} title="Parcelas previstas"
                description="Ainda não lançadas pelo banco. O valor repete a parcela importada mais recente do mesmo parcelamento." />}
            </div>}
            </div>}
            {!bills.length && <EmptyState icon={ReceiptText}>Nenhuma fatura oficial disponível para este cartão.</EmptyState>}
            {bills.map((bill) => <div className="bill-item" key={bill.id} id={"bill-" + bill.id}>
              <div className="bill-row">
                <div>
                  <PanelHeading icon={ReceiptText} title={"Vencimento " + displayDateWithYear(bill.due)} detail={"Fechamento " + displayDateWithYear(bill.closes)} />
                  {bill.minimumPayment != null && <small className="mt-1">Pagamento mínimo: {mask(money(bill.minimumPayment, bill.currency))}</small>}
                  {bill.allowsInstallments != null && <small>{bill.allowsInstallments ? "Permite parcelamento" : "Sem opção de parcelamento"}</small>}
                </div>
                <Badge variant="secondary">Fatura oficial</Badge>
                <strong className="amount">{mask(money(bill.amount, bill.currency))}</strong>
                <Button variant="outline" aria-expanded={billId === bill.id} onClick={() => setBillId(billId === bill.id ? "" : bill.id)}>{billId === bill.id ? "Ocultar compras" : "Ver compras"} <ChevronDown aria-hidden="true" /></Button>
              </div>
              {openedBill === bill.id && <div className="bill-purchases">
                {data.billPurchases?.id === bill.id
                  ? <Ledger rows={data.billPurchases.entries.filter((row) => accountKey(row) === accountKey(bill))} accounts={data.accounts} />
                  : <p role="status" className="py-3 text-sm text-muted-foreground">Carregando compras da fatura…</p>}
              </div>}
            </div>)}
          </>}</CardContent></ScrollArea>
        </Card>}

        {view === "connections" && <Card className="panel-card">
          <CardHeader className="section-header"><PanelHeading icon={Landmark} title="Instituições conectadas" detail="Situação e última sincronização" />
            <Badge variant="secondary">{data.connections.length} {data.connections.length === 1 ? "instituição" : "instituições"}</Badge>
          </CardHeader>
          <ScrollArea asChild><CardContent className="panel-scroll" role="region" aria-label="Lista de instituições" tabIndex={0}>
            {importExisting && <Button variant="outline" onClick={() => run("import-existing")} disabled={busy}>
              <Link2 /> Importar conexão existente
            </Button>}
            {!data.connections.length && <EmptyState icon={Landmark}>Conecte uma instituição para importar suas contas e movimentações.</EmptyState>}
            {data.connections.map((row) => <div key={row.id}>
              <div className="connection-row">
              <div>
                {renaming?.id === row.id ? <>
                  <form className="connection-rename" onSubmit={(event) => { event.preventDefault(); void run("rename", row.id, { label: renaming.value }); }}>
                    <Input aria-label="Nome da conexão" value={renaming.value} maxLength={40} autoFocus placeholder={row.name}
                      onChange={(event) => setRenaming({ id: row.id, value: event.target.value })}
                      onKeyDown={(event) => { if (event.key === "Escape") setRenaming(null); }} />
                    <Button type="submit" size="sm" disabled={busy}>Salvar</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancelar</Button>
                  </form>
                  <small className="mt-1 block text-xs text-muted-foreground">Deixe vazio para voltar a {row.name}.</small>
                </> : <PanelHeading icon={Landmark} title={connectionName(row)} detail={(row.label ? row.name + " · " : "") +
                  (row.details?.lastUpdatedAt ? "Sincronizado com o banco em " + timestamp(row.details.lastUpdatedAt)
                    : row.syncedAt ? "Atualizado em " + timestamp(row.syncedAt) : "Aguardando primeira importação")} />}
                {row.webhookReceivedAt && row.webhookStatus && <p className="mt-1 text-xs text-muted-foreground">
                  Webhook: {row.webhookEvent} · {timestamp(row.webhookReceivedAt)} · {webhookLabels[row.webhookStatus]}
                </p>}
              </div>
              <Badge className={row.status === "CONECTADA" ? "connected-badge" : undefined} variant={row.status === "CONECTADA" ? "secondary" : "outline"}>{stateLabels[row.status] || row.status}</Badge>
              {Boolean(row.active) && <Button variant="outline" aria-expanded={openConnection === row.id}
                aria-controls={"connection-" + row.id}
                onClick={() => setExpandedConnection(openConnection === row.id ? "" : row.id)}>
                {openConnection === row.id ? "Ocultar detalhes" : "Ver detalhes"} <ChevronDown aria-hidden="true" />
              </Button>}
              {Boolean(row.active) && <div className="connection-actions">
                {renaming?.id !== row.id && <Button variant="outline" disabled={busy} onClick={() => setRenaming({ id: row.id, value:
                  row.label ?? (data.accounts.find((account) => account.itemId === row.id && account.type === "BANK") ??
                    data.accounts.find((account) => account.itemId === row.id))?.name.trim() ?? "" })}><Pencil /> Renomear</Button>}
                {row.name === "MeuPluggy" && row.status !== "RECONECTAR" && <Button asChild variant="outline">
                  <a href="https://meu.pluggy.ai" target="_blank" rel="noopener noreferrer" onClick={() => void run("watch", row.id)}>
                    <ExternalLink /> Atualizar no Meu Pluggy</a>
                </Button>}
                {row.status === "RECONECTAR" ? <Button variant="outline" onClick={() => run("token", row.id)} disabled={busy}>Reconectar</Button> :
                  <Button variant="outline" onClick={() => run("refresh", row.id)} disabled={busy || row.status === "IMPORTANDO"}><RefreshCw /> Atualizar</Button>}
                {confirm === row.id ? <><Button variant="destructive" onClick={() => run("disconnect", row.id)} disabled={busy}>Confirmar remoção</Button>
                  <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button></> :
                  <Button variant="ghost" onClick={() => setConfirm(row.id)}>Desvincular</Button>}
              </div>}
              </div>
              <div id={"connection-" + row.id} hidden={openConnection !== row.id || !row.active}>
                {openConnection === row.id && Boolean(row.active) && <ConnectionDetails connection={row}
                  accounts={data.accounts} bills={data.bills} onOpen={openConnectionAccount} />}
              </div>
            </div>)}
          </CardContent></ScrollArea>
        </Card>}
      </main>
    </div>
    {toast && <div className="toast" role="status"><ArrowDownRight size={19} /><div><strong>{noticeLabel(toast)}</strong><small>{money(toast.amount, toast.currency)}</small></div>
      <Button variant="ghost" size="icon" aria-label="Fechar aviso" onClick={() => setToast(null)}><X /></Button></div>}
    {widget && <PluggyConnect connectToken={widget.accessToken} includeSandbox={widget.sandbox}
      connectorIds={widget.sandbox ? [2, 600] : undefined} updateItem={widget.itemId}
      onSuccess={({ item }) => widgetSuccess(item.id)} onClose={() => setWidget(null)}
      onError={() => { setWidget(null); setMessage("A conexão não foi concluída. Tente novamente."); }}
      onLoadError={() => { setWidget(null); setMessage("Não foi possível abrir o Pluggy Connect."); }} />}
  </div></CategoryEditing.Provider></HiddenValues.Provider>;
}
