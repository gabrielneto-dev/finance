# Tarefas do Finance no celular

| ID | Objetivo | Requisitos | Dependências | Estado | Critério de conclusão |
| --- | --- | --- | --- | --- | --- |
| SPEC-0005-T001 | Auditoria, escolha da abordagem e plano | Todos | — | completed | Fase 1 (auditoria) e Fase 2 (PWA escolhida pelo usuário em 2026-11-11) relatadas. [Plano](../../../docs/mobile-plan.md) aprovado pelo usuário em 2026-11-11 |
| SPEC-0005-T002 | Marco 0: backend público, Proxy de sessão e migração do dono | REQ-001, REQ-002 | SPEC-0005-T001 | in_progress | Código pronto em 2026-11-11: `proxy.ts` renova a sessão (e owner() não repete a renovação com o Supabase fora do ar), `migrate-owner` com backup e testes, Dockerfile copiando `lib/` inteira e `FINANCE_ENV_FILE` no Compose. Falta a parte operacional do [roteiro](../../../docs/marco0-deploy.md), que depende do usuário (projeto Supabase, `.env.production`, autorização do `--apply`, túnel) das perguntas 2 e 3 e dos detalhes do servidor de casa, que será a produção |
| SPEC-0005-T003 | Marco 1: PWA instalável com Visão geral real | REQ-003, REQ-004 | SPEC-0005-T002 | pending | Aceite do Marco 1 no plano |
| SPEC-0005-T004 | Marco 2: push de transferência | REQ-005, REQ-006 | SPEC-0005-T003 | pending | Aceite do Marco 2, com 7 dias de observação |
| SPEC-0005-T005 | Marco 3: UX mobile das telas essenciais | REQ-007 | SPEC-0005-T003 | pending | Aceite do Marco 3 no plano |
| SPEC-0005-T006 | Marco 4: conexão de banco pelo celular | REQ-008 | SPEC-0005-T003 | pending | Aceite do Marco 4. Destrava a SPEC-0004-T012 |
