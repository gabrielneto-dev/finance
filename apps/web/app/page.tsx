import { redirect } from "next/navigation";
import { owner } from "@/lib/auth";
import { existingItemId } from "@/lib/config.mjs";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; mode?: string }> }) {
  if (!await owner()) redirect("/login");
  const { view, mode } = await searchParams;
  return <Dashboard importExisting={Boolean(existingItemId())}
    initial={view === "connections" || view === "cards" || view === "ledger" || view === "spending" || view === "bills" ? view : "overview"}
    initialInstallments={mode === "installments"} />;
}
