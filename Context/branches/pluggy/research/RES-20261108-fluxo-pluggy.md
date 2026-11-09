---
id: "CTX-RES-20261108-fluxo-pluggy"
type: "research"
title: "Fluxo de conexão, sandbox e OAuth na Pluggy"
branch: "pluggy"
tags: ["pluggy", "sandbox", "plataformas"]
status: "active"
created_at: "2026-11-08"
updated_at: "2026-11-08"
confidence: "high"
source_ids: ["CTX-SRC-20261108-documentacao-pluggy"]
related: ["CTX-QUE-20261108-acesso-sandbox"]
---

# Fluxo de conexão, sandbox e OAuth na Pluggy

Consulta documental em 2026-11-08. A Pluggy documenta o fluxo em que o backend obtém uma chave com `POST /auth`, emite um token restrito com `POST /connect_token` e consulta os dados do Item. Web e mobile usam o widget para a conexão. O identificador interno pode seguir em `options.clientUserId`. O backend deve conferir o vínculo ao aceitar um Item enviado pelo cliente.

O sandbox usa conectores com dados sintéticos e cobre também falhas. Para conectores com OAuth, a documentação distingue retorno HTTPS na web e retorno por deep link em apps nativos. A prova de integração deve exercitar o retorno nas plataformas escolhidas.

## Cobertura verificada no MVP web

A [verificação](../../../../Specs/features/SPEC-0001--mvp-finance/verification.md#integração-real-e-teste-de-webhook) registra a importação de um Item autorizado com a API real, além da validação sintética do receptor e do worker. O widget abriu após a emissão de token, mas ainda é necessário exercitar o callback após consentimento e a entrega HTTPS pelo provedor.

O [contrato de parcelas](../../../../Specs/features/SPEC-0001--mvp-finance/pluggy-data.md#parcelas-de-cartão) distingue lançamentos retornados pela Pluggy e metadados de compra. A consulta autorizada não encontrou lançamentos de ciclos futuros; esse resultado vale para a conexão verificada, e a cobertura pode variar por conector.
