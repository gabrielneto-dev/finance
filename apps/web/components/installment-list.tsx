import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard-panels";
import { money, moneyTotals } from "@/lib/format";
import type { Installment } from "@/lib/types";

const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export function InstallmentList({ installments, accountLabels, onOpenBill }: {
  installments?: Installment[];
  accountLabels?: Map<string, string>;
  onOpenBill?: (id: string) => void;
}) {
  const months = new Map<string, Installment[]>();
  for (const row of installments ?? []) {
    if (!months.has(row.month)) months.set(row.month, []);
    months.get(row.month)!.push(row);
  }
  return <section className="mt-5 space-y-3" aria-labelledby="installments-title">
    <h3 id="installments-title" className="text-base font-semibold">Parcelas por mês</h3>
    <p className="text-sm text-muted-foreground">
      Do mês atual em diante. As previsões usam o valor da parcela importada mais recente como referência.
    </p>
    {!installments && <p role="status" className="text-sm text-muted-foreground">Carregando parcelas…</p>}
    {installments?.length === 0 && <EmptyState icon={CalendarDays}>Nenhuma parcela encontrada para a seleção.</EmptyState>}
    {Array.from(months, ([month, rows]) => <div key={month} className="rounded-lg border px-3">
      <h4 className="pt-2 text-sm font-semibold capitalize">
        {monthLabel.format(new Date(month + "-01T12:00:00Z"))}
      </h4>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 border-b py-2 text-xs">
        {rows.some((row) => !row.estimated) && <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Importadas</dt>
          <dd className="font-semibold">{moneyTotals(rows.filter((row) => !row.estimated))}</dd>
        </div>}
        {rows.some((row) => row.estimated) && <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Previstas</dt>
          <dd className="font-semibold">{moneyTotals(rows.filter((row) => row.estimated))}</dd>
        </div>}
      </dl>
      <ul className="divide-y">
        {rows.map((row) => <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
          <div className="min-w-0 flex-1 basis-36 break-words">
            <span className="font-medium">{row.description}</span>
            <span className="block text-xs text-muted-foreground">
              Parcela {row.installment}/{row.installments}
              {accountLabels?.get(row.itemId + "/" + row.accountId) && " · " + accountLabels.get(row.itemId + "/" + row.accountId)}
            </span>
          </div>
          <Badge variant={row.estimated ? "outline" : "secondary"}>{row.estimated ? "Prevista" : "Importada"}</Badge>
          <span className="amount">{money(row.amount, row.currency)}</span>
          {onOpenBill && row.billId && <Button size="sm" variant="outline" onClick={() => onOpenBill(row.billId!)}>
            Abrir fatura oficial
          </Button>}
        </li>)}
      </ul>
    </div>)}
  </section>;
}

