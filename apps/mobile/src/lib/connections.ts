import { api } from "./api";

// Ações de conexão pelo app (SPEC-0005, REQ-008). As mesmas rotas do web, com o token do app.
type Result = { ok?: boolean; error?: string; accessToken?: string; sandbox?: boolean; alreadyLinked?: boolean };

const post = (body: object) => api<Result>("/api/connections", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

/** Connect Token com retorno do OAuth para o app (finance://pluggy/retorno). itemId reautoriza uma conexão. */
export async function connectToken(itemId?: string) {
  const result = await post({ action: "token", client: "app", ...(itemId ? { itemId } : {}) });
  if (typeof result.accessToken !== "string") throw new Error("A Pluggy não devolveu o token de conexão.");
  return { accessToken: result.accessToken, sandbox: Boolean(result.sandbox) };
}

/** Vincula ao dono o Item criado ou atualizado no widget. O servidor confere a intenção e o ambiente. */
export const linkItem = (itemId: string) => post({ action: "link", itemId });

/** Reimporta o que a Pluggy já sincronizou. */
export const refreshItem = (itemId: string) => post({ action: "refresh", itemId });

/** Depois de abrir o Meu Pluggy, o worker consulta a Pluggy com mais frequência por alguns minutos. */
export const watchItem = (itemId: string) => post({ action: "watch", itemId });
