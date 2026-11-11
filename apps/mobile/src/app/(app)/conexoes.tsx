import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Header, Notice, Skeleton } from "@/components/ui";
import { config } from "@/lib/config";
import { connectionRows, connectionsQuery } from "@/lib/ledger";
import type { DashboardData } from "@/lib/overview";
import { useApi } from "@/lib/use-api";
import { colors } from "@/theme";

// Situação das conexões (SPEC-0005, REQ-007). Conectar e reautorizar pelo app chega no Marco 4.
export default function Connections() {
  const { state, refreshing, refresh, retry } = useApi<DashboardData>(connectionsQuery());
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
                </Card>
              ))
            : <Notice title="Nenhuma conexão" text="Conecte uma instituição pelo painel web." />
          : null}
        <Text style={styles.note}>Conectar, reautorizar, renomear e desconectar ficam no painel web por enquanto.</Text>
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
});
