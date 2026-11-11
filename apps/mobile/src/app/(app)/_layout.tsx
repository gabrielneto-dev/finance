import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from "expo-router/ui";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrefsProvider } from "@/lib/prefs";
import { colors, TOUCH } from "@/theme";

// Abas embaixo, com alvos de 48 dp (SPEC-0005, REQ-007).
// O ref do TabTrigger tem o tipo de View, incompatível com o do Pressable no RN 0.88; o toque não precisa dele.
function TabButton({ label, symbol, isFocused, ref: _ref, ...props }: TabTriggerSlotProps & { label: string; symbol: string }) {
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }} style={styles.tab}>
      <Text style={[styles.symbol, isFocused && styles.active]} aria-hidden>{symbol}</Text>
      <Text style={[styles.label, isFocused && styles.active]}>{label}</Text>
    </Pressable>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  return (
    <PrefsProvider>
      <Tabs>
        <TabSlot style={{ flex: 1 }} />
        <TabList style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          <TabTrigger name="inicio" href="/" asChild>
            <TabButton label="Início" symbol="⌂" />
          </TabTrigger>
          <TabTrigger name="extrato" href="/extrato" asChild>
            <TabButton label="Extrato" symbol="☰" />
          </TabTrigger>
          <TabTrigger name="conexoes" href="/conexoes" asChild>
            <TabButton label="Conexões" symbol="⇄" />
          </TabTrigger>
          <TabTrigger name="ajustes" href="/ajustes" asChild>
            <TabButton label="Ajustes" symbol="⚙" />
          </TabTrigger>
        </TabList>
      </Tabs>
    </PrefsProvider>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6,
  },
  tab: { flex: 1, minHeight: TOUCH + 8, alignItems: "center", justifyContent: "center", gap: 2 },
  symbol: { fontSize: 20, color: colors.muted },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  active: { color: colors.primary },
});
