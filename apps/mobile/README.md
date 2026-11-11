# Finance no celular (app Android)

App React Native com Expo SDK 58. É a [SPEC-0005](../../Specs/features/SPEC-0005--pwa-mobile/spec.md), e o plano está em [docs/mobile-plan.md](../../docs/mobile-plan.md).

O app entra no Supabase com e-mail e senha e chama o backend do Finance (`apps/web`) com `Authorization: Bearer`. A sessão fica no SecureStore, cifrada pelo Keystore do Android. Nenhum dado financeiro é gravado no aparelho.

## Rodar localmente, sem Supabase real e sem celular

Tudo usa dados sintéticos. Na raiz do projeto:

```bash
node tests/dev/seed-synthetic.mjs
```

```bash
npm --prefix apps/web run build
```

Depois, suba os três serviços pelo painel de prévia do Claude (`.claude/launch.json`) ou em terminais separados:

| Serviço | Configuração | Endereço |
| --- | --- | --- |
| Supabase Auth falso | `finance-dev-auth` | `http://127.0.0.1:54321` |
| Backend em modo Supabase, com o banco sintético | `finance-api-dev` | `http://127.0.0.1:3002` |
| Prévia web do app | `finance-mobile-web` | `http://localhost:8081` |

Entre com `dono@example.com` e a senha sintética `senha-sintetica-123`, definida em `tests/dev/mock-supabase.mjs`. A configuração `finance-dev-auth-curto` emite tokens de 150 s, para testar a renovação da sessão. As regras de reuso do refresh token seguem as do Supabase real.

A prévia web serve para telas e lógica. O comportamento do Android (SecureStore, teclado, notificações) só aparece no aparelho.

## Verificar

```bash
npm --prefix apps/mobile run typecheck
```

```bash
npm --prefix apps/mobile test
```

```bash
npx --prefix apps/mobile expo-doctor
```

Os testes rodam no Node 24, que executa TypeScript sem passo de build.

## Configuração

Copie `.env.example` para `.env` e preencha só valores públicos. Tudo com `EXPO_PUBLIC_` vai dentro do app. A chave publicável do Supabase pode ir no app; a chave secreta, nunca.

## Instalar no celular (Android)

Esta máquina não tem Android SDK, e o Expo não faz build Android local no Windows. Os builds são feitos pelo EAS, na nuvem. O APK de produção aponta para `https://finance.vetracompany.com.br`, então o servidor de casa precisa estar no ar ([roteiro do Marco 0](../../docs/marco0-deploy.md)).

### Uma vez (você)

1. Crie uma conta gratuita em https://expo.dev e entre com `npx eas-cli login`. O agente não cria contas nem digita senhas.
2. Na pasta `apps/mobile`, vincule o projeto com `npx eas-cli init`.
3. No painel do projeto em expo.dev, em **Environment variables**, cadastre no ambiente `production` (e em `preview`, se for usar esse perfil):
   - `EXPO_PUBLIC_SUPABASE_URL`, com a URL do projeto Supabase;
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, com a chave publicável.

   Use visibilidade *plain text* ou *sensitive*. Variáveis *secret* não chegam ao código do app (FATO, documentação do EAS).
4. Para os avisos (Marco 2), cadastre o `google-services.json` do Firebase como variável do tipo arquivo, com o nome `GOOGLE_SERVICES_JSON`. O `app.config.js` usa essa variável como caminho do arquivo. HIPÓTESE, a confirmar no primeiro build: a documentação lida não diz com todas as letras que `process.env.GOOGLE_SERVICES_JSON` recebe o caminho.

### Gerar e instalar

```bash
cd apps/mobile && npx eas-cli build -p android --profile production
```

O EAS gera a chave de assinatura no primeiro build e devolve um link do APK. Abra o link no celular e instale. O Android pede uma vez para permitir instalações dessa origem.

Hoje o APK instalado direto não precisa de verificação de desenvolvedor. Ela vale desde 30/09/2026 no Brasil só para lojas, e a expansão para todo app está prevista para 2027. Antes disso, registre o app numa conta gratuita de distribuição limitada.

### Atualizar o app

1. Se a mudança for visível para você, aumente `version` em `app.json` (por exemplo, 1.0.0 → 1.1.0).
2. Rode o mesmo comando de build. O `versionCode` sobe sozinho (`appVersionSource: remote` e `autoIncrement` no perfil `production`).
3. Instale o APK novo por cima do antigo, **sem desinstalar**. O Android só aceita a atualização se o certificado for o mesmo (FATO, documentação do Android). INFERÊNCIA, a confirmar no aparelho: o login guardado continua.

Desinstalar apaga a sessão e o registro de avisos: os dados do SecureStore não sobrevivem à desinstalação no Android (FATO, documentação do SecureStore).

### Guardar a chave de assinatura (obrigatório)

Sem a chave, nenhuma atualização instala por cima. Seria preciso desinstalar e começar de novo. Depois do primeiro build:

1. Rode `npx eas-cli credentials` em `apps/mobile`.
2. Escolha **Android**.
3. Escolha `credentials.json: Upload/Download credentials between EAS servers and your local json`.
4. Escolha `Download credentials from EAS to credentials.json`.
5. Guarde o `credentials.json` e o keystore num cofre de senhas ou disco criptografado, **fora do repositório**. O `.gitignore` já ignora esses nomes, mas não os deixe na pasta.

### Ícone

O ícone (um "F" branco sobre o verde do painel) é gerado sem dependências por `node apps/mobile/scripts/make-icons.mjs`. Para trocar o desenho, edite as formas no script e rode de novo.

### Privacidade no aparelho

- O backup automático do Android está desligado (`allowBackup: false`).
- Permissões de armazenamento e de sobreposição de tela foram removidas (`blockedPermissions`).
- O app pede só internet e notificações.

### Desenvolvimento no aparelho (opcional)

Para testar mudanças no celular sem gerar APK a cada vez, instale `expo-dev-client` e crie um perfil `development` com `"developmentClient": true`. Isso não foi feito para não acrescentar dependência antes de precisar.
