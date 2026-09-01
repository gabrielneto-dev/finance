# Clareira Finance

MVP self-hosted de controle financeiro pessoal, construído com Next.js, Prisma, PostgreSQL e Auth.js.

## Rodar localmente

1. Copie `.env.example` para `.env` e defina um `AUTH_SECRET` longo.
2. Inicie o PostgreSQL com `docker compose up -d postgres`.
3. Execute `npm install`, `npm run db:setup` e `npm run dev`. O setup também inclui uma semente idempotente com dados de demonstração.
4. Abra `http://localhost:3000`, entre com nome e e-mail e crie o primeiro workspace.

Para executar aplicação e banco juntos: `docker compose up --build`.

Use `demo@clareira.local` no login local para abrir o workspace de demonstração, com conta, cartão, receitas, despesas, fatura e recorrência já cadastrados. `db:migrate` altera somente a estrutura; `db:setup` é o comando indicado para ambiente local com dados iniciais.

## Verificação

- `npm run test`
- `npm run test:integration` (provisiona e usa somente o schema PostgreSQL `integration_test`)
- `npm run lint`
- `npm run build`

## Limites desta fase

O MVP inclui workspaces, categorias padrão, contas, cartões, transações manuais, regras de recorrência, faturas e dashboard. Pluggy está modelado como ponto de integração, sem sincronização bancária ativa nesta primeira entrega.
