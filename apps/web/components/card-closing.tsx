import type { CardCycle } from "@/lib/types";

const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" });
const sources = {
  card: "Informado pelo banco",
  bill: "Informado na fatura",
  history: "Estimado pelo histórico de faturas",
  transactions: "Estimado pelos lançamentos das faturas",
};

export function closingDate(date: string) {
  return dateLabel.format(new Date(date + "T12:00:00Z"));
}

export function CardClosing({ cycle }: { cycle?: CardCycle }) {
  if (!cycle) return <span className="text-sm text-muted-foreground">Consultando fechamento…</span>;
  if (!cycle.nextClosing || !cycle.source) return <span className="text-sm text-muted-foreground">Sem dados suficientes para estimar</span>;
  return <>
    <span>{closingDate(cycle.nextClosing)}</span>
    <span className="block text-xs font-normal text-muted-foreground">{sources[cycle.source]}</span>
  </>;
}
