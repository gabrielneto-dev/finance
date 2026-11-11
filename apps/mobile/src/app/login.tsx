import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Notice } from "@/components/ui";
import { configured } from "@/lib/config";
import { signIn } from "@/lib/session";
import { colors, TOUCH } from "@/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Informe o e-mail e a senha.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandName} accessibilityRole="header">Finance</Text>
            <Text style={styles.brandText}>Seu dinheiro, em um só lugar.</Text>
          </View>
          {!configured
            ? <Notice title="App sem configuração" text="Preencha o arquivo .env do app com o endereço do backend e do Supabase." />
            : (
              <View style={styles.form}>
                <Text style={styles.label} nativeID="email-label">E-mail</Text>
                <TextInput
                  accessibilityLabelledBy="email-label" value={email} onChangeText={setEmail} style={styles.input}
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false}
                  textContentType="username" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()}
                  editable={!busy} />
                <Text style={styles.label} nativeID="password-label">Senha</Text>
                <TextInput
                  ref={passwordRef} accessibilityLabelledBy="password-label" value={password} onChangeText={setPassword}
                  style={styles.input} secureTextEntry autoComplete="current-password" textContentType="password"
                  returnKeyType="go" onSubmitEditing={submit} editable={!busy} />
                {error ? <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{error}</Text> : null}
                <Button label="Entrar" onPress={submit} busy={busy} />
              </View>
            )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 28 },
  brand: { gap: 6 },
  brandName: { fontSize: 32, fontWeight: "800", color: colors.primary },
  brandText: { fontSize: 16, color: colors.muted },
  form: { gap: 10 },
  label: { fontSize: 15, fontWeight: "600", color: colors.foreground, marginTop: 6 },
  input: {
    minHeight: TOUCH, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14,
    fontSize: 16, color: colors.foreground, backgroundColor: colors.card,
  },
  error: { color: colors.danger, fontSize: 15, marginVertical: 4 },
});
