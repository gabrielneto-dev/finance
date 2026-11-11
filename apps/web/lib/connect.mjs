// Opções do Connect Token da Pluggy para o web e para o app (SPEC-0005, REQ-008).
// O retorno do OAuth do banco precisa ser HTTPS ou deep link, nunca localhost (FATO: guia de OAuth da Pluggy).
// O destino vem de uma lista fixa: o cliente só escolhe "app" ou web, nunca a URL.

export const APP_REDIRECT = "finance://pluggy/retorno";
export const CONNECT_PRODUCTS = ["ACCOUNTS", "TRANSACTIONS", "CREDIT_CARDS", "INVESTMENTS", "INVESTMENTS_TRANSACTIONS"];

/**
 * @param {{ appOrigin: string, client?: unknown, intent?: string | null, withProducts?: boolean }} input
 */
export function connectOptions({ appOrigin, client, intent = null, withProducts = true }) {
  const redirect = client === "app" ? APP_REDIRECT
    : appOrigin.startsWith("https://") ? appOrigin + "/pluggy/retorno" : null;
  return {
    ...(redirect ? { oauthRedirectUri: redirect } : {}),
    ...(intent ? { clientUserId: intent } : {}),
    ...(withProducts ? { products: CONNECT_PRODUCTS } : {}),
  };
}
