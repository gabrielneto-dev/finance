---
id: "CTX-DEC-20261108-ciclos-cartao"
type: "decision"
title: "Parcelas, gastos pendentes e fechamento do cartão"
branch: "produto"
tags: ["escopo", "pluggy"]
status: "active"
created_at: "2026-11-08"
updated_at: "2026-11-10"
related: ["CTX-DEC-20261108-pluggy-web-mobile", "CTX-RES-20261108-fluxo-pluggy", "CTX-RES-20261109-sincronizacao-meupluggy"]
source_ids: ["CTX-SRC-20261108-documentacao-pluggy"]
---

# Parcelas, gastos pendentes e fechamento do cartão

**Parcelas.** A API pode entregar parcelas já observadas e metadados da compra. Quando não entrega os ciclos futuros, o backend usa os números de parcela, o valor observado e a referência mensal do ciclo para projetar o restante. Agrupa por cartão e sinais da compra, evita projeções ambíguas e substitui a previsão por um lançamento correspondente quando este chega. Extrato, Gastos, Cartões e Faturas mostram as previsões separadas dos lançamentos importados.


**Parcelas sem fatura (2026-11-09).** O `billForecastDate` da Pluggy repete o mês da compra e não indica o vencimento. Uma parcela `PENDING` sem `billId` entra no ciclo aberto na data de referência do painel. Se a Pluggy já devolveu a fatura oficial desse ciclo, usa o vencimento dela. Senão, projeta o próximo fechamento depois da compra pelo dia mediano dos fechamentos oficiais e soma o intervalo mediano até o vencimento. A compra feita no dia do fechamento entra no ciclo seguinte. Sem fechamentos oficiais, o cronograma mantém o `billForecastDate`. Lançamentos efetivados sem fatura não são deslocados. As datas da lista de faturas mostram dia, mês e ano.

**Mês da cobrança (2026-11-10).** A pedido do usuário, a partir da 2ª parcela o lançamento conta na data em que o banco o lança no cartão (`date`), e não na data da compra (`creditCardMetadata.transactionDateTime`). A data da compra fica em `purchaseDate` e aparece no extrato. Gastos não antecipa parcelas futuras. Motivo: um emissor envia as parcelas futuras de uma vez e inflava o mês da compra, enquanto outro só lança a parcela no mês da cobrança.

**Fatura aberta (2026-11-10).** Faturas mostra a fatura aberta de cada cartão, calculada no backend pelo ciclo atual: fechamento, vencimento, compras e parcelas importadas e previstas. Não depende do filtro de datas, e "Ver compras" lista o que compõe o total. Uma previsão que duplica uma parcela real é descartada, assim como a pendência antiga não confirmada.

**Outra moeda (2026-11-10).** Totais de gastos e a fatura aberta somam o valor cobrado em reais (`amountInAccountCurrency`). O extrato mostra o valor original e o cobrado.

**Gastos.** O resumo por categoria usa os débitos observados da lista filtrada, com efetivados e pendentes separados por moeda. Pagamentos de fatura e projeções ficam fora do resumo. O rótulo de pendência segue o estado do lançamento informado pela origem.

**Fechamento.** Cartões e Gastos usam o mesmo cálculo por cartão. Primeiro vêm datas oficiais futuras do cartão ou da fatura. Sem elas, o backend usa o histórico de fechamentos e, quando disponível, o intervalo observado até um vencimento oficial para estimar o ciclo. Também pode inferir pela transição entre datas de compra em faturas consecutivas, excluindo pagamentos e parcelas posteriores. As datas inferidas têm indicação de origem e não são persistidas como datas oficiais. Se os dados não sustentam uma estimativa, o painel informa isso.

Referências: [contrato de dados](../../../../Specs/features/SPEC-0001--mvp-finance/pluggy-data.md#parcelas-de-cartão), [evidência de fechamento](../../../../Specs/features/SPEC-0001--mvp-finance/verification.md#próximo-fechamento-do-cartão), [mês das parcelas sem fatura](../../../../Specs/features/SPEC-0001--mvp-finance/verification.md#mês-das-parcelas-sem-fatura) e [cartões e faturas](../../../../Specs/features/SPEC-0001--mvp-finance/verification.md#cartões-e-faturas).
