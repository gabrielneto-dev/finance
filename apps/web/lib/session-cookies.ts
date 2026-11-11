import type { CookieOptions } from "@supabase/ssr";

/** Opções dos cookies de sessão do Supabase, iguais nas páginas, nas rotas e no proxy (SPEC-0005, REQ-001). */
export function sessionCookie(options: CookieOptions = {}): CookieOptions {
  return { ...options, httpOnly: true, secure: Boolean(process.env.APP_ORIGIN?.startsWith("https://")) };
}

/** Cabeçalho interno que o proxy.ts põe na requisição quando o Supabase não respondeu. */
export const AUTH_UNAVAILABLE = "x-finance-auth-unavailable";

/** Supabase só vale fora do modo de chave local e com URL e chave configuradas. */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return !process.env.FINANCE_LOCAL_KEY_HASH && url && key ? { url, key } : null;
}
