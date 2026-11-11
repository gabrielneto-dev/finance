---
id: "SPEC-0003"
title: "Análises financeiras"
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
priority: "next"
dependencies: ["SPEC-0001"]
context_refs: ["CTX-DEC-20261110-classificacao-analises", "CTX-DEC-20261108-ciclos-cartao", "CTX-DEC-20261109-sem-avisos-de-atraso", "CTX-RSK-20261109-repositorio-publico"]
supersedes: null
superseded_by: null
---

# Análises financeiras

## Objetivo

Dar ao usuário uma aba própria de Análises para entender o padrão do dinheiro: quanto sobra, para onde vai, o que cresceu, quanto da renda futura o cartão já compromete e o que dá para cortar. A aba tem seis páginas: Resumo, Fluxo de caixa, Categorias, Faturas, Instituições e Hábitos. Todas usam a mesma [classificação de lançamentos](../../../Context/branches/produto/decisions/DEC-20261110-classificacao-analises.md), que também passa a valer em Gastos.

Classificação Full: nova funcionalidade, nova tabela, nova ação de escrita e mudança no cálculo de Gastos.

## Requisitos e aceitação

| ID | Comportamento | Critério de aceitação |
| --- | --- | --- |
| REQ-001 | Classificar cada lançamento para análise | Cada lançamento recebe um tipo: despesa, estorno, receita, rendimento, pagamento de fatura, transferência própria ou ignorado. Pagamento de fatura (pelo método ou pela categoria) e transferência entre contas próprias nunca entram em despesas nem receitas. Crédito no cartão com categoria de consumo abate a despesa. Valores em outra moeda usam o valor cobrado em reais. Testes sintéticos cobrem cada regra. |
| REQ-002 | Mostrar categorias em português, com grupo e natureza | Cada categoria da Pluggy tem nome em português, grupo e natureza (essencial ou estilo de vida). Pix e transferências a terceiros sem categoria do usuário ficam num grupo próprio. Categoria desconhecida cai em "Sem categoria" e mantém o nome original visível. |
| REQ-003 | Corrigir Gastos com a mesma regra | Gastos usa a classificação do REQ-001. Com "todas as contas", o total não soma o pagamento da fatura feito pela conta nem transferências entre contas próprias. O resumo por categoria usa os nomes do REQ-002. |
| REQ-004 | Deixar o usuário escolher a categoria | No Extrato e no detalhe das Análises, o usuário escolhe a categoria de um lançamento ou de todos do mesmo estabelecimento ou destinatário. Também pode ignorar o lançamento ou marcá-lo como transferência entre contas próprias. A escolha do lançamento vence a do estabelecimento, que vence a da Pluggy. Reimportar não apaga a escolha. Só o dono altera, só categorias da lista são aceitas e salvar vazio remove a escolha. |
| REQ-005 | Navegar pelas Análises | A aba Análises tem rota própria, autenticada, e seis páginas. Período (este mês, mês anterior, 3, 6 e 12 meses, este ano e personalizado), comparação com o período anterior e conta ou cartão ficam na URL. Recarregar mantém a tela. Funciona de 375 a 1440 px sem rolagem horizontal. |
| REQ-006 | Resumo e Destaques | O Resumo mostra receitas, despesas, resultado e taxa de poupança com variação, o ritmo do mês com projeção, receitas e despesas de 12 meses e os principais grupos. Os Destaques trazem até 5 frases calculadas com link para o detalhe, dentro do conteúdo e sem faixa de aviso. |
| REQ-007 | Fluxo de caixa | Mostra entradas por origem, saídas por forma de pagamento, a cascata do período até a sobra, o calendário de gastos e o saldo das contas reconstruído pelos lançamentos efetivados. |
| REQ-008 | Categorias | Mostra o ranking de grupos e categorias com variação e tendência, essencial contra estilo de vida, fixos contra variáveis, a evolução mensal por grupo e o ticket médio. Permite ver os totais com e sem Pix a terceiros. Clicar abre o detalhe com série mensal, estabelecimentos e lançamentos. |
| REQ-009 | Faturas e Instituições | Faturas mostra o histórico por vencimento, a fatura aberta estimada, a composição da fatura escolhida, o uso do limite e as parcelas dos próximos 12 meses. Instituições compara entradas, saídas e despesas por conexão e conta, a despesa mensal por instituição e as formas de pagamento. |
| REQ-010 | Hábitos | Lista recorrências e assinaturas detectadas, com custo mensal e anual e as marcas "nova" e "mudou de preço". Mostra os principais estabelecimentos, o padrão por dia da semana e horário e as compras pequenas. |

Saldos, limites, faturas, uso do limite e saldo reconstruído seguem a ocultação do REQ-016 da SPEC-0001. Despesas e receitas continuam visíveis.

## Fora do escopo

- Orçamentos e metas por categoria.
- Categorias criadas pelo usuário além da lista fixa.
- Histórico gravado de saldos. O saldo é reconstruído a partir dos lançamentos.
- Investimentos.

[Plano](plan.md) · [Tarefas](tasks.md) · [Verificação](verification.md)
