---
id: "CTX-CP-20261110-webhooks-endereco-real"
type: "checkpoint"
title: "Máquina Linux em dia, nova conexão pelo widget e webhooks no endereço real"
branch: "global"
tags: ["pluggy", "seguranca", "plataformas"]
status: "superseded"
superseded_by: "CTX-CP-20261110-analises"
created_at: "2026-11-10"
updated_at: "2026-11-10"
supersedes: ["CTX-CP-20261110-atualizacao-frequente"]
related: ["CTX-RES-20261110-webhooks-endereco-real", "CTX-DEC-20261110-endereco-publico", "CTX-RES-20261110-frequencia-atualizacao", "CTX-NTE-20261109-ambiente-local", "CTX-RSK-20261109-repositorio-publico"]
---

# Máquina Linux em dia, nova conexão pelo widget e webhooks no endereço real

## Objetivo e mudanças verificadas

O objetivo foi trazer a máquina Linux para o estado da outra máquina, voltar a importar dados reais e preparar o teste de webhooks no endereço real.

- **Git.** O pull trouxe oito commits por fast-forward, até `4838464`. Depois foi publicado `9f6699d`, com a correção de rolagem. A `main` local e a do GitHub estão iguais.
- **Ambiente.**
  - Dependências reinstaladas com `npm ci`.
  - Os 42 testes, a checagem de tipos e o build passaram.
  - O painel roda em `next start` na porta 3001, e o worker roda à parte.
  - O usuário colocou no `.env` as credenciais novas da Pluggy.
- **Conexão.** Com as chaves novas, o Item antigo respondia 404. O usuário conectou o MeuPluggy de novo pelo widget em Conexões. O retorno do widget vinculou o novo Item em loopback, o worker importou os lançamentos e trouxe os dias 7 e 8 de novembro, que faltavam. A consulta periódica rodou no novo Item sem erro, e o Item antigo foi removido pelo painel.
- **Backup.** O banco anterior foi guardado e verificado em `apps/web/data/backup-20261110/`, fora do Git.
- **Correção.** A lista de Gastos voltou a rolar. A regra que faz a tabela de compras das faturas rolar junto com o painel agora só vale dentro de áreas que rolam. Ver [verificação](../../Specs/features/SPEC-0001--mvp-finance/verification.md#vínculo-pelo-widget-e-rolagem-de-gastos).

## Decisões, descobertas e evidências

- A fase 2 da SPEC-0002 vai usar o túnel da Cloudflare em `finance.vetracompany.com.br`. O `.env` continua com `APP_ORIGIN` local, e a origem HTTPS entra só no comando de cadastro. Ver [decisão](../branches/pluggy/decisions/DEC-20261110-endereco-publico.md).
- Os eventos para o domínio estavam perdidos por três causas: túnel desconectado (HTTP 530, erro 1033), cadastro em `/connections/pluggy/callback` em vez de `/api/webhooks/pluggy` e falta do `X-Finance-Webhook-Secret`. Os três cadastros da aplicação usam o evento `all`. Ver [análise](../branches/pluggy/research/RES-20261110-webhooks-endereco-real.md).
- Uma tentativa de copiar `.env` e SQLite da outra máquina não chegou à máquina Linux. O usuário preferiu seguir sem ela.

## Pendências e próxima ação

- **SPEC-0002-T004.**
  - Usuário: ligar o túnel apontando para o Finance no ar.
  - Agente: cadastrar os eventos pelo script com a origem HTTPS.
  - Teste: reenviar um evento pelo Dashboard e conferir HTTP 204 e "Processado" em Conexões.
  - Depois, remover o cadastro antigo `all` em `/connections/pluggy/callback`, com confirmação do usuário.
- **SPEC-0002-T003.** Ver a rodada automática diária chegar sozinha, com o worker rodando.
- **Outra máquina.** O `.env` e o SQLite seguem no worktree da sessão de lá. Copie-os antes de apagar o worktree.
- **Sem mudança.** A homologação com Supabase continua adiada, e o Android vem depois.
- **Retomada.** Leia o [estado SDD](../../Specs/STATE.md) e as [tarefas da SPEC-0002](../../Specs/features/SPEC-0002--atualizacao-frequente/tasks.md). Para o ambiente, siga a [nota](../global/notes/NTE-20261109-ambiente-local.md).
