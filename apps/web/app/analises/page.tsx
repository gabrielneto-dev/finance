import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { owner } from "@/lib/auth";
import { AnalyticsPage } from "@/components/analytics/analytics-page";
import { SECTIONS } from "@/lib/analytics/sections";
import { PRESETS } from "@/lib/analytics/periods.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finance · Análises" };

type Params = { secao?: string; periodo?: string; de?: string; ate?: string; conta?: string; comparar?: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT = /^[^/\s]{1,100}\/[^/\s]{1,100}$/;

// Aba Análises (SPEC-0003). O estado vem da URL e é validado aqui antes de chegar ao cliente.
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  if (!await owner()) redirect("/login");
  const query = await searchParams;
  const section = SECTIONS.find(([id]) => id === query.secao)?.[0] ?? "resumo";
  const preset = PRESETS.find(([id]) => id === query.periodo)?.[0] ?? "mes";
  const from = query.de && DATE.test(query.de) ? query.de : "";
  const to = query.ate && DATE.test(query.ate) ? query.ate : "";
  return <AnalyticsPage initialSection={section} initialPeriod={{
    preset: preset === "custom" && !(from && to) ? "mes" : preset, from, to,
    account: query.conta && ACCOUNT.test(query.conta) ? query.conta : "", compare: query.comparar !== "0",
  }} />;
}
