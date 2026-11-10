---
id: "SPEC-0002"
title: "Atualização mais frequente de transações, extrato e cartões"
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
priority: "next"
dependencies: ["SPEC-0001"]
context_refs: ["CTX-RES-20261110-frequencia-atualizacao", "CTX-RES-20261109-sincronizacao-meupluggy", "CTX-DEC-20261109-atualizacao-conexoes", "CTX-DEC-20261109-sem-avisos-de-atraso", "CTX-RSK-20261109-repositorio-publico"]
supersedes: null
superseded_by: null
---

# Atualização mais frequente de transações, extrato e cartões

## Objetivo

Fazer os dados novos da Pluggy chegarem ao painel o quanto antes. Depois, avaliar se vale aumentar a frequência com que a Pluggy consulta o banco. A [pesquisa](../../../Context/branches/pluggy/research/RES-20261110-frequencia-atualizacao.md) separa as duas demoras:

- **Pluggy → Finance:** resolvível sem custo.
- **Banco → Pluggy:** uma vez por dia no MeuPluggy. Só melhora com uma aplicação de produção.

Classificação Full nas fases 1 e 2. A fase 3 é Critical, porque troca a conexão bancária e depende de contrato.

## Requisitos e aceitação

| ID | Fase | Comportamento | Critério de aceitação |
| --- | --- | --- | --- |
| REQ-001 | 1 | Detectar sozinho a sincronização da Pluggy | Com o worker rodando e sem webhook, uma sincronização nova da Pluggy chega ao SQLite em até uma hora. Perto do horário previsto (`nextAutoSyncAt`), chega em até 10 minutos. Depois do atalho para o Meu Pluggy, chega em até 2 minutos. Se `lastUpdatedAt` não mudou, nada é reimportado. Conexões inativas não são consultadas. O worker nunca envia `PATCH` nessa rotina. Falhas 429 e 5xx são repetidas sem travar a fila. |
| REQ-002 | 1 | Mostrar a situação da sincronização em Conexões | Cada conexão mostra a última sincronização da Pluggy (`lastUpdatedAt`) e, quando houver, a próxima prevista (`nextAutoSyncAt`). Conexões MeuPluggy têm um atalho para atualizar no app Meu Pluggy. Não há aviso de lançamento atrasado, conforme a [decisão](../../../Context/branches/produto/decisions/DEC-20261109-sem-avisos-de-atraso.md). |
| REQ-003 | 2 | Receber webhooks reais da Pluggy | Com uma origem HTTPS pública e o segredo configurado, `item/updated` e `transactions/*` chegam ao receptor e são processados em menos de um minuto. A consulta da REQ-001 continua como reconciliação. O painel exposto exige autenticação. |
| REQ-004 | 3 | Aumentar a frequência de consulta ao banco | Só depois da decisão do usuário e do contrato com a Pluggy. Um Item Open Finance direto, em aplicação de produção, sincroniza até 4 vezes por dia. O Atualizar envia `PATCH` respeitando o intervalo mínimo da aplicação. O Item MeuPluggy da mesma instituição é desvinculado sem perder o histórico, e o painel mostra quando um produto atingiu o limite mensal (`423`). |

## Fora do escopo

- Forçar atualização de Items MeuPluggy pela API, que a documentação proíbe.
- Manter mais de um Item por banco, o que consome a cota mensal mais cedo.
- Avisos de atraso de lançamento.

## Questões abertas

- Fase 2: expor o Finance por túnel HTTPS ou por hospedagem? A homologação pública foi adiada pelo usuário.
- Fase 3: preço, plano e agenda aceitos pela Pluggy. Falta saber também se a cota do Open Finance é dividida entre o Item original do Meu Pluggy e um Item direto do mesmo CPF.

[Plano](plan.md) · [Tarefas](tasks.md)
