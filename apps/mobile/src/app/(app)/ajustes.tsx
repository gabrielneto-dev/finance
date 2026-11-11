import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Header } from "@/components/ui";
import { config } from "@/lib/config";
import { usePrefs } from "@/lib/prefs";
import { disablePush, enablePush, pushEnabled, pushSupported, sendTestPush } from "@/lib/push";
import { signOut, useSession } from "@/lib/session";
import { colors, TOUCH } from "@/theme";

export default function Settings() {
  const { session } = useSession();
  const { hidden, setHidden } = usePrefs();
  const [busy, setBusy] = useState(false);
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Header title="Ajustes" />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.label}>Conta</Text>
          <Text style={styles.value}>{session?.user.email ?? "—"}</Text>
        </Card>
        <Pressable onPress={() => setHidden(!hidden)} role="switch" aria-checked={hidden}
          accessibilityLabel="Ocultar saldos e faturas" style={styles.toggle}>
          <View style={{ flex: 1 }}>
            <Text style={styles.value}>Ocultar saldos e faturas</Text>
            <Text style={styles.label}>Fica lembrado neste aparelho. Lançamentos continuam visíveis.</Text>
          </View>
          {/* A linha inteira é o alvo de toque (48 dp); o Switch só mostra o estado. */}
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Switch value={hidden} trackColor={{ true: colors.primary }} />
          </View>
        </Pressable>
        <Alerts />
        <Button label="Abrir o painel web" variant="secondary" onPress={() => Linking.openURL(config.apiUrl)}
          accessibilityHint="Análises, Planejamento e as demais telas ficam no painel web" />
        <Button label="Sair" variant="secondary" busy={busy}
          accessibilityHint="Encerra a sessão e apaga o acesso guardado neste aparelho"
          onPress={async () => { setBusy(true); await signOut(); }} />
        <Text style={[styles.label, { textAlign: "center" }]}>Finance {Constants.expoConfig?.version ?? ""}</Text>
      </View>
    </SafeAreaView>
  );
}

/** Avisos de transferência por push (SPEC-0005, REQ-005). */
function Alerts() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { pushEnabled().then(setEnabled).catch(() => {}); }, []);
  const run = async (task: () => Promise<string | null>, success: string, next?: boolean) => {
    setBusy(true);
    setMessage(null);
    const error = await task();
    setBusy(false);
    setMessage(error ?? success);
    if (!error && next !== undefined) setEnabled(next);
  };
  return (
    <Card style={styles.card}>
      <Text style={styles.value}>Avisos de transferência</Text>
      {!pushSupported
        ? <Text style={styles.label}>Disponível no app instalado no Android. A prévia no navegador não recebe avisos.</Text>
        : <>
            <Text style={styles.label}>
              {enabled ? "Ativos neste aparelho. A notificação não mostra o valor." : "Receba um aviso quando entrar ou sair uma transferência."}
            </Text>
            {enabled
              ? <View style={{ gap: 10, marginTop: 6 }}>
                  <Button label="Enviar aviso de teste" variant="secondary" busy={busy}
                    onPress={() => run(sendTestPush, "Teste enviado. Deve chegar em instantes.")} />
                  <Button label="Desativar avisos" variant="secondary" busy={busy}
                    onPress={() => run(async () => { await disablePush(); return null; }, "Avisos desativados neste aparelho.", false)} />
                </View>
              : <View style={{ marginTop: 6 }}>
                  <Button label="Ativar avisos neste aparelho" busy={busy} onPress={() => run(enablePush, "Avisos ativados.", true)} />
                </View>}
          </>}
      {message ? <Text style={styles.label} accessibilityLiveRegion="polite">{message}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  card: { gap: 4 },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 16, color: colors.foreground },
  toggle: {
    minHeight: TOUCH + 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16,
  },
});
