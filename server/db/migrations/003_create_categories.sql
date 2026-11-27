CREATE TABLE categories (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  type        VARCHAR(7) NOT NULL CHECK (type IN ('income', 'expense')),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lets the transactions table check owner and type in one foreign key
  UNIQUE (id, user_id, type)
);

-- A user cannot have two categories of the same type with the same name
-- (ignoring capital letters).
CREATE UNIQUE INDEX categories_unique_name ON categories (user_id, type, lower(name));
