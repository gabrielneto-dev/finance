# Finance

[![CI](https://github.com/gabrielneto-dev/finance/actions/workflows/ci.yml/badge.svg)](https://github.com/gabrielneto-dev/finance/actions/workflows/ci.yml)

Controle financeiro pessoal com captura de transações via WhatsApp.

## Domínio

- **Account** (conta): corrente, poupança, dinheiro, investimento.
- **Card** (cartão de crédito): tem dia de fechamento e vencimento, gera faturas.
- **Category** (categoria): hierárquica, tipada em receita/despesa.
- **Transaction** (transação): unidade central — pode ser manual, do WhatsApp, de uma recorrência ou de um parcelamento.
- **InstallmentPlan / Installment** (parcelamento / parcela): o contrato da compra parcelada e cada parcela individual, cada uma já materializada como uma `Transaction`.
- **Recurrence** (recorrência): regra que gera transações automaticamente (aluguel, assinatura, salário).
- **Invoice** (fatura): agrupa as transações de um cartão por ciclo de fechamento.
- **WhatsAppMessage**: log de auditoria de toda mensagem recebida e o que foi extraído dela.

## Arquitetura

```
WhatsApp (número secundário) ⇄ Baileys ⇄ wa-gateway (processo long-running)
                                              │
                                              ├─ comando estruturado (/g, /r, ...)
                                              └─ fallback: Claude API ou Groq API (extração em linguagem natural)
                                              │
                                              ▼
                                     API interna (Next.js Route Handlers)
                                              │
                                              ▼
                                     Postgres (Prisma)
                                              ▲
                                              │
                                   jobs (cron): recorrências e faturas
```

Três processos separados, um Postgres:
- `api`: Next.js (App Router, `app/api/**/route.ts`), protegida por `X-Api-Key` via `proxy.ts`. Escolhida
  porque o plano é evoluir para um dashboard web depois, no mesmo projeto — sem isso, Fastify seria mais
  simples para uma API pura. `output: "standalone"` gera um servidor Node autossuficiente para produção.
- `wa-gateway`: mantém a sessão WhatsApp viva (Baileys), interpreta mensagens, chama a API. **Não roda em
  serverless/Vercel** — precisa de um processo Node de longa duração com WebSocket persistente, então
  continua compilado à parte (via `tsup`) e rodando em container próprio.
- `jobs`: gera transações de recorrências vencidas e transiciona status de faturas, diariamente. Mesma
  razão do wa-gateway: roda como processo Node standalone, fora do Next.js.

`src/lib` e `src/services` (regra de negócio, sem framework) são compartilhados pelos três: a API os
importa diretamente, `wa-gateway`/`jobs` os importam e viram bundle via `tsup`. Dois `tsconfig` cobrem
isso — `tsconfig.json` é o do Next.js (bundler resolution), `tsconfig.workers.json` faz só type-check
para o mundo `tsup`/Node — mas o `npm run typecheck` roda os dois.

## Por que Baileys, e o risco que isso carrega

Baileys não é uma biblioteca oficial da Meta — é engenharia reversa do protocolo do WhatsApp. Isso significa:

- **Use um número secundário dedicado ao bot**, nunca o seu número pessoal principal. Se o número for banido, você não perde acesso a contatos e grupos importantes.
- A sessão fica salva em `WA_SESSION_PATH` (por padrão `./data/wa-session`). Quem tiver acesso a esses arquivos tem acesso à sessão do WhatsApp inteira — trate como segredo, nunca commite.
- Toda mensagem só é processada se vier de um número na allowlist (`ALLOWED_PHONES`) — isso evita que qualquer pessoa que descubra o número do bot injete transações falsas.

## Setup local

```bash
cp .env.example .env
# edite .env: ALLOWED_PHONES com seu número, API_KEY, e a chave do LLM_PROVIDER escolhido

npm install
docker compose up -d postgres
npm run prisma:migrate
npm run seed

npm run dev:api    # terminal 1 — next dev
npm run dev:jobs   # terminal 2
npm run dev:wa     # terminal 3 — escaneie o QR code com o WhatsApp do número dedicado ao bot
```

## Testes

Dois níveis: unitários (funções puras, sem banco) e de integração (services contra um Postgres real).

```bash
npm run test               # unitários — lib/, wa-gateway/command-parser, allowlist

cp .env.test.example .env.test   # aponte para um banco DIFERENTE do de desenvolvimento
npm run test:integration:setup   # aplica as migrations no banco de teste
npm run test:integration         # services — transaction, installment, recurrence, invoice, resolver

npm run test:all            # os dois
```

Os testes de integração truncam todas as tabelas do banco antes de cada teste (`resetDatabase()` em
`src/testing/db.ts`). Por segurança, `src/testing/setup-integration.ts` recusa rodar se a
`DATABASE_URL` não contiver a palavra "test" no nome do banco — isso existe para não zerar seus
dados reais por engano caso o `.env.test` aponte, por descuido, para o banco de desenvolvimento.

**CI**: `.github/workflows/ci.yml` roda a cada push e pull request — sobe um Postgres de serviço,
gera o Prisma Client, roda `typecheck`, os testes unitários, aplica as migrations no banco de teste,
roda os testes de integração e valida os dois builds de produção (`next build` da API e `tsup` dos
workers). Qualquer um desses passos falhando quebra o CI.

## Uso via WhatsApp

Comandos estruturados (rápidos, sem custo de LLM):

```
/g 45,90 ifood conta:nubank cat:alimentacao
/g 1200 notebook cartao:nubank cat:eletronicos parcelas:10
/r 3000 salario conta:nubank cat:salario
/ok
/corrigir categoria lazer
/desfazer
/saldo nubank
/ajuda
```

Mensagens em linguagem natural (fallback via LLM):

```
gastei 45 no ifood no crédito do nubank
```

Se a extração tiver baixa confiança, o bot cria a transação como pendente e pede confirmação (`/ok`) antes de considerá-la definitiva.

### Provedor do fallback LLM

`LLM_PROVIDER` no `.env` escolhe entre `anthropic` (default) e `groq`. Preencha só as credenciais do
provedor escolhido (`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` ou `GROQ_API_KEY`/`GROQ_MODEL`) — o outro pode
ficar vazio. Os dois usam o mesmo esquema de extração (mesma tool/function definition), então trocar de
provedor não muda o comportamento dos comandos, só qual API processa o texto livre.

Groq hospeda modelos open-source (o default aqui é `openai/gpt-oss-20b`) com inferência muito mais barata
que qualquer modelo proprietário — é a opção consistente se o motivo da escolha for custo. Para uma
mensagem curta como essas, o custo real é baixo com qualquer um dos dois: mesmo com Claude Sonnet, cada
mensagem em linguagem natural fica na casa de fração de centavo de dólar.

## Deploy (produção)

```bash
cp .env.example .env   # preencha com valores reais
docker compose up -d --build
docker compose logs -f wa-gateway   # escaneie o QR na primeira vez
docker compose exec api npx prisma migrate deploy
```

O `Dockerfile` tem dois targets: `api` (Next.js `output: "standalone"`, imagem enxuta) e `worker`
(`wa-gateway`/`jobs`, bundle via `tsup`). Ambos rodam em `node:20-alpine` (musl, não glibc) — por isso
`prisma/schema.prisma` declara `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`. Sem isso, o
Prisma só gera o engine da plataforma onde rodou `prisma generate` (normalmente glibc/debian), que não
carrega dentro do Alpine — a API subiria e o `/api/health` responderia normalmente, mas qualquer rota
que tocasse o banco quebraria em runtime só dentro do container. Se um dia trocar a imagem base do
Dockerfile para uma não-Alpine, ajuste (ou remova) esse `binaryTarget`.

## O que fica fora do escopo (de propósito)

- Multiusuário / múltiplos workspaces — é uso pessoal, single-user.
- Rastreamento detalhado de posições de investimento (cotas, rentabilidade por ativo) — investimento entra como `Account` tipo `INVESTMENT`, aportes/resgates são `Transaction`s normais.
- Dashboard web — o canal primário de entrada continua sendo o WhatsApp. A API já está em Next.js
  justamente para viabilizar um dashboard depois (`app/` ganharia páginas ao lado das rotas `app/api/`),
  mas nenhuma UI foi construída ainda.
