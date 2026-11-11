import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

type State = { session: Session | null; ready: boolean };
const SessionContext = createContext<State>({ session: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ session: null, ready: false });
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setState({ session: data.session, ready: true }))
      .catch(() => setState({ session: null, ready: true }));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, ready: true }));
    return () => subscription.unsubscribe();
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

/** Entra com e-mail e senha. Devolve uma mensagem de erro em português, ou null. */
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (!error.status || /fetch|network/i.test(error.message)) return "Sem conexão com o servidor de login.";
  return "E-mail ou senha inválidos.";
}

/** Encerra a sessão no Supabase e apaga a cópia guardada no aparelho. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: "local" });
}
