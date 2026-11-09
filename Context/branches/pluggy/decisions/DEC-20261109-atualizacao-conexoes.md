---
id: "CTX-DEC-20261109-atualizacao-conexoes"
type: "decision"
title: "Atualizar conexões e tratar falhas da Pluggy no worker"
branch: "pluggy"
tags: ["pluggy"]
status: "active"
created_at: "2026-11-09"
updated_at: "2026-11-09"
source_ids: ["CTX-SRC-20261108-documentacao-pluggy"]
related: ["CTX-RES-20261109-sincronizacao-meupluggy", "CTX-DEC-20261108-acesso-finance"]
---

# Atualizar conexões e tratar falhas da Pluggy no worker

**Contexto.** O botão Atualizar enviava `PATCH /items/{id}`. Conexões MeuPluggy recusam esse pedido com HTTP 400. O worker tratava qualquer falha como temporária, repetia a tarefa sem fim e não registrava o motivo. Enquanto isso, novos pedidos eram ignorados.

**Decisão.** O Atualizar tenta o `PATCH`. Se a Pluggy recusar com HTTP 400, o worker reimporta os dados que ela já sincronizou. Respostas 4xx encerram a tarefa, exceto 401, 408, 425 e 429. Falhas 5xx e de rede continuam com novas tentativas. O worker registra o status e a mensagem curta da Pluggy, sem corpo completo nem dados financeiros.

**Consequências.** O Atualizar não traz dados novos do banco para conexões MeuPluggy. Ele traz o que a Pluggy já tem. Para antecipar a sincronização, atualize primeiro no app Meu Pluggy e depois no Finance, com o worker rodando. Sem webhook público, o painel local não fica sabendo sozinho da sincronização diária.

**Opções descartadas.** Forçar a atualização pela API ou pelo widget, que a documentação impede para o Item proxy. Aviso de atraso no painel, descartado em [CTX-DEC-20261109-sem-avisos-de-atraso](../../produto/decisions/DEC-20261109-sem-avisos-de-atraso.md).

Implementação em `apps/web/lib/sync.mjs` (`processJob`) e `apps/web/lib/pluggy.mjs` (`PluggyError.detail`). Evidência em [verificação](../../../../Specs/features/SPEC-0001--mvp-finance/verification.md#atualização-meupluggy).
