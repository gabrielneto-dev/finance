import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, CalendarDays, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState, PanelHeading } from "@/components/dashboard-panels";
import { InstallmentList } from "@/components/installment-list";
import { CardClosing, closingDate } from "@/components/card-closing";
import { useMaskValue } from "@/components/hidden-values";
import { displayDate, money } from "@/lib/format";
import type { Account, CardCycle, Installment } from "@/lib/types";

type CreditCardSummaryProps = {
  card?: Account;
  institution?: string;
  selector?: ReactNode;
  installments?: Installment[];
  cycle?: CardCycle;
  onOpenBills: () => void;
};

export function CreditCardSummary({ card, institution, selector, installments, cycle, onOpenBills }: CreditCardSummaryProps) {
  const mask = useMaskValue();
  return (
    <Card className="panel-card credit-panel">
      <CardHeader className="section-header">
        <PanelHeading icon={CreditCard} title="Resumo do cartão" />
        {selector}
      </CardHeader>
      <ScrollArea asChild>
        <CardContent className="panel-scroll credit-summary" role="region" aria-label="Detalhes do cartão" tabIndex={0}>
          {card ? (
            <>
            <div className="credit-overview">
              <div className="credit-identity">
                <div className="credit-identity-top">
                  <span className="credit-symbol"><CreditCard size={21} aria-hidden="true" /></span>
                  <span>{institution || "Cartão de crédito"}</span>
                </div>
                <div>
                  <h2>{card.name}</h2>
                  {card.last4 && <p>Final {card.last4}</p>}
                </div>
              </div>

              <div className="credit-cycle">
                <dl>
                  <div className="credit-balance">
                    <dt>Valor em aberto informado</dt>
                    <dd>{card.balance === null ? "Não informado" : mask(money(card.balance, card.currency))}</dd>
                  </div>
                  <div className="credit-dates">
                    <div>
                      <dt><CalendarClock size={15} aria-hidden="true" /> Próximo fechamento</dt>
                      <dd><CardClosing cycle={cycle} /></dd>
                    </div>
                    <div>
                      <dt><CalendarDays size={15} aria-hidden="true" /> Vencimento informado</dt>
                      <dd>{card.due ? displayDate(card.due) : "Não informado"}</dd>
                    </div>
                  </div>
                  {cycle?.lastClosing && <div className="mt-3 text-sm text-muted-foreground">
                    <dt>Último fechamento informado</dt>
                    <dd>{closingDate(cycle.lastClosing)}</dd>
                  </div>}
                </dl>
                <Button onClick={onOpenBills}>Ver faturas <ArrowRight aria-hidden="true" /></Button>
              </div>
            </div>
            <InstallmentList installments={installments} />
            </>
          ) : (
            <EmptyState icon={CreditCard}>Nenhum cartão disponível nas instituições conectadas.</EmptyState>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
