# Finance

Painel web pessoal para consultar saldos, extrato, gastos, cartões e faturas. A Pluggy fornece os dados. O Next.js, o worker e o SQLite rodam no seu servidor. O painel oferece login por chave para acesso na mesma máquina e Supabase Auth para a implantação HTTPS.

## Rodar localmente com a Pluggy

Preencha as credenciais da aplicação Pluggy no `.env` da raiz. Para importar um Item real existente, use `PLUGGY_SANDBOX=0` e defina `PLUGGY_EXISTING_ITEM_ID`. Configure `APP_ORIGIN=http://127.0.0.1:3001`.

Se ainda não houver uma chave local, gere uma com `(umask 077 && set -C && openssl rand -hex 32 > .env.local-login)`. Guarde em `FINANCE_LOCAL_KEY_HASH` no `.env` o SHA-256 da chave sem a quebra de linha. Para calcular o valor, execute `tr -d '\r\n' < .env.local-login | sha256sum` e copie a primeira coluna. O `\r` cobre o `openssl` do Windows, que grava a chave com quebra de linha CRLF. Mantenha os dois arquivos privados. Para rotacionar a chave, gere uma nova e atualize o hash. As sessões anteriores deixam de valer após reiniciar o painel.

Rode os dois serviços em terminais separados na raiz do projeto:

    npm --prefix apps/web ci
    (umask 077 && npm --prefix apps/web run dev -- --hostname 127.0.0.1 --port 3001)
    (umask 077 && npm --prefix apps/web run worker)

Abra [o painel local](http://127.0.0.1:3001), entre com a chave do arquivo `.env.local-login` e clique em **Conexões → Importar conexão existente**. A conexão aparece como **Conectada** após o worker terminar.

## Preparar o servidor

1. Copie este projeto para o servidor com Docker e Compose. Use o [.env.example](.env.example) como referência para preencher o .env local. Mantenha as credenciais do servidor privadas.
2. Deixe `FINANCE_LOCAL_KEY_HASH` vazio. No Supabase Auth, crie e confirme o usuário que corresponde a FINANCE_OWNER_EMAIL. Preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY com o URL e a chave publicável do projeto. O app libera acesso apenas para esse e-mail. O login local e o Supabase usam identidades separadas, então configure o vínculo novamente se mudar o método de autenticação em uma nova instalação.
3. Em APP_ORIGIN, informe a origem HTTPS do painel, sem caminho. Gere PLUGGY_WEBHOOK_SECRET com um gerador de segredos. Use PLUGGY_SANDBOX=1 para homologação ou 0 para usar uma aplicação Pluggy habilitada para instituições reais.
4. Execute `docker compose up -d --build`. Configure seu proxy reverso com TLS para encaminhar a origem pública a 127.0.0.1:3000. O host público precisa estar acessível à Pluggy para receber os webhooks.
5. Com o domínio acessível, execute `docker compose exec web node scripts/register-webhooks.mjs`. O comando cadastra os eventos da aplicação Pluggy no endpoint /api/webhooks/pluggy e pode ser repetido para o mesmo domínio.
6. Acesse o painel, entre com o usuário configurado e abra **Conexões → Conectar instituição** para autorizar uma nova conexão. Para reutilizar um Item já autorizado na mesma aplicação Pluggy, configure `PLUGGY_EXISTING_ITEM_ID` no servidor, recrie os serviços e clique em **Conexões → Importar conexão existente**. Use `PLUGGY_SANDBOX=0` para um Item real. Confira que a conexão passa para **Conectada**.

Mantenha uma instância web e um worker compartilhando o volume finance_data no mesmo host. O worker processa o webhook mesmo quando o painel está fechado. O aviso de uma nova transferência fica disponível no sino ao abrir o painel. Com o painel aberto, ele também aparece na tela após a próxima atualização. A Pluggy envia eventos quando uma sincronização encontra movimentações. A frequência de sincronização automática depende da conexão e da configuração da aplicação. Você também pode solicitar atualização pela tela de Conexões.

O aviso é criado para transferências efetivadas identificadas pela integração, incluindo Pix e TED. A primeira importação do histórico não gera avisos. Datas, horários, formas de pagamento e faturas seguem o que o conector disponibiliza.

## Testar a entrega pelo Dashboard da Pluggy

1. Com o domínio HTTPS público e os dois serviços no ar, cadastre os webhooks pelo comando do passo 5. Ele inclui o cabeçalho de autenticação usado pelo receptor.
2. Depois da primeira importação, dispare uma atualização do Item vinculado. Em [Pluggy → Events](https://dashboard.pluggy.ai/events), confira a entrega ao seu domínio e o HTTP 204. Para reenviar uma entrega, abra o evento e clique em **Retry**.
3. Em **Conexões**, confira a linha **Webhook** da instituição. **Processado** confirma que o worker concluiu o evento. Reenviar o mesmo evento mantém o horário original e não duplica o trabalho. Um `item/updated` permite verificar a entrega e a sincronização sem precisar fazer uma transferência.
4. Para verificar o sino, use um evento de transação que contenha uma transferência efetivada detectada após a primeira importação. Um reenvio de histórico ou uma atualização sem nova transferência não gera aviso.

## Transferência, backup e restauração

Para mover uma instalação existente, pare web e worker e copie o conteúdo do volume SQLite com a aplicação parada. Restaure o volume com o mesmo usuário de execução, configure o .env do novo servidor e suba os serviços. Se mudar o domínio, atualize APP_ORIGIN, cadastre a nova URL de webhook e revise as inscrições antigas no Dashboard. Faça backup regular do volume e mantenha o arquivo de configuração em armazenamento privado.

## Verificar

    npm --prefix apps/web test
    npm --prefix apps/web run build

O teste do webhook usa SQLite e respostas sintéticas. A [verificação do MVP](Specs/features/SPEC-0001--mvp-finance/verification.md) registra a cobertura local e o que exige o domínio público e a conta de homologação.
