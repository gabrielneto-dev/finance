import { owner } from "@/lib/auth";
import { database } from "@/lib/db.mjs";
import { today } from "@/lib/format";
import { analytics } from "@/lib/analytics/index.mjs";
import { parseAnalyticsQuery } from "@/lib/analytics/query.mjs";

export const dynamic = "force-dynamic";

// Análises financeiras do proprietário (SPEC-0003).
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const parsed = parseAnalyticsQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers });
  const user = await owner();
  if (!user) return Response.json({ error: "Entre para consultar as análises." }, { status: 401, headers });
  try {
    return Response.json(analytics(database(), user, { ...parsed.value, reference: today() }), { headers });
  } catch (error) {
    console.error("Falha ao montar as análises", error instanceof Error ? error.message : error);
    return Response.json({ error: "Não foi possível montar as análises agora." }, { status: 500, headers });
  }
}
