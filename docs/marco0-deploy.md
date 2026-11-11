# Marco 0: publicar o Finance no servidor de casa

Roteiro operacional da [SPEC-0005](../Specs/features/SPEC-0005--pwa-mobile/spec.md), tarefa T002. Código, scripts e imagem estão prontos e testados no branch `claude/mobile-pwa`.

**Servidor:** Ubuntu Server de casa, com Docker e `cloudflared`. Ele não é a máquina que guarda o banco atual.

**Decisão de 2026-11-11:** o banco atual não vai para o servidor. A produção começa vazia, e você **reconecta** a conta da Pluggy pelo painel publicado.

| Volta sozinho | Fica para trás |
| --- | --- |
| Contas, saldos, faturas e o histórico de lançamentos que a Pluggy guardar. A importação inicial busca tudo o que ela tiver | O que só existia no SQLite local: Planejamento (caixinhas, metas, projeções, investimentos manuais), categorias escolhidas, nomes das conexões e contas marcadas como do negócio |

Quem faz cada passo:
- **Você:** criar contas, digitar senhas e chaves, e confirmar ações destrutivas.
- **O agente:** comandos e conferências sem credenciais.

## Regras para o servidor de casa

- **Não abra portas no roteador.** O túnel só faz conexões de saída. O Compose publica o web só em `127.0.0.1:3000`.
- Docker e `cloudflared` sobem como serviços do sistema, para voltarem sozinhos depois de queda de luz ou reinício. Os contêineres já usam `restart: unless-stopped`.
- Mantenha o sistema atualizado (`unattended-upgrades`) e acesse por SSH com chave.
- O servidor não precisa de Node. Tudo roda dentro da imagem.

## 1. Supabase (você)

1. Crie um projeto em https://supabase.com. Região sugerida: São Paulo.
2. Em **Authentication**, desligue o cadastro aberto ("Allow new users to sign up").
3. Em **Authentication → Users**, crie o seu usuário com e-mail e senha forte e marque como confirmado. Use o mesmo e-mail de `FINANCE_OWNER_EMAIL`.
4. Em **Project Settings → API Keys**, copie a URL do projeto e a chave **publicável**. Não use a chave secreta (`service_role`). O deploy recusa chaves `sb_secret_`.

O plano gratuito pausa projetos com pouca atividade em 7 dias e manda um e-mail antes ([documentação](https://supabase.com/docs/guides/platform/free-project-pausing)). Usar o Finance com frequência deve bastar.

## 2. Preparar o servidor (uma vez)

```bash
sudo systemctl enable --now docker
```

```bash
sudo usermod -aG docker "$USER"
```

Saia e entre de novo no SSH para o grupo `docker` valer. Depois:

```bash
git clone https://github.com/gabrielneto-dev/finance.git ~/finance && cd ~/finance && git switch claude/mobile-pwa
```

```bash
cp .env.production.example .env.production && chmod 600 .env.production && nano .env.production
```

No `.env.production`, preencha as variáveis abaixo. Os comentários do arquivo explicam cada uma.
- **Supabase:** `FINANCE_OWNER_EMAIL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
- **Pluggy:** `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`, iguais aos do `.env` atual.
- **Webhook:** `PLUGGY_WEBHOOK_SECRET`, gerado com `openssl rand -hex 32`.

Para reconectar sem nova autorização, ponha também em `PLUGGY_EXISTING_ITEM_ID` o id do Item MeuPluggy atual. Ele está no `.env` da máquina Linux.

## 3. Publicar

```bash
cd ~/finance && bash deploy/deploy.sh
```

O script faz o seguinte:
1. Confere Docker e o `.env.production`, sem mostrar valores, e recusa a publicação nestes casos:
   - chave local preenchida;
   - origem sem HTTPS ou terminada em barra;
   - variável obrigatória vazia;
   - chave secreta do Supabase;
   - segredo de webhook curto.
2. Faz `git pull`, gera a imagem e sobe web e worker.
3. Espera o web ficar saudável e confere `/api/health` e o worker.

Para atualizar depois, rode o mesmo comando. O volume com o banco é preservado.

## 4. Túnel da Cloudflare (você)

1. No painel Zero Trust, em **Networks → Tunnels**, abra o túnel do `finance.vetracompany.com.br` e instale um conector no servidor. O painel mostra um comando `sudo cloudflared service install <token>`. Ele já instala o conector como serviço.
2. No hostname público `finance.vetracompany.com.br`, aponte o serviço para `http://localhost:3000`. Hoje ele aponta para a porta 3001 de outra máquina.
3. **Desligue os conectores de outras máquinas nesse túnel.** Com dois conectores ativos, a Cloudflare reparte as requisições, e parte delas cai na máquina errada.

## 5. Webhooks da Pluggy

Com o domínio respondendo:

```bash
bash deploy/deploy.sh --webhooks
```

O script confere `https://finance.vetracompany.com.br/api/health` e cadastra os nove eventos em `/api/webhooks/pluggy`. Depois, no Dashboard da Pluggy, desative o cadastro antigo `all` em `/connections/pluggy/callback`. Isso exige a sua confirmação.

## 6. Reconectar a conta (você, pelo navegador)

Entre em `https://finance.vetracompany.com.br` com o usuário do Supabase e abra **Conexões**.

- **Mais rápido:** **Importar conexão existente**, se `PLUGGY_EXISTING_ITEM_ID` foi preenchido. O Item atual é vinculado sem nova autorização, e o worker importa o histórico.
- **Alternativa:** **Conectar instituição**, que abre o widget e cria uma nova autorização. O retorno do OAuth já usa `https://finance.vetracompany.com.br/pluggy/retorno`. A reautorização também libera os investimentos da SPEC-0004-T012.

A conexão passa para **Conectada** quando o worker termina.

A primeira importação não gera avisos de transferência, como hoje.

## 7. Backup diário

```bash
cd ~/finance && bash deploy/backup.sh
```

O script funciona assim:
- gera uma cópia consistente com `VACUUM INTO`, mesmo com o painel no ar;
- tira a cópia do volume e salva em `~/finance/backups`, fora do Git, com permissão 600;
- apaga as cópias com mais de 14 dias.

Para apontar o backup para um disco externo, que é o recomendado, e agendar no cron (`crontab -e`):

```
30 3 * * * cd ~/finance && FINANCE_BACKUP_DIR=/mnt/backup/finance bash deploy/backup.sh >> ~/finance-backup.log 2>&1
```

**Restaurar** (ação destrutiva, só com tudo parado). Rode os passos em `~/finance`, com `export FINANCE_ENV_FILE=.env.production`:

1. Pare tudo:

   ```bash
   docker compose stop
   ```

2. Copie o backup para o volume e apague os arquivos de WAL antigos:

   ```bash
   docker compose run --rm --no-deps -v /mnt/backup/finance:/b:ro web sh -c 'cp /b/<arquivo>.sqlite /data/finance.sqlite && rm -f /data/finance.sqlite-wal /data/finance.sqlite-shm'
   ```

3. Suba de novo:

   ```bash
   bash deploy/deploy.sh --no-pull
   ```

## 8. Aceite do Marco 0

| Critério | Como conferir |
| --- | --- |
| Login pelo 4G | Celular fora do Wi-Fi, `https://finance.vetracompany.com.br`, entrar com o usuário Supabase |
| Outro e-mail recusado | Tentar outro e-mail: "E-mail ou senha inválidos." |
| 401 sem sessão | `curl -s -o /dev/null -w "%{http_code}" "https://finance.vetracompany.com.br/api/dashboard?from=2026-11-01&to=2026-11-11"` responde `401` |
| Sessão estável | Usar, deixar 2 h parado e voltar. Repetir no dia seguinte. Não pode pedir novo login |
| Sair revoga | Sair e voltar à página anterior: pede login |
| Webhook | Pluggy → Events mostra 204, e Conexões mostra "Processado" |
| Conta reconectada | Conexões "Conectada", e a Visão geral mostra os mesmos saldos do banco |
| Volta sozinho | `sudo reboot` no servidor: depois de alguns minutos, o painel responde pelo domínio sem intervenção |
| Desenvolvimento intacto | Na máquina Linux, o modo de chave local continua abrindo em `127.0.0.1:3001` |

## Apêndice: migrar o banco em vez de reconectar

O script `migrate-owner` continua no código, testado. Ele troca o dono dos dados locais para o UID do Supabase, preservando o Planejamento e as categorias. Para usá-lo:
1. exporte o banco com `VACUUM INTO`;
2. leve-o por `scp`;
3. copie para o volume com `cp -n`;
4. rode `docker compose run --rm --no-deps web node scripts/migrate-owner.mjs --to <UID>`;
5. só com autorização, repita com `--apply`.

O roteiro completo está no histórico deste arquivo, no commit `4464dbb`.
