import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const expected = process.env.API_KEY;
  if (!expected) {
    reply.code(500).send({ error: "API_KEY não configurada no servidor." });
    return;
  }
  const provided = request.headers["x-api-key"];
  if (provided !== expected) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
