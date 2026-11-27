-- Account settings reuse the existing users columns (full_name, email,
-- opening_balance, created_at), so no new columns are needed.
--
-- This index makes it fast to find one user's login sessions. It is used to
-- log a user out everywhere after a password change or account deletion.
CREATE INDEX IF NOT EXISTS sessions_user_index ON sessions ((sess ->> 'userId'));
