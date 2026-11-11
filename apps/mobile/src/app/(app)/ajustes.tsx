import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card } from "@/components/ui";
import { signOut, useSession } from "@/lib/session";
import { colors } from "@/theme";

export default function Settings() {
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">Ajustes</Text>
        <Card style={styles.card}>
          <Text style={styles.label}>Conta</Text>
          <Text style={styles.value}>{session?.user.email ?? "—"}</Text>
        </Card>
        <Button label="Sair" variant="secondary" busy={busy}
          accessibilityHint="Encerra a sessão e apaga o acesso guardado neste aparelho"
          onPress={async () => { setBusy(true); await signOut(); }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
  card: { gap: 4 },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 16, color: colors.foreground },
});
