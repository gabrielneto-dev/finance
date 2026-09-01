# Goals

## Current goals

- Deliver a reliable, self-hostable personal-finance MVP with manual transaction entry.
- Preserve financial-domain invariants: workspace isolation, idempotency, separate transfer and invoice-payment concepts, and correct credit-card invoice allocation.
- Keep the domain ready for Pluggy, WhatsApp, and AI integrations without coupling those integrations to the frontend.

## Non-goals for the first delivery

- Live Pluggy bank synchronisation.
- Full budgets, goals, attachments, WhatsApp workflows, operational AI, and advanced reconciliation.

## Success criteria

- A user can sign in locally, create a workspace, add an account, and record manual income or expense.
- API operations only access workspaces where the user is a member.
- New workspaces receive standard categories and recurring transaction jobs do not duplicate periods.
