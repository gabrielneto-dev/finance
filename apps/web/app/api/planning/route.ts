import { owner } from "@/lib/auth";
import { database } from "@/lib/db.mjs";
import { origin } from "@/lib/config.mjs";
import { today } from "@/lib/format";
import { planning } from "@/lib/planning/index.mjs";
import { applyAction } from "@/lib/planning/actions.mjs";
import { parsePlanningQuery } from "@/lib/planning/validate.mjs";

export const dynamic = "force-dynamic";

const MAX_BODY = 20_000;
const response = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

// Planejamento do proprietário (SPEC-0004).
export async function GET(request: Request) {
  const reference = today();
  const parsed = parsePlanningQuery(new URL(request.url).searchParams, reference);
  if (!parsed.ok) return response({ error: parsed.error }, 400);
  const user = await owner();
  if (!user) return response({ error: "Entre para consultar o planejamento." }, 401);
  try {
    return response(planning(database(), user, { ...parsed.value, reference }));
  } catch (error) {
    console.error("Falha ao montar o planejamento", error instanceof Error ? error.message : error);
    return response({ error: "Não foi possível montar o planejamento agora." }, 500);
  }
}

// Escritas do Planejamento: Origin, sessão, tamanho e valores conferidos antes de tocar no banco (REQ-010).
export async function POST(request: Request) {
  if (request.headers.get("origin") !== origin()) return response({ error: "Origem inválida." }, 403);
  const user = await owner();
  if (!user) return response({ error: "Entre para alterar o planejamento." }, 401);
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY) return response({ error: "Requisição grande demais." }, 413);
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* corpo inválido */ }
  try {
    const result = applyAction(database(), user, body, today());
    return response(result.body, result.status);
  } catch (error) {
    console.error("Falha ao salvar o planejamento", error instanceof Error ? error.message : error);
    return response({ error: "Não foi possível salvar agora." }, 500);
  }
}
