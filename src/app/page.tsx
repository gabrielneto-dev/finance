import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect("/app");
  return <main className="landing"><section><p className="eyebrow">FINANCAS PESSOAIS, SEM RUIDO</p><h1>Veja para onde seu dinheiro vai.</h1><p className="lede">Clareza para contas, cartoes, recorrencias e faturas em um unico lugar.</p></section><form className="login-card" action={async (formData) => { "use server"; await signIn("credentials", { email: formData.get("email"), name: formData.get("name"), redirectTo: "/app" }); }}><h2>Comecar</h2><label>Seu nome<input name="name" required minLength={2} placeholder="Gabriel" /></label><label>E-mail<input name="email" required type="email" placeholder="voce@email.com" /></label><button>Entrar no meu espaco</button><small>Login local de desenvolvimento. Configure um provedor antes de publicar.</small></form></main>;
}
