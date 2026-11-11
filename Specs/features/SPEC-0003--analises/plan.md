# Plano técnico das análises financeiras

## Contexto

O painel mostra o que aconteceu (extrato, gastos do período, faturas), mas não ajuda a entender o padrão do dinheiro: quanto sobra por mês, para onde vai, o que cresceu, quanto da renda futura já está comprometida no cartão e o que dá para cortar. O usuário quer uma aba própria de **Análises**, com várias páginas, layout limpo e só informação que leve a decisão.

O levantamento do código mostrou três pontos que definem o projeto:

1. **Não há base analítica.** Gastos agrega no cliente (`SpendList`, `components/dashboard.tsx:117`), não há biblioteca de gráficos e as categorias são as da Pluggy, em inglês (`lib/pluggy.mjs:179`).
2. **Há contagem dupla em Gastos.** `expense` (`dashboard.tsx:38`) só exclui `method === "Fatura"`. Na base real, quase nenhum lançamento tem esse método. Os pagamentos de fatura feitos pela conta ("Credit card payment", método "Cartão") e as transferências entre contas próprias ("Same person transfer…") entram como gasto, somados às compras do cartão. A spec já proíbe isso (SPEC-0001, regras: pagamento de fatura separado das compras).
3. **Não há histórico de saldo.** Cada sincronização sobrescreve `accounts.data.balance`.

**Decisões do usuário (2026-11-10):**
- Pix a terceiros sem categoria vira o grupo "Pix e transferências a terceiros".
- Precisa haver análise por instituição.
- O usuário quer definir a categoria de um lançamento.
- Gastos passa a usar a mesma regra das Análises, o que corrige a contagem dupla.
- O Resumo tem um bloco "Destaques" no conteúdo. Não é faixa de aviso nem banner.

Classificação SDD: **Full**. É uma nova funcionalidade, com nova tabela e uma rota de escrita, e muda o cálculo de Gastos. Vira a **SPEC-0003 — Análises financeiras**.

---

## 1. Escopo de dados

### 1.1 Classificação de cada lançamento (base de tudo)

O módulo puro `lib/analytics/classify.mjs` dá a cada lançamento um **tipo analítico**. Ele é usado no servidor e na aba Gastos.

| Tipo | Regra (em ordem) | Entra em |
| --- | --- | --- |
| `ignorado` | O usuário marcou "Ignorar nas análises" | Nada |
| `pagamento_fatura` | `method === "Fatura"` ou categoria "Credit card payment", em conta ou cartão | Só Faturas (pagamento) |
| `transferencia_propria` | "Same person transfer", "Same person transfer - CASH", "Transfer - Internal" | Só o fluxo entre contas, neutro |
| `estorno` | CREDIT em conta CREDIT com categoria de consumo | Abate a despesa da mesma categoria |
| `despesa` | DEBIT restante, em conta ou cartão | Gastos, categorias, estabelecimentos |
| `rendimento` | CREDIT "Proceeds interests and dividends" | Receita, em linha própria |
| `receita` | CREDIT restante em conta BANK (Salary, Pix recebido, Non-recurring income…) | Receita |

Regras gerais:
- **Valor:** sempre `charged(row)` (`lib/charged.mjs`), em reais.
- **Data de competência:** o `date` do lançamento. A parcela conta no mês da cobrança, conforme a decisão de 2026-11-10.
- **Pendentes:** entram no mês corrente, com marcação. Previsões de parcela ficam fora dos realizados e aparecem só em "comprometido futuro".

### 1.2 Categorias em português e grupos

O mapa fixo `lib/analytics/categories.mjs` traduz a categoria da Pluggy, liga cada uma a um **grupo** e marca **essencial** ou **estilo de vida**:

| Grupo | Categorias Pluggy (exemplos da base) | Natureza |
| --- | --- | --- |
| Mercado e casa | Groceries, Houseware, Utilities, Water, Internet, Telecommunications | Essencial |
| Transporte | Gas stations, Automotive, Vehicle maintenance, Tolls…, Taxi…, Bus tickets, Car rental | Essencial |
| Saúde | Healthcare, Pharmacy, Insurance | Essencial |
| Alimentação fora | Eating out, Food delivery, Food and drinks | Estilo de vida |
| Compras | Shopping, Online shopping, Clothing, Electronics, Bookstore, Kids and toys, Pet… | Estilo de vida |
| Assinaturas e serviços | Digital services, Services | Estilo de vida |
| Lazer e bem-estar | Leisure, Cinema…, Gyms…, Wellness…, Travel, Accomodation | Estilo de vida |
| Taxas e impostos | Tax on financial operations (IOF) | Essencial |
| Pix e transferências a terceiros | Transfer - PIX (DEBIT), Transfers, Third party transfers, TED | Sem natureza até o usuário categorizar |
| Sem categoria | null ou categoria desconhecida | — |

Uma categoria desconhecida cai em "Sem categoria" com o nome original visível. Assim, uma categoria nova da Pluggy não some.

### 1.3 Categoria definida pelo usuário

Nova tabela no SQLite (migração em `lib/db.mjs`, no mesmo padrão das colunas `label` e `watch_until`):

- `category_overrides(owner, item_id, account_id, entry_id, category, updated_at)`: vale para um lançamento.
- `category_rules(owner, merchant_key, category, updated_at)`: vale para "todos deste estabelecimento ou destinatário".

A ordem de precedência é: override do lançamento, depois regra do estabelecimento, depois o mapa da Pluggy. A sincronização não toca nessas tabelas, então a escolha do usuário sobrevive à reimportação.

Os valores aceitos são a lista fixa de categorias em português, mais "Ignorar nas análises" e "Transferência entre minhas contas". Os dois últimos viram os tipos `ignorado` e `transferencia_propria`.

A escrita usa o `POST /api/connections` que já existe, com novas ações `categorize` e `categorize-rule`. Assim reaproveita a checagem de Origin e o `owner()`. A ação valida o dono do lançamento e aceita só categorias da lista. Enviar vazio remove a escolha.

### 1.4 Estabelecimento e destinatário

`lib/analytics/merchant.mjs` normaliza a descrição numa `merchant_key`:
- tira prefixos como "PIX ENVIADO", "COMPRA CARTAO" e "IFD*";
- tira a marca de parcela "PARC 02/10", datas e números soltos;
- aplica caixa alta e remove acentos.

Ela serve para o ranking de estabelecimentos, para as recorrências e para as regras de categoria. O nome exibido é a descrição mais frequente da chave.

### 1.5 Catálogo de métricas

| Métrica | Definição | Página |
| --- | --- | --- |
| Receitas | Soma de `receita` + `rendimento` | Resumo, Fluxo |
| Despesas | Soma de `despesa` − `estorno` | Todas |
| Resultado (sobra) | Receitas − Despesas | Resumo, Fluxo |
| Taxa de poupança | Resultado ÷ Receitas. Não aparece quando não houve receita | Resumo |
| Ritmo do mês | Despesa acumulada dia a dia, comparada com o mês anterior e a média de 3 meses | Resumo |
| Projeção do mês | Despesa até hoje ÷ dias corridos × dias do mês. Só no mês corrente | Resumo |
| Média diária | Despesas ÷ dias do período | Resumo |
| Variação | Período atual contra o período anterior equivalente, em R$ e % | Todas |
| Essencial × estilo de vida | Participação de cada natureza nas despesas | Categorias |
| Fixos × variáveis | Fixos são os recorrentes detectados (1.6). Variáveis são o resto | Categorias, Hábitos |
| Comprometido futuro | Parcelas importadas e previstas por mês de vencimento, nos próximos 12 meses (`installmentSchedule`) | Faturas, Resumo |
| Comprometimento da renda | Parcelas do próximo mês ÷ receita média de 3 meses | Faturas |
| Uso do limite | Fatura aberta ÷ limite do cartão, e faturas fechadas ÷ limite atual | Faturas |
| Ticket médio | Despesa ÷ número de compras, por categoria e por estabelecimento | Categorias, Hábitos |
| Compras pequenas | Quantidade e soma das compras abaixo de R$ 30 | Hábitos |
| Saldo reconstruído | Saldo atual de cada conta BANK menos o fluxo efetivado acumulado de trás para frente, dia a dia | Fluxo, Instituições |

Valores sujeitos ao REQ-016 (saldos, limites, faturas, uso do limite, saldo reconstruído) seguem `useMaskValue()`. Quando ocultos, os gráficos desses valores perdem eixo e rótulos, e a dica mostra "R$ ••••••". Despesas e receitas continuam visíveis, como em Gastos.

### 1.6 Recorrências e assinaturas

`lib/analytics/recurring.mjs` considera recorrente uma `merchant_key` com estas características:
- despesa em pelo menos 3 meses distintos dos últimos 6;
- intervalo mediano entre 25 e 35 dias;
- coeficiente de variação do valor abaixo de 20%.

Para cada uma, devolve:
- valor típico, custo mensal e anual e última cobrança;
- "mudou de preço", quando a última cobrança difere mais de 5% da mediana;
- "nova", quando a primeira cobrança caiu nos últimos 95 dias. Com o mínimo de três meses, uma janela de 45 dias nunca marcaria nada.

### 1.7 Destaques (3 a 5 frases, só no Resumo)

`lib/analytics/insights.mjs` gera frases ordenadas por impacto em R$ e corta em 5:
- categoria com maior alta e maior queda contra a média de 3 meses (mínimo de R$ 50 e 20%);
- recorrência nova ou com preço novo;
- projeção do mês acima da média;
- parcelas do próximo mês acima de 30% da receita média;
- estabelecimento que entrou no top 5.

Cada frase leva à página do detalhe. Não há texto genérico de dica.

---

## 2. Telas

### 2.1 Navegação e estrutura

- **Rota própria** `app/analises/page.tsx`, com o mesmo guard de `app/page.tsx` (`owner()` e redirecionamento para `/login`).
- **Shell compartilhado.** Extraio de `dashboard.tsx` a sidebar, a topbar e o provider de `HiddenValues` para `components/app-shell.tsx`.
- **Sidebar.** O item novo "Análises" (ícone `ChartNoAxesColumn` do lucide) vem logo abaixo de "Visão geral". Na rota `/analises`, os itens antigos viram links `/?view=…`, que `app/page.tsx` já aceita.
- **Estado na URL:** `/analises?secao=categorias&periodo=6m&conta=…`. Recarregar e voltar mantêm a tela.
- **Cabeçalho da página**, de cima para baixo:
  1. Título "Análises" e o período legível ("Mai – Out 2026").
  2. **Subnavegação segmentada** com 6 páginas: Resumo · Fluxo de caixa · Categorias · Faturas · Instituições · Hábitos. No celular, rola na horizontal.
  3. À direita, na mesma linha: **período** (Este mês, Mês anterior, 3M, 6M, 12M, Este ano, Personalizado com o `DatePicker` atual), **comparar com o período anterior** (toggle, ligado por padrão) e **conta ou cartão** (Select atual, com "Todas").
- **Grade:** 12 colunas no desktop. Faixa de KPIs (no máximo 4), gráfico principal em 8 colunas com painel lateral em 4 colunas, e uma linha secundária em 6 + 6. No celular, tudo vira uma coluna, com os KPIs em 2 × 2.
- **Clique em gráfico:** em qualquer barra ou fatia, abre o detalhe em painel lateral (Sheet), com a série mensal, os estabelecimentos e os lançamentos. Cada lançamento tem o seletor de categoria (1.3).

### 2.2 Páginas

**Resumo**: "como estou neste período"
- KPIs: Receitas, Despesas, Resultado e Taxa de poupança, cada um com a variação contra o período anterior.
- Principal: **ritmo do mês**, em linha acumulada (mês atual, mês anterior tracejado, média de 3 meses em faixa), com a projeção em ponto final.
- Lateral: **Destaques** (1.7).
- Secundária: barras de **Receita × Despesa dos últimos 12 meses**, com o resultado em linha, e **Top 5 grupos** em barras horizontais com a variação.

**Fluxo de caixa**: "de onde vem e para onde vai"
- KPIs: Entradas, Saídas, Resultado e Rendimentos.
- Principal: **cascata do período**, de Receitas por grupo de despesa até a Sobra.
- Lateral: **entradas por origem** (salário, Pix recebido, rendimentos, outras) e **saídas por forma de pagamento** (cartão, Pix, débito).
- Secundária: **saldo reconstruído das contas** em linha (mascarável) e **calendário de gastos** (heatmap por dia).

**Categorias**: "onde gasto"
- Principal: **ranking de grupos e categorias** em barras horizontais, com o valor, a % do total, a variação e uma sparkline de 6 meses. Os grupos expandem para as categorias.
- Lateral: **essencial × estilo de vida** e **fixos × variáveis**, cada um em barra empilhada de 100% com o valor.
- Secundária: **evolução mensal empilhada por grupo** (12 meses) e o **ticket médio por categoria**.
- O seletor "Incluir Pix a terceiros" mostra os totais com e sem o grupo.

**Faturas**: "o que o cartão faz com meu dinheiro"
- Seletor de cartão no cabeçalho. Modo **por fatura**: escolher uma fatura oficial ou a aberta troca o período pelo ciclo dela.
- KPIs: Fatura aberta (estimada), Média das últimas 6, Uso do limite e Parcelas do próximo mês (todos mascaráveis).
- Principal: **histórico das faturas por vencimento**, com as oficiais em barra sólida e a aberta em barra hachurada.
- Lateral: **composição da fatura selecionada**: à vista, parcelas, IOF e outra moeda, e estornos.
- Secundária: **comprometido futuro** (parcelas por mês nos próximos 12 meses, separando importadas de previstas) e **comparar duas faturas por categoria**.

**Instituições**: "como uso cada banco"
- Tabela-resumo por conexão (o nome próprio do REQ-020) e por conta ou cartão: entradas, saídas, despesas, número de lançamentos e participação no total.
- Gráfico de **despesa mensal por instituição** em barras agrupadas.
- **Saldo reconstruído por conta**, mascarável.
- **Formas de pagamento por instituição.**

**Hábitos**: "o que dá para cortar"
- **Assinaturas e recorrentes** (1.6) em lista com o custo mensal e anual, as marcas "nova" e "mudou de preço" e o total anual no topo.
- **Top estabelecimentos**: gasto, frequência, ticket médio e variação.
- **Dia da semana × faixa de horário** em heatmap. Sem horário, só o dia da semana.
- **Compras pequenas**: quantidade, soma e as mais frequentes.

### 2.3 Direção visual

- **Base:** a do painel atual, preto, branco e verde (`app/globals.css`), só no tema claro, como hoje.
- **Estilo:** editorial e contido.
- **Números:** grandes em `font-variant-numeric: tabular-nums`, com rótulos pequenos em `--muted`.
- **Cor:** verde só para receita e resultado positivo. Despesa em quase-preto. Vermelho (`--destructive`) só para piora relevante.
- **Grupos:** uma paleta sequencial de verdes e cinzas validada pela skill `dataviz` antes de escrever os gráficos. Sem arco-íris.
- **Superfícies:** cards sem sombra pesada, com divisórias finas (`--border`).
- **Estados:** hover e foco visíveis nos segmentos e nas barras.
- **Sem dados:** o card diz o que falta, por exemplo "Sem receita no período". Nunca aparece um gráfico vazio.

---

## 3. Arquitetura

**Dependências**
- `recharts` (versão 3, compatível com React 19).
- O componente `chart` do shadcn (`components/ui/chart.tsx`), que segue o estilo new-york do `components.json`.
- `sheet` do shadcn, para o detalhe.

**Backend (lógica pura, testável com `node --test`)**

| Arquivo | Conteúdo |
| --- | --- |
| `lib/analytics/classify.mjs` | Tipo analítico, com precedência das escolhas do usuário |
| `lib/analytics/categories.mjs` | Mapa PT, grupos e natureza |
| `lib/analytics/merchant.mjs` | `merchant_key` |
| `lib/analytics/aggregate.mjs` | Totais por mês, grupo, categoria, instituição, forma de pagamento e dia; período anterior; ritmo; projeção |
| `lib/analytics/balance-history.mjs` | Saldo reconstruído |
| `lib/analytics/recurring.mjs` | Recorrências e assinaturas |
| `lib/analytics/insights.mjs` | Destaques |
| `lib/analytics/index.mjs` | `analytics(db, owner, {from, to, compare, account})`, que monta a resposta reaproveitando `installmentSchedule`, `openBill` e `cardCycle` |

**Banco e API**
- `lib/db.mjs` ganha a migração das duas tabelas, as funções `setCategory`, `setCategoryRule` e `categoryChoices(db, owner)`, e as escolhas do usuário entram no retorno de `dashboard()`, para Gastos e Extrato.
- `app/api/analytics/route.ts`: `GET`, com o mesmo padrão de `app/api/dashboard/route.ts`, ou seja, validação manual, `owner()` e `Cache-Control: private, no-store`. Aceita até 731 dias, para comparar 12 meses com os 12 anteriores.
- `app/api/connections/route.ts` ganha as ações `categorize` e `categorize-rule`.

**Frontend**
- `components/app-shell.tsx`: shell extraído.
- `components/analytics/`:
  - `analytics-page.tsx`: container, busca e estado da URL;
  - `period-bar.tsx`;
  - `kpi-tile.tsx`;
  - um arquivo por página (`summary.tsx`, `cashflow.tsx`, `categories.tsx`, `bills.tsx`, `institutions.tsx`, `habits.tsx`);
  - `detail-sheet.tsx`;
  - `category-picker.tsx`.
- Cada arquivo fica com menos de 400 linhas.

**Gastos e Extrato**
- `expense` (`dashboard.tsx:38`) e `SpendList` passam a usar `classify` e o nome em português.
- O `Ledger` ganha o `category-picker` na célula de categoria.

---

## 4. Tarefas (SPEC-0003)

1. **T001: spec e registros.** Criar `Specs/features/SPEC-0003--analises/` (spec, plan, tasks, verification) com REQ-001 a REQ-010, ligados às seções acima. Atualizar `Specs/INDEX.md` e `Specs/STATE.md`. Registrar a decisão de classificação em `Context/branches/produto/decisions/`.
2. **T002: classificação, categorias e merchant.** Testes primeiro, com dados sintéticos: pagamento de fatura na conta, transferência própria, estorno no cartão, Pix sem categoria, categoria desconhecida e outra moeda.
3. **T003: correção de Gastos.** Aplicar `classify` em `dashboard.tsx` e conferir que o total de Gastos com "todas as contas" deixa de somar os pagamentos de fatura.
4. **T004: categoria do usuário.** Migração, funções no `db.mjs`, as novas ações, `category-picker` no Extrato e no detalhe, e testes com `openDatabase(":memory:")`: dono errado, categoria inválida, vazio remove, reimportação preserva.
5. **T005: agregações, saldo reconstruído, recorrências e destaques**, com testes.
6. **T006: rota `/api/analytics`**, com testes de validação, 401 e limite de dias.
7. **T007: shell extraído e rota `/analises`**, com período e subnavegação.
8. **T008: páginas Resumo e Fluxo de caixa.**
9. **T009: páginas Categorias e Faturas.**
10. **T010: páginas Instituições e Hábitos.**
11. **T011: verificação** no navegador e registro em `verification.md`.

---

## 5. Verificação

- **Testes:** `npm test` em `apps/web`, com os 42 atuais e os novos. A lógica nova deve ter pelo menos 80% de cobertura, medida com `node --test --experimental-test-coverage`.
- **Build:** `npm run build`, com o servidor parado antes, conforme `Context/global/notes/NTE-20261109-ambiente-local.md`.
- **Painel local** com os dados reais, `next start` na porta 3001:
  - Conferir no SQLite, só por consulta de leitura, que as Despesas de um mês nas Análises são iguais à soma dos tipos `despesa − estorno`, e que Gastos mostra o mesmo valor.
  - Recategorizar um Pix, ver o Pix mudar de grupo, reimportar a conexão e confirmar que a escolha ficou.
  - Ocultar valores e checar que saldos, faturas e limites somem dos gráficos, e despesas não.
  - Passar pelas 6 páginas, o período, a comparação, o modo por fatura e o detalhe lateral.
  - Larguras de 375, 768 e 1440 px, sem rolagem horizontal na página.
  - Console sem erros.
- **Registros:** os valores reais não vão para `verification.md` nem para os commits. A evidência registra só se o valor conferiu ou não. Conferir segredos antes de cada commit, porque o repositório é público.
