import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors } from "@/theme";
import type { WidgetProps } from "./pluggy-widget";

// Prévia web: o SDK da Pluggy para React Native usa WebView nativa, que não existe no navegador.
export function PluggyWidget({ onClose }: WidgetProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Conexão pelo app instalado</Text>
      <Text style={styles.text}>
        O widget da Pluggy roda dentro do app Android. Na prévia do navegador, use o painel web para conectar.
      </Text>
      <Button label="Voltar" variant="secondary" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, gap: 14, justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "800", color: colors.foreground },
  text: { fontSize: 15, lineHeight: 21, color: colors.muted },
});
