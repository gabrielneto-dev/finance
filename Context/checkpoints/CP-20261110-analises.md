---
id: "CTX-CP-20261110-analises"
type: "checkpoint"
title: "Aba Análises, classificação de lançamentos e correções de Gastos e da fatura aberta"
branch: "global"
tags: ["escopo", "seguranca"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
supersedes: ["CTX-CP-20261110-webhooks-endereco-real"]
related: ["CTX-DEC-20261110-classificacao-analises", "CTX-DEC-20261108-ciclos-cartao", "CTX-DEC-20261109-sem-avisos-de-atraso", "CTX-NTE-20261109-ambiente-local", "CTX-RSK-20261109-repositorio-publico"]
---

# Aba Análises, classificação de lançamentos e correções de Gastos e da fatura aberta

## Objetivo e mudanças verificadas

O usuário pediu uma aba de gráficos e análise de dados para entender os gastos e o que pode melhorar, com tela limpa e informação relevante. O escopo de dados e as telas viraram a [SPEC-0003](../../Specs/features/SPEC-0003--analises/spec.md), com plano aprovado.

- **Aba Análises.** Rota própria em `/analises`, logo abaixo de Visão geral na barra lateral. Tem seis páginas:
  - **Resumo:** indicadores, ritmo do mês com projeção, Destaques, 12 meses e principais grupos.
  - **Fluxo de caixa:** cascata, origens, formas de pagamento, saldo reconstruído e calendário.
  - **Categorias:** ranking com tendência, composição, evolução por grupo e ticket médio.
  - **Faturas:** histórico, fatura aberta, composição, parcelas futuras e comparação.
  - **Instituições.**
  - **Hábitos:** recorrências, estabelecimentos, horários e compras pequenas.

  Período, conta e comparação ficam na URL. O detalhe lateral lista os lançamentos de cada recorte.
- **Classificação.** Cada lançamento vira despesa, estorno, receita, rendimento ou neutro, com categorias em português, grupos e natureza. Gastos usa a mesma regra. Ver a [decisão](../branches/produto/decisions/DEC-20261110-classificacao-analises.md).
- **Categoria do usuário.** Vale para um lançamento ou para o estabelecimento e é escolhida no Extrato e no detalhe. Fica em `category_overrides` e `category_rules`, que a sincronização não toca.
- **Correções de bugs anteriores:**
  - Gastos somava o pagamento da fatura feito pela conta e as transferências entre contas próprias.
  - A fatura aberta ficava negativa, porque o pagamento chegava ao cartão como `Transfer - Internal`.
- **Evidência.** São 73 testes. Os módulos de `lib/analytics/` têm de 96% a 100% de cobertura de linhas, e o build passou. No painel real foram conferidos:
  - as seis páginas;
  - os valores ocultos;
  - a largura de 375 px;
  - a gravação e a restauração de uma categoria;
  - a igualdade entre Gastos e as Despesas das Análises.

  Ver a [verificação](../../Specs/features/SPEC-0003--analises/verification.md).
- **Git.** O commit `fceee96` foi publicado na `main`.

## Decisões, descobertas e evidências

- **Pix a terceiros.** Sem categoria do usuário, forma o grupo próprio "Pix e transferências a terceiros". O usuário pediu também uma análise por instituição e a escolha de categoria.
- **Destaques.** Ficam dentro do Resumo, com frases calculadas e link para o detalhe. Não é faixa de aviso. Uma nota de rodapé sobre outra moeda foi retirada para respeitar a [decisão sem avisos](../branches/produto/decisions/DEC-20261109-sem-avisos-de-atraso.md).
- **Pagamento de fatura no cartão.** Chega com métodos e categorias variados: `Fatura`, `Credit card payment` ou `Transfer - Internal`. A fatura aberta ignora qualquer lançamento neutro da classificação.
- **Recorrência.** "Nova" usa 95 dias, e não 45. Com o mínimo de três meses de cobrança, 45 dias nunca marcaria nada.
- **Gráficos.** Usam Recharts 3.10.1. A paleta das séries foi validada pelo validador do dataviz: verde, azul, laranja, violeta e magenta, com cinza para "Outros". Receita é verde e despesa é azul.
- **Aprendizados técnicos,** registrados na [nota do ambiente](../global/notes/NTE-20261109-ambiente-local.md):
  - um Server Component não pode ler constantes de um módulo `"use client"`;
  - um menu do Radix dentro de `<dialog>` modal precisa de `container`.

## Pendências e próxima ação

- **SPEC-0003.** Tarefas concluídas. Possíveis evoluções, sem pedido do usuário:
  - orçamento por categoria;
  - categorias próprias além da lista fixa;
  - histórico gravado de saldos.
- **SPEC-0002.**
  - T004: ligar o túnel e cadastrar os webhooks pelo script.
  - T003: ver a sincronização diária chegar sozinha.

  Sem mudança desde o [checkpoint anterior](CP-20261110-webhooks-endereco-real.md).
- **Sem mudança.** A homologação com Supabase continua adiada, e o Android vem depois.
- **Retomada.** Leia o [estado SDD](../../Specs/STATE.md) e as [tarefas da SPEC-0003](../../Specs/features/SPEC-0003--analises/tasks.md). Para rodar, siga a [nota do ambiente](../global/notes/NTE-20261109-ambiente-local.md).
