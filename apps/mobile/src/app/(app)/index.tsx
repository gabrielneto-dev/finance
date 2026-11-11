import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Notice } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { overview, overviewQuery, type DashboardData } from "@/lib/overview";
import { colors, TOUCH } from "@/theme";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

// Tela Início: a Visão geral do web no celular (SPEC-0005, REQ-003).
export default function Home() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", data: await api<DashboardData>(overviewQuery()) });
    } catch (error) {
      setState({ status: "error", message: error instanceof ApiError ? error.message : "Não foi possível carregar os dados." });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>FINANÇAS PESSOAIS</Text>
          <Text style={styles.title} accessibilityRole="header">Início</Text>
        </View>
        <Pressable onPress={() => setHidden((value) => !value)} style={styles.eye} accessibilityRole="button"
          accessibilityLabel={hidden ? "Mostrar valores" : "Ocultar valores"}>
          <Text style={styles.eyeText}>{hidden ? "Mostrar" : "Ocultar"}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}>
        <Body state={state} hidden={hidden} retry={() => { setState({ status: "loading" }); void load(); }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Body({ state, hidden, retry }: { state: State; hidden: boolean; retry: () => void }) {
  if (state.status === "loading") {
    return (
      <View style={styles.loading} accessibilityLabel="Carregando dados">
        <View style={[styles.skeleton, { height: 132 }]} />
        <View style={[styles.skeleton, { height: 92 }]} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (state.status === "error") {
    return <Notice title="Não foi possível carregar" text={state.message} action={<Button label="Tentar de novo" onPress={retry} />} />;
  }
  const summary = overview(state.data, hidden);
  if (!summary.connections) {
    return <Notice title="Nenhuma conta conectada" text="Conecte uma instituição pelo painel web. A conexão pelo app chega numa próxima versão." />;
  }
  return (
    <View style={styles.stack}>
      <Card style={styles.balance}>
        <Text style={styles.balanceLabel}>Saldo atual</Text>
        <Text style={styles.balanceValue} accessibilityLabel={"Saldo atual " + summary.balance}>{summary.balance}</Text>
        <Text style={styles.balanceHint}>Último saldo informado</Text>
        {summary.blocked
          ? <Text style={styles.balanceHint}>{summary.blocked.amount} bloqueado · contábil {summary.blocked.ledger}</Text>
          : null}
      </Card>
      <View style={styles.flow}>
        <Card style={styles.flowCard}>
          <Text style={styles.flowLabel}>↙ Entradas</Text>
          <Text style={styles.flowValue}>{summary.income}</Text>
          <Text style={styles.flowHint}>Efetivadas no mês</Text>
        </Card>
        <Card style={styles.flowCard}>
          <Text style={styles.flowLabel}>↗ Saídas</Text>
          <Text style={styles.flowValue}>{summary.expense}</Text>
          <Text style={styles.flowHint}>Efetivadas no mês</Text>
        </Card>
      </View>
      {summary.lastSync ? <Text style={styles.sync}>Sincronizado em {summary.lastSync}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.primary },
  title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
  eye: { minHeight: TOUCH, minWidth: TOUCH, paddingHorizontal: 12, justifyContent: "center", borderRadius: 10, backgroundColor: colors.secondary },
  eyeText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  stack: { gap: 14 },
  loading: { gap: 14 },
  skeleton: { borderRadius: 14, backgroundColor: colors.secondary },
  balance: { backgroundColor: colors.primary, borderColor: colors.primary, gap: 4 },
  balanceLabel: { color: colors.primaryText, fontSize: 15, fontWeight: "600" },
  balanceValue: { color: colors.primaryText, fontSize: 30, fontWeight: "800", marginVertical: 2 },
  balanceHint: { color: "#d7eadf", fontSize: 14 },
  flow: { flexDirection: "row", gap: 12 },
  flowCard: { flex: 1, gap: 4 },
  flowLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  flowValue: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  flowHint: { fontSize: 13, color: colors.muted },
  sync: { fontSize: 13, color: colors.muted, textAlign: "center" },
});
