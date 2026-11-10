---
id: "CTX-RES-20261110-webhooks-endereco-real"
type: "research"
title: "Webhooks da Pluggy perdidos no endereço real do Finance"
branch: "pluggy"
tags: ["pluggy", "seguranca"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
confidence: "verified"
source_ids: ["CTX-SRC-20261108-documentacao-pluggy"]
related: ["CTX-DEC-20261110-endereco-publico", "CTX-RES-20261110-frequencia-atualizacao", "CTX-DEC-20261109-atualizacao-conexoes"]
---

# Webhooks da Pluggy perdidos no endereço real do Finance

**Método.** Em 2026-11-10, o usuário mostrou a lista de eventos do Dashboard da Pluggy. Os webhooks cadastrados foram lidos com `GET /webhooks`, sem alterações e sem expor cabeçalhos. O domínio foi testado só com GET. O código do receptor foi lido em `apps/web/app/api/webhooks/pluggy/route.ts` e `apps/web/lib/webhook.mjs`.

**Cadastros encontrados.** São três webhooks no nível da aplicação, todos com evento `all` e nenhum com cabeçalho:

- `https://finance.vetracompany.com.br/connections/pluggy/callback`;
- dois endereços do n8n do usuário, o de produção e o `webhook-test`.

**Por que a Pluggy marcou como perdidos.**

1. O domínio responde HTTP 530 com `error code: 1033` em qualquer caminho. É o erro da Cloudflare quando o túnel `cloudflared` não está conectado.
2. O receptor do Finance fica em `/api/webhooks/pluggy`. O caminho `/connections/pluggy/callback` não existe.
3. O receptor exige o cabeçalho `X-Finance-Webhook-Secret` igual a `PLUGGY_WEBHOOK_SECRET` e responde 401 sem ele.

**Comportamento do receptor.** Eventos fora da lista do Finance, como `connector/status_updated` e `item/login_succeeded`, recebem 204 e são ignorados. Os eventos da lista entram na fila do worker. Se o Item não pertence ao Finance, o worker consulta a Pluggy e encerra a tarefa sem vincular nada.

**Origem dos eventos.** Com cadastro `all`, todo evento de qualquer conexão da aplicação vai para todos os destinos. Os eventos observados vinham de outras conexões da aplicação, não da conexão usada pelo Finance. Os destinos do n8n ficaram pendentes, e o `webhook-test` do n8n só recebe com o modo de teste ativo no editor.

**Limitações.** A lista do Dashboard mostrava só os eventos recentes. O status HTTP de cada tentativa não foi lido.
