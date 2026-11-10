---
id: "CTX-RES-20261110-frequencia-atualizacao"
type: "research"
title: "Como atualizar transações, extrato e cartões com mais frequência"
branch: "pluggy"
tags: ["pluggy"]
status: "active"
created_at: "2026-11-10"
updated_at: "2026-11-10"
confidence: "high"
source_ids: ["CTX-SRC-20261108-documentacao-pluggy"]
related: ["CTX-RES-20261109-sincronizacao-meupluggy", "CTX-DEC-20261109-atualizacao-conexoes", "CTX-DEC-20261109-sem-avisos-de-atraso"]
---

# Como atualizar transações, extrato e cartões com mais frequência

**Método.** Leitura da documentação oficial da Pluggy em 2026-11-10: Item, ciclo de vida do Item, atualização de Item, limites do Open Finance, webhooks, guia Meu Pluggy e changelog de 2026. Comparação com o worker e o receptor de webhook em `apps/web`. Sem chamadas à API nem dados financeiros.

## Duas demoras diferentes

O atraso que a pessoa vê soma duas etapas:

1. **Banco → Pluggy.** Depende de quantas vezes o Item sincroniza com a instituição. Na conexão MeuPluggy, o Item original sincroniza a cada 24 horas, de graça. Essa frequência não depende do plano da aplicação. O Item proxy não tem agenda própria e não aceita `PATCH /items/{id}`.
2. **Pluggy → Finance.** Depende de o Finance saber que a Pluggy sincronizou. O worker não consulta a Pluggy sozinho. Ele só importa quando alguém clica em Atualizar ou quando chega um webhook. Sem endereço HTTPS público, nenhum webhook chega. Por isso a sincronização diária da Pluggy pode ficar horas sem aparecer no painel.

A etapa 2 é resolvível sem custo e sem mudar de conexão. A etapa 1 só melhora saindo do MeuPluggy.

## O que a documentação permite

**Auto-sync em Items diretos.** Só existe em aplicações de produção. A Pluggy configura a agenda na aplicação, pelo gerente de conta, conforme o plano. As opções vão de 6 a 96 horas, ou até 4 horários fixos por dia. Uma caixa da mesma página ainda cita só 8, 12 ou 24 horas, então confirme as opções com a Pluggy. O padrão é uma vez por dia. `nextAutoSyncAt` é a data mínima da próxima rodada e pode atrasar. Depois de erro, a Pluggy tenta de hora em hora até 5 vezes. Com `LOGIN_ERROR`, não tenta mais.

**Atualização manual.** `PATCH /items/{id}` aceita no máximo uma chamada por hora em client IDs novos. Desde agosto de 2026, client IDs novos também recebem uma frequência mínima padrão (`minUpdateFrequencyAllowedInHours`). Pedidos antes do prazo voltam com `CLIENT_IS_UPDATING_BEFORE_ALLOWED_FREQUENCY`, e o suporte pode ajustar. Cada atualização recoleta os dados desde a última, com margem de até 4 dias.

**Limites do Open Finance.** São mensais, por CPF, instituição e produto, e compartilhados entre todos os Items do mesmo CPF na mesma instituição. Cada execução do Item conta uma consulta:

| Produto | Limite mensal | Quando é consultado |
| --- | --- | --- |
| Saldo da conta | 420 | A cada atualização |
| Transações recentes da conta, 1 a 6 dias | 240 | A cada atualização |
| Transações antigas da conta, 7 a 365 dias | 4 | Na criação e a cada 7 dias |
| Limites e transações recentes do cartão | 240 | A cada atualização |
| Faturas e transações de fatura | 30 | Na criação e uma vez por dia |

A Pluggy afirma que um único Item por CPF e instituição, com até 4 atualizações por dia, nunca atinge os limites. São cerca de 124 execuções em 31 dias. Investimentos têm limite de 120 e pedem até 3 por dia. Ao estourar, o Item termina em `PARTIAL_SUCCESS`, e o produto afetado traz o aviso `423` em `statusDetail`. O limite não volta antes do mês seguinte. Faturas atualizam no máximo uma vez por dia em qualquer cenário.

**Webhooks.** Eventos úteis: `item/updated`, `item/error`, `transactions/created`, `transactions/updated` e `transactions/deleted`. Items MeuPluggy recebem webhooks como os demais. A URL precisa ser HTTPS pública, porque `localhost` e IPs privados são recusados. A resposta `2xx` precisa sair em até 10 segundos. A Pluggy tenta 3 vezes: na hora, depois de cerca de 15 minutos e depois de cerca de 2 horas. Não repete em 400, 401, 403, 404 e 405. Headers personalizados, como o segredo do Finance, só valem na inscrição por `POST /webhooks`. Desde agosto de 2026, `transactions/updated` chega em blocos de até 400 IDs.

**Mudanças de 2026 que afetam a escolha.** Em julho, a Pluggy começou a descontinuar os conectores diretos para pessoa física, e o caminho direto passa a ser o Open Finance. Também em julho, conexões Open Finance com 5 erros seguidos passaram a ser retentadas uma vez por dia. O guia Meu Pluggy limita o uso pessoal a 5 conexões, sem uso comercial. Empresas seguem o fluxo comercial.

## Opções avaliadas

| Opção | Ganho | Custo e limites |
| --- | --- | --- |
| Worker consulta `GET /items/{id}` e importa quando `lastUpdatedAt` muda | O painel recebe a sincronização diária minutos depois, sem webhook público | Só leitura da API da Pluggy. Pela regra da página de limites, a cota conta execuções do Item, não leituras. Confirme na primeira medição |
| Webhook real por HTTPS público | Aviso imediato de `item/updated` e `transactions/*` | Exige túnel ou hospedagem com HTTPS. O receptor, a fila e `scripts/register-webhooks.mjs` já existem |
| Atualizar no app Meu Pluggy | Sincroniza com o banco sob demanda | Manual e fora do Finance. Consome a cota |
| Item direto Open Finance em aplicação de produção, com auto-sync de até 4 vezes por dia | Até 4 rodadas por dia com o banco, mais o `PATCH` pelo Finance | Contrato e plano com a Pluggy, aprovação comercial e nova autorização no banco. Remover o Item MeuPluggy da mesma instituição para não dividir a cota |
| `PATCH` em Item MeuPluggy ou vários Items do mesmo banco | Nenhum | Proibido no proxy. Vários Items esgotam a cota mais cedo |

## Limites do que se ganha

- Mais rodadas trazem antes os lançamentos da conta bancária, que costumam chegar no mesmo dia.
- Compras do cartão chegaram com dois a três dias de atraso na conexão medida. Esse atraso vem do banco, e mais rodadas reduzem pouco.
- Faturas mudam no máximo uma vez por dia.
- Ficam por confirmar com a Pluggy:
  - preço e plano da aplicação de produção;
  - a agenda que eles aceitam configurar;
  - se a cota do Open Finance é dividida entre o Item original do Meu Pluggy e um Item direto do mesmo CPF.

## Observado na fase 1 (2026-11-10)

- Nas duas conexões reais, `lastUpdatedAt` fica 24 horas antes de `nextAutoSyncAt`. Isso confirma a rodada diária do Item original.
- Uma atualização manual no app Meu Pluggy remarca `nextAutoSyncAt` para 24 horas depois dela. Atualizar à tarde empurra a rodada automática do dia seguinte para o mesmo horário.
- Com a vigilância de 2 minutos, o Finance importou cerca de um a dois minutos depois de a Pluggy terminar. O Mercado Pago não trouxe lançamento novo. O Santander trouxe compras pendentes do cartão de um e dois dias antes e um lançamento da conta do mesmo dia.
- O Meu Pluggy lista três conexões compartilhadas com o app do Finance ("Meu Assessor"), sendo duas da mesma instituição, enquanto o Finance usa uma. Se a sobra for um Item ativo, ela pode dividir a cota do Open Finance. O usuário decide se revoga.
- A cota não foi medida no Dashboard da Pluggy. Nenhum `423` apareceu nas conexões.

## Recomendação

Primeiro, resolver a etapa Pluggy → Finance sem custo: consultar periodicamente e ligar o webhook real quando houver HTTPS público. Depois, decidir com o usuário se vale contratar uma aplicação de produção para ter até 4 rodadas por dia. O plano de execução está na [SPEC-0002](../../../../Specs/features/SPEC-0002--atualizacao-frequente/spec.md).

Fontes:
- [Item](https://docs.pluggy.ai/en/docs/connections/item)
- [Ciclo de vida do Item](https://docs.pluggy.ai/en/docs/connections/item-lifecycle)
- [Atualizando um Item](https://docs.pluggy.ai/pt/docs/connect-widget/updating-item)
- [Limites do Open Finance](https://docs.pluggy.ai/pt/docs/open-finance/rate-limits)
- [Considerações do Open Finance](https://docs.pluggy.ai/pt/docs/open-finance/considerations-faq)
- [Webhooks](https://docs.pluggy.ai/docs/webhooks)
- [Meu Pluggy para uso pessoal](https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use)
- [Changelog](https://docs.pluggy.ai/pt/changelog)
