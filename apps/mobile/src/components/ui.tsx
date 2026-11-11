import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, TOUCH } from "@/theme";

export function Button({ label, onPress, busy, variant = "primary", accessibilityHint }: {
  label: string; onPress: () => void; busy?: boolean; variant?: "primary" | "secondary"; accessibilityHint?: string;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, pressed && styles.pressed]}>
      {busy
        ? <ActivityIndicator color={primary ? colors.primaryText : colors.primary} />
        : <Text style={[styles.buttonText, { color: primary ? colors.primaryText : colors.primary }]}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Mensagem de estado (erro, vazio) com ação opcional. */
export function Notice({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <Card style={styles.notice}>
      <Text style={styles.noticeTitle} accessibilityRole="header">{title}</Text>
      {text ? <Text style={styles.noticeText}>{text}</Text> : null}
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: TOUCH, borderRadius: 10, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  notice: { gap: 10 },
  noticeTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  noticeText: { fontSize: 15, lineHeight: 21, color: colors.muted },
});
