import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EntryItem, ForecastItem } from "@/components/entries";
import { Button, Card, Header, HideButton, Notice, Skeleton } from "@/components/ui";
import { homeQuery, openBills, type OpenBillCard } from "@/lib/ledger";
import { overview, type DashboardData } from "@/lib/overview";
import { usePrefs } from "@/lib/prefs";
import { useApi } from "@/lib/use-api";
import { colors, TOUCH } from "@/theme";

// Tela Início: a Visão geral do web e a fatura aberta de cada cartão (SPEC-0005, REQ-003 e REQ-007).
export default function Home() {
  const { hidden, setHidden } = usePrefs();
  const { state, refreshing, refresh, retry } = useApi<DashboardData>(homeQuery());
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Header kicker="FINANÇAS PESSOAIS" title="Início" right={<HideButton hidden={hidden} onPress={() => setHidden(!hidden)} />} />
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}>
        {state.status === "loading" ? <Skeleton heights={[132, 92, 120]} /> : null}
        {state.status === "error"
          ? <Notice title="Não foi possível carregar" text={state.message} action={<Button label="Tentar de novo" onPress={retry} />} />
          : null}
        {state.status === "ready" ? <Summary data={state.data} hidden={hidden} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ data, hidden }: { data: DashboardData; hidden: boolean }) {
  const summary = overview(data, hidden);
  if (!summary.connections) {
    return <Notice title="Nenhuma conta conectada" text="Conecte uma instituição pelo painel web. A conexão pelo app chega numa próxima versão." />;
  }
  const bills = openBills(data, hidden);
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
      {bills.length
        ? <View style={styles.stack}>
            <Text style={styles.section} accessibilityRole="header">Fatura aberta</Text>
            {bills.map((bill) => <OpenBill key={bill.key} bill={bill} />)}
          </View>
        : null}
      {summary.lastSync ? <Text style={styles.sync}>Sincronizado em {summary.lastSync}</Text> : null}
    </View>
  );
}

function OpenBill({ bill }: { bill: OpenBillCard }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={styles.bill}>
      <View style={styles.billTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.billCard}>{bill.card}</Text>
          <Text style={styles.flowHint}>{bill.when}</Text>
        </View>
        <Text style={styles.billTotal}>{bill.total}</Text>
      </View>
      {bill.parts ? <Text style={styles.flowHint}>{bill.parts}</Text> : null}
      <Text style={styles.estimate}>Estimativa: pode mudar até o banco fechar a fatura.</Text>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? "Ocultar compras da fatura" : "Ver compras da fatura"}
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.8 }]}>
        <Text style={styles.toggleText}>{open ? "Ocultar compras" : "Ver compras"}</Text>
      </Pressable>
      {open
        ? <View>
            {bill.entries.map((row) => <EntryItem key={row.key} row={row} />)}
            {bill.forecast.length ? <Text style={[styles.section, { fontSize: 15, marginTop: 10 }]}>Parcelas previstas</Text> : null}
            {bill.forecast.map((row) => <ForecastItem key={row.key} row={row} />)}
          </View>
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  stack: { gap: 14 },
  balance: { backgroundColor: colors.primary, borderColor: colors.primary, gap: 4 },
  balanceLabel: { color: colors.primaryText, fontSize: 15, fontWeight: "600" },
  balanceValue: { color: colors.primaryText, fontSize: 30, fontWeight: "800", marginVertical: 2 },
  balanceHint: { color: "#d7eadf", fontSize: 14 },
  flow: { flexDirection: "row", gap: 12 },
  flowCard: { flex: 1, gap: 4 },
  flowLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  flowValue: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  flowHint: { fontSize: 13, color: colors.muted },
  section: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  bill: { gap: 8 },
  billTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  billCard: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  billTotal: { fontSize: 20, fontWeight: "800", color: colors.foreground },
  estimate: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  toggle: {
    minHeight: TOUCH, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    alignItems: "center", justifyContent: "center",
  },
  toggleText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  sync: { fontSize: 13, color: colors.muted, textAlign: "center" },
});
