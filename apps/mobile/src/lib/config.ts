// Valores públicos embutidos no app (EXPO_PUBLIC_*). Nenhum segredo entra aqui.
const trim = (value: string | undefined) => (value ?? "").trim().replace(/\/+$/, "");

export const config = {
  apiUrl: trim(process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: trim(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey: (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim(),
};

export const configured = Boolean(config.apiUrl && config.supabaseUrl && config.supabaseKey);
