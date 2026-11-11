import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { owner } from "@/lib/auth";
import { PlanningPage } from "@/components/planning/planning-page";
import { HORIZONS, SECTIONS } from "@/lib/planning/sections";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finance · Planejamento" };

type Params = { secao?: string; mes?: string; horizonte?: string };
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Aba Planejamento (SPEC-0004). O estado vem da URL e é validado aqui antes de chegar ao cliente.
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  if (!await owner()) redirect("/login");
  const query = await searchParams;
  const section = SECTIONS.find(([id]) => id === query.secao)?.[0] ?? "mes";
  const horizon = HORIZONS.find((value) => String(value) === query.horizonte) ?? 12;
  return <PlanningPage initialSection={section} initialMonth={query.mes && MONTH.test(query.mes) ? query.mes : ""} initialHorizon={horizon} />;
}
