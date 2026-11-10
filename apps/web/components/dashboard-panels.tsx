import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet, type LucideIcon } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";

export function PanelHeading({ icon: Icon, title, detail }: {
  icon: LucideIcon;
  title: string;
  detail?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <span className="panel-symbol"><Icon size={17} aria-hidden="true" /></span>
      <div>
        <CardTitle>{title}</CardTitle>
        {detail && <p>{detail}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="panel-empty">
    <span className="panel-symbol"><Icon size={19} aria-hidden="true" /></span>
    <p>{children}</p>
  </div>;
}

export function FinancialOverview({ balanceLabel, balance, blocked, income, expense }: {
  balanceLabel: string;
  balance: string;
  blocked?: { amount: string; ledger: string };
  income: string;
  expense: string;
}) {
  return (
    <Card className="financial-overview">
      <div className="financial-totals" role="region" aria-label="Resumo financeiro">
        <dl className="financial-balance">
          <dt><Wallet size={17} aria-hidden="true" /> {balanceLabel}</dt>
          <dd>{balance}<small>Último saldo informado</small>
            {blocked && <small className="financial-blocked">{blocked.amount} bloqueado · contábil {blocked.ledger}</small>}</dd>
        </dl>
        <div className="financial-flow">
          <dl>
            <dt><span className="panel-symbol"><ArrowDownLeft size={16} aria-hidden="true" /></span> Entradas</dt>
            <dd>{income}<small>Efetivadas no período</small></dd>
          </dl>
          <dl>
            <dt><span className="panel-symbol"><ArrowUpRight size={16} aria-hidden="true" /></span> Saídas</dt>
            <dd>{expense}<small>Efetivadas no período</small></dd>
          </dl>
        </div>
      </div>
    </Card>
  );
}
