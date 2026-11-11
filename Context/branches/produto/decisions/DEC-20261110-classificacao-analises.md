---
id: "CTX-DEC-20261110-classificacao-analises"
type: "decision"
title: "Classificação de lançamentos para Análises e Gastos"
branch: "produto"
tags: ["escopo"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
source_ids: []
related: ["CTX-DEC-20261108-ciclos-cartao", "CTX-DEC-20261109-sem-avisos-de-atraso"]
---

# Classificação de lançamentos para Análises e Gastos

**Contexto.** Gastos excluía só o método "Fatura". O pagamento da fatura feito pela conta chega com a categoria "Credit card payment" e outro método, e as transferências entre contas próprias chegam como "Same person transfer". Os dois entravam como gasto e somavam-se às compras do cartão.

**Decisão do usuário (2026-11-10).**
- Análises e Gastos usam a mesma classificação. Pagamento de fatura (por método ou categoria) e transferência entre contas próprias ficam fora de despesas e receitas. Crédito no cartão com categoria de consumo é estorno e abate a despesa.
- Pix e transferências a terceiros sem categoria escolhida pelo usuário formam um grupo de gasto próprio.
- O usuário pode escolher a categoria de um lançamento ou de todos do mesmo estabelecimento. A escolha fica em tabelas próprias e sobrevive à reimportação.
- As Análises incluem uma visão por instituição.
- No cartão, o pagamento da fatura também chega como crédito `Transfer - Internal`. Por isso, a fatura aberta ignora qualquer lançamento neutro da classificação, e não só o método "Fatura".
- O Resumo tem um bloco de Destaques no conteúdo. Não é faixa de aviso, o que respeita a [decisão sem avisos](DEC-20261109-sem-avisos-de-atraso.md).

Detalhes em [SPEC-0003](../../../../Specs/features/SPEC-0003--analises/spec.md).
