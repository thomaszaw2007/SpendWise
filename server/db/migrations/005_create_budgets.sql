-- One table for the three budget types:
--   daily    : one spending limit per user (no month, no category)
--   monthly  : one overall budget per month
--   category : one budget per expense category per month
-- "month" is always the first day of that month.
CREATE TABLE budgets (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type          VARCHAR(8) NOT NULL CHECK (type IN ('daily', 'monthly', 'category')),
  month         DATE CHECK (EXTRACT(DAY FROM month) = 1),
  category_id   INTEGER,
  -- Always 'expense', so the foreign key only accepts expense categories
  category_type VARCHAR(7) NOT NULL DEFAULT 'expense' CHECK (category_type = 'expense'),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    (type = 'daily' AND month IS NULL AND category_id IS NULL) OR
    (type = 'monthly' AND month IS NOT NULL AND category_id IS NULL) OR
    (type = 'category' AND month IS NOT NULL AND category_id IS NOT NULL)
  ),

  -- The category must belong to the same user.
  -- Deleting an unused category also removes its budgets.
  FOREIGN KEY (category_id, user_id, category_type)
    REFERENCES categories (id, user_id, type) ON DELETE CASCADE
);

-- No duplicate budgets
CREATE UNIQUE INDEX budgets_one_daily ON budgets (user_id) WHERE type = 'daily';
CREATE UNIQUE INDEX budgets_one_monthly ON budgets (user_id, month) WHERE type = 'monthly';
CREATE UNIQUE INDEX budgets_one_category ON budgets (user_id, month, category_id)
  WHERE type = 'category';
