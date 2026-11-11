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

Esta máquina não tem Android SDK, e o Expo não faz build Android local no Windows. Os builds são feitos pelo EAS, na nuvem.

1. Você cria uma conta gratuita em https://expo.dev e entra com `npx eas-cli login`. O agente não cria contas nem digita senhas.
2. No painel do Expo, cadastre as variáveis do projeto `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Rode o build. Ele gera um APK instalável, que aponta para `https://finance.vetracompany.com.br`, e por isso exige o Marco 0 no ar:

   ```bash
   cd apps/mobile && npx eas-cli build -p android --profile preview
   ```

4. Abra o link do build no celular e instale o APK. O Android pede para permitir a instalação desse app.

A chave de assinatura fica no EAS. Exporte uma cópia para um cofre seu. Sem ela, não dá para atualizar o app instalado sem desinstalar.
