import { owner } from "@/lib/auth";
import { dashboard, database } from "@/lib/db.mjs";
import { today } from "@/lib/format";
import { uuid } from "@/lib/config.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  const billId = query.get("bill") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(from) || !date.test(to) || !Number.isFinite(Date.parse(from)) ||
      !Number.isFinite(Date.parse(to)) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) {
    return Response.json({ error: "Período inválido." }, { status: 400 });
  }
  if (billId && !uuid.test(billId)) return Response.json({ error: "Fatura inválida." }, { status: 400 });
  const headers = { "Cache-Control": "private, no-store" };
  const user = await owner();
  if (!user) return Response.json({ error: "Entre para consultar o painel." }, { status: 401, headers });
  const reference = today();
  const scheduleFrom = query.get("installments") === "1" ? reference : "";
  const cycleDate = query.get("cycles") === "1" ? reference : "";
  return Response.json(dashboard(database(), user, from, to, scheduleFrom, billId, cycleDate), { headers });
}
