---
id: "CTX-CP-20261110-atualizacao-frequente"
type: "checkpoint"
title: "Melhorias do painel, consulta periódica à Pluggy e publicação na main"
branch: "global"
tags: ["escopo", "pluggy", "seguranca"]
status: "superseded"
superseded_by: "CTX-CP-20261110-webhooks-endereco-real"
created_at: "2026-11-10"
updated_at: "2026-11-10"
supersedes: ["CTX-CP-20261109-validacao-web"]
related: ["CTX-DEC-20261108-ciclos-cartao", "CTX-RES-20261110-frequencia-atualizacao", "CTX-NTE-20261109-ambiente-local", "CTX-RSK-20261109-repositorio-publico"]
---

# Melhorias do painel, consulta periódica à Pluggy e publicação na main

## Objetivo e mudanças verificadas

O objetivo foi usar o Finance com as duas conexões MeuPluggy reais, ajustar o painel ao que o usuário viu e trazer os dados novos da Pluggy sem clique. Cada entrega passou em testes, checagem de tipos, build e conferência no painel real. A suíte web tem 42 testes.

- **Painel (SPEC-0001).**
  - Ocultar saldos, limites e faturas (REQ-016).
  - Valor bloqueado e cheque bloqueado (REQ-017 e REQ-018).
  - Fatura aberta pelo ciclo do cartão, com a lista "Ver compras" (REQ-019).
  - Renomear conexões (REQ-020).
  - Seletores shadcn e seletor de data.
  - Compras em outra moeda somadas em reais.
  - Parcelas no mês da cobrança.
  - Rolagem das compras com o mouse.

  As regras de cartão estão na [decisão de ciclos](../branches/produto/decisions/DEC-20261108-ciclos-cartao.md).
- **Atualização frequente (SPEC-0002, fase 1).** O worker consulta `GET /items/{id}`:
  - de hora em hora (`PLUGGY_POLL_MINUTES`, mínimo 15);
  - a cada 10 minutos por até 2 horas depois de `nextAutoSyncAt`;
  - a cada 2 minutos por 30 minutos depois do atalho "Atualizar no Meu Pluggy".

  Ele só reimporta quando `lastUpdatedAt` avança e nunca envia `PATCH`. Conexões mostra a última sincronização com o banco, a próxima prevista e o atalho.
- **Git.** Os commits de `02a7810` a `1d0e49f` foram publicados na `main` de `gabrielneto-dev/finance` por fast-forward, a pedido do usuário. A `main` da pasta principal também foi avançada. O branch `claude/project-status-check-5f294d` aponta para o mesmo commit.

## Decisões, descobertas e evidências

- O usuário escolheu consultar de hora em hora para poupar o sistema. As janelas de 10 e 2 minutos foram a otimização proposta e aceita.
- Uma atualização manual no Meu Pluggy remarca a rodada automática para 24 horas depois. Ao atualizar o Santander e o Mercado Pago pelo Meu Pluggy, o Finance importou em um a dois minutos. Ver [pesquisa](../branches/pluggy/research/RES-20261110-frequencia-atualizacao.md).
- O Meu Pluggy lista duas conexões da mesma instituição compartilhadas com o Finance, e o Finance usa uma delas. A sobra pode dividir a cota do Open Finance.
- As evidências estão na [verificação da SPEC-0002](../../Specs/features/SPEC-0002--atualizacao-frequente/verification.md) e na [verificação da SPEC-0001](../../Specs/features/SPEC-0001--mvp-finance/verification.md).

## Pendências e próxima ação

- **SPEC-0002-T003.** Ver a rodada automática diária chegar sozinha, com o worker rodando. As duas conexões estão previstas para 2026-11-11, por volta das 19h50 UTC.
- **Arquivos locais.** `.env`, `.env.local-login` e `apps/web/data/finance.sqlite` existem só no worktree desta sessão. Copie-os para a pasta principal antes de apagar o worktree. O usuário adiou a cópia. Ver [ambiente local](../global/notes/NTE-20261109-ambiente-local.md).
- **Conexão duplicada.** O usuário decide se revoga, no Meu Pluggy, a conexão que sobra.
- **Fases 2 e 3 da SPEC-0002.**
  - A fase 2, webhook por HTTPS, depende da escolha entre túnel e hospedagem.
  - A fase 3, Item Open Finance direto, depende de consulta comercial à Pluggy.
- **Sem mudança.** A homologação pública continua adiada e o Android vem depois.
- **Retomada.**
  - Leia o [estado SDD](../../Specs/STATE.md) e as [tarefas da SPEC-0002](../../Specs/features/SPEC-0002--atualizacao-frequente/tasks.md).
  - Rode `npm test` em `apps/web`.
  - Para o painel e o worker, siga o [ambiente local](../global/notes/NTE-20261109-ambiente-local.md).
