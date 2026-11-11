# Plano técnico do planejamento financeiro

## Contexto

As Análises (SPEC-0003) mostram o que aconteceu. Falta decidir o que vai acontecer: quanto cabe em cada parte da vida, quanto investir, quando cada meta chega e o que muda se a renda ou um gasto mudar. O usuário pediu uma sessão de planejamento com:
- caixinhas ("tanto para gastar aqui, tanto ali, tanto para investir");
- projeções que ele possa alterar;
- tendências;
- investimentos.

Também pediu frameworks que juntem as finanças de quem tem CLT e faz compra e venda pelas mesmas contas.

**Respostas do usuário em 2026-11-10:**
- **Negócio:** hoje fica misturado nas contas pessoais e é separado pelos lançamentos marcados. No futuro, ele terá uma conta só do negócio.
- **Investimentos:** lançamento manual e importação pela Pluggy, com Rico e outros apps. A conexão MeuPluggy atual foi criada só com ACCOUNTS, CREDIT_CARDS e TRANSACTIONS, mas o conector oferece INVESTMENTS e INVESTMENTS_TRANSACTIONS.
- **Divisão inicial:** Plano Consciente.
- **Sobra do mês:** cada caixinha escolhe se acumula ou zera.

**Execução.** Em 2026-11-10 o plano foi só registrado, a pedido do usuário. A implementação começa pela SPEC-0004-T002 numa próxima sessão.

Classificação SDD: **Full**. Vira a **SPEC-0004 — Planejamento financeiro**. Introduz tabelas, ações de escrita e uma integração nova com a Pluggy. Os frameworks usados estão documentados como pesquisa em `Context/`.

## Frameworks combinados

| Framework | Uso no Finance |
| --- | --- |
| Plano Consciente (Ramit Sethi): fixos 50–60%, investir 10%, reservas e objetivos 5–10%, livre 20–35% | Caixinhas iniciais e faixas saudáveis de cada uma |
| Base zero e despesas verdadeiras (YNAB) | "Renda sem destino" visível até chegar a zero. Caixinhas com acúmulo para gastos anuais, como IPVA, presentes e viagens |
| Profit First (Michalowicz), adaptado à revenda | Lucro do negócio calculado à parte. Sugestão de separar cada venda em reposição de mercadoria, impostos e taxas, lucro e retirada para a vida pessoal |
| Reserva de emergência | Meta em meses de gasto essencial. O padrão é 6 meses, porque a renda é mista (CLT dá de 3 a 6, renda variável de 6 a 12) |
| Regra dos 4% (25× o gasto anual) | Meta de longo prazo opcional de independência financeira |

---

## 1. Dados

### 1.1 Negócio na classificação (estende a SPEC-0003)

- **Grupo novo "Negócio"** em `lib/analytics/categories.mjs`:
  - Vendas (CREDIT);
  - Compra de mercadoria;
  - Frete e envio;
  - Taxas e plataformas;
  - Outros custos do negócio.
- **Tipos novos em `classify`:** `negocio_receita` e `negocio_custo`.
- **Escolhas especiais novas:** "Aporte em investimento" (`investimento`) e "Retirada do negócio" (`transferencia_propria`).
- **Conta do negócio**, para o futuro: a tabela `account_settings(owner, item_id, account_id, business)` marca a conta. Nela, débitos viram custo e créditos viram venda. Transferência para conta própria vira retirada (pró-labore). As regras de neutros e a escolha do usuário continuam valendo.
- **Efeito nas Análises:**
  - Despesas e receitas pessoais deixam o negócio de fora.
  - `totals` ganha `business: { revenue, costs, profit }`.
  - O Resultado passa a ser receitas pessoais + lucro do negócio − despesas.
  - O Fluxo de caixa mostra "Lucro do negócio" como origem.
  - O seletor de categoria ganha o grupo Negócio.

### 1.2 Tabelas novas (SQLite, `lib/db.mjs`)

| Tabela | Conteúdo |
| --- | --- |
| `plan_buckets` | `owner, id, name, kind` (fixos, livre, investir, reservas, meta, negocio), `mode` (valor ou percentual), `amount`, `rollover` (0/1), `sort`, `archived` |
| `plan_bucket_groups` | Quais grupos e categorias de despesa alimentam cada caixinha. Cada grupo pertence a uma só caixinha |
| `plan_month_amounts` | `bucket_id, month, amount`: ajuste do valor num mês. Sem ajuste, vale o valor da caixinha |
| `plan_income` | `owner, month, expected`: renda prevista do mês. Sem valor, usa a estimativa automática |
| `plan_goals` | `id, name, kind` (reserva, objetivo, independencia), `target, deadline, monthly, yield_rate`, `source` (manual, investimentos ou conta), `current`, `priority` |
| `plan_adjustments` | Ajustes da projeção: `kind` (renda, corte de grupo, evento pontual, aporte extra), `start_month, end_month, amount` ou `percent, group, enabled` |
| `investments` | `id, owner, source` (manual ou pluggy), `external_id, item_id, name, institution, class` (renda fixa, tesouro, ações, FIIs, fundos, previdência, cripto, outros), `liquidity, balance, updated_at` |
| `investment_snapshots` | `investment_id, date, balance`: histórico, um por atualização ou sincronização |

A sincronização não toca nas tabelas de planejamento. Valores reais ficam só no SQLite local, fora do Git.

### 1.3 Cálculos (funções puras em `lib/planning/`)

- **`income.mjs`: renda prevista.**
  - Mediana dos 3 últimos meses de Salário.
  - Mais a média de 3 meses das outras receitas.
  - Mais a média de 3 meses do lucro do negócio.
  - O usuário pode substituir o valor do mês.
- **`buckets.mjs`: caixinhas padrão pelo Plano Consciente.**
  - Fixos recebem os grupos de natureza essencial.
  - Livre recebe os grupos de estilo de vida e Pix a terceiros.
  - Investir recebe os aportes (tipo `investimento`).
  - Reservas e objetivos são alimentadas pelas metas.
  - O valor sugerido é a média de 3 meses do gasto real, encaixada na faixa do framework.
- **`budget.mjs`: o mês.** Para cada caixinha, calcula:
  - **planejado:** valor ou percentual da renda, mais o acúmulo do mês anterior quando `rollover`;
  - **realizado:** despesas menos estornos dos grupos ligados, pela `classify`;
  - **disponível**;
  - **ritmo:** projeção até o fim do mês pela média diária;
  - **situação:** dentro, atenção acima de 85% do ritmo, ou estourou;
  - **"livre por dia":** disponível ÷ dias restantes.

  A renda sem destino é a renda prevista menos a soma do planejado.
- **`goals.mjs`: metas.**
  - Valor atual vem do manual, da soma dos investimentos ligados ou do saldo de uma conta.
  - Aporte necessário: `(alvo − atual) / meses restantes`, com rendimento mensal opcional (juros compostos).
  - Data prevista com o aporte planejado.
  - A meta de reserva calcula o alvo como gasto essencial médio × meses, com padrão de 6.
- **`projection.mjs`: projeção mensal de 12 meses**, extensível a 24.
  - Entradas: renda prevista.
  - Saídas: caixinhas planejadas, ou a tendência quando a caixinha não existe, mais as parcelas já comprometidas (`installmentSchedule`).
  - Investido: caixinha Investir mais metas.
  - Ajustes ligados de `plan_adjustments`.
  - Resultado: sobra por mês, saldo em conta acumulado, patrimônio (contas + investimentos com rendimento assumido) e marcos das metas.
  - Calcula sempre o cenário base, sem ajustes, e o cenário com ajustes.
- **`trends.mjs`: tendências.**
  - Regressão linear dos 6 meses de cada grupo e categoria, com a inclinação em % ao mês.
  - Marca "subindo", com ao menos +8% ao mês e 3 meses de dado.
  - Marca "acima do planejado há N meses".
  - Marca "nova despesa recorrente", reaproveitando `recurring.mjs`.
- **`business.mjs`: resultado mensal do negócio.**
  - Vendas, custo de mercadoria, frete e taxas, lucro e margem.
  - Número de vendas e ticket médio.
  - Retiradas para a vida pessoal.
  - Sugestão Profit First: % de reposição, impostos e taxas, lucro e retirada, a partir dos percentuais reais atuais.
- **`networth.mjs`: patrimônio.**
  - Saldo das contas + investimentos − fatura aberta − parcelas futuras.
  - Alocação por classe e por liquidez.
  - Aportes por mês e taxa de investimento (aportes ÷ renda).
  - Meses de reserva cobertos pelo que tem liquidez diária.

### 1.4 Investimentos pela Pluggy

- O Connect Token passa a pedir `INVESTMENTS` e `INVESTMENTS_TRANSACTIONS` (`app/api/connections/route.ts`).
- O usuário reautoriza a conexão MeuPluggy pelo widget com o `itemId`, o fluxo de atualização que já existe.
- `lib/sync.mjs` passa a buscar `GET /investments?itemId=` e grava `investments` (com `source: "pluggy"`) e um snapshot por sincronização.
- Mapeamento de tipo: FIXED_INCOME → renda fixa ou tesouro, conforme o subtipo; EQUITY → ações ou FIIs; MUTUAL_FUND → fundos; ETF; COE.
- Os saldos usam `balance` (líquido). A liquidez vem de `dueDate` e da carência.
- **Depende de o Rico estar conectado dentro do Meu Pluggy.** A tarefa começa conferindo `statusDetail` e os recursos do Item. Sem dado, fica o manual, e a tela não depende da Pluggy.

---

## 2. Telas

### 2.1 Estrutura

- **Navegação:** novo item **Planejamento** na barra lateral (ícone `Target`), logo abaixo de Análises. Rota `/planejamento` com o mesmo shell, cabeçalho e subnavegação das Análises. Reaproveita `components/app-sidebar.tsx`, `components/analytics/kit.tsx`, `rank-list.tsx`, `detail-sheet.tsx` e `app/analytics.css`.
- **Subnavegação:** Mês · Caixinhas · Metas · Projeções · Patrimônio · Negócio.
- **Controle à direita:** um seletor de mês (‹ novembro 2026 ›). Projeções usam um horizonte de 12 ou 24 meses.
- **Edição:** sempre no painel lateral, com formulário curto, validação e Salvar/Cancelar. Nada de modal no meio da tela.
- **Situação das caixinhas:** aparece na própria caixinha, com ícone e texto (Dentro, Atenção, Estourou). Não há faixa de aviso, conforme a decisão sem avisos.
- **Valores ocultos:** saldos, patrimônio, investimentos e metas em reais seguem o botão de ocultar. Percentuais e despesas continuam visíveis.

### 2.2 Páginas

**Mês**: "quanto ainda posso gastar"
- **Faixa:** renda prevista, planejado, gasto até hoje e **renda sem destino**. Esta última fica em destaque e é verde quando chega a zero.
- **Principal:** caixinhas em cartões com barra planejado × gasto, marca do ritmo esperado para hoje, disponível e "R$ X por dia até o fim do mês". A cor e o texto mostram a situação.
- **Lateral:** situação do Plano Consciente, com barras de cada fatia contra a faixa recomendada (fixos 50–60% etc.) e onde você está.
- **Secundária:** maiores gastos de cada caixinha, abrindo o detalhe lateral com a troca de categoria.

**Caixinhas**: "como divido meu dinheiro"
- **Editor da divisão:** uma barra horizontal da renda dividida entre as caixinhas, com o que sobra em cinza.
- **Lista de caixinhas:** nome, tipo, valor ou percentual, grupos ligados, acumula ou zera, e média real dos 3 meses ao lado do planejado.
- **Ações:** "Sugerir pelo Plano Consciente" recalcula pelo histórico. "Nova caixinha" abre o painel.
- **Ajuste só deste mês:** troca o valor de um mês sem mudar o padrão.

**Metas**: "para onde estou indo"
- Cartões de meta com progresso, valor que falta, aporte necessário por mês × planejado e data prevista contra o prazo (no prazo ou atrasada X meses).
- A reserva de emergência fica fixa no topo, com meses cobertos.
- A independência financeira é opcional, com o alvo pela regra dos 4%.
- O formulário da meta permite ligar a meta a investimentos ou a uma conta.

**Projeções**: "e se…"
- **Gráfico principal:** linha do patrimônio projetado, base contra cenário ajustado, por 12 ou 24 meses. Barras mensais de sobra embaixo, em outro gráfico (sem eixo duplo).
- **Lateral, ajustes ligáveis:**
  - "Salário +10% a partir de mar/2027";
  - "Cortar Alimentação fora em 20%";
  - "IPVA R$ X em jan";
  - "Aporte extra R$ X por mês".

  Cada um com chave liga e desliga e o efeito em reais no fim do horizonte.
- **Tabela mês a mês:** entradas, saídas, parcelas, investido, sobra e saldo.
- **Tendências:** grupos e categorias subindo ou acima do planejado, com minigráfico e ação "Ajustar caixinha" ou "Ver lançamentos".

**Patrimônio**: "quanto eu tenho"
- **Faixa:** patrimônio líquido, investido, em conta, dívidas do cartão e taxa de investimento do mês.
- **Gráficos:** evolução do patrimônio (snapshots e saldo reconstruído das contas), alocação por classe e por liquidez, e aportes por mês.
- **Lista de investimentos:** origem Pluggy ou manual, atualizado em, e "Atualizar saldo" para os manuais.

**Negócio**: "minha revenda dá lucro?"
- **Faixa:** vendas, custos, lucro e margem do mês, com a variação.
- **Gráficos:** vendas × custos × lucro em 12 meses, composição dos custos, ticket médio e número de vendas.
- **Profit First:** quanto de cada R$ 100 vendidos vai para cada destino hoje, contra a sugestão.
- **Retiradas:** quanto do lucro foi para a vida pessoal.
- **Sem lançamentos marcados:** um estado vazio explica como marcar vendas e compras no Extrato. Não aparece banner.

---

## 3. Arquitetura

- **Backend:**
  - `lib/planning/{income,buckets,budget,goals,projection,trends,business,networth,store,validate,index}.mjs`;
  - `planning(db, owner, { month, horizon, reference })` reaproveita `dashboard()`, `classify`, `aggregate`, `recurring` e `installmentSchedule`.
- **API:**
  - `GET /api/planning?month=YYYY-MM&horizon=12`;
  - `POST /api/planning` com ações `bucket-save`, `bucket-delete`, `bucket-month`, `income-set`, `goal-save`, `goal-delete`, `investment-save`, `investment-balance`, `investment-delete`, `adjustment-save`, `adjustment-toggle`, `adjustment-delete` e `account-business`.
  - Mesmas proteções de `app/api/connections/route.ts`: Origin, `owner()`, validação manual, limites de tamanho, valores em centavos inteiros e checagem de dono em cada id.
- **Frontend:**
  - `app/planejamento/page.tsx`, com a validação da URL como em `app/analises/page.tsx`;
  - `components/planning/` com container, uma página por arquivo, os editores e a barra de divisão da renda;
  - `components/app-sidebar.tsx` ganha a seção;
  - constantes compartilhadas em `lib/planning/sections.ts`, nunca num módulo `"use client"`.
- **Cores:** reaproveitam a paleta validada das Análises. Caixinhas em ordem fixa: Fixos verde, Livre azul, Investir violeta, Reservas laranja, Metas magenta, sem destino cinza. Situação com ícone e texto.

## 4. Tarefas (SPEC-0004)

1. **T001:** spec, plano, tarefas e verificação. Pesquisa dos frameworks em `Context/branches/produto/research/` e decisão do modelo de caixinhas. Atualizar índice, estado e catálogo.
2. **T002:** Negócio e aportes na classificação, conta do negócio, ajuste das Análises e do seletor de categoria. Testes.
3. **T003:** tabelas, `store.mjs` e `validate.mjs`, e as ações do POST. Testes de dono, valores inválidos e escopo.
4. **T004:** renda prevista, caixinhas, mês e acúmulo. Testes.
5. **T005:** metas, reserva e independência. Testes.
6. **T006:** projeção, cenários, ajustes e tendências. Testes.
7. **T007:** patrimônio e investimentos manuais com snapshots. Testes.
8. **T008:** resultado do negócio e sugestão Profit First. Testes.
9. **T009:** GET `/api/planning`, shell, rota `/planejamento` e páginas Mês e Caixinhas.
10. **T010:** páginas Metas e Projeções.
11. **T011:** páginas Patrimônio e Negócio.
12. **T012:** investimentos pela Pluggy. Produto no Connect Token, importação em `sync.mjs` e reautorização pelo usuário, que depende dele. Conferir com o Item real.
13. **T013:** verificação final no navegador e registro.

## 5. Verificação

- **Testes:** `npm test` com os 73 atuais e os novos, em `test/planning-*.test.mjs`, com dados sintéticos. Os módulos de `lib/planning/` devem ficar com pelo menos 80% de cobertura (`--experimental-test-coverage`).
- **Build:** checagem de tipos e `npm run build`, com o servidor da porta 3001 parado antes e iniciado depois.
- **Painel real:**
  - criar as caixinhas sugeridas e conferir que gasto por caixinha bate com as Despesas das Análises no mês;
  - acúmulo de um mês para o outro;
  - meta com data prevista;
  - um ajuste da projeção ligado e desligado mudando o cenário;
  - investimento manual com atualização de saldo;
  - marcar uma venda e uma compra de mercadoria e ver o lucro do negócio, saindo das despesas pessoais;
  - valores ocultos;
  - 375 px sem rolagem horizontal;
  - console e log sem erros.

  Desfazer o que for teste, se não for do usuário.
- **Pluggy:** depois da reautorização, `/investments` do Item real é importado, e o patrimônio mostra a origem Pluggy.
- **Registros:** `verification.md` sem valores reais. Conferir segredos antes de qualquer commit, porque o repositório é público.
