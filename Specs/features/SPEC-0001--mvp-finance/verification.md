# Verificação do MVP

| Requisito | Procedimento | Resultado atual |
| --- | --- | --- |
| REQ-001 | Fluxo no sandbox na web e no Android, incluindo cancelamento, retorno e tentativa após falha | NOT_RUN |
| REQ-002 | Importação paginada, lote repetido, processamento concorrente e interrupção parcial | NOT_RUN |
| REQ-003 | Comparação de extrato e totais na web e no Android com amostra sintética por conta, período e moeda | NOT_RUN |
| REQ-004 | Testes de sessão, IDs adulterados, acesso cruzado e inspeção de logs e bundles | NOT_RUN |
| REQ-005 | Exercício de falha, reautorização, desvínculo durante importação e exclusão de dados | NOT_RUN |
| REQ-006 | Filtros combinados, lançamento sem horário ou forma, totais por categoria e separação de pendentes | PASS na web. Android pendente. [Detalhes](#filtros-e-gastos) |
| REQ-007 | Seleção de cartões, fatura oficial e estimativa, falta de cobertura e vínculo de compras | PASS na web. A situação da fatura não vem da Pluggy. [Detalhes](#cartões-e-faturas) |
| REQ-008 | Persistência de webhook e aviso de nova transferência após reprocessamento | PASS local · entrega HTTPS pela Pluggy pendente |
| REQ-009 | Importar Item real autorizado e acompanhar processamento e repetição | PASS na API real em memória e no backend local · login do proprietário e entrega pública pendentes |
| REQ-010 | Detalhes da conexão, isolamento e navegação até extrato e fatura | PASS local e importação real em memória |
| REQ-011 | Autenticação local, isolamento e importação pelo painel em modo real | PASS no build local e API real |
| REQ-012 | Cronograma autenticado, substituição de previsão e isolamento | PASS em testes locais e na API com a conexão real |
| REQ-013 | Cronograma nas quatro abas, subtotais por moeda e compras da fatura oficial | PASS no navegador e em testes locais |
| REQ-014 | Fechamento informado ou estimado por cartão com indicação de origem | PASS em testes locais, no navegador e na API autenticada |
| REQ-015 | Aviso de lançamentos ainda a caminho | Descartado. Removido a pedido do usuário. [Registro](#lançamentos-ainda-a-caminho) |

Estado em 2026-11-08. A validação funcional depende da implementação. A leitura da documentação oficial está registrada na [pesquisa](../../../Context/branches/pluggy/research/RES-20261108-fluxo-pluggy.md).

## Versão web

- Em 2026-11-08, o carregamento do ambiente local foi corrigido para evitar que o Next.js repasse flags incompatíveis ao processo de desenvolvimento. O comando de demonstração iniciou em loopback e o navegador carregou a visão geral e os dados sintéticos. Os testes do worker e do receptor passaram.

- O novo layout foi verificado na demonstração local. As seis abas abriram a 390 × 690 px sem rolagem na página inteira. No navegador, o filtro Pix retornou dois lançamentos, a fatura oficial abriu a lista de compras e o painel de notificações exibiu o aviso de Pix. O formulário de login foi inspecionado na mesma largura. O build de produção e a checagem TypeScript passaram.

- O resumo de Cartões foi verificado no navegador em duas larguras. A identificação do cartão, o valor em aberto e as datas do ciclo aparecem em dois blocos no desktop e em uma coluna a 390 px, sem rolagem horizontal. O botão Ver faturas abriu a fatura oficial da demonstração.

- O componente compartilhado de rolagem foi validado no navegador. Na visão geral, o arraste da barra verde moveu só a tabela. O cabeçalho e os filtros conservaram a posição. No extrato filtrado por Pix, os dois lançamentos couberam na tabela e a barra desapareceu.

- Ajuste de layout validado na demonstração local. No extrato, a rolagem pelo teclado moveu apenas os lançamentos e manteve fixos os filtros e o cabeçalho da tabela. Em uma janela de 390 × 690 px, os filtros recolhíveis liberaram espaço para os lançamentos. O filtro Pix continuou aplicado após recolher os controles.

- O build de produção do Next.js, a checagem TypeScript e os testes locais passaram. A interface abriu no navegador com dados fictícios. Foram inspecionados a visão geral, os filtros do extrato, as faturas e a central de notificações.
- O novo importador consultou o Pluggy Bank Sandbox e gravou 2 contas, 1.440 transações e 2 faturas em SQLite em memória.
- O receptor HTTP do build local rejeitou segredo inválido e aceitou a entrega autenticada repetida. Foi persistido um único trabalho. O teste do worker reabriu o SQLite, processou o evento e gravou um único aviso para a transferência, com isolamento por proprietário.
- A implantação no servidor, o login no Supabase do usuário, o fluxo de consentimento com a aplicação implantada, a entrega pública de webhook pela Pluggy e a execução do Compose no servidor aguardam homologação. O Android está previsto para etapa posterior. [Guia de instalação](../../../README.md)

## Integração real e teste de webhook

Em 2026-11-08, o importador consultou a API real da Pluggy, verificou que o Item autorizado pertencia ao ambiente real e executou a importação para SQLite em memória. O painel consultado pelo backend retornou contas para o dono e nenhuma para outra identidade. O ensaio não gravou dados financeiros em disco, não mostrou conteúdo financeiro e não atualizou o Item no provedor.

O build passou e o teste HTTP em loopback rejeitou consultas e importação sem sessão, segredo inválido e payload malformado. A entrega autenticada repetida retornou HTTP 204 e criou um único trabalho. Testes locais sintéticos confirmaram preservação de trabalhos ao migrar o SQLite, isolamento do Item autorizado, estado da fila após reabertura e aviso único para uma transferência posterior ao corte da primeira importação.

O login no Supabase configurado e a entrega da Pluggy pelo domínio público não foram executados. O [roteiro](../../../README.md#testar-a-entrega-pelo-dashboard-da-pluggy) indica onde confirmar a entrega e o processamento.

Em 2026-11-08, o teste em navegador passou com build de produção, worker e SQLite temporário, usando respostas sintéticas no lugar dos serviços externos. O login abriu o painel, **Importar conexão existente** levou a instituição a **Conectada** com o sino vazio, e duas entregas do mesmo evento retornaram HTTP 204. A tela mostrou `transactions/created` como **Processado** e um único aviso de **Pix recebido**.

## Detalhes da instituição

Em 2026-11-08, o teste de importação confirmou cobertura do conector separada dos produtos do Item, nome e final mascarado do cartão, limites em centavos, preservação de zero e ausência de valores opcionais. A migração preservou uma conexão criada com o esquema anterior. Outra identidade não recebeu detalhes, contas ou faturas. O build passou.

O navegador exibiu os detalhes da demonstração. O atalho de extrato abriu apenas os lançamentos da conta selecionada e o atalho de faturas abriu o cartão correto, seu pagamento mínimo e as compras vinculadas. A API real da Pluggy também completou o novo fluxo em SQLite em memória, sem registrar dados financeiros reais em evidências. A tela autenticada com dados reais ainda depende da configuração do Supabase.

## Painel local com a conexão real

O build de produção iniciou em loopback e o navegador exibiu o login por chave local. O teste HTTP rejeitou chave incorreta, origem externa, host diferente e consulta sem sessão. A chave local abriu uma sessão com cookie HttpOnly e SameSite Strict. O logout revogou a sessão no SQLite.

Pela API autenticada do Finance, a ação de importar acionou o worker, consultou a Pluggy e gravou a conexão e as contas reais no SQLite local. O painel retornou a conexão como Conectada. Os testes automatizados existentes e o build passaram. A entrega pública do webhook continua pendente.

## Cronograma de parcelas

Em 2026-11-08, os testes sintéticos verificaram a virada de ano, a prioridade da fatura conhecida, a substituição de uma previsão pelo lançamento recebido, a exclusão de estimativas ambíguas e o isolamento por proprietário. O cronograma foi calculado com o histórico completo mesmo com o extrato filtrado. O build passou.

A reimportação da conexão autorizada pelo worker preencheu os metadados no SQLite. A API do build local rejeitou consultas sem sessão e retornou parcelas importadas e previstas após o login. O extrato continuou contendo somente os lançamentos recebidos. A chegada de uma nova parcela foi testada com dados sintéticos.

## Parcelas nas quatro abas

Em 2026-11-08, o build e os testes locais passaram. A amostra sintética com dois cartões e duas moedas confirmou no navegador o cronograma em Extrato, Gastos, Cartões e Faturas, os filtros por conta e os subtotais por origem e moeda. O atalho do cronograma abriu uma fatura oficial e mostrou uma compra fora do período do extrato. Os testes de banco confirmaram o vínculo por Item, conta e fatura e rejeitaram a consulta cruzada entre donos.

## Filtros e gastos

Em 2026-11-08, o REQ-006 foi exercitado no painel local autenticado com a conexão real. Um script em leitura recalculou cada combinação no SQLite com as mesmas regras do painel.

- **Filtros combinados.** De 1º de outubro a 8 de novembro de 2026, sem filtros, com forma não informada, com cartão, crédito e noite, e com conta, Pix e tarde, o Extrato mostrou 112, 7, 13 e 14 lançamentos. Os números coincidiram com o SQLite.
- **Estado vazio.** O filtro sem horário mostrou a mensagem de seleção vazia no Extrato e em Gastos, porque a conexão real não tem lançamento sem horário.
- **Gastos.** Nas mesmas combinações, total, efetivados, pendentes e quantidade de categorias coincidiram com o SQLite. Os pendentes apareceram na categoria correspondente.
- **Moeda e categoria ausente.** De junho a julho de 2026, o resumo separou reais e dólares e mostrou o grupo sem categoria com o valor esperado.
- **Sem horário e sem forma.** O filtro do Extrato foi extraído para `lib/ledger-filter.ts`, sem mudar o comportamento. Um teste unitário cobre lançamentos sem horário e sem forma, os limites das faixas e a combinação com conta. As quatro combinações acima repetiram os mesmos números após a extração. Os 14 testes web, a checagem de tipos e o build passaram.
- **Pendente.** O Android segue para a etapa móvel.

## Gastos por categoria

Em 2026-11-08, o navegador com uma amostra sintética de dois cartões e duas moedas confirmou que o total e as categorias usam os mesmos lançamentos que a tabela. Os subtotais destacam valores pendentes. O filtro de conta atualizou a tabela e o resumo juntos. A amostra também incluiu gasto sem categoria, estorno e pagamento de fatura. O build e os testes automatizados existentes passaram.

## Próximo fechamento do cartão

Em 2026-11-08, os testes sintéticos confirmaram a precedência de datas oficiais, o uso do histórico e do vencimento de um novo ciclo, o ajuste de mês curto e a inferência entre compras de ciclos consecutivos. A consulta de compras ignorou pagamentos e parcelas posteriores. O navegador exibiu a mesma estimativa em Cartões e Gastos e respeitou o filtro por conta. A API autenticada calculou uma próxima data para a conexão autorizada usando o histórico, pois o fechamento não veio no cadastro do cartão. Build e testes passaram.

## Mês das parcelas sem fatura

Em 2026-11-08, uma leitura do SQLite local conferiu o card de compras pendentes da aba Faturas. O total exibido bateu com os lançamentos de cartão `PENDING`, sem `billId` e de débito. Dois deles eram a primeira parcela de compras parceladas e também apareciam no cronograma, sem somar duas vezes no mesmo total.

A mesma leitura comparou `billForecastDate` com a fatura oficial de cada parcela já vinculada. Em todas as 27 parcelas com o campo, o valor coincidiu com o mês da data do lançamento. O vencimento real ficou um mês depois em 24 das 25 parcelas com fatura, e dois meses depois na restante. Compras feitas no dia do fechamento entraram na fatura seguinte. A documentação descreve o campo como período de fatura previsto e não informa se é o mês de vencimento. Como `installmentSchedule` usa esse campo como mês da fatura quando não há `billId`, parcelas pendentes e as previsões ancoradas nelas aparecem um mês antes. [Contrato](pluggy-data.md#parcelas-de-cartão)

Correção no mesmo dia. Uma parcela `PENDING` sem fatura passa a usar o próximo fechamento depois da data da compra, projetado pelo dia mediano dos últimos fechamentos oficiais do cartão e pelo intervalo mediano até o vencimento. A compra no dia do fechamento entra no ciclo seguinte. Sem fechamentos oficiais, o cronograma mantém `billForecastDate`. Lançamentos efetivados não são deslocados. O teste sintético cobre compra depois do fechamento, no dia do fechamento, depois do fechamento projetado e efetivada sem fatura. Na leitura do SQLite local, as duas parcelas pendentes passaram para o mês do vencimento seguinte, e as parcelas com fatura oficial não mudaram.

A API do painel passa a data de referência ao cronograma. Uma fatura oficial que fecha depois dessa data e depois da compra é tratada como o ciclo aberto e define o mês da parcela. Os fechamentos anteriores à data servem só para projetar o próximo ciclo. Um teste sintético cobre a fatura aberta com fechamento fora do dia habitual. Os nove testes web e o build passaram, e o resultado com os dados locais não mudou. No painel local autenticado, servido pelo build de produção, a aba Cartões mostrou as duas parcelas pendentes como importadas em dezembro de 2026. As previsões seguintes começaram em janeiro de 2027.

## Cartões e faturas

Em 2026-11-08, o REQ-007 foi exercitado no navegador em duas instâncias locais autenticadas. A primeira usou a conexão real, com um cartão. A segunda usou um banco SQLite sintético, fora do projeto, com dois cartões e uma chave de teste descartável.

- **PASS.** O seletor alternou entre os dois cartões, identificados por nome e final mascarado. Com um único cartão, o seletor fica oculto.
- **PASS.** A estimativa do ciclo aberto aparece separada das faturas oficiais e soma apenas lançamentos `PENDING` sem fatura do cartão selecionado.
- **PASS.** O cartão sem faturas mostrou a ausência de fatura oficial e manteve a estimativa.
- **PASS.** Na fatura oficial, as compras vinculadas listaram a parcela 1/3 com o cartão correto. Na conexão real, a fatura mais recente listou 40 lançamentos, sendo 9 parcelas.
- **Situação.** A fatura da Pluggy informa vencimento, fechamento, valor, pagamento mínimo e opção de parcelamento. Não há campo de situação, então o painel não exibe uma.
- **Corrigido.** Em Faturas, vencimento e fechamento apareciam sem o ano. Com faturas de mais de 12 meses, ciclos diferentes ficavam com o mesmo rótulo, como dois vencimentos em 10 de novembro. Agora a lista usa dia, mês e ano, como Cartões. Um teste unitário cobre o formato, os dez testes web e o build passaram, e o navegador mostrou novembro de 2026 e novembro de 2025 separados na instância sintética. Com os dados locais da conexão real, o mesmo formatador produziu 15 rótulos distintos para as 15 faturas. O painel autenticado exibiu os mesmos 15 vencimentos com ano, de setembro de 2025 a novembro de 2026.
- **Cuidado no teste.** Instâncias locais no mesmo host compartilham o cookie de sessão mesmo em portas diferentes. Entrar na instância sintética encerrou a sessão da instância real. Use outro host de loopback ou um perfil de navegador separado.
- **Observação.** Na conexão real, a soma das compras vinculadas difere do valor oficial em alguns ciclos. O valor exibido é o informado pelo banco. A conciliação não faz parte deste requisito.

## Lançamentos ainda a caminho

Em 2026-11-09, a conexão real não tinha lançamentos de 7 e 8 de novembro. O Meu Pluggy tinha a mesma contagem, e o histórico mostrou que compras do cartão chegam do banco com dois a três dias de atraso. A conta chega em até um dia. Os 16 grupos com mesma data, valor e descrição tinham horários diferentes e eram lançamentos distintos.

O backend calcula, por conta, o último lançamento recebido e o atraso dentro do qual chegam 80% dos lançamentos dos 90 dias anteriores, no fuso de Brasília. Com menos de dez amostras, o atraso não é estimado. Extrato e Gastos avisam a partir de que dia a conta ainda pode receber lançamentos e mostram a próxima sincronização informada pela Pluggy. Cinco testes unitários cobrem atraso, fuso, histórico insuficiente, janela de 90 dias, conta selecionada, período e sincronização vencida. Os 22 testes web, a checagem de tipos e o build passaram.

No painel real, com período até 9 de novembro, o aviso indicou o cartão a partir de 7 de novembro, com atraso de até quatro dias, e a conta a partir de 8 de novembro, com atraso de até um dia. Também mostrou a próxima sincronização. Com o período até 5 de novembro não houve aviso. Até 7 de novembro, apenas o cartão apareceu. Gastos mostrou o mesmo aviso.

No mesmo dia, o usuário considerou o aviso poluição visual e pediu a remoção. O cálculo, o componente e os testes foram retirados. Os 17 testes web, a checagem de tipos e o build passaram, e o painel real deixou de exibir o aviso no Extrato e em Gastos. As medições de atraso acima continuam válidas como conhecimento sobre o conector.

## Atualização MeuPluggy

Em 2026-11-08, a conexão real recusou `PATCH /items/{id}` com HTTP 400 e a mensagem `MeuPluggy item cant be updated`. O worker repetia a tarefa sem registrar o motivo e bloqueava novos pedidos. Três testes com respostas sintéticas da Pluggy cobrem a recusa por MeuPluggy, seguida da reimportação, além de erro definitivo e erro temporário. Os 17 testes web, a checagem de tipos e o build passaram.

Com o worker corrigido, a tarefa que estava travada foi concluída e a reimportação atualizou a conexão sem erro no log. Um novo clique em Atualizar foi concluído em cerca de dois segundos, e o painel mostrou a sincronização no mesmo minuto. Lançamentos de 7 de novembro ainda não estavam na Pluggy, cuja próxima sincronização automática era em 9 de novembro.

## Ocultar saldos e faturas

REQ-016 · 2026-11-10 · PASS na web. Um teste unitário cobre a máscara, a ausência de dígitos no valor oculto e a preservação de campos ausentes. Os 18 testes web, a checagem de tipos e o build passaram.

No painel local com a conexão real, o botão do topo ocultou o saldo atual na Visão geral, o valor em aberto em Cartões, a estimativa do ciclo aberto, o valor e o pagamento mínimo das faturas em Faturas e os dez campos de saldo, limite e cheque especial em Conexões. Movimentações recentes, entradas, saídas, gastos por categoria e parcelas continuaram visíveis. Depois de recarregar a página, a preferência foi mantida. Ao clicar de novo, nenhum valor ficou mascarado. Limite: a preferência vale por navegador e não se aplica ao Android, que ainda não existe.

## Definição da stack

Em 2026-11-08, SPEC-0001-T001 passou em revisão documental. O [plano](plan.md) registra as escolhas e as fontes primárias sobre SDKs Pluggy, deep links no Expo, Route Handlers e autenticação. O público de uso pessoal é uma premissa da prova. A execução do widget, o retorno OAuth no Android e os demais critérios do produto continuam em `NOT_RUN`.

## Contrato de dados

Em 2026-11-08, SPEC-0001-T007 passou na leitura dos contratos oficiais e em um ensaio com SQLite em memória, executado pelo módulo `sqlite3` do Python com dados sintéticos. O ensaio verificou BRL em centavos, débito positivo de cartão, crédito negativo de pagamento, reimportação sem duplicar, transição de `PENDING` para `POSTED` e rollback após erro de integridade. A execução foi isolada e o esquema do ensaio não é uma migração do produto.

A validação autenticada de leitura e paginação está registrada abaixo. O corte de datas do extrato e as particularidades de conectores seguem pendentes. Veja o [contrato de dados](pluggy-data.md). Os critérios do produto continuam em `NOT_RUN`.

## Testes automatizados da Pluggy

Em 2026-11-08, foram executados cinco testes de contrato com Node.js 24 e SQLite em memória. Passaram conversão decimal, paginação simulada, reimportação, separação por moeda e status, preservação de data, rejeição de dados fora da conta ou Item e rollback. As respostas locais são sintéticas.

A chamada ao endpoint público de status da Pluggy retornou HTTP 200. A rota protegida de transações retornou HTTP 403 sem credencial. Em 2026-11-08, a autenticação com o `.env` passou. A API classificou o Item configurado como real, e a checagem interrompeu a leitura financeira. Em um Item sintético separado no Pluggy Bank Sandbox, o teste autenticado passou com 2 contas, 240 transações e 2 páginas, incluindo reimportação em SQLite sem duplicar. Uma segunda execução, com uma amostra de maior volume, também passou. A API retornou 2 contas e 1.440 transações únicas em 4 páginas, exercitando a continuação por cursor e a reimportação sem duplicatas. O teste preservou a data informada pelo provedor. A regra de corte do período no fuso do usuário e os testes de interface web e Android seguem em `NOT_RUN`.

### Connect Token e webhook

- **PASS na API.** A emissão de Connect Token com deep link Android passou. O token leu o próprio Item (HTTP 200). Outro Item sintético retornou 404 e a API de transações retornou 403. A suíte local e autenticada passou com seis testes.
- **PASS na abertura web.** A prova local abriu o widget com Connect Token e chegou à tela de termos. A aceitação dos termos e o callback do widget ficaram pendentes. A tentativa de criar o Item diretamente com o Connect Token retornou HTTP 400, `CREATE_ITEMS_API_FREE_DISABLED`. O retorno ao Android requer um build com deep link configurado.
- **PASS na consulta incremental.** A API v2 retornou 930 registros sintéticos em duas páginas usando `createdAtFrom`. Todos pertenciam à conta consultada e a resposta incluiu o lançamento que tinha exatamente a data de criação usada no filtro. Entrega de webhook pela Pluggy segue em `NOT_RUN`. [Fluxo previsto](pluggy-data.md#webhook-de-novas-transações).

### Executar

```sh
node --test --test-isolation=none tests/pluggy/*.test.mts
```

Para a prova autenticada, crie ou selecione um Item do Pluggy Bank Sandbox com sincronização concluída. Preencha `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` com as credenciais da aplicação no Dashboard da Pluggy e `PLUGGY_SANDBOX_ITEM_ID` com o ID do Item de teste. Com o `.env` na raiz, execute:

```sh
node --env-file=.env tests/pluggy/sandbox.test.mts
```

Se usar um cofre, o teste também aceita um arquivo JSON privado fora do repositório, com permissões 0400 ou 0600 e os campos `clientId`, `clientSecret` e `itemId`. Se informado, o caminho explícito tem precedência sobre as três variáveis.

```sh
PLUGGY_SANDBOX_CONFIG=/caminho/privado/pluggy-sandbox.json node tests/pluggy/sandbox.test.mts
```

O teste autentica no servidor, verifica `connector.isSandbox` antes de ler contas e transações e importa os mesmos registros duas vezes no SQLite em memória. Ele informa apenas contagens, sem imprimir credenciais ou conteúdo financeiro. A prova usa um Item existente e não o altera.

## Bootstrap documental

Em 2026-11-08, a auditoria local passou para os 38 arquivos, incluindo blocos de agente, catálogo, 9 registros, 69 links locais e rastreabilidade dos 5 requisitos nas 6 tarefas. A varredura textual não encontrou padrões de credenciais.

A reexecução do inicializador preservou todos os caminhos e hashes. A retomada foi simulada em uma cópia isolada dos arquivos e recuperou a SPEC-0001, a tarefa T001, a dependência de acesso ao sandbox e o resultado pendente dos testes de produto. O workspace não tinha Git operacional para comparar o diff. A revisão usou o inventário inicial e os arquivos criados.
