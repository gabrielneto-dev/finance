import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, TOUCH } from "@/theme";

export function Button({ label, onPress, busy, disabled, variant = "primary", accessibilityHint }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: "primary" | "secondary"; accessibilityHint?: string;
}) {
  const primary = variant === "primary";
  const off = Boolean(busy || disabled);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy }} disabled={off} onPress={onPress}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, pressed && styles.pressed, disabled && styles.disabled]}>
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

/** Cabeçalho das telas, com ação opcional à direita. */
export function Header({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
      </View>
      {right}
    </View>
  );
}

/** Botão de "ocultar valores" do cabeçalho. */
export function HideButton({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} role="switch" aria-checked={hidden}
      accessibilityLabel="Ocultar valores" style={({ pressed }) => [styles.hide, pressed && styles.pressed]}>
      <Text style={styles.hideText}>{hidden ? "Mostrar" : "Ocultar"}</Text>
    </Pressable>
  );
}

/** Esqueleto enquanto carrega. */
export function Skeleton({ heights }: { heights: number[] }) {
  return (
    <View style={{ gap: 14 }} accessibilityLabel="Carregando dados" accessibilityRole="progressbar">
      {heights.map((height, index) => <View key={index} style={[styles.skeleton, { height }]} />)}
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.primary },
  title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
  hide: { minHeight: TOUCH, minWidth: TOUCH, paddingHorizontal: 12, justifyContent: "center", borderRadius: 10, backgroundColor: colors.secondary },
  hideText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  skeleton: { borderRadius: 14, backgroundColor: colors.secondary },
  button: { minHeight: TOUCH, borderRadius: 10, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  notice: { gap: 10 },
  noticeTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  noticeText: { fontSize: 15, lineHeight: 21, color: colors.muted },
});
