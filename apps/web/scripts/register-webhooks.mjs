import { eventTypes, origin } from "../lib/config.mjs";
import { pluggy } from "../lib/pluggy.mjs";

const secret = process.env.PLUGGY_WEBHOOK_SECRET;
const url = origin() + "/api/webhooks/pluggy";
if (!url.startsWith("https://") || !secret || secret.length < 32) {
  throw new Error("Configure uma origem HTTPS e um segredo de webhook com pelo menos 32 caracteres.");
}
try {
  const response = await pluggy("/webhooks");
  const existing = response === null ? [] : Array.isArray(response) ? response : response?.results;
  if (!Array.isArray(existing)) throw new Error("Lista de webhooks inválida");
  for (const event of eventTypes) {
    const headers = { "X-Finance-Webhook-Secret": secret };
    const current = existing.find((row) => row.url === url && row.event === event);
    if (current) {
      const previous = Object.entries(current.headers || {});
      const currentSecret = previous.find(([name]) => name.toLowerCase() === "x-finance-webhook-secret")?.[1];
      if (current.disabledAt || currentSecret !== secret) {
        const otherHeaders = Object.fromEntries(previous.filter(([name]) => name.toLowerCase() !== "x-finance-webhook-secret"));
        await pluggy("/webhooks/" + encodeURIComponent(current.id), "PATCH", {
          headers: { ...otherHeaders, ...headers },
          ...(current.disabledAt ? { enabled: true } : {}),
        });
      }
    } else {
      await pluggy("/webhooks", "POST", { event, url, headers });
    }
    console.log("%s configurado", event);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha no cadastro dos webhooks");
  process.exitCode = 1;
}
