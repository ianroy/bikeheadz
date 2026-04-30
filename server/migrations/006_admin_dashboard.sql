-- Migration 006 — Admin dashboard data plumbing.
--
-- New surfaces this enables:
--   * Trends graph (page hits, signups, photos, jobs, completions per day)
--   * Funnel (Land → Sign in → Generate → Download)
--   * Cohort retention by signup week
--   * Login world map (audit_log geo_country / geo_city)
--   * Referrer + device split
--   * Password opt-in (password_hash + password_set_at on accounts)
--   * Admin-issued invites (invites table)
--   * TRELLIS pipeline health (triangles / watertight / retry telemetry on
--     generated_designs)

-- Page views — every navigation gets a row; admin trends + funnel run
-- aggregate queries over this. session_key is the visitor cookie (anon
-- or signed-in); account_id is set when the visitor is logged in.
CREATE TABLE IF NOT EXISTS page_views (
  id           BIGSERIAL PRIMARY KEY,
  account_id   BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  session_key  TEXT NOT NULL,
  path         TEXT NOT NULL,
  referrer     TEXT,
  ip           TEXT,
  user_agent   TEXT,
  geo_country  TEXT,
  geo_city     TEXT,
  device_kind  TEXT,
  os_kind      TEXT,
  browser_kind TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS page_views_created_idx ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_account_idx ON page_views (account_id);
CREATE INDEX IF NOT EXISTS page_views_session_idx ON page_views (session_key);
CREATE INDEX IF NOT EXISTS page_views_path_idx ON page_views (path);

-- Password opt-in. Unset for magic-link-only accounts (the default).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS invited_by BIGINT REFERENCES accounts(id) ON DELETE SET NULL;

-- Geo columns on audit_log so login locations can be plotted on a map.
-- Page-view middleware also writes to these for relevant action rows.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS geo_country TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS geo_city TEXT;

-- Invites — admin sends these to bring people on board. Each invite
-- carries a single-use code that, when redeemed, signs the recipient
-- in and tags their account with invited_by.
CREATE TABLE IF NOT EXISTS invites (
  id           BIGSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL,
  sent_by      BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  accepted_at  TIMESTAMPTZ,
  accepted_by  BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  message      TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS invites_email_idx ON invites (LOWER(email));
CREATE INDEX IF NOT EXISTS invites_sent_by_idx ON invites (sent_by);

-- Pipeline telemetry on generated_designs so the TRELLIS quality
-- dashboard can render histograms + auto-retry rate. Backfilled NULL
-- for rows generated before this migration; aggregations skip nulls.
ALTER TABLE generated_designs ADD COLUMN IF NOT EXISTS triangles INT;
ALTER TABLE generated_designs ADD COLUMN IF NOT EXISTS watertight BOOLEAN;
ALTER TABLE generated_designs ADD COLUMN IF NOT EXISTS stage3_retried BOOLEAN DEFAULT FALSE;
ALTER TABLE generated_designs ADD COLUMN IF NOT EXISTS pipeline_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;
