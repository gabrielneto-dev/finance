import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { devOrigins } from "@/lib/request-auth.mjs";
import { AUTH_UNAVAILABLE, sessionCookie, supabaseConfig } from "@/lib/session-cookies";

// CORS só para a prévia web do app em desenvolvimento (FINANCE_DEV_ORIGINS, vazio na produção).
// O app Android não precisa de CORS: só o navegador o exige.
function corsHeaders(request: NextRequest) {
  const from = request.headers.get("origin");
  if (!from || !request.nextUrl.pathname.startsWith("/api/") || !devOrigins().includes(from)) return null;
  return {
    "Access-Control-Allow-Origin": from,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function proxy(request: NextRequest) {
  const cors = corsHeaders(request);
  if (cors && request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: cors });
  const response = await refreshSession(request);
  if (cors) for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
  return response;
}

// Renova a sessão do Supabase antes das páginas e rotas (SPEC-0005, REQ-001). Server Components não
// gravam cookies, e o Supabase só aceita cada refresh token uma vez: sem esta renovação, uma página
// renovaria o token sem salvar o novo, e o reuso seguinte revogaria a sessão inteira.
async function refreshSession(request: NextRequest) {
  // O aviso de Supabase fora do ar só vale quando vem deste proxy, nunca do cliente.
  request.headers.delete(AUTH_UNAVAILABLE);
  let response = NextResponse.next({ request });
  const config = supabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, sessionCookie(options));
        // Resposta com sessão renovada nunca vai para cache compartilhado.
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  // getClaims confere o JWT e, se ele venceu, troca o refresh token e chama setAll.
  // Se o Supabase não responder, owner() nega o acesso logo, sem repetir as tentativas de renovação
  // (cerca de 25 s cada). A página ou a rota responde como sem sessão: login ou 401.
  let unavailable = false;
  try {
    const { error } = await supabase.auth.getClaims();
    unavailable = isAuthRetryableFetchError(error);
  } catch {
    unavailable = true;
  }
  if (unavailable) {
    request.headers.set(AUTH_UNAVAILABLE, "1");
    return NextResponse.next({ request });
  }
  return response;
}

export const config = {
  // Fora: arquivos estáticos, o webhook da Pluggy (sem sessão) e o health check.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/webhooks/|api/health).*)"],
};
