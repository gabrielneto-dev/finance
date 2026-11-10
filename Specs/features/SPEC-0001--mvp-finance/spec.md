---
id: "SPEC-0001"
title: "MVP de controle financeiro"
status: "draft"
created_at: "2026-11-08"
updated_at: "2026-11-08"
priority: "first-release"
dependencies: []
context_refs: ["CTX-DEC-20261108-pluggy-web-mobile", "CTX-ASM-20261108-uso-pessoal", "CTX-QUE-20261108-publico-plataformas", "CTX-RES-20261108-fluxo-pluggy", "CTX-RSK-20261108-isolamento"]
supersedes: null
superseded_by: null
---

# MVP de controle financeiro

## Objetivo

Dar à pessoa uma forma simples de acompanhar sua movimentação financeira. A primeira entrega é web, com Android em uma etapa posterior. O painel pessoal usa Pluggy e uma paleta de preto, branco e verde.

## Requisitos propostos e aceitação

| ID | Comportamento | Critério de aceitação |
| --- | --- | --- |
| REQ-001 | Conectar uma instituição via Pluggy nos dois apps | Uma pessoa autenticada conclui o vínculo no sandbox pela web e pelo app Android. Ao cancelar ou falhar, vê um estado claro e consegue tentar de novo. |
| REQ-002 | Importar e atualizar contas e transações | Depois da conexão, contas e transações ficam disponíveis nos dois apps. Reprocessar o mesmo lote mantém uma única cópia de cada registro. Em falha parcial, preserva-se a última leitura íntegra e a atualização pode ser retomada. |
| REQ-003 | Consultar extrato e resumo simples por período | Os dois apps exibem os mesmos registros e totais para a mesma conta e período. O extrato mostra data, descrição e valor. Uma amostra sintética comprova limites de datas, precisão monetária e estado vazio. |
| REQ-004 | Controlar acesso a conexões e dados | Um usuário autenticado consegue consultar e atualizar seus dados. Tentativas de vincular ou consultar recursos alheios são rejeitadas. As credenciais privilegiadas da Pluggy permanecem no servidor. Após o provisionamento da aplicação, o backend autentica na Pluggy automaticamente, com credenciais disponibilizadas apenas ao servidor. |
| REQ-005 | Acompanhar e encerrar a conexão | A pessoa vê o estado e a última sincronização bem-sucedida. Quando a conexão exige nova autorização, recebe instrução para reconectar. Ao desvincular, o app interrompe a importação e aplica a política de exclusão definida antes da entrega. |
| REQ-006 | Filtrar o extrato e analisar gastos | A pessoa combina conta, período, data, horário e forma de pagamento. Lançamentos sem horário ou forma informada continuam visíveis e têm filtros próprios. A visão Gastos agrega as saídas efetivadas e pendentes da lista por categoria e moeda, com subtotais por situação. Testar combinação de filtros, estados vazios e lançamentos pendentes nos dois apps. |
| REQ-007 | Consultar cartões e faturas | A pessoa alterna entre cartões vinculados, identificados com número mascarado quando disponível, e vê faturas por ciclo, vencimento, valor e situação quando o conector fornece os dados. Uma estimativa do ciclo aberto aparece separada da fatura oficial. Testar cartões distintos, fatura ausente e compra parcelada quando houver vínculo. |
| REQ-008 | Avisar sobre transferências novas | Ao processar um webhook de transações, o backend registra uma notificação para cada transferência efetivada que a integração identificar como nova. Eventos repetidos e a importação do histórico inicial não duplicam avisos. O sino mantém os avisos disponíveis para leitura posterior. |
| REQ-009 | Usar conexão real existente e acompanhar webhooks na web | Fora da demonstração, o proprietário autenticado pode importar o Item autorizado na configuração do servidor sem novo consentimento enquanto ele estiver válido. A seleção é validada na Pluggy, respeita o ambiente e não permite trocar o proprietário. A tela de Conexões indica recebimento e andamento do último webhook da conexão. Reentregar um evento não duplica o trabalho nem os avisos. |
| REQ-010 | Detalhar cada instituição na aba Conexões | A instituição expandida mostra dados de sincronização e cobertura informada, contas e cartões identificados com final mascarado, campos financeiros disponíveis e atalhos para extrato e faturas do produto selecionado. Cobertura do conector e dados importados aparecem separados. Campos ausentes continuam ausentes e vínculos antigos seguem legíveis. |
| REQ-011 | Usar dados reais no Finance local com login próprio | A aplicação web serve apenas dados importados. Em loopback o proprietário pode entrar com uma chave de acesso local, importar o Item real configurado e consultar seus dados. A API rejeita pedidos sem sessão. A implantação com Supabase continua disponível. |
| REQ-012 | Importar e acompanhar parcelas de cartão | Cartões mostra por ciclo as parcelas recebidas da Pluggy e previsões das restantes quando a compra pode ser agrupada. A parcela recebida ocupa seu número na série. Previsões ficam separadas de extrato, faturas oficiais e gastos. |
| REQ-013 | Consultar parcelas em Extrato, Gastos, Cartões e Faturas | As quatro abas exibem o mesmo cronograma a partir do mês atual. Extrato e Gastos respeitam a conta selecionada e Faturas e Cartões respeitam o cartão. Cada mês distingue subtotais importados e previstos por moeda. O detalhamento de uma fatura oficial lista todos os lançamentos vinculados, independentemente do filtro de datas. |
| REQ-014 | Mostrar o próximo fechamento por cartão | Cartões e Gastos exibem a mesma data e origem. Usar a data oficial do cartão ou da fatura quando disponível. Se faltar, estimar pelo histórico de fechamentos e vencimentos. Sem fechamentos oficiais, usar a transição entre compras de faturas consecutivas quando a janela for curta. Evidência insuficiente fica explícita. |
| REQ-015 | Avisar quando dias recentes ainda podem receber lançamentos | Descartado em 2026-11-09. O usuário considerou o aviso poluição visual e pediu a remoção. Não exibir avisos de atraso de chegada no Extrato nem em Gastos. |
| REQ-016 | Ocultar saldos, limites e faturas na web | Um botão no topo do painel alterna a exibição. Com valores ocultos, ficam mascarados o saldo atual e o valor em aberto, os saldos e limites de contas e cartões, o cheque especial, o valor e o pagamento mínimo das faturas e a estimativa do ciclo aberto. Lançamentos, entradas e saídas, gastos por categoria e parcelas continuam visíveis. A escolha persiste no navegador e não altera a API nem os dados armazenados. |

As referências ao Android na aceitação se aplicam à etapa móvel. A aceitação web pode ser verificada separadamente.

## Regras e limites da proposta

- O primeiro resumo apresenta entradas e saídas **por conta e moeda**, a partir de movimentações efetivadas. A regra exata de data, sinal e tratamento de estornos será validada com dados de teste do conector.
- A forma de pagamento usa os dados que a integração conseguir identificar. Horários ausentes ficam sem horário. O pagamento da fatura fica separado das compras no cartão para evitar contagem dupla em totais de gastos.
- Pagamentos, transferências iniciadas pelo app, orçamento, lançamentos manuais, categorização avançada e investimentos ficam para discussão posterior.
- Público, distribuição do app Android e acesso ao sandbox são [questões de definição](../../../Context/STATE.md).

[Plano](plan.md) · [Tarefas](tasks.md) · [Verificação](verification.md)
