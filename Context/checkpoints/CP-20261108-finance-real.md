---
id: "CTX-CP-20261108-finance-real"
type: "checkpoint"
title: "Finance com Pluggy real e acompanhamento de ciclos"
branch: "global"
tags: ["escopo", "plataformas", "pluggy", "sandbox", "seguranca"]
status: "superseded"
superseded_by: "CTX-CP-20261109-validacao-web"
created_at: "2026-11-08"
updated_at: "2026-11-09"
supersedes: ["CTX-CP-20261108-mvp-web"]
related: ["CTX-DEC-20261108-pluggy-web-mobile", "CTX-DEC-20261108-acesso-finance", "CTX-DEC-20261108-ciclos-cartao", "CTX-RES-20261108-fluxo-pluggy", "CTX-RSK-20261108-isolamento"]
---

# Finance com Pluggy real e acompanhamento de ciclos

## Estado verificado

- O MVP prioriza web e uso pessoal. Next.js atende o painel, SQLite armazena os dados financeiros e um worker processa eventos. Android vem depois; a distribuição continua [em aberto](../branches/produto/questions/QUE-20261108-publico-plataformas.md).
- O painel autenticado usa a integração real, sem demonstração. O [fluxo local](../../README.md#rodar-localmente-com-a-pluggy) permite importar um Item autorizado e configurado no servidor. Para conectar outro Item, o fluxo usa o widget. A emissão e o escopo do token foram verificados; o retorno após consentimento ainda precisa ser exercitado.
- Conexões mostra instituição, contas, cartões, estado de sincronização e processamento do webhook. A tela distingue a cobertura anunciada pelo conector, os produtos configurados e os dados efetivamente importados.
- Extrato, Gastos, Cartões e Faturas exibem parcelas importadas e projeções mensais separadamente. As compras de faturas oficiais são consultadas pelo vínculo com a fatura, independentemente do intervalo do extrato.
- O resumo de Gastos usa os mesmos lançamentos filtrados da lista, com valores efetivados e pendentes separados por moeda. Cartões e Gastos exibem o mesmo próximo fechamento por cartão e indicam se é informado ou estimado. As [regras de ciclos](../branches/produto/decisions/DEC-20261108-ciclos-cartao.md) registram a precedência e as condições de inferência.
- O receptor e o worker de webhook foram verificados localmente, incluindo processamento, deduplicação e aviso de transferência. A entrega da Pluggy ao domínio HTTPS público continua pendente.

## Evidências e retomada

A [verificação da SPEC-0001](../../Specs/features/SPEC-0001--mvp-finance/verification.md) registra o teste local com o Item autorizado, os testes sintéticos no navegador e a validação do fechamento na API autenticada. A suíte web foi reexecutada neste checkpoint: sete testes passaram.

Para testar o painel, use o [guia local](../../README.md#rodar-localmente-com-a-pluggy). A chave local permite testar em loopback sem Supabase; para hospedagem HTTPS, o Supabase cuida da autenticação. Os dados financeiros continuam no SQLite. Consulte a [decisão de acesso](../branches/produto/decisions/DEC-20261108-acesso-finance.md) antes de trocar o modo de autenticação.

A próxima etapa de homologação é [preparar o servidor](../../README.md#preparar-o-servidor) com Compose, web e worker compartilhando o volume SQLite, domínio HTTPS e Supabase Auth. Depois, concluir consentimento e callback web e [disparar um webhook no Dashboard da Pluggy](../../README.md#testar-a-entrega-pelo-dashboard-da-pluggy). Conferir resposta HTTP, estado de processamento em Conexões, deduplicação e avisos de transferência conforme o evento. Os critérios de recuperação, Android e liberação seguem nas [tarefas](../../Specs/features/SPEC-0001--mvp-finance/tasks.md) e no [estado SDD](../../Specs/STATE.md).
