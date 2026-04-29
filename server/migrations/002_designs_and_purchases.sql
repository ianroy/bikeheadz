-- Generated STL files + Stripe purchases.

CREATE TABLE IF NOT EXISTS generated_designs (
  id          UUID PRIMARY KEY,
  account_id  BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  stl_bytes   BYTEA NOT NULL,
  filename    TEXT NOT NULL DEFAULT 'StemDomeZ_ValveStem.stl',
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS generated_designs_expires_idx ON generated_designs (expires_at);

CREATE TABLE IF NOT EXISTS purchases (
  id                 BIGSERIAL PRIMARY KEY,
  design_id          UUID REFERENCES generated_designs(id) ON DELETE SET NULL,
  stripe_session_id  TEXT UNIQUE NOT NULL,
  stripe_payment_id  TEXT,
  amount_cents       INTEGER NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'usd',
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','paid','failed','expired','refunded')),
  product            TEXT NOT NULL
                     CHECK (product IN ('stl_download','printed_stem','pack_of_4')),
  customer_email     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS purchases_session_idx ON purchases (stripe_session_id);
CREATE INDEX IF NOT EXISTS purchases_design_idx  ON purchases (design_id);
CREATE INDEX IF NOT EXISTS purchases_status_idx  ON purchases (status);
