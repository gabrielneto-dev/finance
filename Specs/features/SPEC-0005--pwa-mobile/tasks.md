# Tarefas do Finance no celular

| ID | Objetivo | Requisitos | Dependências | Estado | Critério de conclusão |
| --- | --- | --- | --- | --- | --- |
| SPEC-0005-T001 | Auditoria, escolha da abordagem e plano | Todos | — | completed | Fase 1 (auditoria) e Fase 2 (PWA escolhida pelo usuário em 2026-11-11) relatadas. [Plano](../../../docs/mobile-plan.md) v1 (PWA) aprovado em 2026-11-11. No mesmo dia, o usuário pediu app React Native. O plano v2 aguarda aprovação |
| SPEC-0005-T002 | Marco 0: backend público, Proxy de sessão e conta reconectada | REQ-001, REQ-002 | SPEC-0005-T001 | in_progress | Código pronto em 2026-11-11: `proxy.ts` renova a sessão (e owner() não repete a renovação com o Supabase fora do ar), `migrate-owner` com backup e testes, Dockerfile copiando `lib/` inteira e `FINANCE_ENV_FILE` no Compose. Deploy pronto e testado em Docker local em 2026-11-11: `.env.production.example`, `deploy/deploy.sh` (confere o ambiente, gera, sobe e espera a saúde) e `deploy/backup.sh`. Falta a parte do usuário no [roteiro](../../../docs/marco0-deploy.md): Supabase, `.env.production` no servidor de casa, túnel, webhooks e reconexão da conta |
| SPEC-0005-T003 | Marco 1: app Expo com login e Visão geral no celular | REQ-003, REQ-004 | Plano v2 aprovado | pending | Aceite do Marco 1 no plano v2. Pode começar antes de o Marco 0 terminar, pela prévia web com o backend local |
| SPEC-0005-T004 | Marco 2: push de transferência por FCM | REQ-005, REQ-006 | SPEC-0005-T002, SPEC-0005-T003 | pending | Aceite do Marco 2, com 7 dias de observação |
| SPEC-0005-T005 | Marco 3: telas essenciais | REQ-007 | SPEC-0005-T003 | pending | Aceite do Marco 3 no plano v2 |
| SPEC-0005-T006 | Marco 4: conectar banco pelo app | REQ-008 | SPEC-0005-T002, SPEC-0005-T003 | pending | Aceite do Marco 4. Destrava a SPEC-0004-T012 |
| SPEC-0005-T007 | Marco 5: APK de uso diário | REQ-009 | SPEC-0005-T005 | pending | Aceite do Marco 5 no plano v2 |
