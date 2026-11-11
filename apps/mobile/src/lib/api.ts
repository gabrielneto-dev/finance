import { config } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// Chamadas ao backend do Finance com o token do app (Authorization: Bearer). 401 encerra a sessão.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "Sua sessão terminou. Entre de novo.");
  let response: Response;
  try {
    response = await fetch(config.apiUrl + path, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}), Authorization: "Bearer " + token },
    });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor do Finance.");
  }
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (response.status === 401) {
    await supabase.auth.signOut({ scope: "local" });
    throw new ApiError(401, "Sua sessão terminou. Entre de novo.");
  }
  if (!response.ok) throw new ApiError(response.status, body?.error ?? "O servidor não respondeu como esperado.");
  return body as T;
}
