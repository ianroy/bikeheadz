-- Migration 007 — Terms-of-Service acceptance tracking.
--
-- Pairs with the rewritten /terms + /privacy from the chunk-2 commit.
-- account.acceptTos writes both columns; account.get exposes
-- needsTosAccept = true when tos_version is null or != current
-- TOS_VERSION constant in server/commands/account.js. The SPA blocks
-- the /account page on a TOS-accept modal until the user clicks
-- "I accept", and the modal re-fires on bump (we change TOS_VERSION
-- whenever a material edit lands).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tos_version TEXT;

CREATE INDEX IF NOT EXISTS accounts_tos_version_idx ON accounts (tos_version);
