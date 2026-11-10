"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, CreditCard, Eye, EyeOff, Filter, Landmark, LayoutGrid, Link2, List, LogOut, Plus, ReceiptText, RefreshCw, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreditCardSummary } from "@/components/credit-card-summary";
import { CardClosing } from "@/components/card-closing";
import { InstallmentList } from "@/components/installment-list";
import { ConnectionDetails } from "@/components/connection-details";
import { HIDDEN_VALUES_KEY, HiddenValues } from "@/components/hidden-values";
import { EmptyState, FinancialOverview, PanelHeading } from "@/components/dashboard-panels";
import { logout } from "@/app/login/actions";
import { displayDate, displayDateWithYear, maskValue, money, moneyTotals, monthRange, timestamp } from "@/lib/format";
import { filterLedger, UNKNOWN_METHOD } from "@/lib/ledger-filter";
import type { Account, DashboardData, Entry, Notice } from "@/lib/types";

const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((mod) => mod.PluggyConnect), { ssr: false });

const sections = [
  ["overview", "Visão geral", LayoutGrid], ["ledger", "Extrato", List], ["spending", "Gastos", Activity],
  ["cards", "Cartões", CreditCard], ["bills", "Faturas", ReceiptText], ["connections", "Conexões", Link2],
] as const;
type View = typeof sections[number][0];
const empty: DashboardData = { accounts: [], entries: [], bills: [], connections: [], notifications: [], unread: 0 };
const accountKey = (row: { itemId: string; accountId?: string; id?: string }) => row.itemId + "/" + (row.accountId ?? row.id);
const expense = (row: Entry) => row.direction === "DEBIT" && row.method !== "Fatura";
const stateLabels: Record<string, string> = {
  CONECTADA: "Conectada", IMPORTANDO: "Importando", RECONECTAR: "Reconectar",
  "ATENÇÃO": "Atenção", PARCIAL: "Importação parcial", REMOVENDO: "Removendo",
};
const webhookLabels = {
  queued: "Aguardando processamento", retry: "Aguardando nova tentativa",
  processed: "Processado", ignored: "Ignorado",
};

function noticeLabel(row: Notice) {
  return (row.method === "Pix" ? "Pix " : row.method + " · ") + (row.direction === "CREDIT" ? "recebido" : "enviado");
}

function Ledger({ rows, accounts }: { rows: Entry[]; accounts: Account[] }) {
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
          {row.installment && row.installments ? " · " + row.installment + "/" + row.installments : ""}</small></div>
      </div></td>
      <td className="entry-date">{displayDate(row.date)} <small>{row.time ?? "Sem horário"}</small></td>
      <td><Badge variant={row.status === "PENDING" ? "outline" : "secondary"}>{row.status === "PENDING" ? "Pendente" : "Efetivada"}</Badge></td>
      <td className={row.direction === "CREDIT" ? "amount positive" : "amount"}>{row.direction === "CREDIT" ? "+" : "−"}{money(row.amount, row.currency)}</td>
    </tr>)}</tbody>
  </table></ScrollArea>;
}

function SpendList({ rows, includePending = false }: { rows: Entry[]; includePending?: boolean }) {
  const groups = new Map<string, { label: string; currency: string; amount: number; pending: number }>();
  for (const row of rows) {
    if (!expense(row) || (!includePending && row.status !== "POSTED")) continue;
    const label = row.category || "Sem categoria";
    const key = row.currency + "/" + label;
    const group = groups.get(key) ?? { label, currency: row.currency, amount: 0, pending: 0 };
    group.amount += row.amount;
    if (row.status === "PENDING") group.pending += row.amount;
    groups.set(key, group);
  }
  const sorted = Array.from(groups.values()).sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount);
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
  const [installmentsSelected, setInstallmentsSelected] = useState(initialInstallments);
  const [notifications, setNotifications] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [expandedConnection, setExpandedConnection] = useState<string | null>(null);
  const [widget, setWidget] = useState<{ accessToken: string; sandbox: boolean; itemId?: string } | null>(null);
  const latest = useRef<number | null>(null);
  const noticeButton = useRef<HTMLButtonElement>(null);
  const refreshVersion = useRef(0);
  const canSwitchInstallments = view === "ledger" || view === "spending" || view === "bills";
  const showInstallmentPanel = canSwitchInstallments && installmentsSelected;
  const includeInstallments = view === "cards" || showInstallmentPanel;
  const includeCycles = view === "cards" || view === "spending";
  const openedBill = view === "bills" && !showInstallmentPanel ? billId : "";

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
  }, [range, includeInstallments, includeCycles, openedBill]);

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
  const cardInstitution = data.connections.find((connection) => connection.id === card?.itemId)?.name;
  const bills = card ? data.bills.filter((row) => accountKey(row) === accountKey(card)).sort((a, b) => (b.due ?? "").localeCompare(a.due ?? "")) : [];
  const cardRows = card ? data.entries.filter((row) => accountKey(row) === accountKey(card)) : [];
  const cardInstallments = card ? data.installments?.filter((row) => accountKey(row) === accountKey(card)) : [];
  const selectedInstallments = data.installments?.filter((row) => !selected || accountKey(row) === selected);
  const installmentCardLabels = new Map(cards.map((row) => [
    accountKey(row), row.name + (row.last4 ? " · " + row.last4 : ""),
  ]));
  const openBill = cardRows.filter((row) => !row.billId && row.status === "PENDING" && expense(row));
  const chosen = data.accounts.find((row) => accountKey(row) === selected);
  const selectedRows = data.entries.filter((row) => !selected || accountKey(row) === selected);
  const ledgerRows = useMemo(() => filterLedger(data.entries, { account: selected, method, hours }),
    [data.entries, selected, method, hours]);
  const spendingRows = ledgerRows.filter(expense);
  const bankKeys = new Set(data.accounts.filter((row) => row.type === "BANK").map(accountKey));
  const accountBalances = (chosen ? [chosen] : data.accounts.filter((row) => row.type === "BANK"))
    .flatMap((row) => row.balance === null ? [] : [{ amount: row.balance, currency: row.currency }]);
  const overviewRows = chosen ? selectedRows : selectedRows.filter((row) => bankKeys.has(accountKey(row)));
  const posted = overviewRows.filter((row) => row.status === "POSTED");
  const methods = [...new Set(["Pix", "Débito", "Crédito", "Boleto", "TED", "Transferência", UNKNOWN_METHOD,
    ...data.entries.map((row) => row.method ?? UNKNOWN_METHOD)])].sort((a,b) => a.localeCompare(b, "pt-BR"));
  const lastSync = data.connections.reduce<string | null>((last, row) => row.syncedAt && (!last || row.syncedAt > last) ? row.syncedAt : last, null);

  async function operation(action: string, itemId?: string) {
    const response = await fetch("/api/connections", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, itemId }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível executar a ação.");
    return body;
  }

  async function run(action: string, itemId?: string) {
    setMessage("");
    setBusy(true);
    try {
      const result = await operation(action, itemId);
      if (action === "token") setWidget({ accessToken: result.accessToken, sandbox: result.sandbox, itemId });
      else {
        if (action === "refresh") setMessage("Atualização solicitada.");
        if (action === "import-existing") setMessage(result.alreadyLinked ? "A conexão já está vinculada." : "Importação solicitada.");
        if (action === "disconnect") { setConfirm(null); setMessage("Remoção solicitada."); }
        await refresh();
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : "A ação falhou."); }
    finally { setBusy(false); }
  }

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
    <label className="field">
      Cartão
      <span className="select-wrap">
        <select value={accountKey(card)} onChange={(event) => { setCardId(event.target.value); setBillId(""); }}>
          {cards.map((row) => <option key={accountKey(row)} value={accountKey(row)}>{row.name}{row.last4 && " · " + row.last4}</option>)}
        </select>
        <ChevronDown size={14} />
      </span>
    </label>
  );
  const accountSelector = <label className="field">Conta <span className="select-wrap"><select value={selected} onChange={(event) => setSelected(event.target.value)}>
    <option value="">{view === "overview" ? "Todas as contas bancárias" : "Todas as contas e cartões"}</option>
    {data.accounts.map((row) => <option key={accountKey(row)} value={accountKey(row)}>{row.name}{row.last4 && " · " + row.last4}</option>)}
  </select><ChevronDown size={14} /></span></label>;
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

  return <HiddenValues.Provider value={valuesHidden}><div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Wallet size={20} /></span><div><strong>Finance</strong><span>Meu espaço financeiro</span></div></div>
      <p className="nav-label">PAINEL</p>
      <ScrollArea asChild overflow="vertical"><nav aria-label="Seções do Finance">{sections.map(([id, label, Icon]) =>
        <button key={id} type="button" aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={17} />{label}</button>
      )}</nav></ScrollArea>
      <form className="side-footer" action={logout}><Button variant="ghost"><LogOut size={16} /> Sair</Button></form>
    </aside>
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
            <div><span className="eyebrow">FINANÇAS PESSOAIS</span><h1>{sections.find(([id]) => id === view)?.[1]}</h1>
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
            <label className="field">De<Input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
            <label className="field">Até<Input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
            {(view === "ledger" || view === "spending") && <>
              <label className="field">Horário<span className="select-wrap"><select value={hours} onChange={(event) => setHours(event.target.value)}><option value="">Todos</option>
                <option value="morning">Manhã · 06h–11h</option><option value="afternoon">Tarde · 12h–17h</option><option value="night">Noite · 18h–05h</option><option value="unknown">Sem horário</option></select><ChevronDown size={14} /></span></label>
              <label className="field">Forma de pagamento<span className="select-wrap"><select value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="">Todas as formas</option>{methods.map((value) => <option key={value}>{value}</option>)}
              </select><ChevronDown size={14} /></span></label>
            </>}
            </div>
          </>}
        </ScrollArea>

        {view === "overview" && <ScrollArea className="overview-body" overflow="layout">
          <FinancialOverview
            balanceLabel={chosen?.type === "CREDIT" ? "Valor em aberto" : "Saldo atual"}
            balance={mask(moneyTotals(accountBalances))}
            income={moneyTotals(posted.filter((row) => row.direction === "CREDIT"))}
            expense={moneyTotals(posted.filter((row) => row.direction === "DEBIT"))}
          />
          <ScrollArea className="panel-grid" overflow="layout">
            <Card className="panel-card"><CardHeader className="section-header"><PanelHeading icon={List} title="Movimentações recentes" /><Button variant="outline" onClick={() => navigate("ledger")}>Ver extrato <ArrowRight /></Button></CardHeader>
              <CardContent className="table-panel"><Ledger rows={overviewRows.slice(0, 7)} accounts={data.accounts} /></CardContent></Card>
            <Card className="panel-card"><CardHeader><PanelHeading icon={Activity} title="Gastos por categoria" detail="Saídas efetivadas no período" /></CardHeader><ScrollArea asChild><CardContent className="panel-scroll" role="region" aria-label="Resumo de gastos por categoria" tabIndex={0}><SpendList rows={overviewRows} /></CardContent></ScrollArea></Card>
          </ScrollArea>
        </ScrollArea>}
        {view === "ledger" && !showInstallmentPanel && <Card className="panel-card">
          <CardHeader className="section-header"><PanelHeading icon={List} title="Lançamentos do período" />
            <Badge variant="secondary">{ledgerRows.length} {ledgerRows.length === 1 ? "lançamento" : "lançamentos"}</Badge>
          </CardHeader>
          <CardContent className="table-panel"><Ledger rows={ledgerRows} accounts={data.accounts} /></CardContent>
        </Card>}
        {view === "spending" && !showInstallmentPanel && <ScrollArea className="panel-grid spending-grid" overflow="layout">
          <Card className="panel-card">
            <CardHeader><PanelHeading icon={Activity} title="Gastos por categoria" detail="Total dos lançamentos da lista" />
            </CardHeader>
            <ScrollArea asChild><CardContent className="panel-scroll" role="region" aria-label="Resumo de gastos por categoria" tabIndex={0}>
              {spendingRows.length > 0 && <>
                <strong className="spending-total">{moneyTotals(spendingRows)}</strong>
                <dl className="mb-4 grid gap-1 text-sm">
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <dt className="text-muted-foreground">Efetivados</dt>
                    <dd>{moneyTotals(spendingRows.filter((row) => row.status === "POSTED"))}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <dt className="text-muted-foreground">Pendentes</dt>
                    <dd>{moneyTotals(spendingRows.filter((row) => row.status === "PENDING"))}</dd>
                  </div>
                </dl>
              </>}
              {spendingClosings}
              <SpendList rows={spendingRows} includePending />
            </CardContent></ScrollArea>
          </Card>
          <Card className="panel-card">
            <CardHeader className="section-header"><PanelHeading icon={List} title="Lançamentos de gastos" />
              <Badge variant="secondary">{spendingRows.length} {spendingRows.length === 1 ? "lançamento" : "lançamentos"}</Badge>
            </CardHeader>
            <CardContent className="table-panel"><Ledger rows={spendingRows} accounts={data.accounts} /></CardContent>
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
            {openBill.length > 0 && <div className="bill-row bill-estimate">
              <PanelHeading icon={Activity} title="Compras pendentes no período" detail="Estimativa do ciclo aberto" />
              <strong className="amount">{mask(moneyTotals(openBill))}</strong>
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
                <PanelHeading icon={Landmark} title={row.name} detail={row.syncedAt ? "Atualizado em " + timestamp(row.syncedAt) : "Aguardando primeira importação"} />
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
  </div></HiddenValues.Provider>;
}
