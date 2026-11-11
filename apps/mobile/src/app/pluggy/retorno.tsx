import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/theme";

// Retorno do OAuth do banco por deep link (finance://pluggy/retorno), definido no Connect Token
// (SPEC-0005, REQ-008). Volta para a tela anterior, onde o widget da Pluggy continua aberto e confere o Item.
export default function OauthReturn() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/conexoes");
  }, [router]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Voltando para o Finance" />
    </View>
  );
}
