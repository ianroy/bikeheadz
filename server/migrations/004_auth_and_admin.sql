-- P1-001: magic-link login tokens.
-- P1-002: server-side sessions backing the cookie.
-- P0-008: admin role.
-- P0-009: audit log.
-- P0-010: feature flags.
-- P1-006: user photos.
-- P1-009: webauthn credentials.
-- P1-010: active sessions row-per-cookie.

-- ── accounts: shift to BIGSERIAL, add new columns. The existing schema
-- declared id BIGINT PRIMARY KEY (no auto-generated default). Real users
-- need autoincrement, so we attach a sequence to the existing column
-- without dropping the table.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'accounts_id_seq') THEN
    EXECUTE 'CREATE SEQUENCE accounts_id_seq START WITH 1000';
    EXECUTE 'ALTER TABLE accounts ALTER COLUMN id SET DEFAULT nextval(''accounts_id_seq'')';
    EXECUTE 'ALTER SEQUENCE accounts_id_seq OWNED BY accounts.id';
  END IF;
END $$;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','support')),
  ADD COLUMN IF NOT EXISTS email_prefs JSONB NOT NULL DEFAULT
    '{"marketing": false, "order_updates": true, "design_reminders": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS avatar JSONB NOT NULL DEFAULT '{"kind":"identicon"}'::jsonb,
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_token_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS accounts_email_lower_idx ON accounts (LOWER(email));
CREATE INDEX IF NOT EXISTS accounts_username_lower_idx ON accounts (LOWER(username));
CREATE INDEX IF NOT EXISTS accounts_role_idx ON accounts (role) WHERE deleted_at IS NULL;

-- ── auth_tokens: short-lived magic-link tokens.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token        TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  ip           TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS auth_tokens_email_idx ON auth_tokens (LOWER(email));
CREATE INDEX IF NOT EXISTS auth_tokens_expires_idx ON auth_tokens (expires_at);

-- ── sessions (P1-002 / P1-010): row-per-cookie so we can revoke individually.
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_agent    TEXT,
  ip            TEXT,
  ip_city       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_last_seen_idx ON sessions (last_seen_at);

-- ── webauthn_credentials (P1-009).
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key  BYTEA NOT NULL,
  sign_count  BIGINT NOT NULL DEFAULT 0,
  transports  JSONB NOT NULL DEFAULT '[]'::jsonb,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- ── audit_log (P0-009).
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  on_behalf_of BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

-- ── feature_flags (P0-010).
CREATE TABLE IF NOT EXISTS feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  percent     INTEGER NOT NULL DEFAULT 0 CHECK (percent BETWEEN 0 AND 100),
  allowlist   JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  updated_by  BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── user_photos (P1-006).
CREATE TABLE IF NOT EXISTS user_photos (
  id            UUID PRIMARY KEY,
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  image_b64     BYTEA NOT NULL,
  sha256        TEXT NOT NULL,
  filename      TEXT,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX IF NOT EXISTS user_photos_account_idx ON user_photos (account_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_photos_account_sha_idx ON user_photos (account_id, sha256);
CREATE INDEX IF NOT EXISTS user_photos_expires_idx ON user_photos (expires_at);

-- Designs / purchases enrichments (P1-003 / P1-006 / P2-003 / P2-013).
ALTER TABLE generated_designs
  ADD COLUMN IF NOT EXISTS photo_id UUID REFERENCES user_photos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pipeline_version TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

CREATE INDEX IF NOT EXISTS generated_designs_account_idx ON generated_designs (account_id);
CREATE INDEX IF NOT EXISTS generated_designs_public_idx ON generated_designs (is_public, created_at DESC);

-- Re-enable larger product set + shipping/promo fields.
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_product_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_product_check
  CHECK (product IN ('stl_download','printed_stem','pack_of_4','comp_grant'));

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_address JSONB,
  ADD COLUMN IF NOT EXISTS shipping_tracking JSONB,
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS print_vendor TEXT,
  ADD COLUMN IF NOT EXISTS print_vendor_order_id TEXT,
  ADD COLUMN IF NOT EXISTS tax_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('pending','paid','failed','expired','refunded',
                    'in_queue','printing','shipped','delivered'));

CREATE INDEX IF NOT EXISTS purchases_account_idx ON purchases (account_id);

-- ── design_feedback (P3-011).
CREATE TABLE IF NOT EXISTS design_feedback (
  id          BIGSERIAL PRIMARY KEY,
  design_id   UUID NOT NULL REFERENCES generated_designs(id) ON DELETE CASCADE,
  account_id  BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  rating      TEXT NOT NULL CHECK (rating IN ('up','meh','down')),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(design_id, account_id)
);

-- ── promo_codes (P2-011).
CREATE TABLE IF NOT EXISTS promo_codes (
  code         TEXT PRIMARY KEY,
  percent_off  INTEGER CHECK (percent_off BETWEEN 0 AND 100),
  amount_off   INTEGER CHECK (amount_off >= 0),
  max_uses     INTEGER,
  used_count   INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  scope        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by   BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── email_events (P4-011).
CREATE TABLE IF NOT EXISTS email_events (
  id          BIGSERIAL PRIMARY KEY,
  message_id  TEXT,
  account_id  BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  template    TEXT,
  type        TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_events_account_idx ON email_events (account_id);
CREATE INDEX IF NOT EXISTS email_events_created_idx ON email_events (created_at DESC);

-- ── experiments (P4-009).
CREATE TABLE IF NOT EXISTS experiments (
  key         TEXT PRIMARY KEY,
  variants    JSONB NOT NULL,
  allocation  JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS experiment_exposures (
  id            BIGSERIAL PRIMARY KEY,
  experiment_key TEXT NOT NULL REFERENCES experiments(key) ON DELETE CASCADE,
  account_id    BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  variant       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS experiment_exposures_key_idx ON experiment_exposures (experiment_key, created_at DESC);

-- ── daily_stats (P4-005).
CREATE TABLE IF NOT EXISTS daily_stats (
  day             DATE PRIMARY KEY,
  generations     INTEGER NOT NULL DEFAULT 0,
  unique_users    INTEGER NOT NULL DEFAULT 0,
  purchases_paid  INTEGER NOT NULL DEFAULT 0,
  revenue_cents   BIGINT NOT NULL DEFAULT 0,
  refund_cents    BIGINT NOT NULL DEFAULT 0,
  median_latency_ms INTEGER,
  cache_hits      INTEGER NOT NULL DEFAULT 0,
  cache_misses    INTEGER NOT NULL DEFAULT 0
);
