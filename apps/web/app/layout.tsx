import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Finance · Painel financeiro", description: "Controle pessoal de contas, cartões e faturas." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
