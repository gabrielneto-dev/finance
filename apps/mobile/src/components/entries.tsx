import { StyleSheet, Text, View } from "react-native";
import type { EntryRow, ForecastRow } from "@/lib/ledger";
import { colors } from "@/theme";

// Linha de lançamento: descrição e valor em cima; data, conta e forma embaixo.
export function EntryItem({ row }: { row: EntryRow }) {
  const label = [row.description, row.amount, row.charged, row.date, row.detail, row.pending ? "pendente" : null]
    .filter(Boolean).join(", ");
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <View style={[styles.icon, row.credit && styles.iconIn]}>
        <Text style={[styles.iconText, row.credit && styles.in]}>{row.credit ? "↙" : "↗"}</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.line}>
          <Text style={styles.description} numberOfLines={2}>{row.description}</Text>
          <Text style={[styles.amount, row.credit && styles.in]}>{row.amount}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.detail} numberOfLines={2}>{[row.date, row.detail].filter(Boolean).join(" · ")}</Text>
          {row.pending ? <Text style={styles.badge}>Pendente</Text> : null}
        </View>
        {row.charged ? <Text style={styles.detail}>{row.charged}</Text> : null}
      </View>
    </View>
  );
}

export function ForecastItem({ row }: { row: ForecastRow }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={[row.description, row.amount, row.detail].join(", ")}>
      <View style={styles.icon}><Text style={styles.iconText}>◷</Text></View>
      <View style={styles.main}>
        <View style={styles.line}>
          <Text style={styles.description} numberOfLines={2}>{row.description}</Text>
          <Text style={styles.amount}>{row.amount}</Text>
        </View>
        <Text style={styles.detail}>{row.detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary },
  iconIn: { backgroundColor: "#dcefe4" },
  iconText: { fontSize: 16, color: colors.muted },
  main: { flex: 1, gap: 3 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  description: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.foreground },
  amount: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  in: { color: colors.primary },
  detail: { flex: 1, fontSize: 13, color: colors.muted },
  badge: {
    fontSize: 12, fontWeight: "700", color: "#8a5a00", backgroundColor: "#fdf1d6", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden",
  },
});
