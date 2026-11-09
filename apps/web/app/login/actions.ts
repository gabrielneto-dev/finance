"use server";

import { redirect } from "next/navigation";
import { authClient, isOwner, localLoginEnabled, signInLocally, signOutLocally } from "@/lib/auth";

export async function login(_: { error: string }, form: FormData) {
  const password = String(form.get("password") ?? "");
  if (localLoginEnabled()) {
    if (!await signInLocally(password)) return { error: "Chave de acesso inválida." };
    redirect("/");
  }
  const client = await authClient();
  if (!client) return { error: "O acesso ainda precisa ser configurado no servidor." };
  const email = String(form.get("email") ?? "").trim();
  if (!isOwner(email)) return { error: "E-mail ou senha inválidos." };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function logout() {
  if (localLoginEnabled()) await signOutLocally();
  else {
    const client = await authClient();
    if (client) await client.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}
