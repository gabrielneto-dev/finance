# Verificação da atualização frequente

## Consulta periódica

REQ-001 · 2026-11-10 · PASS parcial.

**Testes sintéticos.** Dez testes em `apps/web/test/poll.test.mjs` cobrem:
- o intervalo padrão de 60 minutos e o mínimo de 15;
- a ausência de tarefa duplicada;
- conexões inativas ou sem importação;
- a janela de 10 minutos após `nextAutoSyncAt` e o retorno ao intervalo normal;
- a vigilância de 2 minutos por 30 minutos, restrita ao dono da conexão;
- a limpeza de consultas antigas;
- a importação só quando `lastUpdatedAt` avança;
- a espera enquanto a Pluggy sincroniza;
- o estado RECONECTAR em erro de login;
- o adiamento em HTTP 429.

Nenhum cenário envia `PATCH`. Os 42 testes web, a checagem de tipos e o build passaram.

**Conexões reais.**
- Na subida, o worker consultou as duas conexões MeuPluggy, importou cada uma uma vez e gravou o `lastUpdatedAt` da Pluggy.
- Uma segunda rodada forçada, sem sincronização nova, concluiu as consultas sem reimportar.
- Atualização pelo Meu Pluggy, em 2026-11-10: o usuário entrou no meu.pluggy.ai e a conexão do Mercado Pago foi atualizada às 19h49m54s UTC. A conexão estava em vigilância e o worker importou sem nenhum clique no Finance:
  - a consulta das 19h48 não viu novidade;
  - a das 19h50 viu o novo `lastUpdatedAt` e importou às 19h50m51s, cerca de um minuto depois da sincronização;
  - a Pluggy remarcou a próxima sincronização automática para 24 horas depois da atualização manual;
  - nenhum lançamento novo veio nessa rodada, porque não havia movimentação desde a sincronização anterior.
- Atualização do Santander pelo Meu Pluggy, em 2026-11-10: a Pluggy sincronizou às 19h53m14s UTC e o worker importou às 19h54m53s, na consulta seguinte da vigilância. Vieram quatro lançamentos novos: três compras pendentes no cartão, de 8 e 9 de novembro, e um lançamento efetivado na conta, de 10 de novembro.
- Falta observar a sincronização diária automática chegando sozinha. As atualizações manuais remarcaram as próximas para 2026-11-11, às 19h49 UTC (Mercado Pago) e 19h53 UTC (Santander).

Antes de reiniciar, dois processos `node` antigos do worker continuavam vivos e foram encerrados. Assim só o código novo processou a fila.

## Situação em Conexões

REQ-002 · 2026-11-10 · PASS. Conferido no navegador, no build de produção, com as duas conexões reais e os valores ocultos:
- a linha de cada conexão mostra "Sincronizado com o banco em …" com o `lastUpdatedAt` da Pluggy;
- os detalhes mostram a última sincronização com o banco, a próxima sincronização automática (`nextAutoSyncAt`, 24 horas depois) e a data da importação no Finance;
- as duas conexões MeuPluggy exibem o link "Atualizar no Meu Pluggy" para `https://meu.pluggy.ai`;
- o clique enviou a ação `watch` (HTTP 202) e mostrou "Depois de atualizar no Meu Pluggy, os dados novos chegam aqui em poucos minutos.";
- no SQLite, a conexão recebeu 30 minutos de vigilância, e o worker enfileirou e concluiu uma consulta no minuto seguinte;
- nenhum aviso de lançamento atrasado aparece.

O painel embutido bloqueia novas abas abertas por automação, então a abertura do meu.pluggy.ai depende do clique do usuário. O link usa `target="_blank"` com `rel="noopener noreferrer"`.
