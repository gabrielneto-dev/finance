# Finance Branch Index

## Purpose

Track the personal-finance product domain, its accounting invariants, and delivery decisions.

## Scope

- workspace-scoped personal finance
- accounts, cards, invoices, and transactions
- recurring workflows and future financial integrations

## Current state

The branch contains the active MVP foundation and confirmed product direction.

## Key records

- Fact: `CTX-FCT-20260901-finance-mvp-implementation`
- Decisions: `CTX-DEC-20260901-finance-mvp-stack`, `CTX-DEC-20260901-finance-mvp-scope`, `CTX-DEC-20260901-local-demo-seed`
- Active plan: `CTX-PLN-20260901-finance-mvp-delivery`

## Active decisions

- Keep financial mutations workspace-scoped and enforce domain semantics outside the UI.

## Open questions

- What production authentication provider and Pluggy sync lifecycle best fit the deployment?

## Risks

- Financial calculations need database-backed integration tests before a production launch.

## Related branches

- None yet. Add new branches when the repository reveals distinct areas such as analysis, data, automation, or operations.
