import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { sessionStorage } from "./storage";

// Avisos de transferência por push (SPEC-0005, REQ-005). Só no app Android instalado: a prévia web
// não recebe push. O token do aparelho fica no SecureStore para poder ser removido ao sair.
const KEY = "finance.push.token";
export const CHANNEL = "transferencias";
export const pushSupported = Platform.OS === "android";

if (pushSupported) {
  // Com o app aberto, a notificação também aparece.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

const post = (body: object) =>
  api<{ ok?: boolean; error?: string }>("/api/devices", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

export async function pushEnabled() {
  return pushSupported && Boolean(await sessionStorage.getItem(KEY).catch(() => null));
}

/** Pede a permissão (Android 13+), cria o canal e registra o token no servidor. Devolve um erro em português, ou null. */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported) return "Os avisos funcionam só no app instalado no Android.";
  // O canal precisa existir antes de pedir o token.
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Transferências", importance: Notifications.AndroidImportance.HIGH,
  });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return "Permissão de notificações negada. Ative nas configurações do Android para o Finance.";
  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = String(data);
    await post({ action: "register", token });
    await sessionStorage.setItem(KEY, token);
    return null;
  } catch (error) {
    return error instanceof Error && error.message ? error.message : "Não foi possível ativar os avisos agora.";
  }
}

/** Remove o token do servidor e do aparelho. Chamado também ao sair. */
export async function disablePush() {
  const token = await sessionStorage.getItem(KEY).catch(() => null);
  if (!token) return;
  try { await post({ action: "unregister", token }); } catch { /* o servidor limpa tokens inválidos no próximo envio */ }
  await sessionStorage.removeItem(KEY).catch(() => {});
}

export async function sendTestPush(): Promise<string | null> {
  try {
    await post({ action: "test" });
    return null;
  } catch (error) {
    return error instanceof Error && error.message ? error.message : "Não foi possível enviar o teste.";
  }
}
