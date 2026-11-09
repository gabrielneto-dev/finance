import { database, enqueue } from "@/lib/db.mjs";
import { checkWebhookSecret, parseWebhook } from "@/lib/webhook.mjs";

export async function POST(request: Request) {
  const { PLUGGY_WEBHOOK_SECRET: secret, PLUGGY_CLIENT_ID: clientId } = process.env;
  if (!secret || !clientId) return new Response(null, { status: 503 });
  if (!checkWebhookSecret(request.headers.get("x-finance-webhook-secret"), secret)) return new Response(null, { status: 401 });
  if (!request.body) return new Response(null, { status: 400 });

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return new Response(null, { status: 400 });
  } finally {
    reader.releaseLock();
  }
  let job;
  try {
    job = parseWebhook(JSON.parse(Buffer.concat(chunks, size).toString("utf8")), clientId);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (job) enqueue(database(), { ...job, receivedAt: new Date().toISOString() });
  return new Response(null, { status: 204 });
}
