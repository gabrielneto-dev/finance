// Regras de autenticação por requisição, sem dependência do Next (SPEC-0005, REQ-004).
import { origin } from "./config.mjs";

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/;

/**
 * Token do app no cabeçalho Authorization.
 * @param {string | null | undefined} value
 * @returns {string | null | undefined} undefined sem cabeçalho; null quando o cabeçalho é inválido.
 */
export function parseBearer(value) {
  if (value == null) return undefined;
  return BEARER.exec(value)?.[1] ?? null;
}

/**
 * Escritas do web exigem a própria origem, contra CSRF. Requisições com Authorization são do app:
 * nelas o servidor usa só o token, nunca o cookie, e o navegador não envia esse cabeçalho sozinho.
 * @param {Request} request
 */
export function writeAllowed(request) {
  return request.headers.has("authorization") || request.headers.get("origin") === origin();
}

/**
 * Origens da prévia web do app em desenvolvimento, que recebem CORS. Vazio na produção.
 * @param {string | undefined} value
 */
export function devOrigins(value = process.env.FINANCE_DEV_ORIGINS) {
  return (value ?? "").split(",").map((item) => item.trim()).filter((item) => /^https?:\/\/[^/]+$/.test(item));
}
