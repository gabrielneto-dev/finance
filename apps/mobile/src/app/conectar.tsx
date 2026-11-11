import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PluggyWidget } from "@/components/pluggy-widget";
import { Button, Notice } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { connectToken, linkItem } from "@/lib/connections";
import { colors } from "@/theme";

type State =
  | { status: "loading" }
  | { status: "widget"; accessToken: string; sandbox: boolean }
  | { status: "linking" }
  | { status: "done"; title: string; text: string }
  | { status: "error"; message: string };

const message = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : "A conexão não foi concluída.";

// Conectar uma instituição ou reconectar uma conexão pelo app (SPEC-0005, REQ-008).
// item=<id> reautoriza; sem item, cria uma conexão nova.
export default function Connect() {
  const router = useRouter();
  const { item } = useLocalSearchParams<{ item?: string }>();
  const [state, setState] = useState<State>({ status: "loading" });

  const start = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const token = await connectToken(item);
      setState({ status: "widget", ...token });
    } catch (error) {
      setState({ status: "error", message: message(error) });
    }
  }, [item]);

  useEffect(() => { void start(); }, [start]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/conexoes"));

  async function link(itemId: string, pending: boolean) {
    setState({ status: "linking" });
    try {
      await linkItem(itemId);
      setState(pending
        ? { status: "done", title: "Autorização em andamento", text: "O banco ainda está confirmando. A conexão aparece em Conexões assim que a Pluggy concluir." }
        : { status: "done", title: item ? "Conexão atualizada" : "Instituição conectada", text: "Os dados chegam em alguns minutos, enquanto o servidor importa." });
    } catch (error) {
      setState({ status: "error", message: message(error) });
    }
  }

  if (state.status === "widget") {
    return (
      <View style={{ flex: 1 }}>
        <PluggyWidget connectToken={state.accessToken} sandbox={state.sandbox} updateItem={item}
          onSuccess={(itemId) => void link(itemId, false)}
          // Alguns bancos terminam a autorização depois: o Item já existe e o sucesso chega pelo webhook.
          onError={(text, itemId) => itemId ? void link(itemId, true) : setState({ status: "error", message: text || "A conexão não foi concluída." })}
          onClose={close} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">{item ? "Reconectar" : "Conectar instituição"}</Text>
        {state.status === "loading" || state.status === "linking"
          ? <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.text}>{state.status === "loading" ? "Preparando a conexão segura…" : "Vinculando a conexão…"}</Text>
            </View>
          : null}
        {state.status === "error"
          ? <Notice title="A conexão não foi concluída" text={state.message} action={
              <View style={{ gap: 10 }}>
                <Button label="Tentar de novo" onPress={start} />
                <Button label="Voltar" variant="secondary" onPress={close} />
              </View>} />
          : null}
        {state.status === "done"
          ? <Notice title={state.title} text={state.text} action={<Button label="Ver conexões" onPress={() => router.replace("/conexoes")} />} />
          : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: "800", color: colors.foreground },
  center: { alignItems: "center", gap: 12, paddingTop: 40 },
  text: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
