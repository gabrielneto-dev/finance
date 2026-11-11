import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Onde a sessão do Supabase fica guardada (SPEC-0005, REQ-004).
// Android: SecureStore, que grava cifrado pelo Keystore do sistema.
// Web: só a prévia de desenvolvimento, em localStorage, com dados sintéticos.
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const web: Storage = {
  getItem: async (key) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key, value) => globalThis.localStorage?.setItem(key, value),
  removeItem: async (key) => globalThis.localStorage?.removeItem(key),
};

const secure: Storage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const sessionStorage: Storage = Platform.OS === "web" ? web : secure;
