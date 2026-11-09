---
id: "CTX-NTE-20261109-ambiente-local"
type: "note"
title: "Cuidados ao rodar e testar o Finance localmente"
branch: "global"
tags: ["seguranca"]
status: "active"
created_at: "2026-11-09"
updated_at: "2026-11-09"
source_ids: []
related: ["CTX-DEC-20261108-acesso-finance", "CTX-RSK-20261109-repositorio-publico"]
---

# Cuidados ao rodar e testar o Finance localmente

Aprendizados de 2026-11-08 e 2026-11-09 que evitam repetir falhas.

- **Login local.** A chave local só funciona no host do `APP_ORIGIN`, hoje `http://127.0.0.1:3001`. Um `next dev` em outra porta abre a tela de login, mas recusa a chave.
- **Servidores.** O usuário mantém um `next dev` em `127.0.0.1:3000`. O Next não permite um segundo `next dev` na mesma pasta, então a porta 3001 roda `next start` com o build de produção. A configuração `finance-web-start` está em `.claude/launch.json`. O log avisa que `output: standalone` prefere `node .next/standalone/server.js`, mas o painel responde.
- **Build.** `npm run build` substitui `.next` e derruba um `next start` em execução. Pare o servidor da porta 3001 antes do build e suba de novo depois. As sessões locais ficam no SQLite e sobrevivem ao reinício.
- **Instâncias de teste.** Cookies não separam portas. Entrar numa instância sintética em `127.0.0.1` sobrescreve `finance_local_session` e derruba a sessão real. Como a chave local exige `127.0.0.1`, use outro perfil de navegador ou valide a lógica com testes unitários.
- **Worker.** Atualizar em Conexões só tem efeito com o worker rodando: `npm --prefix apps/web run worker`, na raiz.
- **Git.** O sandbox do agente esconde `.git` como pasta vazia. Comandos Git precisam rodar fora do sandbox. O repositório foi criado em 2026-11-09 e publicado em `gabrielneto-dev/finance`.
- **Credenciais.** O agente não digita a chave local nem senhas. O usuário entra no painel e no Meu Pluggy pelo navegador do app.
