import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { sessionStorage } from "./storage";

// Preferências do aparelho (SPEC-0005, REQ-007). "Ocultar valores" fica lembrado entre aberturas do app,
// como no web, que o guarda no navegador.
const KEY = "finance.hidden";
type Prefs = { hidden: boolean; setHidden: (value: boolean) => void };
const PrefsContext = createContext<Prefs>({ hidden: false, setHidden: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [hidden, setState] = useState(false);
  useEffect(() => {
    sessionStorage.getItem(KEY).then((value) => setState(value === "1")).catch(() => {});
  }, []);
  const setHidden = (value: boolean) => {
    setState(value);
    sessionStorage.setItem(KEY, value ? "1" : "0").catch(() => {});
  };
  return <PrefsContext.Provider value={{ hidden, setHidden }}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
