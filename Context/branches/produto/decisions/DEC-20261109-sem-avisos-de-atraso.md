---
id: "CTX-DEC-20261109-sem-avisos-de-atraso"
type: "decision"
title: "Painel sem avisos de lançamentos a caminho"
branch: "produto"
tags: ["escopo"]
status: "active"
created_at: "2026-11-09"
updated_at: "2026-11-09"
source_ids: []
related: ["CTX-RES-20261109-sincronizacao-meupluggy", "CTX-DEC-20261109-atualizacao-conexoes"]
---

# Painel sem avisos de lançamentos a caminho

**Contexto.** Dias recentes aparecem vazios porque o banco envia compras do cartão com atraso. Em 2026-11-09, Extrato e Gastos ganharam um aviso por conta com o último lançamento recebido, o atraso habitual e a próxima sincronização (REQ-015).

**Decisão.** O usuário considerou o aviso poluição visual e pediu a remoção no mesmo dia. O REQ-015 foi descartado, e o código e os testes do aviso foram retirados.

**Consequências.** Não adicione avisos informativos persistentes ao painel para explicar atraso ou atualização de dados sem perguntar antes. Explique na conversa ou melhore o fluxo de dados. As medições de atraso continuam em [CTX-RES-20261109-sincronizacao-meupluggy](../../pluggy/research/RES-20261109-sincronizacao-meupluggy.md).

Registro operacional em [verificação](../../../../Specs/features/SPEC-0001--mvp-finance/verification.md#lançamentos-ainda-a-caminho).
