import { owner } from "@/lib/auth";
import { database } from "@/lib/db.mjs";
import { deviceCount, enqueueTestPush, registerDevice, removeDevice, serviceAccount } from "@/lib/push.mjs";
import { writeAllowed } from "@/lib/request-auth.mjs";

export const dynamic = "force-dynamic";

const MAX_BODY = 8_192;
const response = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const configured = () => {
  try { return Boolean(serviceAccount()); } catch { return false; }
};

// Aparelhos do app para push (SPEC-0005, REQ-005 e REQ-006): registrar, remover e enviar um teste.
export async function POST(request: Request) {
  if (!writeAllowed(request)) return response({ error: "Origem inválida." }, 403);
  const user = await owner();
  if (!user) return response({ error: "Entre para gerenciar os avisos." }, 401);
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY) return response({ error: "Requisição grande demais." }, 413);
  let body: { action?: unknown; token?: unknown } | null = null;
  try { body = JSON.parse(text); } catch { /* corpo inválido */ }
  const db = database();
  if (body?.action === "register") {
    return registerDevice(db, user, body.token)
      ? response({ ok: true, configured: configured() }) : response({ error: "Token do aparelho inválido." }, 400);
  }
  if (body?.action === "unregister") {
    removeDevice(db, user, body.token);
    return response({ ok: true });
  }
  if (body?.action === "test") {
    if (!configured()) return response({ error: "O envio de avisos ainda não foi configurado no servidor." }, 503);
    const sent = enqueueTestPush(db, user);
    return sent ? response({ ok: true, devices: sent }, 202) : response({ error: "Nenhum aparelho registrado." }, 404);
  }
  if (body?.action === "status") return response({ devices: deviceCount(db, user), configured: configured() });
  return response({ error: "Ação inválida." }, 400);
}
