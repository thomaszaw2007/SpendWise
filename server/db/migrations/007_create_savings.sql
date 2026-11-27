-- Savings goals. Money put into a goal is "reserved": it is still part of the
-- user's balance, but it is no longer available to spend.
CREATE TABLE savings_goals (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name          VARCHAR(80) NOT NULL CHECK (btrim(name) <> ''),
  description   VARCHAR(300),
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  target_date   DATE,
  status        VARCHAR(9) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The date columns must match the status
  CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),

  -- Lets savings_entries check the owner in its foreign key
  UNIQUE (id, user_id)
);

-- Two goals that are not cancelled cannot have the same name
CREATE UNIQUE INDEX savings_goals_unique_name
  ON savings_goals (user_id, lower(name)) WHERE status <> 'cancelled';
CREATE INDEX savings_goals_user_index ON savings_goals (user_id, status);

-- The history of every change to a goal. The amount reserved for a goal is
-- always calculated from this table:
--   contribution : money reserved for the goal (adds)
--   withdrawal   : money taken back by the user (subtracts)
--   release      : money freed automatically when a goal is cancelled (subtracts)
-- Nothing here is an income or an expense, so budgets and analytics ignore it.
CREATE TABLE savings_entries (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  goal_id    INTEGER NOT NULL,
  type       VARCHAR(12) NOT NULL CHECK (type IN ('contribution', 'withdrawal', 'release')),
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note       VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The goal must belong to the same user
  FOREIGN KEY (goal_id, user_id) REFERENCES savings_goals (id, user_id) ON DELETE CASCADE
);

CREATE INDEX savings_entries_goal_index ON savings_entries (goal_id, created_at DESC, id DESC);
CREATE INDEX savings_entries_user_index ON savings_entries (user_id);
