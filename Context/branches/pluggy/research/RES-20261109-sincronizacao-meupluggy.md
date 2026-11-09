---
id: "CTX-RES-20261109-sincronizacao-meupluggy"
type: "research"
title: "Sincronização e atraso de dados na conexão MeuPluggy"
branch: "pluggy"
tags: ["pluggy"]
status: "active"
created_at: "2026-11-09"
updated_at: "2026-11-09"
confidence: "verified"
source_ids: ["CTX-SRC-20261108-documentacao-pluggy"]
related: ["CTX-DEC-20261109-atualizacao-conexoes", "CTX-DEC-20261108-ciclos-cartao", "CTX-RES-20261108-fluxo-pluggy"]
---

# Sincronização e atraso de dados na conexão MeuPluggy

**Método.** Leitura da documentação de Item, atualização de Item e parcelas de cartão em 2026-11-08. Consultas de leitura à API e análise do `createdAt` dos lançamentos no SQLite local da conexão real, sem registrar valores.

**Item proxy.** A conexão do Finance usa o conector MeuPluggy. Na aplicação ela é um Item proxy que reflete o Item original do Meu Pluggy. O original sincroniza sozinho a cada 24 horas. O proxy não faz sincronização própria e não aceita `PATCH /items/{id}`. A API responde HTTP 400 com `MeuPluggy item cant be updated`. O widget com `updateItem` também não se aplica a esse caso. Os webhooks funcionam normalmente.

**Atualização manual.** O app Meu Pluggy (meu.pluggy.ai) tem o botão Atualizar nos detalhes da conexão. Na conexão real, o fluxo terminou em menos de um minuto, sem novo consentimento. O `lastUpdatedAt` do proxy acompanhou em menos de um minuto, e a próxima sincronização automática foi reagendada para 24 horas depois. Cada pedido consome a cota mensal do Open Finance, cerca de 240 consultas de transações recentes por mês.

**Atraso de chegada.** Entre agosto e novembro de 2026, compras do cartão chegaram em geral dois a três dias depois da data do lançamento, com cauda acima de quatro dias. Lançamentos da conta bancária chegaram no mesmo dia ou no seguinte. Dias recentes vazios no painel costumam ser atraso do banco, não perda de dados. Lançamentos atrasados entram com a data original, porque a importação lê o histórico inteiro.

**`billForecastDate`.** Na conexão real, o campo repetiu o mês da data do lançamento. A fatura venceu no mês seguinte em 24 de 25 parcelas medidas. Não use o campo como mês de vencimento.

**Limitações.** As medições vêm de uma conexão Santander. Outros bancos podem ter atrasos diferentes.

Referências: [contrato de dados](../../../../Specs/features/SPEC-0001--mvp-finance/pluggy-data.md#atualização-de-conexões-meupluggy) e [Item na documentação](https://v2.docs.pluggy.ai/pt/docs/connections/item).
