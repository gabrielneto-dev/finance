# Plano técnico proposto

## Fase 1 — consulta periódica (REQ-001, REQ-002)

- **Agendamento no worker.** A cada minuto, o laço de `apps/web/scripts/worker.mjs` chama `schedulePolls` (`lib/poll.mjs`). A função enfileira uma tarefa `poll` por conexão ativa, conforme o intervalo da situação:
  - **Normal:** `PLUGGY_POLL_MINUTES`, com padrão de 60 a pedido do usuário e mínimo de 15.
  - **Sincronização prevista:** depois de `nextAutoSyncAt`, a cada 10 minutos por até 2 horas, até ver a sincronização nova.
  - **Meu Pluggy:** depois do atalho, a cada 2 minutos por 30 minutos (`watch_until`).

  A função não enfileira se houver qualquer tarefa pendente do Item. A data da última consulta fica em `connections.polled_at`, e consultas concluídas há mais de um dia são apagadas. A tarefa passa pela fila existente e herda as novas tentativas de `processJob`.
- **Comparação.** A tarefa `poll` faz `GET /items/{id}` e compara `lastUpdatedAt` com a coluna `connections.provider_updated_at`, criada por migração idempotente. A reimportação completa (`fullSync`) grava essa coluna, inclusive quando vem do Atualizar ou de um webhook.
  - Se a data avançou e o Item terminou em `UPDATED` com `SUCCESS`, roda a reimportação completa, que já existe e é idempotente.
  - Se a Pluggy está sincronizando, só grava os detalhes.
  - Em erro, `PARTIAL_SUCCESS` incluído, aplica o estado da conexão como antes.
  - Os detalhes da conexão (`nextAutoSyncAt`, `executionStatus`) são gravados de qualquer forma.
  - Erros de status seguem o mapeamento que já existe para `item/error`.
- **Por que reimportar tudo.** Sem webhook, não há `transactions/updated`, e um `createdAtFrom` não pega compras que passaram de pendentes para efetivadas. A reimportação completa só lê a API da Pluggy e roda uma vez por sincronização, cerca de uma vez por dia no MeuPluggy.
- **Conexões.** Exibir "Sincronizado pela Pluggy em …" e "Próxima sincronização prevista …". Em conexões MeuPluggy, mostrar um link "Atualizar no Meu Pluggy" para `https://meu.pluggy.ai`. Depois de usar o link, a consulta periódica traz os dados sozinha.
- **Testes com dados sintéticos e `fetch` simulado.** Cobrem:
  - `lastUpdatedAt` igual não enfileira nada;
  - data nova enfileira `initial`;
  - conexão inativa é ignorada;
  - não há tarefa `poll` duplicada;
  - 429 adia a tarefa;
  - nenhum `PATCH` é enviado.
- **Verificação real.** Confirmar que uma sincronização diária ou um Atualizar no Meu Pluggy aparece no painel sem clique. Medir no Dashboard da Pluggy, em Logs e métricas, se as leituras não geram 423.

## Fase 2 — webhook real (REQ-003)

- Escolher a exposição HTTPS:
  - **Túnel com domínio fixo** (por exemplo, Cloudflare Tunnel): mantém o app local.
  - **Hospedagem do web e do worker:** retoma a homologação adiada.
- Antes de expor, ativar a autenticação do painel. O acesso por chave local ou o Supabase Auth seguem a [decisão de acesso](../../../Context/branches/produto/decisions/DEC-20261108-acesso-finance.md).
- Configurar `PLUGGY_WEBHOOK_SECRET` com pelo menos 32 caracteres e a origem HTTPS. Rodar `scripts/register-webhooks.mjs` para inscrever os eventos com o header secreto.
- Conferir a entrega no Dashboard da Pluggy e no estado do webhook em Conexões. Lembrar que a Pluggy não repete depois de 400, 401, 403, 404 ou 405.
- Manter a consulta da fase 1 com intervalo maior, por exemplo 60 minutos, para reconciliar eventos perdidos.

## Fase 3 — Item Open Finance direto (REQ-004), condicionada a decisão

1. O usuário consulta a Pluggy sobre:
   - plano e preço da aplicação de produção;
   - agenda de até 4 horários por dia;
   - remoção do limite de um `PATCH` por hora;
   - divisão da cota com o Meu Pluggy.

   Registrar a decisão em `Context/`.
2. Conectar o banco pelo widget com o conector Open Finance da aplicação de produção. Usar `products` só com o necessário.
3. Migrar com os dois Items ativos por pouco tempo:
   - importar o novo Item e conferir contas, cartões e faturas;
   - desvincular o Item MeuPluggy e apagar os dados dele;
   - não manter os dois depois da conferência, para não dividir a cota.
4. O Atualizar volta a enviar `PATCH`. A interface explica o intervalo mínimo quando a Pluggy recusar com `CLIENT_IS_UPDATING_BEFORE_ALLOWED_FREQUENCY`.
5. Em Conexões, mostrar os produtos com `isUpdated: false` e aviso `423` como "limite mensal do banco atingido".

## Riscos

- **Exposição pública** (fase 2): dados financeiros acessíveis pela internet. Mitigar com autenticação obrigatória, segredo do webhook e HTTPS. Ver o [risco do repositório público](../../../Context/global/risks/RSK-20261109-repositorio-publico.md).
- **Cota do Open Finance** (fase 3): mais rodadas por dia ou Items duplicados esgotam a cota mensal, e os dados param até o mês seguinte.
- **Expectativa:** o atraso de dois a três dias das compras do cartão vem do banco e não some com mais rodadas.
