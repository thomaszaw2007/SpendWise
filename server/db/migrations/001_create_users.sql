-- Run this first.
CREATE TABLE users (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash   TEXT NOT NULL,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
