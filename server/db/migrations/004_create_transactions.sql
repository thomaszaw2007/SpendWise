CREATE TABLE transactions (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id      INTEGER NOT NULL,
  type             VARCHAR(7) NOT NULL CHECK (type IN ('income', 'expense')),
  description      VARCHAR(120) NOT NULL,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  payment_method   VARCHAR(20) NOT NULL CHECK (payment_method IN
                     ('Cash', 'Card', 'PayNow', 'Bank Transfer', 'E-wallet', 'Other')),
  notes            VARCHAR(500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The category must belong to the same user and have the same type.
  -- It also stops a category being deleted while transactions use it.
  FOREIGN KEY (category_id, user_id, type) REFERENCES categories (id, user_id, type)
);

CREATE INDEX transactions_user_date_index ON transactions (user_id, transaction_date DESC);
CREATE INDEX transactions_category_index ON transactions (category_id);
