# Verificação das análises financeiras

Os registros dizem só se o valor conferiu. Valores reais ficam fora deste arquivo.

## Testes automatizados

Todos os requisitos · 2026-11-10 · PASS.

- `npm test` em `apps/web`: 73 testes passam, contra 42 antes da SPEC-0003.
- Arquivos novos:
  - `test/analytics-classify.test.mjs`: classificação, categorias e estabelecimento (REQ-001, REQ-002).
  - `test/analytics-choices.test.mjs`: escolha do usuário, dono, conexão inativa, remoção, reimportação e escopo das análises (REQ-004).
  - `test/analytics-aggregate.test.mjs`: totais, grupos, ritmo, calendário, formas de pagamento, faixas de horário, compras pequenas, estabelecimentos, instituições, saldo reconstruído, recorrências, faturas e destaques (REQ-006 a REQ-010).
  - `test/analytics-query.test.mjs` e `test/analytics-periods.test.mjs`: validação da rota e períodos (REQ-005).
- `test/open-bill.test.mjs` ganhou o caso do pagamento lançado no cartão.
- Cobertura de linhas dos módulos em `lib/analytics/`: de 96% a 100%, medida com `--experimental-test-coverage`.
- Checagem de tipos e `npm run build` passaram.

## Painel local com as conexões reais

REQ-003 a REQ-010 · 2026-11-10 · PASS.

- **Coerência interna** (cópia do banco no scratchpad): a soma dos grupos, a natureza, fixos com variáveis, o mês no gráfico de 12 meses, o calendário e as instituições batem com as despesas do período.
- **Gastos e Análises:** para o mês corrente, o total de Gastos com todas as contas é igual às Despesas das Análises. Pagamento de fatura e transferências entre contas próprias saíram do total.
- **Categoria do usuário:** um lançamento foi trocado de categoria pelo detalhe lateral. Ele mudou de grupo nos totais, e o menu abriu por cima do painel. Depois foi restaurado, e as tabelas de escolhas voltaram a ficar vazias. A reimportação está coberta por teste.
- **Valores ocultos:** fatura aberta, média, uso e limite ficaram mascarados, e o eixo do histórico de faturas sumiu. Parcelas e composição continuaram visíveis.
- **Navegação:** as seis páginas, o período, a comparação, a conta e o detalhe lateral foram conferidos. A URL guarda página e período.
- **Largura de 375 px:** nenhuma página rola na horizontal.
- **Erros:** nenhum erro novo no console nem no log do servidor.
- **API:** `/api/analytics` responde 401 sem sessão e 400 para período invertido.

## Correção encontrada na verificação

Fatura aberta negativa · 2026-11-10 · PASS após correção.

- **Problema:** um pagamento de fatura chegou ao cartão como crédito pendente com a categoria `Transfer - Internal`. `openBill` o tratava como estorno, e a fatura aberta ficava negativa, também na aba Faturas.
- **Correção:** a fatura aberta agora ignora qualquer lançamento neutro da classificação, seja pagamento ou transferência entre contas próprias. Conferido no painel: a fatura aberta voltou a ser positiva e igual à soma da composição.

## Limites

- O saldo reconstruído depende do saldo atual informado e dos lançamentos efetivados. Um lançamento ausente na Pluggy desloca a curva.
- Recorrências exigem três meses de cobrança, então uma assinatura com menos histórico ainda não aparece.
