# Plano do Finance no celular (PWA)

Fase 3, versão para aprovação. Escrito em 2026-11-11. Nenhum código de produção foi escrito.
Rastreio SDD: [SPEC-0005](../Specs/features/SPEC-0005--pwa-mobile/spec.md).

Convenção usada no texto:
- **FATO**: conferido no código ou na documentação oficial (ver [Fontes](#fontes)).
- **INFERÊNCIA**: conclusão minha, ainda não testada.
- **HIPÓTESE**: suposição que segue até você confirmar.

## 0. Decisões que este plano assume

| Decisão | Origem |
| --- | --- |
| Abordagem: PWA, o próprio web instalável pelo Chrome no Android | Sua escolha, Fase 2 |
| Aviso de transferência por push é requisito | Sua resposta, Fase 1 |
| Conectar e reconectar banco pelo celular entra no escopo | Sua resposta, Fase 1 |
| O celular acessa o backend pela internet, em HTTPS | Sua resposta, Fase 1 |
| Só Android. iOS fora do escopo | Contexto do projeto |
| Um único usuário, o dono (`FINANCE_OWNER_EMAIL`) | FATO: `lib/auth.ts` |

**Atenção:** numa PWA, o app mobile **é o próprio web**. Todo marco abaixo altera `apps/web`. Cada alteração aparece listada com o seu impacto, conforme a sua regra de não mexer no web sem aviso.

## 1. Escopo do MVP

### Dentro (essencial para o uso principal)

1. Abrir o app instalado e entrar com login seguro pela internet.
2. Visão geral: saldo, valor bloqueado, entradas e saídas.
3. Fatura aberta de cada cartão, com "Ver compras".
4. Extrato do período, com filtros simplificados.
5. Ocultar valores.
6. **Push** quando entra uma transferência efetivada, com o app fechado.
7. **Conectar ou reautorizar uma instituição** pelo widget Pluggy, com retorno do OAuth para dentro do app.
8. "Atualizar no Meu Pluggy" a partir do celular.

### Fora do MVP (registrado de propósito)

- **As demais telas continuam abrindo no celular, mas sem otimização nem critério de aceite mobile:**
  - Gastos e Cartões;
  - histórico de Faturas;
  - Análises: as seis seções, incluindo o Resumo;
  - Planejamento, inclusive os editores;
  - renomear e desconectar conexões.

  Por ser PWA, essas telas não somem.
- Uso offline com dados, detalhado no item 4.
- iOS e Play Store.
- App nativo, Capacitor e Expo. O plano B fica no item 13.
- Biometria, bloqueio de captura de tela, widget na tela inicial e atalhos do manifest.
- Push de outros eventos, como fatura perto de fechar ou gasto acima da caixinha. Avisos de lançamentos a caminho continuam rejeitados ([DEC-20261109](../Context/branches/produto/decisions/DEC-20261109-sem-avisos-de-atraso.md)).
- Paridade web/Android exigida pela SPEC-0001 (REQ-001, T002, T005). Proponho que a SPEC-0005 substitua essa parte quando o plano for aprovado.

## 2. Arquitetura

```
Android (Chrome / WebAPK instalado)
  ├─ páginas do Next (as mesmas do web)        ──HTTPS──▶  Cloudflare Tunnel ─▶ web (Next 16) ─▶ SQLite
  ├─ service worker /sw.js (push + página offline)                                  ▲
  └─ PushManager ─inscrição─▶ POST /api/push                                         │
                                                                                     │
FCM (serviço de push do Chrome) ◀──Web Push (VAPID, RFC 8291)── worker ─────────────┘
```

- **Como o app usa o backend:** pelas mesmas rotas de hoje (`/api/dashboard`, `/api/connections`, `/api/planning` e `/api/analytics`), na mesma origem, com o cookie de sessão. **Nenhum login novo e nenhum token no cabeçalho.** A checagem de `Origin` nas rotas POST continua valendo (FATO: a origem é o mesmo domínio HTTPS).
- **O que é compartilhado:** tudo, porque é o mesmo código. Não há pacote compartilhado nem cliente de API novo.
- **O que muda no backend (todas as mudanças são no web):**

| Mudança | Arquivo | Impacto no web de hoje |
| --- | --- | --- |
| Proxy que renova a sessão Supabase | `apps/web/proxy.ts` (novo) | Corrige um defeito latente: ver o item 3. Não afeta o modo de chave local |
| Manifest, ícones e cor do tema | `app/manifest.ts`, `public/icons/*`, `app/layout.tsx` | O desktop passa a oferecer "Instalar". Nada mais muda |
| Service worker | `public/sw.js`, cabeçalhos em `next.config.ts` | Novo código no navegador. Não guarda dados financeiros |
| Inscrições de push | tabela `push_subscriptions` em `lib/db.mjs`, `app/api/push/route.ts` | Migração aditiva no SQLite |
| Envio de push | `lib/push.mjs` (novo), chamado depois de `notifyTransfers` em `lib/sync.mjs` | O worker passa a fazer chamadas de saída ao FCM |
| Navegação mobile | `components/app-sidebar.tsx`, `app/globals.css` | Só abaixo de 720 px. O desktop fica igual |

## 3. Autenticação e armazenamento de sessão

- **Produção:** Supabase Auth com e-mail e senha. A sessão fica em cookies `httpOnly`, com `secure` quando a origem é HTTPS (FATO: `lib/auth.ts`). No celular, os cookies vivem no armazenamento do Chrome, compartilhado com a PWA (FATO: web.dev, WebAPKs). **Nenhum token fica em `localStorage`.** Hoje o `localStorage` só guarda a opção "ocultar valores".
- **Defeito latente a corrigir no Marco 0:**
  - A documentação do Supabase exige um Proxy para renovar os tokens, porque Server Components não gravam cookies (FATO). O Finance não tem esse Proxy. O `setAll` de `lib/auth.ts` falha em silêncio dentro das páginas.
  - Pela documentação, cada refresh token só pode ser usado uma vez, com tolerância de 10 s. Fora desse intervalo, o reuso revoga a sessão inteira (FATO).
  - INFERÊNCIA: depois de cerca de 1 h de uso, a sessão pode cair sozinha. No celular, onde o app fica aberto por dias, o problema aparece mais.
  - Correção: criar `proxy.ts` (Next 16, runtime Node, FATO) com `getClaims()`, deixando de fora estáticos, `/api/webhooks/pluggy` e `/api/health`.
- **Chaves no app:** nenhuma. A chave publicável do Supabase continua só no servidor, como hoje. A chave **pública** VAPID vai para o navegador, e foi feita para isso. As chaves privadas (VAPID, Pluggy e webhook) ficam só no `.env` do servidor.
- **Chave local:** continua existindo só em loopback, para desenvolvimento.
- **Migração do dono (destrutiva, exige sua autorização):**
  - Os dados atuais pertencem a `"local-owner"`. No Supabase, o dono passa a ser o `user.id` (FATO: `DEC-20261108-acesso-finance`).
  - Opção A (recomendada): script com backup `VACUUM INTO`, simulação e confirmação, que troca o dono em `connections`, `plan_*`, `category_*`, `account_settings`, `investments` e `intents`.
  - Opção B: reconectar pelo widget. É mais simples, mas perde o Planejamento e as categorias escolhidas.

## 4. Estratégia offline

**Nada precisa funcionar sem internet.** Dados financeiros não ficam em cache no aparelho, por privacidade e para não mostrar saldo velho como se fosse atual.

- O service worker só faz duas coisas:
  1. guarda **uma página estática "Sem conexão"**;
  2. recebe o push.
- Não intercepta `/api/*` nem o HTML autenticado.
- Custo aceito: o app não abre sem rede. Na tela "Sem conexão", um botão "Tentar de novo" recarrega.

## 5. Notificações push

- **Disparo:**
  - O worker já grava `notices` em `notifyTransfers` quando chega uma transferência efetivada nova (FATO: `lib/db.mjs`). A primeira importação não gera aviso.
  - Para cada aviso inserido, o worker põe na fila um envio Web Push para cada inscrição do dono, com TTL de 24 h e urgência `high`.
  - Respostas 404 e 410 apagam a inscrição. Respostas 429 e 5xx tentam de novo pela fila `jobs` que já existe.
- **Inscrição:**
  - O botão "Ativar avisos neste aparelho" pede a permissão só depois do toque. Uma WebAPK não recebe a permissão na instalação (FATO: web.dev).
  - O `POST /api/push` valida a origem, o dono, um corpo de até 4 KB e o endpoint: só `https:` e só hosts de serviço de push conhecidos, para evitar SSRF.
  - Há um botão "Enviar teste".
- **Clique:** abre o Extrato (`/?view=ledger`).
- **Privacidade na tela bloqueada (HIPÓTESE):** por padrão, a notificação diz "Transferência recebida · Pix", sem valor. Uma opção mostra o valor. O conteúdo viaja criptografado ponta a ponta (RFC 8291).
- **Dependência nova: `web-push`**, só no Marco 2.
  - O que resolve: a criptografia `aes128gcm` do conteúdo e a assinatura VAPID. A documentação do Next a recomenda (FATO).
  - Alternativa mais leve: implementar com `node:crypto`. São cerca de 150 linhas de criptografia sensível, com risco alto de erro e sem ganho real.
  - Custo de manutenção: uma biblioteca madura com poucas dependências, usada só no servidor e no worker.
- **Logs:** registram o status HTTP e a latência. Nunca registram valor, descrição ou endpoint completo.

## 6. Navegação e UX mobile

- **Navegação até 720 px:**
  - Uma barra inferior fixa com 4 itens: **Visão geral · Extrato · Faturas · Mais**. O "Mais" lista Gastos, Cartões, Conexões, Análises, Planejamento e Sair.
  - Hoje a barra lateral vira uma faixa no topo, com botões de 12 px e `padding: 8px` (FATO: `globals.css`), abaixo do mínimo de toque.
- **Toque:**
  - Alvos de no mínimo **48 × 48 px**, a regra do Android (FATO). O piso WCAG 2.2 é 24 × 24 px.
  - Espaço de 8 px entre alvos.
  - Respeito às áreas seguras (`env(safe-area-inset-*)`), porque o modo `standalone` não tem barra do navegador.
- **Estados:**
  - Carregando: esqueleto no lugar do conteúdo.
  - Erro: mensagem com "Tentar de novo".
  - Vazio: o `EmptyState` existente.
  - Sessão expirada: volta ao login e preserva a tela de destino.
- **Teclado:**
  - `inputmode` e `enterkeyhint` certos nos campos de nome e valor.
  - O conteúdo não fica escondido atrás do teclado.
  - Os filtros de data continuam no Popover, que já foi conferido no mobile em 2026-11-10.
- **Tela pequena:**
  - Fatura aberta logo depois do saldo, na Visão geral.
  - Lista do extrato com uma linha principal (descrição e valor) e uma secundária (data e forma).
  - Sem rolagem horizontal a 360 px de largura.
- **Desempenho:** medir o `/api/dashboard` em 4G com o período padrão de um mês. Se passar de cerca de 500 KB (INFERÊNCIA de limite razoável), reduzir os campos devolvidos ao celular, em tarefa própria.

## 7. Ambientes

| Ambiente | Onde | Login | Pluggy | Dados |
| --- | --- | --- | --- | --- |
| Desenvolvimento | `127.0.0.1:3001` na sua máquina | Chave local | A do `.env` local | SQLite local. Testes automáticos sempre com dados sintéticos |
| Homologação (HIPÓTESE, confirmar) | Mesmo host da produção, outro projeto Compose, outro volume e o subdomínio `homolog.` no túnel | Segundo projeto Supabase | `PLUGGY_SANDBOX=1`, **sem webhook**, só pela consulta periódica, para não receber os eventos da produção | Sintéticos (Pluggy Bank Sandbox) |
| Produção | `finance.vetracompany.com.br` (HIPÓTESE: na máquina Linux, onde estão o `.env` e o SQLite atuais) | Supabase, só o seu e-mail | Real, MeuPluggy | Reais |

Notas:
- O push dá para testar no Chrome de desktop em `127.0.0.1`, que conta como contexto seguro. A documentação do Next também mostra `next dev --experimental-https` (FATO).
- Teste de push no celular só em homologação ou produção.
- Sem homologação, o Marco 4 testa o OAuth direto na produção, com a reautorização real da MeuPluggy. Funciona, mas com mais risco.

## 8. Plano de testes

- **Automáticos (`npm test`, dados sintéticos):**
  - validação da inscrição (endpoint, host e tamanho);
  - isolamento por dono;
  - envio só para avisos novos, nunca na primeira importação;
  - limpeza nos códigos 404 e 410;
  - nova tentativa nos códigos 429 e 5xx;
  - conteúdo sem valor por padrão;
  - script de migração do dono, numa cópia sintética.
- **Novo comando `typecheck` (`tsc --noEmit`):** usa o TypeScript que já está instalado, sem dependência nova.
- **Lint:** não existe hoje. Ver a pergunta 5 do item 14.
- **Build:** `npm run build` a cada marco.
- **Manual:**
  - No seu celular Android, com Chrome estável. Modelo e versão do Android: pergunta 4 do item 14.
  - Num emulador do Android Studio (Pixel, imagem com Google Play, que traz Chrome e FCM), para instalação e layout.
  - No navegador do app, com viewport de 360 × 800, para layout e comparação do desktop antes e depois.
- **Push real:**
  - observar por 7 dias;
  - comparar os `notices` criados com as notificações recebidas;
  - medir a latência entre a criação do aviso e a chegada, nos logs, sem valores.
- **Fora:** não uso Lighthouse para PWA, porque a categoria foi descontinuada (FATO). A instalação é conferida no próprio Chrome.

## 9. Publicação

- **Sem loja, sem conta de desenvolvedor e sem custo.** A instalação é pelo Chrome, em "Instalar app", que gera uma WebAPK (FATO).
- INFERÊNCIA: a verificação de desenvolvedor do Android, em vigor no Brasil desde 30/09/2026 para as lojas participantes, não se aplica, porque a WebAPK é gerada pelo Chrome. Vou confirmar na instalação do Marco 1.
- Requisitos de instalação (FATO, web.dev):
  - HTTPS;
  - `name` ou `short_name`;
  - ícones de 192 e 512 px;
  - `start_url`;
  - `display: standalone`;
  - `prefer_related_applications` ausente.
- **Política de privacidade:** nenhuma loja exige. Proponho uma seção curta no README sobre os dados no aparelho (nenhum) e no push (sem valor por padrão). Se o público crescer, revisar LGPD e a [questão aberta](../Context/branches/produto/questions/QUE-20261108-publico-plataformas.md).
- **Atualizações:** chegam a cada deploy. Mudar o manifest regera a WebAPK (FATO), por isso o manifest deve mudar pouco.

## 10. Marcos

Cada marco termina com lint ou type-check, testes e build rodados, um relatório com os resultados reais, e uma parada para a sua validação.

### Marco 0: backend público e sessão estável (pré-requisito)

Tarefas:
1. Criar o projeto Supabase e o seu usuário, com cadastro aberto desligado.
2. Criar o `proxy.ts` que renova a sessão.
3. Script de migração do dono, com backup e confirmação.
4. Subir web e worker por Compose no host da produção, com `cloudflared` encaminhando para `127.0.0.1:3000`.
5. Ajustar o `.env` (`APP_ORIGIN` HTTPS e `FINANCE_LOCAL_KEY_HASH` vazio).
6. Cadastrar os webhooks pelo script.
7. Remover o cadastro antigo errado, com confirmação.
8. Backup periódico do volume.

**Aceite:**
- Pelo 4G no celular, `https://finance.vetracompany.com.br` abre o login.
- Outro e-mail é recusado.
- Sem cookie, `/api/dashboard` responde 401.
- Depois de 2 h e de 1 dia de uso intermitente, a sessão segue válida sem novo login.
- Sair revoga a sessão.
- `item/updated` aparece como 204 em Pluggy → Events e como "Processado" em Conexões.
- Os dados migrados aparecem iguais aos do SQLite antes da migração (contagens, sem valores em arquivo).
- O modo de chave local continua funcionando em loopback.
- 94 testes, `typecheck` e build passam.

### Marco 1, o mais fino: instalável, login e Visão geral real no celular

Tarefas: `manifest.ts`, ícones, `theme-color`, viewport com áreas seguras, `sw.js` mínimo com a página offline e os cabeçalhos `no-store` e CSP do `sw.js` recomendados pelo Next (FATO).

**Aceite:**
- O Chrome Android oferece "Instalar app".
- O app abre em `standalone`, com ícone próprio.
- O login e a Visão geral mostram dados reais em 4G.
- Em modo avião, aparece a página "Sem conexão".
- O Cache Storage não tem nenhuma resposta de `/api/*` nem HTML autenticado.
- O desktop a 1280 px fica igual ao de hoje (captura antes e depois).
- Testes, `typecheck` e build passam.

### Marco 2: push de transferência

Tarefas:
1. Chaves VAPID no `.env`, com os campos vazios no `.env.example`.
2. Tabela `push_subscriptions`.
3. `POST /api/push`.
4. `lib/push.mjs` com `web-push`.
5. Envio pelo worker.
6. `push` e `notificationclick` no service worker.
7. Botões "Ativar avisos" e "Enviar teste".
8. Opção de mostrar o valor.

**Aceite:**
- Testes automáticos do item 8.
- O teste chega com o app fechado e a tela bloqueada.
- Uma transferência real gera a notificação.
- Em 7 dias de observação, nenhum aviso deixa de chegar, e a latência fica registrada.
- Remover a permissão leva à limpeza da inscrição no envio seguinte.

### Marco 3: UX mobile das telas essenciais

Tarefas:
1. Barra inferior e "Mais".
2. Alvos de 48 px.
3. Estados de carregando, erro e vazio.
4. Teclado.
5. Fatura aberta na Visão geral.
6. Lista compacta do extrato.
7. Medição do payload.

**Aceite:**
- A 360 × 800 e no celular, nenhuma rolagem horizontal nas telas essenciais.
- Um script no navegador confirma que todo alvo interativo das telas essenciais tem pelo menos 48 × 48 px.
- Os estados de erro e vazio são provocados e conferidos.
- O desktop fica igual (captura).
- Testes, `typecheck` e build passam.

### Marco 4: conexão de banco pelo celular

Tarefas:
1. Widget Pluggy no app instalado.
2. Retorno do OAuth em `https://…/pluggy/retorno`, dentro do escopo da WebAPK e capturado por ela (FATO: web.dev).
3. Estados de cancelamento e falha.
4. Atalho para o Meu Pluggy.

**Aceite:**
- Em homologação, uma instituição OAuth do sandbox conecta a partir do app instalado.
- O app volta sozinho e a conexão fica "Conectada".
- Cancelar ou falhar mostra um estado claro com nova tentativa (SPEC-0001 REQ-001).
- Na produção, a reautorização da MeuPluggy pelo celular conclui. Isso também destrava a SPEC-0004-T012, que pede investimentos.

## 11. Estimativa de esforço

Em dias de trabalho (INFERÊNCIA):

| Marco | Faixa | O que mais pesa na incerteza |
| --- | --- | --- |
| 0 | 1,5 a 4 | Infraestrutura (túnel, Supabase, host) e migração do dono |
| 1 | 0,5 a 1,5 | Baixa |
| 2 | 2 a 4, mais 7 dias corridos de observação | Comportamento do fabricante com a bateria |
| 3 | 2 a 5 | Quantidade de ajustes de layout |
| 4 | 1 a 3 | Retorno do OAuth fora do controle do código |
| **Total** | **7 a 17,5 dias**, mais a observação | |

## 12. Riscos e mitigação

| Risco | Probabilidade / impacto | Mitigação |
| --- | --- | --- |
| Painel com dados bancários reais exposto na internet | Média / alto | Supabase só com o seu e-mail e cadastro desligado, Proxy de sessão, cookies `secure` `httpOnly`, checagem de `Origin` mantida e backup do volume. Opcional: Cloudflare WAF ou limite de taxa no `/login` |
| Sessão caindo por reuso de refresh token | Alta sem o Proxy / médio | Proxy no Marco 0 e aceite com 2 h e 1 dia de uso |
| Migração do dono corromper ou perder dados | Baixa / alto | `VACUUM INTO` antes, simulação, contagens antes e depois, sua autorização e retorno pelo backup |
| Push atrasado ou perdido pela economia de bateria (Xiaomi, Samsung) | Média / alto, porque é requisito | Urgência `high` e TTL, observação de 7 dias, orientação para tirar o Chrome da otimização de bateria. **Gatilho do plano B** |
| Retorno do OAuth abrir no Chrome em vez do app | Média / médio | Escopo `/` no manifest e teste em homologação. A sessão é a mesma, então a conexão conclui. Se ficar ruim, é **gatilho do plano B** |
| Repositório público expor segredos novos (VAPID, credenciais de túnel) | Média / alto | Só variáveis de ambiente, campos vazios no `.env.example`, `git diff --cached` e busca por segredos antes de cada commit |
| Valor na tela bloqueada | Média / médio | Sem valor por padrão |
| A homologação compartilhar a aplicação Pluggy com a produção | Média / médio | Homologação sem webhook e só com sandbox |
| Mudanças mobile quebrarem o desktop | Baixa / médio | CSS só abaixo de 720 px e capturas a 1280 px em todo marco |

## 13. Plano B, se um gatilho disparar

O plano B é o **Expo**, com o SDK oficial `react-native-pluggy-connect` 1.6.0 e FCM. Ele aproveita o Marco 0 inteiro, a tabela de inscrições e o envio pelo worker, trocando o canal de Web Push para FCM. Exige aceitar token no cabeçalho `Authorization: Bearer` em `lib/auth.ts` e reescrever as telas. Nada do plano PWA é perdido.

## 14. Perguntas abertas

Nenhuma bloqueia a aprovação do plano. Todas precisam de resposta antes do marco indicado.

1. **Host da produção** (Marco 0): a máquina Linux com o túnel, como suponho, ou outro servidor?
2. **Migração do dono** (Marco 0): opção A (script) ou B (reconectar e perder o Planejamento)?
3. **Homologação** (Marco 0 ou 4): vale manter um segundo ambiente, ou testar o OAuth direto na produção?
4. **Celular de teste** (Marco 1): qual modelo e qual versão do Android?
5. **Lint** (Marco 1): adicionar ESLint (uma dependência de desenvolvimento e configuração para manter) ou ficar só com `typecheck`? Recomendo só `typecheck` agora.
6. **Push na tela bloqueada** (Marco 2): sem valor por padrão está bom?

## Fontes

- Next.js: [PWA](https://nextjs.org/docs/app/guides/progressive-web-apps) · [proxy.ts](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- Supabase: [cliente SSR e Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client) · [sessões e refresh token](https://supabase.com/docs/guides/auth/sessions)
- web.dev: [critérios de instalação](https://web.dev/articles/install-criteria) · [WebAPKs](https://web.dev/articles/webapks) · [visão geral do push](https://web.dev/articles/push-notifications-overview)
- [Chrome: mudança nos critérios de instalação e Lighthouse](https://developer.chrome.com/blog/update-install-criteria)
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- Tamanho de toque: [Android](https://developer.android.com/guide/topics/ui/accessibility/apps) · [WCAG 2.2, critério 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Pluggy: [OAuth](https://docs.pluggy.ai/docs/oauth-support-guide) · [SDKs](https://v2.docs.pluggy.ai/docs/connect-widget/environments)
- Android: [verificação de desenvolvedor](https://developer.android.com/developer-verification/guides) · [perguntas frequentes](https://developer.android.com/developer-verification/guides/faq)
