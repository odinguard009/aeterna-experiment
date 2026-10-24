-- 0002_sessions.sql - login tokens and sessions (roadmap M7 step 3).
--
-- Both rows are addressed by the SHA-256 of a random token, never by the token itself: a database
-- dump must not be a set of working login links. The token is shown once (the magic link, the
-- cookie) and only its hash is stored.
--
--   login_tokens: a magic link. Single use, short lived, marked used_at the moment it is consumed,
--                 so a forwarded mail does not work twice.
--   sessions:     the cookie after a login. Long lived, revoked by deleting the row, and the
--                 account can see nothing without it.
--
-- Expiry is checked by the queries, not by a cron: a row past expires_at is simply not returned.

BEGIN;

CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash  text PRIMARY KEY,                       -- sha256 hex of the token in the link
  account_id  uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS login_tokens_account_idx ON login_tokens (account_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  text PRIMARY KEY,                       -- sha256 hex of the cookie value
  account_id  uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions (account_id);

COMMIT;
