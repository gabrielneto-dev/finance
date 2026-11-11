"use client";

import Link from "next/link";
import { Activity, ChartNoAxesColumn, CreditCard, LayoutGrid, Link2, List, LogOut, ReceiptText, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logout } from "@/app/login/actions";

export const SECTIONS = [
  ["overview", "Visão geral", LayoutGrid], ["analises", "Análises", ChartNoAxesColumn], ["planejamento", "Planejamento", Target],
  ["ledger", "Extrato", List], ["spending", "Gastos", Activity], ["cards", "Cartões", CreditCard], ["bills", "Faturas", ReceiptText],
  ["connections", "Conexões", Link2],
] as const;
export type Section = typeof SECTIONS[number][0];
/** Seções com rota própria, fora do painel. */
const ROUTES: Partial<Record<Section, string>> = { analises: "/analises", planejamento: "/planejamento" };
export type DashboardView = Exclude<Section, "analises" | "planejamento">;

const href = (id: Section) => ROUTES[id] ?? (id === "overview" ? "/" : "/?view=" + id);

// Barra lateral compartilhada pelo painel, pelas Análises e pelo Planejamento. No painel, as seções trocam
// de aba sem recarregar; Análises e Planejamento têm rota própria (SPEC-0003, REQ-005; SPEC-0004, REQ-010).
export function AppSidebar({ current, onNavigate }: { current: Section; onNavigate?: (view: DashboardView) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Wallet size={20} /></span><div><strong>Finance</strong><span>Meu espaço financeiro</span></div></div>
      <p className="nav-label">PAINEL</p>
      <ScrollArea asChild overflow="vertical"><nav aria-label="Seções do Finance">{SECTIONS.map(([id, label, Icon]) => {
        const active = current === id ? "page" : undefined;
        if (onNavigate && !ROUTES[id]) {
          return <button key={id} type="button" aria-current={active} onClick={() => onNavigate(id as DashboardView)}><Icon size={17} />{label}</button>;
        }
        return <Link key={id} href={href(id)} aria-current={active}><Icon size={17} />{label}</Link>;
      })}</nav></ScrollArea>
      <form className="side-footer" action={logout}><Button variant="ghost"><LogOut size={16} /> Sair</Button></form>
    </aside>
  );
}
