---
id: CTX-DEC-20260901-finance-mvp-stack
type: decision
title: Adopt Next.js, Prisma, PostgreSQL, and Auth.js for the MVP
branch: finance
tags: [architecture, nextjs, prisma, postgresql, authjs]
status: active
created_at: 2026-09-01
updated_at: 2026-09-01
related: [CTX-FCT-20260901-finance-mvp-implementation]
---

# Decision

Use a Next.js full-stack application with TypeScript, Prisma ORM, PostgreSQL, and Auth.js. The application exposes workspace-scoped REST endpoints to allow future integrations to reuse the same business rules. PostgreSQL-specific guardrails and balance view remain in SQL migration files.
