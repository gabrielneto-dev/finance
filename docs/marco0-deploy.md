# Marco 0: publicar o Finance em HTTPS com Supabase

Roteiro operacional da [SPEC-0005](../Specs/features/SPEC-0005--pwa-mobile/spec.md), tarefa T002. O código (Proxy de sessão, migração do dono e correção do Docker) já está no branch.

Quem faz cada passo:
- **Você:** criar contas, digitar senhas e chaves, e autorizar ações destrutivas.
- **O agente:** comandos e conferências que não envolvem credenciais.

A produção roda no **servidor da sua casa** (sua resposta de 2026-11-11). HIPÓTESE: ele tem Docker e roda o `cloudflared`. Se ele não for a máquina que hoje guarda o SQLite atual, o passo 3a leva os dados até ele.

Regras para o servidor de casa:
- **Não abra portas no roteador.** O túnel só faz conexões de saída. O Compose já publica o web só em `127.0.0.1:3000`.
- Deixe Docker e `cloudflared` subindo como serviços do sistema, para voltarem sozinhos depois de queda de luz ou reinício.
- Mantenha o sistema atualizado e acesse por SSH com chave, não por senha.

## 1. Supabase (você)

1. Crie um projeto em https://supabase.com. Região sugerida: São Paulo.
2. Em **Authentication**, desligue o cadastro aberto ("Allow new users to sign up"). O app já recusa outros e-mails, e isso fecha a porta também no Supabase.
3. Em **Authentication → Users**, crie o seu usuário com e-mail e senha forte e marque como confirmado. Use o mesmo e-mail de `FINANCE_OWNER_EMAIL`.
4. Anote o **UID** do usuário. É ele que entra na migração do passo 3.
5. Em **Project Settings → API Keys**, copie a URL do projeto e a chave **publicável**. Não use a chave `service_role`: o Finance não precisa dela.

## 2. Arquivo de ambiente da produção (você)

Crie `.env.production` na raiz. O `.gitignore` já exclui esse arquivo. Copie as linhas da Pluggy do `.env` atual e ajuste:

```
APP_ORIGIN=https://finance.vetracompany.com.br
FINANCE_LOCAL_KEY_HASH=
FINANCE_OWNER_EMAIL=<seu e-mail>
SUPABASE_URL=<URL do projeto>
SUPABASE_PUBLISHABLE_KEY=<chave publicável>
PLUGGY_CLIENT_ID=<igual ao .env>
PLUGGY_CLIENT_SECRET=<igual ao .env>
PLUGGY_SANDBOX=0
PLUGGY_EXISTING_ITEM_ID=
PLUGGY_WEBHOOK_SECRET=<o mesmo, ou um novo gerado com openssl rand -hex 32>
```

O `.env` de desenvolvimento continua igual, com `APP_ORIGIN=http://127.0.0.1:3001` e a chave local.

## 3. Migração do dono (autorização sua antes do `--apply`)

Pare o servidor e o worker locais. Antes de encerrar o worker, procure processos `node` com `worker.mjs`.

Depois rode, na raiz:

```bash
npm --prefix apps/web run migrate-owner -- --to <UID>
```

```bash
npm --prefix apps/web run migrate-owner -- --to <UID> --apply
```

Funcionamento:
- **Sem `--apply`:** só mostra quantas linhas de cada tabela mudam de dono. Nenhum valor aparece.
- **Com `--apply`:**
  - antes de mudar qualquer coisa, grava `backup-owner-<data>.sqlite` na pasta do banco;
  - troca o dono numa transação e confere as contagens;
  - se algo não bater, desfaz tudo.
- **Segunda execução:** é recusada, porque o destino já tem dados.

Para voltar atrás: com o painel parado, substitua `finance.sqlite` pelo backup e apague `finance.sqlite-wal` e `finance.sqlite-shm`.

**Atenção:** depois da migração, os dados deixam de aparecer no modo de chave local, porque o dono agora é o usuário Supabase. Para desenvolver, use uma cópia sintética ou o backup.

## 3a. Levar os dados para o servidor de casa (se for outra máquina)

Na máquina que tem o banco atual, com web e worker parados, gere uma cópia única com `VACUUM INTO`. Envie-a por `scp` pela rede de casa, junto com o `.env.production`. Não use Git, e-mail nem nuvem: o repositório é público, e o banco tem dados bancários reais. No servidor, coloque a cópia em `apps/web/data/finance.sqlite` e rode a migração do passo 3 ali. Pelo contexto do projeto, o banco mais recente é o da máquina Linux, com o Item MeuPluggy vinculado em 2026-11-10.

## 4. Subir web e worker (agente, com você por perto)

```bash
FINANCE_ENV_FILE=.env.production docker compose up -d --build
```

Copie o banco migrado para o volume com tudo parado:

```bash
FINANCE_ENV_FILE=.env.production docker compose stop
```

```bash
FINANCE_ENV_FILE=.env.production docker compose run --rm --no-deps -v "$PWD/apps/web/data:/src:ro" web node -e "new (require('node:sqlite').DatabaseSync)('/src/finance.sqlite').exec(\"VACUUM INTO '/data/finance.sqlite'\")"
```

```bash
FINANCE_ENV_FILE=.env.production docker compose up -d
```

O `VACUUM INTO` gera um arquivo único, já com o conteúdo do WAL, criado pelo usuário `node` do contêiner. O comando falha se `/data/finance.sqlite` já existir. Nesse caso, confira o volume antes de seguir, porque substituir o arquivo é uma ação destrutiva.

## 5. Túnel da Cloudflare (você e o agente)

O Compose publica o web em `127.0.0.1:3000`. Hoje o túnel aponta para `127.0.0.1:3001` ([decisão](../Context/branches/pluggy/decisions/DEC-20261110-endereco-publico.md)). Mude o destino do hostname `finance.vetracompany.com.br` para `http://127.0.0.1:3000` e ligue o `cloudflared` na mesma máquina.

## 6. Webhooks da Pluggy

```bash
FINANCE_ENV_FILE=.env.production docker compose exec web node scripts/register-webhooks.mjs
```

Depois, no Dashboard da Pluggy, desative o cadastro antigo `all` em `/connections/pluggy/callback`. Isso exige a sua confirmação.

## 7. Backup periódico

```bash
FINANCE_ENV_FILE=.env.production docker compose exec -T web node -e "new (require('node:sqlite').DatabaseSync)('/data/finance.sqlite').exec(\"VACUUM INTO '/data/backup-\" + new Date().toISOString().slice(0,10) + \".sqlite'\")"
```

Copie esses arquivos para **outro aparelho** ou disco externo, de preferência criptografado. Um backup no mesmo disco do servidor de casa não protege contra a perda desse disco. Agende o comando no `cron` do servidor, uma vez por dia.

## 8. Aceite do Marco 0

| Critério | Como conferir |
| --- | --- |
| Login pelo 4G | Celular fora do Wi-Fi, `https://finance.vetracompany.com.br`, entrar com o usuário Supabase |
| Outro e-mail recusado | Tentar outro e-mail: "E-mail ou senha inválidos." |
| 401 sem sessão | `curl -s -o /dev/null -w "%{http_code}" "https://finance.vetracompany.com.br/api/dashboard?from=2026-11-01&to=2026-11-11"` responde `401` |
| Sessão estável | Usar, deixar 2 h parado e voltar; depois, no dia seguinte. Sem novo login |
| Sair revoga | Sair e voltar à página anterior: pede login |
| Webhook | Pluggy → Events mostra 204, e Conexões mostra "Processado" |
| Dados preservados | Contagens da migração iguais antes e depois. Visão geral com os mesmos saldos |
| Desenvolvimento intacto | O modo de chave local continua abrindo em `127.0.0.1:3001` |
