-- Initial schema for StemDomeZ on PostgreSQL 18 (Digital Ocean Managed).

CREATE TABLE IF NOT EXISTS accounts (
  id            BIGINT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  email         TEXT UNIQUE,
  preferences   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS designs (
  id            BIGSERIAL PRIMARY KEY,
  account_id    BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  thumbnail_url TEXT,
  material      TEXT NOT NULL CHECK (material IN ('matte','gloss','chrome')),
  stars         INTEGER NOT NULL DEFAULT 5 CHECK (stars BETWEEN 0 AND 5),
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS designs_created_idx ON designs (created_at DESC);
CREATE INDEX IF NOT EXISTS designs_account_idx ON designs (account_id);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  account_id   BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  design_id    BIGINT REFERENCES designs(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Processing',
  price        TEXT NOT NULL,
  qty          INTEGER NOT NULL DEFAULT 1,
  placed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_placed_idx  ON orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS orders_account_idx ON orders (account_id);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  happens_at  TIMESTAMPTZ NOT NULL,
  location    TEXT,
  image_url   TEXT
);

CREATE INDEX IF NOT EXISTS events_happens_idx ON events (happens_at);
