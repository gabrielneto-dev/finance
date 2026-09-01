-- Prisma creates the base schema. Keep PostgreSQL-only guardrails here.
CREATE OR REPLACE FUNCTION assert_workspace_relation() RETURNS trigger AS $$
DECLARE reference_workspace uuid;
DECLARE plan_card_id uuid;
DECLARE plan_category_id uuid;
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM accounts WHERE id = NEW.account_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'account belongs to another workspace'; END IF;
  END IF;
  IF NEW.destination_account_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM accounts WHERE id = NEW.destination_account_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'destination account belongs to another workspace'; END IF;
  END IF;
  IF NEW.card_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM cards WHERE id = NEW.card_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'card belongs to another workspace'; END IF;
  END IF;
  IF NEW.category_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM categories WHERE id = NEW.category_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'category belongs to another workspace'; END IF;
  END IF;
  IF NEW.installment_plan_id IS NOT NULL THEN
    SELECT workspace_id, card_id, category_id INTO reference_workspace, plan_card_id, plan_category_id FROM installment_plans WHERE id = NEW.installment_plan_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'installment plan belongs to another workspace'; END IF;
    IF NEW.card_id IS DISTINCT FROM plan_card_id THEN RAISE EXCEPTION 'installment transaction card must match plan card'; END IF;
    IF NEW.category_id IS DISTINCT FROM plan_category_id THEN RAISE EXCEPTION 'installment transaction category must match plan category'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_transactions_workspace_guard ON financial_transactions;
CREATE TRIGGER financial_transactions_workspace_guard
BEFORE INSERT OR UPDATE ON financial_transactions
FOR EACH ROW EXECUTE FUNCTION assert_workspace_relation();

CREATE OR REPLACE FUNCTION assert_card_workspace_relation() RETURNS trigger AS $$
DECLARE reference_workspace uuid;
BEGIN
  SELECT workspace_id INTO reference_workspace FROM accounts WHERE id = NEW.account_id;
  IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'card account belongs to another workspace'; END IF;
  IF NEW.institution_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM institutions WHERE id = NEW.institution_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'card institution belongs to another workspace'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cards_workspace_guard ON cards;
CREATE TRIGGER cards_workspace_guard
BEFORE INSERT OR UPDATE ON cards
FOR EACH ROW EXECUTE FUNCTION assert_card_workspace_relation();

CREATE OR REPLACE FUNCTION assert_invoice_workspace_relation() RETURNS trigger AS $$
DECLARE reference_workspace uuid;
BEGIN
  SELECT workspace_id INTO reference_workspace FROM cards WHERE id = NEW.card_id;
  IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'invoice card belongs to another workspace'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_workspace_guard ON invoices;
CREATE TRIGGER invoices_workspace_guard
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION assert_invoice_workspace_relation();

CREATE OR REPLACE FUNCTION assert_recurring_rule_workspace_relation() RETURNS trigger AS $$
DECLARE reference_workspace uuid;
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM accounts WHERE id = NEW.account_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'recurrence account belongs to another workspace'; END IF;
  END IF;
  IF NEW.card_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM cards WHERE id = NEW.card_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'recurrence card belongs to another workspace'; END IF;
  END IF;
  IF NEW.category_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM categories WHERE id = NEW.category_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'recurrence category belongs to another workspace'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recurring_rules_workspace_guard ON recurring_rules;
CREATE TRIGGER recurring_rules_workspace_guard
BEFORE INSERT OR UPDATE ON recurring_rules
FOR EACH ROW EXECUTE FUNCTION assert_recurring_rule_workspace_relation();

CREATE OR REPLACE FUNCTION assert_installment_plan_workspace_relation() RETURNS trigger AS $$
DECLARE reference_workspace uuid;
BEGIN
  SELECT workspace_id INTO reference_workspace FROM cards WHERE id = NEW.card_id;
  IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'installment card belongs to another workspace'; END IF;
  SELECT workspace_id INTO reference_workspace FROM categories WHERE id = NEW.category_id;
  IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'installment category belongs to another workspace'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS installment_plans_workspace_guard ON installment_plans;
CREATE TRIGGER installment_plans_workspace_guard
BEFORE INSERT OR UPDATE ON installment_plans
FOR EACH ROW EXECUTE FUNCTION assert_installment_plan_workspace_relation();

CREATE OR REPLACE FUNCTION assert_budget_workspace_relation() RETURNS trigger AS $$
DECLARE reference_workspace uuid;
BEGIN
  IF NEW.scope = 'GENERAL' AND NEW.category_id IS NOT NULL THEN RAISE EXCEPTION 'general budget cannot have a category'; END IF;
  IF NEW.scope = 'CATEGORY' AND NEW.category_id IS NULL THEN RAISE EXCEPTION 'category budget requires a category'; END IF;
  IF NEW.category_id IS NOT NULL THEN
    SELECT workspace_id INTO reference_workspace FROM categories WHERE id = NEW.category_id;
    IF reference_workspace IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'budget category belongs to another workspace'; END IF;
  END IF;
  IF NEW.period_end < NEW.period_start OR NEW.amount <= 0 THEN RAISE EXCEPTION 'invalid budget period or amount'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS budgets_workspace_guard ON budgets;
CREATE TRIGGER budgets_workspace_guard
BEFORE INSERT OR UPDATE ON budgets
FOR EACH ROW EXECUTE FUNCTION assert_budget_workspace_relation();

CREATE OR REPLACE FUNCTION assert_goal_account_workspace_relation() RETURNS trigger AS $$
DECLARE goal_workspace uuid;
DECLARE account_workspace uuid;
BEGIN
  SELECT workspace_id INTO goal_workspace FROM goals WHERE id = NEW.goal_id;
  SELECT workspace_id INTO account_workspace FROM accounts WHERE id = NEW.account_id;
  IF goal_workspace IS DISTINCT FROM account_workspace THEN RAISE EXCEPTION 'goal account belongs to another workspace'; END IF;
  IF NEW.allocation_percent < 0 OR NEW.allocation_percent > 100 THEN RAISE EXCEPTION 'invalid goal account allocation'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS goal_accounts_workspace_guard ON goal_accounts;
CREATE TRIGGER goal_accounts_workspace_guard
BEFORE INSERT OR UPDATE ON goal_accounts
FOR EACH ROW EXECUTE FUNCTION assert_goal_account_workspace_relation();

ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_installment_number_check;
ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_installment_number_check CHECK (installment_number IS NULL OR installment_number > 0);
DROP INDEX IF EXISTS financial_transactions_installment_plan_number_unique;
CREATE UNIQUE INDEX financial_transactions_installment_plan_number_unique ON financial_transactions (installment_plan_id, installment_number) WHERE installment_plan_id IS NOT NULL;

CREATE OR REPLACE VIEW v_account_balances AS
SELECT a.id, a.workspace_id, a.currency,
  a.initial_balance + COALESCE(SUM(CASE
    WHEN t.type IN ('INCOME', 'REFUND') AND t.status IN ('PAID', 'RECEIVED', 'COMPLETED') THEN t.amount
    WHEN t.type IN ('EXPENSE', 'INVOICE_PAYMENT', 'ADJUSTMENT') AND t.status IN ('PAID', 'RECEIVED', 'COMPLETED') THEN -t.amount
    WHEN t.type = 'TRANSFER' AND t.account_id = a.id AND t.status IN ('PAID', 'RECEIVED', 'COMPLETED') THEN -t.amount
    WHEN t.type = 'TRANSFER' AND t.destination_account_id = a.id AND t.status IN ('PAID', 'RECEIVED', 'COMPLETED') THEN t.amount
    ELSE 0 END), 0) AS balance
FROM accounts a LEFT JOIN financial_transactions t ON a.id IN (t.account_id, t.destination_account_id)
GROUP BY a.id;
