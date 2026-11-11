---
id: "CTX-CP-20261110-planejamento"
type: "checkpoint"
title: "Plano da aba Planejamento registrado para continuar"
branch: "global"
tags: ["escopo", "pluggy"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
supersedes: ["CTX-CP-20261110-analises"]
related: ["CTX-DEC-20261110-planejamento", "CTX-RES-20261110-frameworks-planejamento", "CTX-DEC-20261110-classificacao-analises", "CTX-NTE-20261109-ambiente-local"]
---

# Plano da aba Planejamento registrado para continuar

## Objetivo e mudanças verificadas

O usuário pediu uma aba de planejamento: caixinhas ("tanto para gastar aqui, tanto ali, tanto para investir"), metas, projeções que possa alterar, tendências e investimentos, num layout limpo como o das Análises. Pediu também frameworks que juntem as finanças de quem tem CLT e faz compra e venda pelas mesmas contas.

- O plano foi aprovado e registrado como [SPEC-0004](../../Specs/features/SPEC-0004--planejamento/spec.md), com [plano técnico](../../Specs/features/SPEC-0004--planejamento/plan.md) e [tarefas](../../Specs/features/SPEC-0004--planejamento/tasks.md).
- Os frameworks estão na [pesquisa](../branches/produto/research/RES-20261110-frameworks-planejamento.md): Plano Consciente, YNAB, Profit First, reserva de emergência e regra dos 4%. As escolhas do usuário estão na [decisão](../branches/produto/decisions/DEC-20261110-planejamento.md).
- **Nenhum código foi alterado nesta etapa.** A aba Análises continua como no [checkpoint anterior](CP-20261110-analises.md), publicada em `fceee96` e `5da3caf`.

## Decisões, descobertas e evidências

- **Seis páginas** em `/planejamento`: Mês, Caixinhas, Metas, Projeções, Patrimônio e Negócio. Elas reaproveitam o shell, o kit de gráficos, o detalhe lateral e a paleta das Análises.
- **Negócio.** Fica separado pelos lançamentos marcados, com categorias novas de vendas e custos. Também haverá a marcação de conta do negócio, porque o usuário pretende abrir uma. O lucro sai das despesas pessoais e entra no resultado.
- **Caixinhas.** Partem do Plano Consciente, e cada uma escolhe se acumula ou zera a sobra. A renda sem destino deve chegar a zero.
- **Investimentos.** Manual e pela Pluggy. A conexão MeuPluggy atual foi criada só com ACCOUNTS, CREDIT_CARDS e TRANSACTIONS, mas o conector oferece INVESTMENTS e INVESTMENTS_TRANSACTIONS. Importar depende de pedir o produto no Connect Token e de o usuário reautorizar a conexão. Também depende de o Rico estar conectado dentro do Meu Pluggy.

## Pendências e próxima ação

- **Próxima tarefa:** SPEC-0004-T002, negócio e aportes na classificação, com testes. T003, as tabelas e ações de escrita, pode começar em paralelo.
- **Ordem sugerida:**
  1. T002 a T008, com a lógica pura e testes.
  2. T009 a T011, com API e telas, conferidas no navegador.
  3. T012, os investimentos pela Pluggy, que precisam da reautorização do usuário.
  4. T013, a verificação final.
- **SPEC-0002 sem mudança.** Faltam T004 (túnel e webhooks) e T003 (ver a sincronização diária chegar sozinha).
- **Retomada.** Leia o [estado SDD](../../Specs/STATE.md), a [spec](../../Specs/features/SPEC-0004--planejamento/spec.md) e as [tarefas](../../Specs/features/SPEC-0004--planejamento/tasks.md). Para rodar, siga a [nota do ambiente](../global/notes/NTE-20261109-ambiente-local.md).
