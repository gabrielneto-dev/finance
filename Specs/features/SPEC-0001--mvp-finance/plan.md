# Plano técnico proposto

Classificação Critical por autorização e tratamento de dados financeiros. O workspace começa sem código. A proposta usa um backend compartilhado para que web e Android tenham as mesmas regras e dados. A stack abaixo foi escolhida para a prova. A compatibilidade real do widget com o build Android será verificada no sandbox.

## Stack da primeira entrega

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Web | Next.js App Router, React e TypeScript | Hospeda as telas e a API no mesmo projeto e integra o Pluggy Connect para React. [Next.js](https://nextjs.org/docs/app) · [SDKs Pluggy](https://v2.docs.pluggy.ai/en/docs/connect-widget/environments) |
| Android | Expo, React Native, TypeScript e `react-native-pluggy-connect` | Mantém a linguagem comum entre os clientes e usa o SDK móvel documentado pela Pluggy. Testar deep link em um build de desenvolvimento Android. [SDKs Pluggy](https://v2.docs.pluggy.ai/en/docs/connect-widget/environments) · [Deep links no Expo](https://docs.expo.dev/linking/into-your-app/) |
| API | Next.js Route Handlers em Node.js | Serve os dois clientes por HTTP e mantém credenciais, vínculo e sincronização no servidor. [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) |
| Autenticação | Supabase Auth | Centraliza sessões. A API verifica identidade e propriedade dos recursos nas operações sobre o SQLite. [Auth](https://supabase.com/docs/guides/auth) |
| Banco de dados | SQLite no backend | Um arquivo persistente em volume local para os dados financeiros dos dois apps. Iniciar com uma instância do backend e prever backup e restauração. Em WAL, escritas são serializadas e o arquivo fica no mesmo host dos processos que o acessam. [SQLite WAL](https://sqlite.org/wal.html) |

Manter dois apps no mesmo repositório, em `apps/web` e `apps/android`. Cada app tem sua própria interface. Compartilhar tipos de API quando houver uso pelos dois clientes. A prova usa o recorte de controle pessoal como hipótese reversível. A confirmação do público segue aberta para o desenho definitivo de permissões. Hospedagem e distribuição serão tratadas antes da entrega.

## Componentes e dados

A interface terá Visão geral, Extrato, Gastos, Cartões, Faturas e Conexões. Validar o horário real e o meio de pagamento por conector. Guardar a precisão de data recebida e manter campos ausentes explícitos. Para cartões, separar lançamentos de crédito, faturas oficiais e estimativas. Usar o vínculo por `billId` quando disponível. [Transações](https://docs.pluggy.ai/en/docs/products/transactions) · [Faturas](https://docs.pluggy.ai/en/docs/products/credit-card-bills)

- **Clientes** com autenticação, tela de conexões, extrato por período e resumo. O widget Pluggy Connect recebe token do backend. Exercitar o retorno do OAuth com URL HTTPS na web e deep link no build Android. A API deve configurar destinos conhecidos por ambiente e conferir o estado do Item após o retorno. [OAuth da Pluggy](https://docs.pluggy.ai/en/docs/connect-widget/oauth-support)
- **Backend** com operações autenticadas para emitir token, vincular Item, consultar conexões e extrato, atualizar e desvincular. Contratos internos serão fechados após o experimento. Conferir a associação do Item com o identificador interno enviado em `options.clientUserId` antes de persistir o vínculo. Escopar toda operação financeira ao dono.
- **Armazenamento** com usuário, conexão, conta, transação e estado de sincronização. Usar chaves estrangeiras habilitadas, upserts no escopo correto e valores inteiros em unidades mínimas. Veja o [contrato de dados da Pluggy](pluggy-data.md).

## Integração, falhas e segurança

1. Usar sandbox e validar criação e reautorização de Item. Confirmar campos de contas e transações, paginação, atualização e remoções com a documentação e amostras sintéticas.
2. Importar páginas para uma área temporária ou lote identificável. Publicar somente uma versão coerente, com unicidade para reprocessamento e proteção contra execução concorrente da mesma conexão. Definir como reconciliar alterações e remoções sem tratar uma página ausente como exclusão.
3. Na proposta inicial, sincronizar após vínculo e permitir atualização sob demanda. Separar atualização do Item na Pluggy da leitura dos dados disponíveis. Definir tratamento de expiração, falhas e indisponibilidade. Usar a prova para definir o mecanismo de reconciliação de conexões que terminam com o app fechado. Validar a entrega dos eventos do [webhook de transações](pluggy-data.md#webhook-de-novas-transações) em um endpoint HTTPS de teste e usar a API v2 para reconciliar registros. [Eventos do widget e webhooks](https://v2.docs.pluggy.ai/en/docs/connect-widget/environments#webhooks-and-callbacks)
4. Limitar dados coletados e definir revogação, retenção e exclusão. Impedir novas gravações após desvínculo, inclusive em processamento iniciado antes dele. Provisionar as credenciais da aplicação Pluggy somente no backend. O desenvolvimento local aceita `.env`. O servidor pode recebê-las de um cofre. Renovar a API Key automaticamente e emitir Connect Token sob demanda. Não registrar tokens, credenciais bancárias ou conteúdo financeiro em logs.
5. Usar métricas de resultado e duração de sincronização com identificadores técnicos mínimos. Em falha, suspender o fluxo de importação e preservar a última leitura íntegra para conexões ativas. Validar recuperação, reprocessamento e estratégia de rollback de dados antes da entrega.

## Verificação e entrega

Validar primeiro em sandbox, com falhas de autorização e de provedor, reprocessamento, acesso cruzado, consistência entre clientes, totais e desvínculo. Usar testes sintéticos determinísticos para valores e datas, além de testar o widget no navegador e no Android. Definir migrações e operação antes de release. O acesso a conectores reais permanece dependente de validação de cobertura e operação com dados reais.

[Pesquisa Pluggy](../../../Context/branches/pluggy/research/RES-20261108-fluxo-pluggy.md) · [Risco de isolamento](../../../Context/global/risks/RSK-20261108-isolamento.md)

## Homologação web com uma conexão existente

Classificação Critical. Usar um Item explicitamente autorizado pelo operador no ambiente do servidor; não aceitar um ID livre para a importação de conexões antigas. Verificar identidade e ambiente no provedor e manter a regra de propriedade e a fila transacional. O login continua obrigatório. Guardar apenas metadados técnicos de entrega no SQLite e mostrar o último evento por conexão ao dono. Verificar atualização de um banco anterior e reentrega sem duplicação. Em falha, preservar dados já importados; para desabilitar a importação inicial por configuração, remova o ID do ambiente. Fazer backup do volume antes de trocar a versão em uma instalação existente.

## Detalhes da instituição

Classificação Critical por ampliar os campos financeiros armazenados. Preservar o escopo do consentimento e a consulta autenticada por proprietário. Separar cobertura declarada pelo conector, produtos configurados no Item e registros disponíveis no Finance. Persistir apenas metadados conhecidos do Item e campos normalizados de contas, cartões e faturas. Aplicar migração aditiva, manter campos novos opcionais para registros anteriores e preenchê-los na próxima sincronização. Reutilizar o extrato e as faturas com a conta selecionada. Verificar isolamento, registros sem campos opcionais e navegação em dados sintéticos.

## Acesso local para homologação real

Classificação Critical. Remover o fallback de demonstração e manter o painel e suas APIs autenticados. Habilitar em loopback uma chave de acesso aleatória com digest no ambiente e sessão opaca, expirada e revogável no SQLite. Restringir o modo local à origem configurada em 127.0.0.1. Manter a identidade do dono local estável e independente do Supabase. Não migrar vínculos automaticamente entre identidades. Verificar recusa de acesso sem sessão, login, logout e importação pela API do app. A rotação da chave invalida sessões anteriores. O Supabase segue disponível para instalações HTTPS.

Referência para sessões e revogação. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Acompanhamento de parcelas

Classificação Critical por interpretação de dados financeiros. Acrescentar metadados opcionais às transações normalizadas, sem mudar chaves ou criar lançamentos estimados no SQLite. Agrupar dentro do mesmo Item e cartão usando uma impressão dos campos de compra presentes na resposta. Se dois IDs ocuparem o mesmo número de parcela, não projetar essa série. Priorizar o ciclo de fatura, seguido do mês indicado pela Pluggy e do mês da transação. Usar a parcela observada anterior como referência para o mês e o valor das seguintes. A API autenticada calcula o cronograma do mês atual em diante a partir do histórico completo do cartão. A aba Cartões distingue parcelas importadas de previsões. Uma nova importação preenche os metadados das linhas anteriores e a recomposição usa sempre os lançamentos atuais. Para reverter a apresentação basta retirar o cronograma, pois nenhuma previsão é gravada nem entra nos saldos.

## Parcelas nas quatro abas

Classificação Critical por exibir totais financeiros e ampliar a consulta de compras vinculadas a uma fatura. Compartilhar o cronograma sem persistir estimativas e mostrar a partir do mês atual nos quatro pontos de acesso. Exibir subtotais distintos por moeda e origem. Extrato e Gastos mantêm os filtros de período e horário no modo Lançamentos. Faturas consulta compras vinculadas por fatura autenticada e mostra a lista completa, com escopo da conta e do proprietário. A alteração é aditiva à API e pode ser revertida sem alteração dos dados armazenados.

## Gastos pendentes por categoria

Correção localizada. Em Gastos, usar a mesma lista filtrada para o total e as categorias. Identificar a parte pendente no total e nas categorias. Preservar a definição de efetivados na Visão geral e manter previsões no cronograma de parcelas. Validar com uma amostra sintética que inclua débitos efetivados, pendentes e moedas diferentes.

## Próximo fechamento do cartão

Classificação Critical por calcular uma data financeira. Usar dados oficiais da conta e de faturas primeiro. Para estimar, usar os fechamentos recentes do próprio cartão e o intervalo até o vencimento quando houver um vencimento de ciclo novo. Sem data oficial anterior, procurar o intervalo entre a última compra da fatura anterior e a primeira compra da seguinte, sem tratar datas de parcelas posteriores como datas de compra. Limitar a inferência a faturas de ciclos consecutivos com uma janela curta. Pagamento da fatura não é evidência do dia de fechamento. Exibir fonte da data em Cartões e Gastos, incluindo a falta de evidência. Calcular sob demanda com escopo autenticado. Não gravar a data estimada sobre campos oficiais.

## Ocultar saldos e faturas

Classificação Lightweight. A mudança fica na interface e não altera API, banco ou integração. Um contexto React guarda a preferência, e cada ponto que exibe saldo, limite ou fatura aplica a máscara. Lançamentos individuais e agregados de movimentação seguem visíveis, porque o usuário pediu para ocultar apenas valores de conta e fatura. A preferência fica no `localStorage` do navegador. Validar no painel local alternando o botão em Visão geral, Cartões, Faturas e Conexões e conferir a persistência após recarregar.

## Valor bloqueado na conta

Classificação Lightweight. A Pluggy informa o saldo disponível em `balance` e o saldo contábil em `bankData.closingBalance`. Um depósito em cheque ainda não compensado entra no contábil antes do disponível, e a diferença aparece como bloqueada. Calcular na interface, por moeda, a partir das contas já exibidas no Saldo atual, sem alterar API ou banco. Só exibir diferença positiva. Validar com teste unitário e no painel com a conexão real.

## Depósito em cheque bloqueado

Classificação Lightweight. A Pluggy não informa bloqueio por lançamento, então a marcação é inferida na interface. Considerar créditos da própria conta e moeda com categoria `Transfer - Check` ou descrição com "cheque", dos sete dias anteriores à data de referência, porque a compensação leva poucos dias úteis e a sincronização tem até um dia de atraso. Percorrer do mais recente ao mais antigo e marcar enquanto a soma couber no valor bloqueado da conta. Parar no primeiro que não couber, para não marcar cheques antigos já compensados. A situação Bloqueado substitui Efetivada e explica a origem no título. Mover o cálculo de saldos para `lib/balances.ts`, com testes próprios.

## Fatura aberta pelo ciclo do cartão

Classificação Critical por exibir uma estimativa financeira. Substitui o bloco "Compras pendentes no período", que somava compras pendentes dentro do filtro de datas e omitia parcelas. O backend autenticado calcula a fatura aberta quando o painel pede `open=1`, com o escopo do proprietário. O ciclo aberto usa o mesmo mês de vencimento que o cronograma de parcelas atribui a lançamentos pendentes sem fatura, e o fechamento usa a data do REQ-014. O vencimento é o fechamento somado à mediana dos intervalos recentes entre fechamento e vencimento. Só é exibido se cair no mês do ciclo.

Entram as compras sem fatura com situação pendente ou efetivadas depois do último fechamento oficial, exceto parcelas e pagamentos de fatura. Créditos sem fatura, como estornos, reduzem o valor. As parcelas vêm do cronograma do REQ-013 para o mês de vencimento, separadas entre importadas e previstas, sem contar a mesma parcela duas vezes. Riscos: o banco pode lançar encargos, ajustes ou compras atrasadas que mudam o valor. Por isso o bloco fica identificado como estimativa, e a fatura oficial continua sendo a referência. A mudança é aditiva à API e reversível sem alterar dados armazenados.

## Renomear conexões

Classificação Full, com controle de acesso. Conexões MeuPluggy chegam todas com o nome do conector, e a sincronização regrava `connections.name`. Adicionar a coluna opcional `label`, migrada como as anteriores com `ALTER TABLE` idempotente. A ação `rename` da API de conexões valida origem, sessão e propriedade, normaliza espaços, recusa caracteres de controle e limita o nome a 40 caracteres. Vazio grava `NULL`. O painel recebe `label` junto de `name` e exibe o primeiro disponível. A migração é aditiva. Para reverter, basta ignorar a coluna.
