# Plano do Finance no celular: app Android em React Native

**Versão 2**, de 2026-11-11, aprovada pelo usuário no mesmo dia. O Marco 1 está em andamento.

Em 2026-11-11 você trocou a abordagem de PWA para **app React Native**. A versão 1 (PWA), aprovada antes, está no histórico do Git, no commit `f5be6c2`. O Marco 0 (backend público, sessão e deploy) continua igual, porque serve aos dois caminhos.

Rastreio SDD: [SPEC-0005](../Specs/features/SPEC-0005--pwa-mobile/spec.md).

Convenção usada no texto:
- **FATO**: conferido no código ou na documentação oficial (ver [Fontes](#fontes)).
- **INFERÊNCIA**: conclusão minha, ainda não testada.
- **HIPÓTESE**: suposição que segue até você confirmar.

## 0. Decisões que este plano assume

| Decisão | Origem |
| --- | --- |
| App nativo em React Native | Sua escolha, 2026-11-11 |
| Push de transferência é requisito | Sua resposta, Fase 1 |
| Conectar e reconectar banco pelo celular | Sua resposta, Fase 1 |
| Backend no servidor de casa, em HTTPS pelo túnel | Suas respostas, 2026-11-11 |
| Reconectar a conta em vez de migrar o banco | Sua resposta, 2026-11-11 |
| Só Android, um único usuário (`FINANCE_OWNER_EMAIL`) | Contexto do projeto |

**Leitura crítica, para constar.** O app nativo custa mais que a PWA. São duas interfaces para manter, build Android, credenciais FCM e distribuição de APK. A estimativa sobe de 7 a 17 dias para **14,5 a 29 dias**, contando o que resta do Marco 0. Em troca, o app ganha:
- o SDK oficial da Pluggy, com retorno por deep link;
- push por FCM nativo, mais previsível que Web Push;
- armazenamento seguro no Keystore;
- a possibilidade de biometria e de bloquear captura de tela, se você quiser depois.

É uma escolha legítima.

## 1. Escopo do MVP

### Dentro

1. Login com o usuário Supabase, com a sessão guardada no armazenamento seguro do Android.
2. Visão geral: saldo, valor bloqueado, entradas e saídas.
3. Fatura aberta de cada cartão, com as compras.
4. Extrato do período, com filtros simples (conta e período).
5. Ocultar valores, lembrado no aparelho.
6. **Push** quando entra uma transferência efetivada, com o app fechado. Tocar abre o Extrato.
7. **Conectar ou reautorizar uma instituição** pelo SDK da Pluggy, com retorno por deep link.
8. Estado das conexões e o atalho "Atualizar no Meu Pluggy".

### Fora do MVP

- **Fica no web:**
  - Análises e Planejamento;
  - Gastos por categoria e Cartões com o cronograma de parcelas;
  - histórico de Faturas;
  - renomear e desconectar conexões;
  - escolher a categoria de um lançamento.

  O app tem um link "Abrir no navegador" para essas telas.
- Uso offline com dados. O app mostra o último estado só enquanto está aberto e não grava dados financeiros no aparelho (item 4).
- iOS, Play Store em produção, biometria, bloqueio de captura de tela e widget na tela inicial. Os três últimos são candidatos a depois do MVP.
- Push de outros eventos.
- A versão PWA: manifest e service worker não serão feitos.

## 2. Arquitetura

```
apps/mobile (Expo SDK 58, React Native 0.8x, TypeScript, Expo Router)
  ├─ login: supabase-js no app (e-mail e senha) → access token
  ├─ chamadas: fetch para https://finance.vetracompany.com.br/api/* com Authorization: Bearer <token>
  ├─ push: expo-notifications → token FCM do aparelho → POST /api/devices
  └─ Pluggy: react-native-pluggy-connect (WebView) → oauthRedirectUri finance://pluggy/retorno

servidor de casa (Marco 0): web Next 16 + worker + SQLite
  ├─ owner() aceita o cookie (web) ou o Bearer (app)
  └─ worker: aviso novo → FCM HTTP v1 → aparelho
```

### Por que Expo

A documentação do React Native recomenda começar apps novos com um framework e cita o Expo. O comando oficial é `npx create-expo-app@latest` (FATO).

Com Expo:
- Expo Router já vem configurado;
- o build Android pode ser feito na nuvem (EAS), sem Android Studio nesta máquina;
- há `expo-notifications`, `expo-secure-store` e WebView prontos.

### Repositório

- O app fica em `apps/mobile`, com `package.json` próprio, sem workspace. Assim o lockfile do web não muda.
- **Compartilhado com o web:**
  - os tipos de resposta (`apps/web/lib/types.ts`, `lib/analytics/types.ts`);
  - as funções puras (`lib/format.ts`, `lib/ledger-filter.ts`, `lib/balances.ts`, `lib/charged.mjs`).

  O app as importa por caminho relativo, com `watchFolders` no Metro. Nada é copiado.
- **Não compartilhado:** tudo que importa `node:sqlite` ou `next/*`.

### Mudanças no backend (todas no web, com impacto)

| Mudança | Arquivo | Impacto no web |
| --- | --- | --- |
| `owner()` aceita `Authorization: Bearer`, validado com `supabase.auth.getUser(jwt)` | `lib/auth.ts` | Nenhum. O cookie continua igual. Bearer só vale no modo Supabase, nunca na chave local |
| Requisição com Bearer dispensa a checagem de `Origin` | `app/api/*/route.ts` (POST) | Nenhum. Requisição com cookie continua exigindo `Origin`. CSRF não se aplica a Bearer |
| Token do Connect com retorno para o app (`client: "app"` usa `finance://pluggy/retorno`, de uma lista fixa) | `app/api/connections/route.ts` | Nenhum. O web continua com o retorno HTTPS |
| Aparelhos para push: tabela `devices` e `POST /api/devices` | `lib/db.mjs`, `app/api/devices/route.ts` | Migração aditiva |
| Envio FCM pelo worker | `lib/push.mjs`, chamado depois de `notifyTransfers` | O worker passa a fazer chamadas de saída ao FCM |
| CORS só para a prévia web do app em desenvolvimento (`FINANCE_DEV_ORIGINS`, vazio na produção) | `proxy.ts` | Nenhum na produção |

## 3. Autenticação e armazenamento seguro

- O app entra direto no Supabase com e-mail e senha, usando a **chave publicável**, que é feita para ir no cliente (FATO: Supabase). Nenhuma chave secreta vai para o app.
- **Sessão no aparelho:** segue o padrão da documentação do Supabase.
  - A sessão fica no SecureStore, que no Android grava valores cifrados pelo Keystore (FATO).
  - **Desvio no Marco 1:** o plano previa AES com a chave no SecureStore. A documentação atual do SecureStore diz que o Expo não impõe limite de tamanho e que o limite de cerca de 2048 bytes era de versões antigas do iOS (FATO). Para um app só Android, guardar a sessão direto no SecureStore é mais simples e não depende de `aes-js` nem do AsyncStorage. Na prévia web, que é só para desenvolvimento, a sessão fica em `localStorage`, com dados sintéticos.
  - Nada fica em armazenamento sem criptografia.
  - Com `autoRefreshToken`, a sessão é renovada enquanto o app está em primeiro plano.
- **Servidor:**
  - `owner()` valida o Bearer no Supabase;
  - continua aceitando só o `FINANCE_OWNER_EMAIL`;
  - resposta 401 leva o app de volta ao login.
- **Sair:** encerra a sessão no Supabase, apaga o armazenamento local e cancela o registro de push do aparelho.

## 4. Offline

**Nada precisa funcionar sem internet.** O app guarda os dados só na memória enquanto está aberto. Sem rede, mostra "Sem conexão" com "Tentar de novo". Nenhum dado financeiro é gravado no aparelho.

## 5. Push

- **Canal:** FCM. O app obtém o token **nativo** do aparelho (`getDevicePushTokenAsync`). O worker envia pela **API HTTP v1 do FCM**, sem passar pelo serviço de push do Expo. Assim há um intermediário a menos para o conteúdo, e nenhuma dependência sem SLA (FATO: o serviço do Expo não tem SLA).
- **Credenciais:**
  - a conta de serviço do Firebase fica só no `.env.production` do servidor;
  - o worker assina o JWT com `node:crypto`, sem biblioteca nova;
  - o `google-services.json` vai para o build e fica fora do Git, porque o repositório é público.
- **Registro:**
  - no Android 13 ou mais novo, pedir a permissão depois de um toque;
  - criar o canal de notificação antes de obter o token (FATO);
  - enviar o token para `POST /api/devices`.
- **Envio:**
  - um aviso novo vira uma mensagem de prioridade alta para cada aparelho do dono;
  - token inválido (`UNREGISTERED`) é apagado;
  - erros 429 e 5xx tentam de novo pela fila `jobs`.
- **Privacidade:** por padrão, a notificação diz "Transferência recebida · Pix", sem valor (HIPÓTESE). Os logs nunca registram valor nem token.
- **Teste:** push exige *development build*. Não funciona no Expo Go a partir do SDK 53 (FATO).

## 6. Navegação e UX

- Expo Router com **abas embaixo**: Início (Visão geral e fatura aberta), Extrato, Conexões e Ajustes (ocultar valores, avisos e sair).
- Toques de no mínimo 48 dp (FATO: Android). Respeito às áreas seguras. Rolar para baixo atualiza.
- **Estados:**
  - carregando: esqueleto;
  - erro: mensagem e "Tentar de novo";
  - vazio: mensagem própria;
  - sessão vencida: volta ao login.
- Valores com `Intl` em pt-BR, reaproveitando `lib/format.ts`. O teclado do login usa `keyboardType="email-address"`.

## 7. Ambientes

| Ambiente | Backend | App |
| --- | --- | --- |
| Desenvolvimento nesta máquina | `next start` em `127.0.0.1:3001`, em modo Supabase, com dados sintéticos | `npx expo start --web`, a prévia no navegador com react-native-web (FATO), para telas e lógica |
| Desenvolvimento no seu celular | Servidor de casa (Marco 0) ou a máquina na rede local | *Development build* instalado por APK, com o Metro pela rede |
| Produção | Servidor de casa, `finance.vetracompany.com.br` | APK de release, instalado por você |

**Limites desta máquina (FATO):**
- não tem Android SDK nem Android Studio, só o Java 8;
- tem 7 GB de RAM, apertado para emulador junto com Metro e Gradle;
- o Expo não suporta build Android local no Windows.

Por isso, os builds Android vão pelo **EAS na nuvem**. O plano gratuito inclui até 15 builds Android (FATO: página de preços). O teste do Android de verdade acontece no **seu celular**.

## 8. Testes

- **Automáticos:**
  - `npm test` do web: Bearer válido, inválido, de outro e-mail, e Bearer na chave local recusado; POST com Bearer sem `Origin`; registro de aparelho; envio só para avisos novos; limpeza de token inválido; JWT do FCM;
  - `tsc --noEmit` no app e no web;
  - testes das funções do app (formatação e estados). **Desvio no Marco 1:** em vez de `jest-expo`, os testes usam `node --test`, porque o Node 24 roda TypeScript direto. Assim, nenhuma dependência nova entra. O `jest-expo` só vale a pena quando houver testes de componentes.
- **Prévia web nesta máquina:** login, telas, estados de erro e vazio, a 360 × 800.
- **No seu celular:**
  - instalação do APK;
  - login pelo 4G;
  - push com o app fechado e a tela bloqueada, observado por 7 dias;
  - retorno do OAuth da Pluggy;
  - reinício do aparelho.

## 9. Distribuição

- **Sem Play Store.** Você instala o APK. O EAS gera APK com `buildType: "apk"` (FATO).
- **Verificação de desenvolvedor do Android (FATO):**
  - em vigor no Brasil desde 30/09/2026, só para instalações por lojas participantes;
  - APK instalado direto ou por `adb` está isento por enquanto;
  - a expansão para todo app em aparelho certificado está prevista para 2027.

  Quando isso chegar, a saída é registrar o app numa conta de **distribuição limitada**, que é gratuita e serve para uso pessoal. As páginas oficiais divergem no limite de aparelhos: 20 ou 50.
- **Contas necessárias, todas suas e gratuitas:**
  - Expo (EAS);
  - Firebase (FCM);
  - Supabase (Marco 0).
- **A chave de assinatura do Android** fica com o EAS ou num cofre seu, nunca no Git. Perder essa chave impede atualizar o app instalado sem desinstalar.

## 10. Marcos

Cada marco termina com typecheck, testes e build rodados, um relatório com os resultados reais e uma parada para a sua validação.

### Marco 0: backend público e sessão estável

**Código e deploy prontos e testados.** Falta a parte operacional, sua: ver o [roteiro](marco0-deploy.md).

### Marco 1, o mais fino: login e Visão geral no seu celular

Tarefas:
1. Criar `apps/mobile` com `create-expo-app` (SDK 58).
2. Login com Supabase e sessão segura.
3. Tela Início chamando `/api/dashboard` com Bearer.
4. No backend: Bearer em `owner()`, dispensa do `Origin` para Bearer e CORS de desenvolvimento.
5. Primeiro *development build* Android pelo EAS.

**Aceite:**
- Nesta máquina, a prévia web faz login e mostra a Visão geral com dados sintéticos.
- No seu celular, o APK instala, o login funciona pelo 4G e a Visão geral mostra os dados reais.
- O web segue igual: os 98 testes passam, mais os novos.

### Marco 2: push de transferência

Tarefas: projeto Firebase, `google-services.json`, `expo-notifications`, tabela e rota de aparelhos, envio FCM v1 pelo worker, e Ajustes com "Ativar avisos" e "Enviar teste".

**Aceite:**
- O teste chega com o app fechado e a tela bloqueada.
- Uma transferência real gera a notificação.
- Em 7 dias de observação, nenhum aviso deixa de chegar.
- Desinstalar o app leva à limpeza do token no envio seguinte.

### Marco 3: telas essenciais

Tarefas: fatura aberta com as compras, Extrato com filtros, ocultar valores, abas, estados, toques de 48 dp e o link "Abrir no navegador".

**Aceite:** a prévia web e o celular mostram as telas essenciais, com os mesmos valores do web para a mesma data, e os estados de carregando, erro e vazio foram provocados e conferidos.

### Marco 4: conectar banco pelo app

Tarefas: `react-native-pluggy-connect` com `react-native-webview` (incluído no Expo, FATO), esquema `finance://`, retorno do OAuth, estados de cancelamento e falha, e atalho para o Meu Pluggy.

**Aceite:**
- Uma instituição OAuth do sandbox volta ao app e fica "Conectada".
- Cancelar ou falhar permite tentar de novo.
- A reautorização da MeuPluggy conclui, o que destrava a SPEC-0004-T012.

### Marco 5: APK de uso diário

Tarefas: perfil de release em APK, ícone e nome, versão, e o roteiro de atualização (instalar por cima).

**Aceite:** o APK de release instala por cima do anterior sem perder o login, e o roteiro está escrito.

## 11. Estimativa de esforço

Em dias de trabalho (INFERÊNCIA):

| Marco | Faixa | O que mais pesa na incerteza |
| --- | --- | --- |
| 0 | Restante: 0,5 a 1 | Túnel e Supabase, do seu lado |
| 1 | 3 a 6 | Primeiro build EAS e o ambiente do Expo |
| 2 | 3 a 5, mais 7 dias corridos | Credenciais FCM e comportamento do fabricante |
| 3 | 5 a 10 | Quantidade de telas e de estados |
| 4 | 2 a 5 | OAuth e WebView fora do controle do código |
| 5 | 1 a 2 | Baixa |
| **Total** | **14,5 a 29 dias**, mais a observação | |

## 12. Riscos e mitigação

| Risco | Probabilidade / impacto | Mitigação |
| --- | --- | --- |
| Painel com dados reais exposto na internet | Média / alto | Supabase só com o seu e-mail e cadastro desligado. Bearer validado no servidor. Proxy de sessão. Backup fora do servidor |
| Token ou chave vazando no repositório público (`google-services.json`, conta de serviço, keystore) | Média / alto | Tudo fora do Git, com `.gitignore` para esses arquivos desde o Marco 1, e busca por segredos antes de cada commit |
| Sessão do app perdida ou exposta | Baixa / médio | Sessão cifrada com chave no Keystore. Sair apaga tudo. 401 volta ao login |
| Push atrasado pela economia de bateria | Média / alto | FCM de prioridade alta, observação de 7 dias e orientação para tirar o app da otimização |
| Mudança na API do FCM (FATO, 2026-11-11: o campo `token` está marcado como obsoleto em favor de `fid`, e a documentação pede a migração para `AndroidConfigV2`) | Média / médio | O envio fica todo em `lib/push.mjs`, coberto por testes. Revisar quando o Google marcar uma data de desligamento |
| OAuth da Pluggy não voltar ao app | Média / médio | SDK oficial com deep link. Teste no sandbox antes da conta real |
| Limite de builds gratuitos do EAS | Baixa / baixo | Desenvolver pela prévia web e pelo *development build* com o Metro. Build novo só quando mudar código nativo |
| Verificação de desenvolvedor em 2027 | Certa / médio | Conta de distribuição limitada, gratuita, registrada antes da data |
| Perder a chave de assinatura | Baixa / alto | Guardar a cópia exportada do EAS num cofre seu |
| Servidor de casa fora do ar | Média / médio | Túnel só de saída, serviços que voltam sozinhos e consulta periódica que recupera o que faltou |
| Supabase gratuito pausado | Média / alto | Uso frequente. Se pausar, você reativa pelo painel. Ou o plano Pro |

## 13. Perguntas abertas

Nenhuma bloqueia a aprovação do plano.

1. **Contas** (Marco 1 e 2): você cria as contas Expo e Firebase quando chegar a hora? Eu não crio contas nem digito senhas.
2. **Celular de teste** (Marco 1): qual modelo e qual versão do Android?
3. **Homologação** (Marco 4): testar o OAuth no sandbox pelo próprio servidor, como proponho, ou manter um ambiente separado?
4. **Push na tela bloqueada** (Marco 2): sem valor por padrão está bom?

## Fontes

- [React Native: configuração do ambiente e recomendação de framework](https://reactnative.dev/docs/environment-setup) · [versões](https://reactnative.dev/versions)
- Expo:
  - [criar projeto (SDK 58)](https://docs.expo.dev/get-started/create-a-project/)
  - [ambiente](https://docs.expo.dev/get-started/set-up-your-environment/)
  - [web](https://docs.expo.dev/workflow/web/)
  - [WebView](https://docs.expo.dev/versions/latest/sdk/webview/)
  - [APK](https://docs.expo.dev/build-reference/apk/)
  - [builds locais](https://docs.expo.dev/build-reference/local-builds/)
  - [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
  - [Expo Router](https://docs.expo.dev/router/introduction/)
  - [deep links](https://docs.expo.dev/linking/into-your-app/)
  - [notificações](https://docs.expo.dev/versions/latest/sdk/notifications/)
  - [credenciais FCM](https://docs.expo.dev/push-notifications/fcm-credentials/)
  - [envio e limites](https://docs.expo.dev/push-notifications/sending-notifications/)
  - [preços](https://expo.dev/pricing)
- Supabase: [Expo React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) · [sessões](https://supabase.com/docs/guides/auth/sessions) · [pausa de projetos gratuitos](https://supabase.com/docs/guides/platform/free-project-pausing)
- Pluggy: [OAuth](https://docs.pluggy.ai/docs/oauth-support-guide) · [SDKs](https://v2.docs.pluggy.ai/docs/connect-widget/environments) · [react-native-pluggy-connect 1.6.0](https://registry.npmjs.org/react-native-pluggy-connect)
- Android: [verificação de desenvolvedor](https://developer.android.com/developer-verification/guides) · [perguntas frequentes](https://developer.android.com/developer-verification/guides/faq) · [tamanho de toque](https://developer.android.com/guide/topics/ui/accessibility/apps)
