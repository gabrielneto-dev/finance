import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SessionProvider, useSession } from "@/lib/session";
import { colors } from "@/theme";

// Rotas protegidas: sem sessão, só o login; com sessão, o app (SPEC-0005, REQ-003).
function Routes() {
  const { session, ready } = useSession();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="conectar" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Routes />
    </SessionProvider>
  );
}
