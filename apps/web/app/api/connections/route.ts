import { randomUUID } from "node:crypto";
import { owner } from "@/lib/auth";
import { atomic, bind, bindExisting, CONNECTION_LABEL_MAX, connection, database, enqueue, normalizeLabel, renameConnection } from "@/lib/db.mjs";
import { existingItemId, origin, sandbox, uuid } from "@/lib/config.mjs";
import { pluggy } from "@/lib/pluggy.mjs";

const response = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== origin()) return response({ error: "Origem inválida." }, 403);
  const user = await owner();
  if (!user) return response({ error: "Entre para acessar as conexões." }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") return response({ error: "Requisição inválida." }, 400);
  const { action, itemId } = body;
  const db = database();
  if (action === "read-notices") {
    db.prepare(`UPDATE notices SET read_at=? WHERE read_at IS NULL AND item_id IN
      (SELECT id FROM connections WHERE owner=? AND active=1)`).run(new Date().toISOString(), user);
    return response({ ok: true });
  }
  if (action === "import-existing") {
    const configured = existingItemId();
    if (itemId != null) return response({ error: "Conexão inválida." }, 400);
    if (!configured) return response({ error: "Nenhuma conexão configurada para importar." }, 404);
    const current = connection(db, configured);
    if (current) return current.owner === user && current.active
      ? response({ alreadyLinked: true }) : response({ error: "Conexão indisponível." }, 404);
    try {
      const item = await pluggy("/items/" + configured);
      if (item?.id !== configured || item.connector?.isSandbox !== sandbox()) {
        return response({ error: "Instituição fora do ambiente configurado." }, 403);
      }
      const accepted = atomic(db, () => bindExisting(db, item, user, configured));
      return accepted ? response({ ok: true }, 202) : response({ error: "Conexão indisponível." }, 404);
    } catch {
      return response({ error: "Não foi possível consultar a conexão configurada na Pluggy." }, 502);
    }
  }
  if ((action !== "token" || itemId != null) && (typeof itemId !== "string" || !uuid.test(itemId))) {
    return response({ error: "Conexão inválida." }, 400);
  }

  const linked = typeof itemId === "string" ? connection(db, itemId) : null;
  if (linked && linked.owner !== user) return response({ error: "Conexão indisponível." }, 404);

  try {
    if (action === "token") {
      if (itemId && !linked?.active) return response({ error: "Conexão indisponível." }, 404);
      const appOrigin = origin();
      const options = appOrigin.startsWith("https://") ? { oauthRedirectUri: appOrigin + "/pluggy/retorno" } : {};
      const intent = itemId ? null : randomUUID();
      if (intent) {
        db.prepare("DELETE FROM intents WHERE expires<?").run(Date.now());
        db.prepare("INSERT INTO intents VALUES(?,?,?)").run(intent, user, Date.now() + 2 * 60 * 60_000);
      }
      const token = await pluggy("/connect_token", "POST", {
        ...(itemId ? { itemId } : {}),
        options: { ...options, ...(intent ? { clientUserId: intent, products: ["ACCOUNTS", "TRANSACTIONS", "CREDIT_CARDS"] } : {}) },
      });
      if (typeof token?.accessToken !== "string") throw new Error("Connect Token ausente");
      return response({ accessToken: token.accessToken, sandbox: sandbox() });
    }

    if (action === "link") {
      const item = await pluggy("/items/" + itemId);
      if (item?.id !== itemId || item.connector?.isSandbox !== sandbox()) {
        return response({ error: "Instituição fora do ambiente configurado." }, 403);
      }
      const accepted = atomic(db, () => {
        const current = connection(db, itemId);
        if (current) {
          if (current.owner !== user || !current.active) return false;
          enqueue(db, { itemId, kind: "initial" });
          return true;
        }
        return bind(db, item, user, item.clientUserId ?? "");
      });
      return accepted ? response({ ok: true }, 202) : response({ error: "Não foi possível verificar o vínculo." }, 403);
    }

    if (!linked || !linked.active) return response({ error: "Conexão indisponível." }, 404);
    if (action === "rename") {
      const label = normalizeLabel(body.label);
      if (label === undefined) return response({ error: "Use um nome com até " + CONNECTION_LABEL_MAX + " caracteres." }, 400);
      return renameConnection(db, user, itemId, label) ? response({ ok: true }) : response({ error: "Conexão indisponível." }, 404);
    }
    if (action === "refresh" || action === "disconnect") {
      atomic(db, () => {
        const current = connection(db, itemId);
        if (!current?.active || current.owner !== user) return;
        const pending = db.prepare("SELECT 1 FROM jobs WHERE item_id=? AND kind=? AND done=0").get(itemId, action);
        if (pending) return;
        if (action === "disconnect") {
          db.prepare("UPDATE connections SET active=0,status='REMOVENDO' WHERE id=? AND owner=?").run(itemId, user);
        }
        enqueue(db, { itemId, kind: action });
      });
      return response({ ok: true }, 202);
    }
    return response({ error: "Ação inválida." }, 400);
  } catch {
    return response({ error: "A conexão com a Pluggy está indisponível. Tente novamente." }, 502);
  }
}
