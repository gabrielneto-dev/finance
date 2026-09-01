---
id: CTX-DEC-20260901-local-demo-seed
type: decision
title: Seed local development with idempotent demonstration data
branch: finance
tags: [database, seed, local-development, demonstration]
status: active
created_at: 2026-09-01
updated_at: 2026-09-01
related: [CTX-FCT-20260901-finance-mvp-implementation]
---

# Decision

`db:migrate` remains schema-only. `db:setup` runs the structural setup followed by an idempotent local seed. The seed supplies a demonstration user, workspace, categories, institution, account, card, transactions, invoice, and recurring rule. It must not store or document database credentials.
