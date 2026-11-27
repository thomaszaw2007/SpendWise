-- Login sessions, managed by the connect-pg-simple package.
-- The column names (sid, sess, expire) are required by that package.
CREATE TABLE sessions (
  sid    VARCHAR PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX sessions_expire_index ON sessions (expire);
