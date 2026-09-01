---
id: CTX-PLN-20260901-finance-mvp-delivery
type: plan
title: Finance MVP delivery plan
branch: finance
tags: [plan, mvp, finance, delivery]
status: active
created_at: 2026-09-01
updated_at: 2026-09-01
related: [CTX-FCT-20260901-finance-mvp-implementation, CTX-DEC-20260901-finance-mvp-stack, CTX-DEC-20260901-finance-mvp-scope]
---

# Plan

## Completed foundation

- Next.js, Prisma, PostgreSQL, Auth.js, local Docker setup, and workspace-scoped REST API.
- Manual accounts, cards, categories, transactions, recurring rules, invoices, dashboard, and Pluggy integration boundary.
- Local PostgreSQL provisioning and idempotent demonstration seed.

## Next delivery: transaction completeness

- Implement `InstallmentPlan` in the Prisma schema, API, and UI.
- Materialize all installments when a plan is created, with exact total validation and invoice assignment for credit-card installments.
- Add PostgreSQL-backed integration tests for transfers, invoice payments, recurrence idempotency, installment totals, and workspace isolation.

## Following delivery: operational UI

- Add screens and forms for institutions, cards, recurring rules, invoices, and transaction history.
- Add filters by account, card, category, status, and period.
- Improve dashboard summaries while keeping multi-currency totals explicitly scoped.

## Later delivery: integrations and production readiness

- Select a production Auth.js provider and replace the local credentials-only flow.
- Implement Pluggy consent, connection lifecycle, import idempotency, and reconciliation workflow.
- Add budgets, goals, attachments, observability, backup strategy, CI, and self-host deployment hardening.

## Immediate next step

Implement installment plans and their database-backed integration tests before adding new external integrations.
