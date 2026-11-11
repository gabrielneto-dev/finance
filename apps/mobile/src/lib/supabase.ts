import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { config } from "./config";
import { sessionStorage } from "./storage";

// Login direto no Supabase com a chave publicável, feita para ir no cliente (SPEC-0005, REQ-003).
export const supabase = createClient(config.supabaseUrl || "http://configurar.invalid", config.supabaseKey || "configurar", {
  auth: {
    storage: sessionStorage,
    storageKey: "finance.session",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// No celular, a renovação automática só roda com o app em primeiro plano, como recomenda o Supabase.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
