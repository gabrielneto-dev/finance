---
id: "SPEC-0004"
title: "Planejamento financeiro"
status: "draft"
created_at: "2026-11-10"
updated_at: "2026-11-10"
priority: "next"
dependencies: ["SPEC-0001", "SPEC-0003"]
context_refs: ["CTX-DEC-20261110-planejamento", "CTX-RES-20261110-frameworks-planejamento", "CTX-DEC-20261110-classificacao-analises", "CTX-DEC-20261109-sem-avisos-de-atraso", "CTX-RSK-20261109-repositorio-publico"]
supersedes: null
superseded_by: null
---

# Planejamento financeiro

## Objetivo

Dar ao usuário uma aba **Planejamento** para decidir o que vai acontecer com o dinheiro. Ela cobre:
- caixinhas que dividem a renda;
- metas;
- projeções que ele pode alterar;
- tendências;
- patrimônio e investimentos;
- o resultado da compra e venda que ele faz pelas mesmas contas da vida pessoal.

O desenho combina frameworks pesquisados em [RES-20261110-frameworks-planejamento](../../../Context/branches/produto/research/RES-20261110-frameworks-planejamento.md) e segue as [decisões do usuário](../../../Context/branches/produto/decisions/DEC-20261110-planejamento.md).

Classificação Full: tabelas novas, ações de escrita, mudança na classificação das Análises e integração nova com a Pluggy.

## Requisitos e aceitação

| ID | Comportamento | Critério de aceitação |
| --- | --- | --- |
| REQ-001 | Separar o negócio na classificação | Existem as categorias de Negócio (vendas, compra de mercadoria, frete, taxas e outros custos) e as escolhas "Aporte em investimento" e "Retirada do negócio". Uma conta pode ser marcada como do negócio. Vendas e custos saem das receitas e despesas pessoais. O lucro do negócio aparece à parte e entra no resultado. Testes sintéticos cobrem as regras. |
| REQ-002 | Caixinhas com o Plano Consciente | A partir do histórico, o sistema sugere as caixinhas Fixos, Livre, Investir e Reservas e objetivos, com valores encaixados nas faixas do framework. O usuário cria, edita, arquiva e reordena caixinhas. Define cada uma em valor ou percentual da renda, liga grupos de despesa e escolhe se a sobra acumula ou zera. Um grupo pertence a uma só caixinha. |
| REQ-003 | Acompanhar o mês | Para cada caixinha, a página Mês mostra planejado com acúmulo, gasto, disponível, ritmo até o fim do mês, situação com ícone e texto, e valor por dia restante. A renda sem destino aparece até zerar. O gasto por caixinha soma as Despesas das Análises no mês. Um ajuste só do mês não muda o padrão. |
| REQ-004 | Metas e reserva | O usuário cria metas com alvo, prazo, aporte planejado e rendimento opcional, ligadas a valor manual, investimentos ou conta. Cada meta mostra progresso, aporte necessário e data prevista. A reserva de emergência usa gasto essencial × meses, com padrão de 6. A independência financeira é opcional, pela regra dos 4%. |
| REQ-005 | Projeções editáveis | A projeção mensal de 12 ou 24 meses mostra entradas, saídas, parcelas comprometidas, investido, sobra, saldo e patrimônio, no cenário base e no ajustado. Os ajustes (renda, corte de grupo, evento pontual e aporte extra) ligam e desligam e mostram seu efeito. Sem eixo duplo. |
| REQ-006 | Tendências | Grupos e categorias com alta consistente em 6 meses, acima do planejado por meses seguidos ou com nova recorrência aparecem com minigráfico e ação. |
| REQ-007 | Patrimônio e investimentos manuais | O usuário cadastra investimentos com classe e liquidez e atualiza o saldo, guardando o histórico. A página Patrimônio mostra patrimônio líquido, alocação, aportes por mês, taxa de investimento e meses de reserva cobertos. |
| REQ-008 | Página do negócio | Mostra vendas, custos, lucro, margem, ticket médio e número de vendas por mês, retiradas para a vida pessoal e a divisão de cada venda contra a sugestão Profit First. Sem lançamentos marcados, mostra um estado vazio com instrução e nenhum banner. |
| REQ-009 | Investimentos pela Pluggy | O Connect Token pede `INVESTMENTS` e `INVESTMENTS_TRANSACTIONS`. Depois da reautorização do usuário, a sincronização importa `/investments` do Item, com saldo líquido e snapshot. A tela funciona sem a Pluggy. |
| REQ-010 | Navegação, segurança e privacidade | A rota `/planejamento` é autenticada e tem seis páginas: Mês, Caixinhas, Metas, Projeções, Patrimônio e Negócio. Toda escrita verifica Origin, sessão, dono e valores. Saldos, patrimônio, investimentos e metas em reais seguem o botão de ocultar. Funciona de 375 a 1440 px sem rolagem horizontal. |

## Fora do escopo

- Movimentar dinheiro, pagar ou investir pelo app.
- Controle de estoque item a item do negócio.
- Cálculo de imposto de renda.
- Cotação de ativos em tempo real.

[Plano](plan.md) · [Tarefas](tasks.md) · [Verificação](verification.md)
