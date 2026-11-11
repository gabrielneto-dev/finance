import { useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Header } from "@/components/ui";
import { config } from "@/lib/config";
import { usePrefs } from "@/lib/prefs";
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
        <Button label="Abrir o painel web" variant="secondary" onPress={() => Linking.openURL(config.apiUrl)}
          accessibilityHint="Análises, Planejamento e as demais telas ficam no painel web" />
        <Button label="Sair" variant="secondary" busy={busy}
          accessibilityHint="Encerra a sessão e apaga o acesso guardado neste aparelho"
          onPress={async () => { setBusy(true); await signOut(); }} />
      </View>
    </SafeAreaView>
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
