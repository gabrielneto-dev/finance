# Project State

Last updated: 2026-09-01
Latest checkpoint: `Context/checkpoints/CP-20260901-0002-local-database-and-demo-seed.md`

## Current objective

Continue the next Finance MVP slice: installment plans, richer operational UI, and database-backed integration tests.

## Working

- Next.js full-stack MVP is implemented with Prisma schema, REST API, Auth.js local credentials flow, and a usable UI.
- Financial API enforces workspace membership and validates transaction scenarios.
- Domain-level tests, lint, and production build pass.
- Local PostgreSQL database `finance` is provisioned and has the Prisma schema plus PostgreSQL guardrails applied.
- `db:setup` provisions an idempotent local demonstration workspace with account, card, transactions, invoice, and recurring rule.

## In progress

- End-to-end browser workflows and database-backed integration tests still need to be added.

## Blockers

- A production authentication provider and secure credential strategy remain to be selected before deployment.

## Active decisions

- Use Next.js, Prisma, PostgreSQL, and Auth.js for the MVP foundation.
- Use REST endpoints under `/api/v1/workspaces/:workspaceId` as the integration boundary.

## Open critical questions

- Which production Auth.js provider should replace the local development credentials flow?
- Which Pluggy synchronisation scope and consent lifecycle should be implemented next?

## Next likely steps

- Implement the installment-plan endpoint and UI.
- Add integration tests against PostgreSQL for financial transaction flows.
