---
id: "CTX-CP-20261109-validacao-web"
type: "checkpoint"
title: "Validação web local, sincronização MeuPluggy e publicação no GitHub"
branch: "global"
tags: ["escopo", "pluggy", "seguranca"]
status: "active"
created_at: "2026-11-09"
updated_at: "2026-11-09"
supersedes: ["CTX-CP-20261108-finance-real"]
related: ["CTX-DEC-20261108-ciclos-cartao", "CTX-DEC-20261109-atualizacao-conexoes", "CTX-DEC-20261109-sem-avisos-de-atraso", "CTX-RES-20261109-sincronizacao-meupluggy", "CTX-NTE-20261109-ambiente-local", "CTX-RSK-20261109-repositorio-publico"]
---

# Validação web local, sincronização MeuPluggy e publicação no GitHub

## Objetivo e mudanças verificadas

O objetivo foi concluir a validação web local com a conexão real antes da homologação pública. Todas as mudanças passaram em testes, checagem de tipos, build e conferência no painel real. A suíte web tem 17 testes.

- **Cronograma de parcelas.** Parcelas pendentes sem fatura usam o ciclo aberto do cartão, não o `billForecastDate`. Regra em [ciclos do cartão](../branches/produto/decisions/DEC-20261108-ciclos-cartao.md).
- **Faturas.** Vencimento e fechamento mostram o ano. Antes, ciclos de anos diferentes ficavam com o mesmo rótulo.
- **Filtros.** O filtro do Extrato saiu para `apps/web/lib/ledger-filter.ts`, com testes para lançamento sem horário e sem forma.
- **Atualização.** O Atualizar funciona com conexões MeuPluggy, e o worker encerra falhas definitivas registrando o motivo. Detalhes em [atualização de conexões](../branches/pluggy/decisions/DEC-20261109-atualizacao-conexoes.md).
- **Requisitos.** REQ-006 e REQ-007 passaram na web. O REQ-015, aviso de lançamentos a caminho, foi entregue e depois [descartado](../branches/produto/decisions/DEC-20261109-sem-avisos-de-atraso.md).
- **Git.** O repositório foi criado e o commit `687eea5` foi publicado em `gabrielneto-dev/finance`, que é público. Ver [risco](../global/risks/RSK-20261109-repositorio-publico.md).

## Decisões, descobertas e evidências

- O card "Compras pendentes no período" soma lançamentos `PENDING` sem fatura do cartão e não tem relação com parcelas. Na conferência, bateu com o SQLite.
- A conexão MeuPluggy não aceita atualização pela API. Para antecipar, atualize no app Meu Pluggy e depois clique em Atualizar no Finance. Compras do cartão chegam do banco com dois a três dias de atraso. Ver [pesquisa](../branches/pluggy/research/RES-20261109-sincronizacao-meupluggy.md).
- Cuidados para rodar e testar localmente, como portas, build, cookies, worker e Git, estão em [ambiente local](../global/notes/NTE-20261109-ambiente-local.md).
- As evidências estão na [verificação da SPEC-0001](../../Specs/features/SPEC-0001--mvp-finance/verification.md), nas seções mês das parcelas sem fatura, cartões e faturas, filtros e gastos, atualização MeuPluggy e lançamentos ainda a caminho.

## Pendências e próxima ação

- **Homologação pública adiada pelo usuário.** Faltam servidor, domínio HTTPS, projeto Supabase, entrega de webhook e callback do widget. Esta máquina não tem Docker nem túnel.
- **Android em etapa posterior.** A [distribuição](../branches/produto/questions/QUE-20261108-publico-plataformas.md) segue em aberto.
- Na retomada, leia o [estado SDD](../../Specs/STATE.md) e as [tarefas](../../Specs/features/SPEC-0001--mvp-finance/tasks.md). Rode `npm --prefix apps/web test`. Para o painel, siga o [ambiente local](../global/notes/NTE-20261109-ambiente-local.md).
