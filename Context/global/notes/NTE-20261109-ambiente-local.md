---
id: "CTX-NTE-20261109-ambiente-local"
type: "note"
title: "Cuidados ao rodar e testar o Finance localmente"
branch: "global"
tags: ["seguranca"]
status: "active"
created_at: "2026-11-09"
updated_at: "2026-11-10"
source_ids: []
related: ["CTX-DEC-20261108-acesso-finance", "CTX-RSK-20261109-repositorio-publico"]
---

# Cuidados ao rodar e testar o Finance localmente

Aprendizados de 2026-11-08 a 2026-11-10 que evitam repetir falhas.

- **Login local.** A chave local só funciona no host do `APP_ORIGIN`, hoje `http://127.0.0.1:3001`. Um `next dev` em outra porta abre a tela de login, mas recusa a chave.
- **Servidores.** O usuário mantém um `next dev` em `127.0.0.1:3000`. O Next não permite um segundo `next dev` na mesma pasta, então a porta 3001 roda `next start` com o build de produção. A configuração `finance-web-start` está em `.claude/launch.json`. O log avisa que `output: standalone` prefere `node .next/standalone/server.js`, mas o painel responde.
- **Build.** `npm run build` substitui `.next` e derruba um `next start` em execução. Pare o servidor da porta 3001 antes do build e suba de novo depois. As sessões locais ficam no SQLite e sobrevivem ao reinício.
- **Instâncias de teste.** Cookies não separam portas. Entrar numa instância sintética em `127.0.0.1` sobrescreve `finance_local_session` e derruba a sessão real. Como a chave local exige `127.0.0.1`, use outro perfil de navegador ou valide a lógica com testes unitários.
- **Worker.** Atualizar em Conexões e a consulta periódica da SPEC-0002 só funcionam com o worker rodando: `npm --prefix apps/web run worker`, na raiz. No Windows, encerrar a tarefa do agente para só o `npm`, e o `node scripts/worker.mjs` continua vivo e processa a fila com código antigo. Antes de subir outro, procure e encerre os processos cujo `CommandLine` contém `worker.mjs`.
- **Arquivos locais fora do Git.** Em 2026-11-10, o `.env` com as credenciais da Pluggy, o `.env.local-login` e o banco `apps/web/data/finance.sqlite` existem só no worktree `.claude/worktrees/project-status-check-5f294d`, e não na pasta principal. Antes de apagar esse worktree ou arquivar a sessão, pare worker e servidor e copie os três para a pasta principal. O usuário adiou essa cópia.
- **Credenciais trocadas.** Se a Pluggy responder 401 `client keys are invalid`, as chaves do `.env` foram trocadas no Dashboard. Com as chaves novas, um Item antigo pode responder 404 `item not found`. Em 2026-11-10, a máquina Linux resolveu isso conectando de novo pelo widget em Conexões. O banco anterior ficou em `apps/web/data/backup-20261110/`.
- **Webhooks no endereço real.** O receptor fica em `/api/webhooks/pluggy` e exige `X-Finance-Webhook-Secret`. Cadastre com `APP_ORIGIN=https://finance.vetracompany.com.br npm --prefix apps/web run webhooks` e não altere o `APP_ORIGIN` do `.env`. HTTP 530 com erro 1033 indica túnel desconectado. Ver [decisão](../../branches/pluggy/decisions/DEC-20261110-endereco-publico.md).
- **Testes.** Rode `npm test` em `apps/web`. O script usa `--test-isolation=none`. `node --test test/` sem essa opção falha com uma mensagem genérica.
- **Rolagem e navegador do app.** A rolagem suave leva cerca de 1,5 segundo; meça `scrollTop` depois disso. O navegador embutido bloqueia abas novas abertas por automação, como o link para o Meu Pluggy, então esse passo depende do clique do usuário.
- **Git.** O sandbox do agente esconde `.git` como pasta vazia. Comandos Git precisam rodar fora do sandbox. O repositório foi criado em 2026-11-09 e publicado em `gabrielneto-dev/finance`. Em 2026-11-10, o usuário autorizou publicar direto na `main`; o branch do worktree avançou a `main` por fast-forward, sem merge.
- **Componentes do servidor.** Uma página do servidor que importa constantes de um módulo `"use client"` recebe uma referência de cliente, e não o valor. O resultado foi `SECTIONS.find is not a function` e HTTP 500. Constantes usadas nos dois lados ficam em `lib/`, como `lib/analytics/sections.ts`.
- **Menus dentro de `<dialog>`.** O `<dialog>` modal fica na camada superior. Um Popover do Radix aberto no `body` fica por baixo dele, então `PopoverContent` aceita `container`. O seletor de categoria passa o `<dialog>` mais próximo.
- **Conferir cálculos com dados reais.** Para não tocar o banco em uso, copie com `VACUUM INTO` para o scratchpad da sessão, confira só no terminal e apague a cópia depois. Valores e nomes reais não vão para arquivos.
- **Credenciais.** O agente não digita a chave local nem senhas. O usuário entra no painel e no Meu Pluggy pelo navegador do app.
