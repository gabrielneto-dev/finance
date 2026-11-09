---
id: "CTX-RSK-20261108-isolamento"
type: "risk"
title: "Exposição de dados entre usuários"
branch: "global"
tags: ["seguranca", "pluggy"]
status: "open"
created_at: "2026-11-08"
updated_at: "2026-11-08"
related: ["CTX-RES-20261108-fluxo-pluggy"]
---

# Exposição de dados entre usuários

Aceitar IDs de Item, conta ou transação sem validar o vínculo no servidor pode expor dados financeiros. Vincular cada Item ao usuário autenticado, escopar leitura e atualização por proprietário e testar acesso cruzado, callbacks adulterados e vazamento em logs. A entrega com dados reais depende da verificação desses controles.

A [verificação web local](../../../Specs/features/SPEC-0001--mvp-finance/verification.md#painel-local-com-a-conexão-real) cobre sessão, revogação e vínculo do Item autorizado. A homologação pública do callback e os critérios de acesso nas duas plataformas continuam pendentes.
