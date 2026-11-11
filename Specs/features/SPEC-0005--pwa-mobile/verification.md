# Verificação

| Requisito | Método | Data | Resultado | Evidência e limites |
| --- | --- | --- | --- | --- |
| REQ-001 | `npm run typecheck`, `npm test` e `npm run build` em `apps/web` | 2026-11-11 | PASS | Typecheck sem erros, 98 testes (94 anteriores e 4 novos da migração), build com "Proxy (Middleware)" |
| REQ-001 | Modo de chave local depois do Proxy: `next start` em 127.0.0.1:3001 com a sessão local existente | 2026-11-11 | PASS | `/api/health` 200, `/api/dashboard` 200, `/analises` 200 e `/planejamento` 200, com o painel carregado. Nenhum valor foi registrado |
| REQ-001 | Modo Supabase simulado, com URL inacessível e banco sintético, sem sessão | 2026-11-11 | PASS | `/` redireciona ao login, `/login` 200, `/api/dashboard` 401 e POST `/api/planning` 401, todos em menos de 110 ms |
| REQ-001 | Supabase fora do ar com sessão vencida (cookie sintético) | 2026-11-11 | PASS com limite | Resposta 401 ou login, sem 500. A renovação passa a acontecer só no Proxy: os erros saem só dele, e não mais também da página. A resposta ainda leva cerca de 45 s por causa das novas tentativas da biblioteca `@supabase/supabase-js`. É uma limitação conhecida, só durante indisponibilidade do Supabase |
| REQ-001 | Renovação real do token, sessão por 2 h e 1 dia, login pelo 4G e logout | — | BLOCKED | Exige o projeto Supabase e a publicação ([roteiro](../../../docs/marco0-deploy.md), passos 1 a 8) |
| REQ-002 | `test/owner-migration.test.mjs` (dados sintéticos) | 2026-11-11 | PASS | Descobre as tabelas com dono. A simulação não altera nada. Recusa destino inválido, igual ou com dados e origem vazia. Preserva outro dono. `--apply` cria o backup antes. Segunda execução recusada |
| REQ-002 | Migração no banco real | — | NOT_RUN | Ação destrutiva: aguarda a autorização do usuário e o UID do Supabase |
| REQ-001 | Imagem Docker do worker | 2026-11-11 | PASS (simulado) | Com só `lib/*.mjs`, como no Dockerfile anterior, o worker falhava com `ERR_MODULE_NOT_FOUND` (`lib/analytics/categories.mjs`). Com `lib/` inteira, `sync`, `poll`, `db`, `webhook` e `owner-migration` carregam sem `node_modules`. O `docker build` real não rodou, porque o Docker Desktop estava parado |
| REQ-003 a REQ-008 | Aceites do item 10 do [plano](../../../docs/mobile-plan.md) | — | NOT_RUN | Marcos seguintes |
