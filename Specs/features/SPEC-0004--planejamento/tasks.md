# Tarefas do planejamento financeiro

| ID | Objetivo | Requisitos | Dependências | Estado | Critério de conclusão |
| --- | --- | --- | --- | --- | --- |
| SPEC-0004-T001 | Spec, plano, pesquisa e decisões | Todos | — | completed | SPEC-0004, pesquisa dos frameworks, decisão e checkpoint registrados. |
| SPEC-0004-T002 | Negócio e aportes na classificação | REQ-001 | SPEC-0004-T001 | pending | Categorias de Negócio, tipos `negocio_receita` e `negocio_custo`, escolhas "Aporte em investimento" e "Retirada do negócio", `account_settings` e Análises com `business` e lucro à parte. Testes passando. |
| SPEC-0004-T003 | Tabelas, `store.mjs`, `validate.mjs` e ações do POST | REQ-002, REQ-004, REQ-005, REQ-007, REQ-010 | SPEC-0004-T001 | pending | Migrações idempotentes e ações de escrita com Origin, sessão, dono e valores validados. Testes de dono, valores inválidos e escopo. |
| SPEC-0004-T004 | Renda prevista, caixinhas, mês e acúmulo | REQ-002, REQ-003 | SPEC-0004-T002, SPEC-0004-T003 | pending | Sugestão pelo Plano Consciente, cálculo do mês, acúmulo e ajuste do mês. Testes. |
| SPEC-0004-T005 | Metas, reserva e independência | REQ-004 | SPEC-0004-T003 | pending | Aporte necessário, data prevista com rendimento e alvos da reserva e da regra dos 4%. Testes. |
| SPEC-0004-T006 | Projeção, cenários, ajustes e tendências | REQ-005, REQ-006 | SPEC-0004-T004, SPEC-0004-T005 | pending | Cenário base e ajustado, ajustes ligáveis e tendências por regressão. Testes. |
| SPEC-0004-T007 | Patrimônio e investimentos manuais | REQ-007 | SPEC-0004-T003 | pending | Cadastro, snapshots, alocação, aportes, taxa de investimento e meses de reserva. Testes. |
| SPEC-0004-T008 | Resultado do negócio e Profit First | REQ-008 | SPEC-0004-T002 | pending | Vendas, custos, lucro, margem, ticket, retiradas e divisão sugerida. Testes. |
| SPEC-0004-T009 | API, rota `/planejamento` e páginas Mês e Caixinhas | REQ-002, REQ-003, REQ-010 | SPEC-0004-T004 | pending | Páginas conferidas no navegador com o painel real. |
| SPEC-0004-T010 | Páginas Metas e Projeções | REQ-004, REQ-005, REQ-006 | SPEC-0004-T006, SPEC-0004-T009 | pending | Páginas conferidas no navegador. |
| SPEC-0004-T011 | Páginas Patrimônio e Negócio | REQ-007, REQ-008 | SPEC-0004-T007, SPEC-0004-T008, SPEC-0004-T009 | pending | Páginas conferidas no navegador. |
| SPEC-0004-T012 | Investimentos pela Pluggy | REQ-009 | SPEC-0004-T007. Reautorização da conexão MeuPluggy pelo usuário. | pending | Produto pedido no Connect Token, importação de `/investments` e conferência com o Item real. Se não houver dado, fica registrado e o manual continua. |
| SPEC-0004-T013 | Verificação final | Todos | SPEC-0004-T009 a T012 | pending | Testes, build e painel real registrados em [verificação](verification.md), sem valores reais. |
