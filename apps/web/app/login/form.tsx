"use client";

import { useActionState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login } from "./actions";

export function LoginForm({ local }: { local: boolean }) {
  const [state, submit, pending] = useActionState(login, { error: "" });
  return <main className="login-page">
    <Card className="login-layout">
      <div className="login-brand">
        <div><span className="brand-icon"><Wallet size={20} aria-hidden="true" /></span><strong>Finance</strong></div>
        <p>Suas contas, seus cartões e suas faturas em um só lugar.</p>
      </div>
      <div className="login-card">
        <CardHeader>
          <CardTitle><h1>Entre no Finance</h1></CardTitle>
          <CardDescription>Acesse o seu painel financeiro pessoal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submit} className="grid gap-4">
            {!local && <label className="field">E-mail<Input name="email" type="email" autoComplete="username" required /></label>}
            <label className="field">{local ? "Chave de acesso local" : "Senha"}<Input name="password" type="password" autoComplete="current-password" required /></label>
            {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            <Button disabled={pending}>{pending ? "Entrando…" : "Entrar"}</Button>
          </form>
        </CardContent>
      </div>
    </Card>
  </main>;
}
