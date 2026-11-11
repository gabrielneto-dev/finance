"use client";

import { CircleAlert, CircleCheck, Clock, Pencil, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl, ChartCard, Empty, monthLong, percent } from "@/components/analytics/kit";
import type { Goal } from "@/lib/planning/types";
import type { PlanningProps } from "./planning-page";

const months = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + (value >= 0.95 && value < 1.05 ? " mês" : " meses");

const SITUATION: Record<Goal["situation"], { label: string; Icon: typeof Clock; tone: string }> = {
  concluida: { label: "Concluída", Icon: CircleCheck, tone: "dentro" },
  no_prazo: { label: "No prazo", Icon: CircleCheck, tone: "dentro" },
  atrasada: { label: "Atrasada", Icon: CircleAlert, tone: "estourou" },
  sem_prazo: { label: "Sem prazo", Icon: Clock, tone: "" },
  sem_aporte: { label: "Sem aporte planejado", Icon: CircleAlert, tone: "atencao" },
};

export function GoalsSection({ data, secret, edit }: PlanningProps) {
  const reserve = data.goals.find((goal) => goal.kind === "reserva");
  const independence = data.goals.find((goal) => goal.kind === "independencia");
  const others = data.goals.filter((goal) => goal.kind === "objetivo");
  const totalMonthly = data.goals.reduce((total, goal) => total + goal.monthly, 0);
  return <div className="an-grid">
    <ChartCard className="span-12 pl-reserve" title="Reserva de emergência"
      detail={"Meses de gasto essencial guardados. Média essencial: " + brl(data.essentialAverage) + " por mês"}
      action={reserve ? <Button size="sm" variant="outline" onClick={() => edit({ type: "goal", goal: reserve })}><Pencil />Editar</Button> : undefined}>
      {reserve ? <GoalBody goal={reserve} secret={secret} />
        : <div className="pl-empty-row"><ShieldCheck aria-hidden="true" />
          <p>Com renda mista, guarde 6 meses de gasto essencial: {secret(data.essentialAverage * 6)}.</p>
          <Button size="sm" onClick={() => edit({ type: "goal", kind: "reserva" })}>Criar reserva</Button></div>}
    </ChartCard>
    <ChartCard className="span-8" title="Metas" detail={totalMonthly ? "Aportes planejados: " + brl(totalMonthly) + " por mês" : "Objetivos com alvo, prazo e aporte"}
      action={<Button size="sm" variant="outline" onClick={() => edit({ type: "goal" })}><Plus />Nova meta</Button>}>
      {others.length ? <div className="pl-goals">{others.map((goal) => <article key={goal.id} className="pl-goal">
        <header><h3>{goal.name}</h3><Button variant="ghost" size="icon-xs" onClick={() => edit({ type: "goal", goal })} aria-label={"Editar " + goal.name}><Pencil /></Button></header>
        <GoalBody goal={goal} secret={secret} />
      </article>)}</div> : <Empty>Crie metas como viagem, carro ou entrada de imóvel para ver o aporte necessário e a data prevista.</Empty>}
    </ChartCard>
    <ChartCard className="span-4" title="Independência financeira" detail="Opcional. Regra dos 4%: 25 vezes o gasto anual"
      action={independence ? <Button variant="ghost" size="icon-xs" onClick={() => edit({ type: "goal", goal: independence })} aria-label="Editar independência financeira"><Pencil /></Button> : undefined}>
      {independence ? <GoalBody goal={independence} secret={secret} compact />
        : <div className="pl-empty-col">
          <p className="big-number">{secret(data.annualSpending * 25)}</p>
          <p className="big-caption">Com gasto anual de {brl(data.annualSpending)}</p>
          <Button size="sm" variant="outline" onClick={() => edit({ type: "goal", kind: "independencia" })}>Acompanhar esta meta</Button>
        </div>}
    </ChartCard>
  </div>;
}

function GoalBody({ goal, secret, compact = false }: { goal: Goal; secret: PlanningProps["secret"]; compact?: boolean }) {
  const { label, Icon, tone } = SITUATION[goal.situation];
  return <div className="pl-goal-body">
    <div className="pl-goal-figures">
      <span className="big-number">{secret(goal.current)}</span>
      <span>de {secret(goal.target)}{goal.automaticTarget ? " (calculado)" : ""}</span>
    </div>
    <div className="pl-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goal.progress * 100)}
      aria-label={"Progresso de " + goal.name}><span style={{ width: goal.progress * 100 + "%" }} /></div>
    <div className="pl-goal-meta">
      <span className={"pl-status " + tone}><Icon size={14} aria-hidden="true" />{label}{goal.situation === "atrasada" && goal.delay > 0 ? " " + months(goal.delay) : ""}</span>
      <span>{percent(goal.progress)} · falta {secret(goal.remaining)}</span>
    </div>
    {!compact && <dl className="pl-facts">
      {goal.covered !== null && <div><dt>Cobre</dt><dd>{months(goal.covered)} de gasto essencial</dd></div>}
      <div><dt>Aporte planejado</dt><dd>{brl(goal.monthly)} por mês</dd></div>
      {goal.required !== null && <div><dt>Necessário até o prazo</dt><dd className={goal.required > goal.monthly ? "negative" : undefined}>{brl(goal.required)} por mês</dd></div>}
      <div><dt>Data prevista</dt><dd>{goal.situation === "concluida" ? "Já alcançada" : goal.etaMonth ? monthLong(goal.etaMonth) : "Sem previsão com o aporte atual"}</dd></div>
      {goal.deadline && <div><dt>Prazo</dt><dd>{monthLong(goal.deadline)}</dd></div>}
      {goal.yieldRate > 0 && <div><dt>Rendimento</dt><dd>{percent(goal.yieldRate / 10000, 2)} ao ano</dd></div>}
    </dl>}
    {compact && <p className="an-note">{goal.etaMonth ? "Prevista para " + monthLong(goal.etaMonth) : "Defina um aporte para ver a data prevista."}</p>}
  </div>;
}
