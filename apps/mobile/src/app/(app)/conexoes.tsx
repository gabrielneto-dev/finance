import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Header, Notice, Skeleton } from "@/components/ui";
import { config } from "@/lib/config";
import { refreshItem, watchItem } from "@/lib/connections";
import { connectionRows, connectionsQuery } from "@/lib/ledger";
import type { DashboardData } from "@/lib/overview";
import { useApi } from "@/lib/use-api";
import { colors } from "@/theme";

// Situação e ações das conexões (SPEC-0005, REQ-007 e REQ-008), com as mesmas regras do painel web.
export default function Connections() {
  const router = useRouter();
  const { state, refreshing, refresh, retry } = useApi<DashboardData>(connectionsQuery());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const act = async (key: string, task: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setMessage(null);
    try { await task(); setMessage(success); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "A ação falhou."); }
    finally { setBusy(null); }
  };
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Header title="Conexões" />
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}>
        {state.status === "loading" ? <Skeleton heights={[76, 76]} /> : null}
        {state.status === "error"
          ? <Notice title="Não foi possível carregar" text={state.message} action={<Button label="Tentar de novo" onPress={retry} />} />
          : null}
        {state.status === "ready"
          ? connectionRows(state.data).length
            ? connectionRows(state.data).map((row) => (
                <Card key={row.key} style={styles.card}>
                  <View style={styles.top}>
                    <Text style={styles.name}>{row.name}</Text>
                    <Text style={[styles.status, row.ok ? styles.ok : styles.warn]}>{row.status}</Text>
                  </View>
                  <Text style={styles.detail}>{row.synced}</Text>
                  <View style={styles.actions}>
                    {row.reconnect
                      ? <Button label="Reconectar" onPress={() => router.push({ pathname: "/conectar", params: { item: row.key } })} />
                      : <Button label="Atualizar" variant="secondary" busy={busy === row.key + ":refresh"} disabled={row.importing}
                          onPress={() => act(row.key + ":refresh", () => refreshItem(row.key), "Atualização solicitada.")} />}
                    {row.meuPluggy
                      ? <Button label="Atualizar no Meu Pluggy" variant="secondary" busy={busy === row.key + ":watch"}
                          accessibilityHint="Abre o Meu Pluggy; os dados novos chegam aqui em poucos minutos"
                          onPress={() => act(row.key + ":watch", async () => { await watchItem(row.key); await Linking.openURL("https://meu.pluggy.ai"); },
                            "Depois de atualizar no Meu Pluggy, os dados novos chegam aqui em poucos minutos.")} />
                      : null}
                  </View>
                </Card>
              ))
            : <Notice title="Nenhuma conexão" text="Conecte sua primeira instituição pelo botão abaixo." />
          : null}
        {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
        <Button label="Conectar instituição" onPress={() => router.push("/conectar")} />
        <Text style={styles.note}>Renomear e desvincular ficam no painel web.</Text>
        <Button label="Abrir o painel web" variant="secondary" onPress={() => Linking.openURL(config.apiUrl)}
          accessibilityHint="Abre o Finance no navegador do aparelho" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  card: { gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.foreground },
  status: { fontSize: 13, fontWeight: "700", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  ok: { color: colors.primary, backgroundColor: "#dcefe4" },
  warn: { color: "#8a5a00", backgroundColor: "#fdf1d6" },
  detail: { fontSize: 13, color: colors.muted },
  note: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  message: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
  actions: { gap: 10, marginTop: 6 },
});
