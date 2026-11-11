# Tarefas das análises financeiras

| ID | Objetivo | Requisitos | Dependências | Estado | Critério de conclusão |
| --- | --- | --- | --- | --- | --- |
| SPEC-0003-T001 | Spec, plano, tarefas e decisão | Todos | — | completed | Arquivos da SPEC-0003 e decisão de classificação registrados. |
| SPEC-0003-T002 | Classificação, categorias e estabelecimento | REQ-001, REQ-002 | SPEC-0003-T001 | completed | `lib/analytics/classify.mjs`, `categories.mjs` e `merchant.mjs` com testes sintéticos passando. |
| SPEC-0003-T003 | Corrigir Gastos | REQ-003 | SPEC-0003-T002 | completed | Gastos usa a classificação e o total deixa de somar pagamentos de fatura e transferências próprias. |
| SPEC-0003-T004 | Categoria do usuário | REQ-004 | SPEC-0003-T002 | completed | Tabelas, ações `categorize` e `categorize-rule`, seletor no Extrato e testes de dono, categoria inválida, remoção e reimportação. |
| SPEC-0003-T005 | Agregações, saldo, recorrências e destaques | REQ-006 a REQ-010 | SPEC-0003-T002 | completed | Funções puras com testes sintéticos. |
| SPEC-0003-T006 | Rota de análises | REQ-005 | SPEC-0003-T005 | completed | `GET /api/analytics` com validação, 401 e limite de 731 dias testados. |
| SPEC-0003-T007 | Shell e rota `/analises` | REQ-005 | SPEC-0003-T006 | completed | Shell compartilhado, item na sidebar, período, comparação e conta na URL. |
| SPEC-0003-T008 | Páginas Resumo e Fluxo de caixa | REQ-006, REQ-007 | SPEC-0003-T007 | completed | Páginas conferidas no navegador. |
| SPEC-0003-T009 | Páginas Categorias e Faturas | REQ-008, REQ-009 | SPEC-0003-T007 | completed | Páginas conferidas no navegador. |
| SPEC-0003-T010 | Páginas Instituições e Hábitos | REQ-009, REQ-010 | SPEC-0003-T007 | completed | Páginas conferidas no navegador. |
| SPEC-0003-T011 | Verificação final | Todos | SPEC-0003-T003 a T010 | completed | Testes, build e conferência no painel local registrados em [verificação](verification.md), sem valores reais. |
