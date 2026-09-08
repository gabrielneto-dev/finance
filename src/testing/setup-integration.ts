import { config } from "dotenv";

config({ path: ".env.test" });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não definida para os testes de integração. Copie .env.test.example para .env.test " +
      "e aponte para um banco de teste dedicado (nunca o de desenvolvimento).",
  );
}

if (!process.env.DATABASE_URL.includes("test")) {
  throw new Error(
    `DATABASE_URL "${process.env.DATABASE_URL}" não parece ser um banco de teste (falta "test" no nome). ` +
      "Os testes de integração truncam todas as tabelas a cada execução — abortando por segurança.",
  );
}
