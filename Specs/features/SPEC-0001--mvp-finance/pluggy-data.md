# Contrato de dados da Pluggy para o MVP

Análise documental em 2026-11-08. As estruturas abaixo vêm dos contratos e exemplos oficiais. Os exemplos desta análise são sintéticos. A prova autenticada em sandbox segue na SPEC-0001-T002.

## Leitura e campos

| Recurso | Resposta documentada | Projeção mínima no SQLite |
| --- | --- | --- |
| `GET /items/{id}` | Um Item com `id`, estado da conexão (`status`), estado da execução (`executionStatus`) e informações de atualização. `UPDATED` pode acompanhar `PARTIAL_SUCCESS`. | `connections` com ID local, dono, ID do Item, ID do conector, estados, data de atualização do provedor e data da última importação local completa. Verificar `clientUserId` antes de associar o Item. |
| `GET /accounts?itemId=…` | Objeto com `results`, `page`, `total` e `totalPages`. Contas `BANK` e `CREDIT` têm tipos, subtipos e detalhes distintos. | `accounts` com conexão, ID da conta na Pluggy, tipo, subtipo, nome de exibição, moeda e saldo reportado. Saldo bancário e valor em aberto de cartão têm significados diferentes. |
| `GET /v2/transactions?accountId=…` | `results` e `next`. Cada lançamento informa ID, conta, data, descrição, valor, moeda, tipo e status. Metadados como valor na moeda da conta e ID de fatura dependem do lançamento. | `transactions` com conta, ID da transação na Pluggy, data original, descrição, valor, moeda, direção, status e atualização do provedor quando disponível. Reter valor na moeda da conta e ID da fatura quando necessários. |

[Estado de Item](https://v2.docs.pluggy.ai/en/docs/connections/item-lifecycle) · [Contas](https://docs.pluggy.ai/en/reference/account/accounts-list) · [Saldo por tipo de conta](https://v2.docs.pluggy.ai/en/docs/products/accounts) · [Transações por cursor](https://docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor)

## Regras de normalização

- **Direção e precisão.** Use `type` para distinguir `DEBIT` de `CREDIT`. Converta o valor decimal para magnitude inteira na unidade mínima da moeda, com escala conhecida e validação de precisão. Exemplo em BRL: `42.90` vira `4290` centavos. Valide o intervalo de armazenamento e use operações inteiras para os totais. Preserve o sinal do saldo, que pode ser negativo.
- **Cartões.** Uma compra de `amount: 42.90, type: DEBIT` é um débito. Um pagamento de fatura de `amount: -42.90, type: CREDIT` é um crédito no cartão. Mostre a movimentação por conta. Evite tratar pagamento de fatura como renda ou somá-lo ao gasto das compras em um consolidado futuro.
- **Moeda.** Agrupe o resumo por conta e moeda. Quando houver `amountInAccountCurrency`, guarde-o separadamente com a moeda da conta. Não estime câmbio nem use ambos os valores no mesmo total.
- **Status e datas.** Mostre `PENDING` separadamente. O resumo de efetivados usa `POSTED`. Ao mudar o status, atualize o mesmo registro quando a Pluggy preservar o ID. Guarde a data ISO do provedor e valide a regra do dia de extrato com o sandbox, incluindo meia-noite UTC, fuso e limites do período. Use `date` como data financeira e datas de criação/atualização para sincronização.
- **Minimização.** Selecione apenas campos usados pelo produto. CPF/CNPJ, número completo de conta, detalhes de contrapartes e o JSON bruto ficam fora da persistência inicial. Use rótulos de exibição sem repetir identificadores financeiros completos.

[Campos e sinais de transações](https://docs.pluggy.ai/en/docs/products/transactions) · [Direção e status](https://v2.docs.pluggy.ai/en/reference/transaction/transactions-retrieve) · [Ciclo de transações no cartão](https://v2.docs.pluggy.ai/en/docs/products/credit-card-installments)

## Sincronização e consistência

1. O backend resolve o Item pertencente ao usuário, lê o estado do provedor e lista contas. A atualização na instituição e a importação para o SQLite são operações distintas. Em sucesso parcial, mantenha a última leitura local íntegra e registre o estado.
2. Para cada conta, percorra a listagem v2 até `next: null`. Use a query retornada por `next` com o host e caminho fixos. Valide que as páginas pertencem à conta esperada. Web e Android leem a API local.
3. Use chaves únicas para Item, conta dentro da conexão e transação dentro da conta. Após coletar e validar o lote fora da transação SQL, publique-o em uma transação curta com upserts. Repetir o lote é seguro. A publicação verifica se o vínculo permanece ativo e se o lote ainda é o atual.
4. Reconciliar alterações antigas e exclusões explícitas do provedor, com checagem de conta e Item. A ausência em uma página, janela de datas ou resposta parcial não comprova exclusão. Validar no sandbox quais eventos e filtros cobrem atualização e remoção, inclusive a mudança de status de compras antigas.

[Atualização do Item](https://docs.pluggy.ai/en/docs/integration-checklist/data-sync) · [Transações por cursor](https://docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor) · [Eventos de transação](https://docs.pluggy.ai/en/docs/products/transactions)

## Autenticação da aplicação

A Pluggy emite `clientId` e `clientSecret` para a aplicação no Dashboard. Provisionar as credenciais no backend. Em desenvolvimento local, o teste aceita um `.env` privado. Em um servidor, o ambiente pode recebê-las de um cofre. O backend faz `POST /auth`, renova a API Key automaticamente e emite o Connect Token sob demanda para o widget. O usuário final autoriza a instituição pelo fluxo Pluggy Connect. Se o produto for exclusivamente de uso próprio, o fluxo Meu Pluggy também usa credenciais da aplicação e tem um fluxo próprio de autorização.

[Autenticação](https://docs.pluggy.ai/en/reference/authentication) · [Credenciais da aplicação](https://docs.pluggy.ai/en/docs/integration-checklist/api-keys) · [Meu Pluggy](https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use)

## Webhook de novas transações

A Pluggy envia um `POST` HTTPS quando uma sincronização encontra novos registros. O evento `transactions/created` pode trazer `eventId`, `itemId`, `accountId`, `transactionsCreatedAtFrom` e um link de consulta. As transações são lidas depois pela API. O horário de criação no provedor e a data financeira do lançamento têm funções distintas. Uma atualização sem mudanças pode terminar sem emitir esse evento.

1. Registrar `transactions/created` por `POST /webhooks` numa aplicação de teste com um endpoint HTTPS público controlado pelo projeto. Configurar um segredo dedicado nos headers da inscrição e verificá-lo no receptor. Um `webhookUrl` fornecido ao Item ou ao Connect Token envia os eventos daquele recurso sem os headers personalizados da inscrição.
2. Validar o corpo e a aplicação, persistir o evento com chave única por aplicação e `eventId` e responder `2xx` após aceitar de forma durável, dentro do prazo de 10 segundos. Processar depois. A Pluggy pode repetir a entrega. Preservar tentativas locais e reconciliar eventos perdidos.
3. Resolver o usuário pelo `itemId` e conferir a conta no vínculo armazenado. Os eventos de transação não trazem `clientUserId`. Quando o evento chegar antes do vínculo inicial, deixar o trabalho pendente até reconciliar com o Item. Nunca associar dados financeiros a partir de um ID enviado pelo cliente sem conferir o vínculo com a API.
4. Para `transactions/created`, montar a consulta no host fixo da Pluggy com `GET /v2/transactions?accountId=…&createdAtFrom=…`. Usar a data de criação informada e percorrer os cursores até `next: null`. Assim o cliente evita enviar a chave a URLs arbitrárias e funciona mesmo se o link do evento ainda apontar para a rota antiga. A janela é inclusiva. Reprocessar com upsert por conta e ID.
5. Para `transactions/updated`, recuperar os IDs indicados pela API v2 e atualizar os registros. Para `transactions/deleted`, aplicar a remoção explícita no escopo da conta. Revalidar o vínculo ativo antes de publicar o lote no SQLite.

A consulta incremental por `createdAtFrom` passou com dados sintéticos. O recebimento de uma notificação real da Pluggy e a fila durável ainda precisam ser exercitados. [Webhooks e entrega](https://docs.pluggy.ai/en/docs/developer-tools/webhooks-ref) · [Cadastro e segredo por header](https://docs.pluggy.ai/en/reference/webhooks) · [Consulta incremental](https://docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor)

## Atualização de conexões MeuPluggy

Em 2026-11-08, a conexão real retornou HTTP 400 com a mensagem `MeuPluggy item cant be updated` ao pedido `PATCH /items/{id}`. Conexões MeuPluggy só atualizam na sincronização automática da Pluggy (`nextAutoSyncAt`) ou pelo app MeuPluggy. O botão Atualizar não consegue buscar dados novos no banco. Sem webhook público, o painel local também não recebe o resultado da sincronização automática.

Correção em 2026-11-08. Quando a Pluggy recusa a atualização com HTTP 400, o Atualizar reimporta os dados que ela já sincronizou. Erros 4xx encerram a tarefa, exceto 401, 408, 425 e 429. Falhas temporárias seguem com novas tentativas. O worker registra o status e a mensagem curta da Pluggy. Dados novos do banco continuam dependendo da sincronização automática ou do app MeuPluggy.

A documentação de Item confirma o limite. A conexão MeuPluggy na aplicação é um Item proxy. Ele reflete o Item original do Meu Pluggy, que sincroniza a cada 24 horas, e não aceita atualização manual pela API. O widget com `updateItem` também atualiza Items, mas a regra do proxy impede o uso nesse caso. Os webhooks funcionam normalmente. [Item](https://v2.docs.pluggy.ai/pt/docs/connections/item) · [Atualizando um Item](https://v2.docs.pluggy.ai/pt/docs/connect-widget/updating-item)

Na conexão real, o `createdAt` mostrou uma rodada diária perto das 17h20, horário de Brasília, entre 4 e 8 de novembro de 2026. Lançamentos da conta bancária chegaram no mesmo dia. Compras pendentes do cartão chegaram com dois a três dias de atraso. As rodadas de 7 e 8 de novembro não trouxeram lançamentos dessas datas.

O app Meu Pluggy permite atualizar a conexão original pelo botão Atualizar, nos detalhes da conexão. O pedido abre o fluxo de conexão e terminou em menos de um minuto, sem novo consentimento. Em 8 de novembro de 2026, às 23h59, o `lastUpdatedAt` do Item proxy acompanhou essa atualização em menos de um minuto. Em seguida, o Atualizar do Finance reimportou os dados sem erro. Nenhum lançamento de 7 ou 8 de novembro tinha sido enviado pelo banco, e a contagem de lançamentos do Meu Pluggy coincidiu com a do SQLite local. Para antecipar a sincronização, atualize no Meu Pluggy e depois clique em Atualizar no Finance. Cada pedido consome a cota mensal do Open Finance.

## Parcelas de cartão

Estudo SPEC-0001-T013 em 2026-11-08. O importador pagina `GET /v2/transactions` sem corte de datas e já guarda o número da parcela, a quantidade total e o ID da fatura quando informado. O intervalo exibido no painel é independente da leitura. Na verificação autenticada, a API devolveu metadados suficientes para reconhecer compras parceladas, mas nenhum registro de parcela nos meses seguintes por data ou por ciclo. A consulta paginada de faturas encontrou faturas oficiais, sem ciclos futuros. Foram feitas apenas leituras da conexão já autorizada.

Os campos presentes incluíram data original da compra, número e total de parcelas e identificação do cartão. Algumas parcelas também tinham período previsto, data de postagem ou ID de fatura. O valor total da compra e um identificador de grupo não vieram na resposta. Uma chave exploratória com conta, data original, descrição, cartão, moeda e quantidade conseguiu agrupar registros de parcelas da mesma série sem colisões observadas por número da parcela na amostra. Isso ainda é uma heurística. Persistir no máximo o final do cartão e nunca vincular candidatos ambíguos automaticamente.

Caminhos avaliados:

1. **Importar lançamentos oficiais.** Consumir a listagem de transações e eventos de criação, atualização e exclusão. Guardar a data original e o mês de fatura informado quando disponível. Usar o identificador da transação para atualizar o registro já importado e o ID de fatura para vincular a cobrança oficial. A lista de faturas fornece os ciclos coletados pela Pluggy. O campo que informa se uma fatura permite parcelamento se refere ao pagamento da fatura.
2. **Rastrear parcelas restantes.** Agrupar compras com evidência suficiente e gerar meses previstos a partir do número de parcelas faltantes. Preferir o mês de fatura informado a um mês inferido. Quando o total da compra não vier, usar o valor da parcela observada como estimativa. Exibir as previsões em uma lista separada dos lançamentos e totais oficiais. Ao receber a parcela real, substituir a previsão quando a correspondência for única.
3. **Importar cronograma complementar.** Se o banco oferecer uma exportação com as parcelas futuras, avaliar o formato para importar datas e valores informados no arquivo. Sem esse cronograma ou um registro da Pluggy, o mês e o valor futuros permanecem estimados.

Na conexão real, `billForecastDate` repetiu o mês da data do lançamento, enquanto a fatura oficial venceu no mês seguinte. Não use o campo como mês de vencimento sem conferir o ciclo do cartão. Lançamentos `PENDING` vêm das transações recentes, ainda sem `billId`. [Medição](verification.md#mês-das-parcelas-sem-fatura)

[Parcelas de cartão](https://v2.docs.pluggy.ai/pt/docs/products/credit-card-installments) · [Campos das transações](https://v2.docs.pluggy.ai/pt/reference/transaction/transactions-retrieve) · [Lista de faturas](https://v2.docs.pluggy.ai/en/reference/bill/bills-list)
