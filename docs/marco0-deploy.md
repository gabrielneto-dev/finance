# Marco 0: publicar o Finance em HTTPS com Supabase

Roteiro operacional da [SPEC-0005](../Specs/features/SPEC-0005--pwa-mobile/spec.md), tarefa T002. O código (Proxy de sessão, migração do dono e correção do Docker) já está no branch.

Quem faz cada passo:
- **Você:** criar contas, digitar senhas e chaves, e autorizar ações destrutivas.
- **O agente:** comandos e conferências que não envolvem credenciais.

A produção roda no **servidor de casa**, com Ubuntu Server, Docker e `cloudflared` já instalados (suas respostas de 2026-11-11). Ele **não** é a máquina que guarda o banco atual: o passo 3 leva os dados até ele. Pelo contexto do projeto, o banco mais recente está na máquina Linux, com o Item MeuPluggy vinculado em 2026-11-10.

Máquinas citadas:
- **Origem:** a máquina Linux com o SQLite atual.
- **Servidor:** o Ubuntu de casa.

Regras para o servidor de casa:
- **Não abra portas no roteador.** O túnel só faz conexões de saída. O Compose já publica o web só em `127.0.0.1:3000`.
- Docker e `cloudflared` precisam subir como serviços do sistema, para voltarem sozinhos depois de queda de luz ou reinício: `sudo systemctl enable --now docker` e `cloudflared service install`. Os contêineres já usam `restart: unless-stopped`.
- Mantenha o sistema atualizado (`unattended-upgrades`) e acesse por SSH com chave, não por senha.
- O servidor não precisa de Node instalado. Tudo roda dentro da imagem.

## 1. Supabase (você)

1. Crie um projeto em https://supabase.com. Região sugerida: São Paulo.
2. Em **Authentication**, desligue o cadastro aberto ("Allow new users to sign up"). O app já recusa outros e-mails, e isso fecha a porta também no Supabase.
3. Em **Authentication → Users**, crie o seu usuário com e-mail e senha forte e marque como confirmado. Use o mesmo e-mail de `FINANCE_OWNER_EMAIL`.
4. Anote o **UID** do usuário. É ele que entra na migração do passo 4.
5. Em **Project Settings → API Keys**, copie a URL do projeto e a chave **publicável**. Não use a chave `service_role`: o Finance não precisa dela.

## 2. Arquivo de ambiente da produção (você)

Crie `.env.production`. Ele vai para a raiz do projeto no servidor (passo 3.1), e o `.gitignore` já exclui esse arquivo. Copie as linhas da Pluggy do `.env` atual e ajuste:

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

## 3. Código e dados no servidor

### 3.1 Código

O branch `claude/mobile-pwa` precisa estar no GitHub para o servidor baixar. O repositório é público e o branch só tem código e documentação, sem segredos. No servidor:

```bash
git clone https://github.com/gabrielneto-dev/finance.git ~/finance && cd ~/finance && git switch claude/mobile-pwa
```

Coloque o `.env.production` do passo 2 em `~/finance/.env.production`, com `chmod 600`.

### 3.2 Exportar o banco na origem

Na origem, pare o `next start` e o worker. Antes de encerrar o worker, procure processos `node` com `worker.mjs`. Depois, na raiz do projeto:

```bash
(umask 077 && node -e "new (require('node:sqlite').DatabaseSync)('apps/web/data/finance.sqlite').exec(\"VACUUM INTO '/tmp/finance-export.sqlite'\")")
```

O `VACUUM INTO` gera um arquivo único e consistente, já com o conteúdo do WAL.

### 3.3 Enviar pela rede de casa

```bash
ssh <usuario>@<servidor> "mkdir -p ~/finance/apps/web/data/import && chmod 700 ~/finance/apps/web/data/import"
```

```bash
scp /tmp/finance-export.sqlite <usuario>@<servidor>:~/finance/apps/web/data/import/finance.sqlite
```

```bash
rm /tmp/finance-export.sqlite
```

Não use Git, e-mail nem nuvem: o repositório é público, e o banco tem dados bancários reais. A pasta `apps/web/data/` fica fora do Git pelo `.gitignore`.

### 3.4 Gerar a imagem e importar no volume (servidor)

Use `build`, e não `up`. Um `up` iniciaria web e worker, que criariam um banco vazio no volume antes da importação.

```bash
cd ~/finance && export FINANCE_ENV_FILE=.env.production && docker compose build
```

```bash
docker compose run --rm --no-deps -v "$PWD/apps/web/data/import:/src:ro" web cp -n /src/finance.sqlite /data/finance.sqlite
```

O `cp -n` não sobrescreve um banco que já exista no volume. O arquivo fica com o dono `node`, que é o usuário do contêiner.

## 4. Migração do dono (sua autorização antes do `--apply`)

Ainda no servidor, com `FINANCE_ENV_FILE` exportado e nada no ar:

```bash
docker compose run --rm --no-deps web node scripts/migrate-owner.mjs --to <UID>
```

```bash
docker compose run --rm --no-deps web node scripts/migrate-owner.mjs --to <UID> --apply
```

Funcionamento:
- **Sem `--apply`:** só mostra quantas linhas de cada tabela mudam de dono. Nenhum valor aparece.
- **Com `--apply`:**
  - antes de mudar qualquer coisa, grava `/data/backup-owner-<data>.sqlite` no volume;
  - troca o dono numa transação e confere as contagens;
  - se algo não bater, desfaz tudo.
- **Segunda execução:** é recusada, porque o destino já tem dados.

Para voltar atrás, com tudo parado, restaure pelo backup:

```bash
docker compose run --rm --no-deps web sh -c 'cp /data/backup-owner-<data>.sqlite /data/finance.sqlite && rm -f /data/finance.sqlite-wal /data/finance.sqlite-shm'
```

Depois de conferir que os dados aparecem no painel, apague a cópia de importação: `rm ~/finance/apps/web/data/import/finance.sqlite`.

A origem fica como estava, com o dono local, e pode seguir para desenvolvimento.

**Subir:**

```bash
docker compose up -d
```

```bash
docker compose ps
```

O `web` deve aparecer como `healthy`, e o `worker`, como `running`.

## 5. Túnel da Cloudflare (você e o agente)

O Compose publica o web em `127.0.0.1:3000` no servidor. Hoje o hostname aponta para `127.0.0.1:3001` ([decisão](../Context/branches/pluggy/decisions/DEC-20261110-endereco-publico.md)).

1. No painel Zero Trust da Cloudflare, em **Networks → Tunnels**, mude o destino do hostname `finance.vetracompany.com.br` para `http://127.0.0.1:3000`, no túnel cujo conector roda no **servidor**.
2. **Cuidado com dois conectores no mesmo túnel.** Se esse túnel também tiver um conector ligado em outra máquina, a Cloudflare reparte as requisições entre eles, e parte delas cai na máquina errada. Confira na aba de conectores que só o servidor está ativo. Se precisar, pare o `cloudflared` da outra máquina.

## 6. Webhooks da Pluggy

```bash
docker compose exec web node scripts/register-webhooks.mjs
```

Depois, no Dashboard da Pluggy, desative o cadastro antigo `all` em `/connections/pluggy/callback`. Isso exige a sua confirmação.

## 7. Backup periódico

```bash
cd ~/finance && FINANCE_ENV_FILE=.env.production docker compose exec -T web node -e "new (require('node:sqlite').DatabaseSync)('/data/finance.sqlite').exec(\"VACUUM INTO '/data/backup-\" + new Date().toISOString().slice(0,10) + \".sqlite'\")"
```

Copie esses arquivos para **outro aparelho** ou disco externo, de preferência criptografado. Um backup no mesmo disco do servidor de casa não protege contra a perda desse disco. Agende o comando no `cron` do servidor, uma vez por dia. Apague os backups antigos do volume depois de copiá-los.

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
| Desenvolvimento intacto | Na origem, o modo de chave local continua abrindo em `127.0.0.1:3001` |
| Volta sozinho | `sudo reboot` no servidor: depois de alguns minutos, o painel responde pelo domínio sem intervenção |
