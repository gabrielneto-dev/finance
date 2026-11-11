import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EntryItem } from "@/components/entries";
import { Button, Header, Notice, Skeleton } from "@/components/ui";
import { accountOptions, currentMonth, ledgerQuery, ledgerRows, monthLabel, shiftMonth } from "@/lib/ledger";
import type { DashboardData } from "@/lib/overview";
import { useApi } from "@/lib/use-api";
import { colors, TOUCH } from "@/theme";

// Extrato do mês, com filtro por conta (SPEC-0005, REQ-007). Os valores dos lançamentos ficam sempre
// visíveis, como no web: "ocultar valores" vale para saldos e faturas.
export default function Ledger() {
  const [month, setMonth] = useState(currentMonth());
  const [account, setAccount] = useState("");
  const { state, refreshing, refresh, retry } = useApi<DashboardData>(ledgerQuery(month));
  const latest = month >= currentMonth();
  const options = state.status === "ready" ? accountOptions(state.data) : [];
  const rows = state.status === "ready" ? ledgerRows(state.data, account) : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Header title="Extrato" />
      <View style={styles.months}>
        <MonthButton label="‹" hint="Mês anterior" onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text style={styles.month} accessibilityLiveRegion="polite">{monthLabel(month)}</Text>
        <MonthButton label="›" hint="Próximo mês" disabled={latest} onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      {options.length > 1
        ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}
            accessibilityRole="radiogroup" accessibilityLabel="Conta">
            <Chip label="Todas" selected={!account} onPress={() => setAccount("")} />
            {options.map((option) => <Chip key={option.key} label={option.label} selected={account === option.key} onPress={() => setAccount(option.key)} />)}
          </ScrollView>
        : null}
      {state.status === "loading" ? <View style={styles.padded}><Skeleton heights={[64, 64, 64]} /></View> : null}
      {state.status === "error"
        ? <View style={styles.padded}><Notice title="Não foi possível carregar" text={state.message} action={<Button label="Tentar de novo" onPress={retry} />} /></View>
        : null}
      {state.status === "ready"
        ? <FlatList data={rows} keyExtractor={(row) => row.key} renderItem={({ item }) => <EntryItem row={item} />}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
            ListEmptyComponent={<Notice title="Nenhum lançamento" text="Não há lançamentos neste período para a conta escolhida." />} />
        : null}
    </SafeAreaView>
  );
}

function MonthButton({ label, hint, onPress, disabled }: { label: string; hint: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={hint}
      accessibilityState={{ disabled }} style={({ pressed }) => [styles.monthButton, disabled && { opacity: 0.35 }, pressed && { opacity: 0.7 }]}>
      <Text style={styles.monthArrow}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  months: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  month: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  monthButton: { minWidth: TOUCH, minHeight: TOUCH, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  monthArrow: { fontSize: 28, color: colors.primary, fontWeight: "600" },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: {
    minHeight: TOUCH, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  chipTextOn: { color: colors.primaryText },
  padded: { padding: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
});
