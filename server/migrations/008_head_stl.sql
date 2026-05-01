-- 008_head_stl.sql — handler v0.1.42 dual-output (head + final).
--
-- The pipeline now ships two STLs per generation: the head-only mesh
-- coming out of stage 1.7 (always available when the job succeeds at
-- all), and the head+cap mesh coming out of stage 6 (which fails
-- regularly — boolean ops on selfie geometry are unforgiving).
--
-- Storing both means a failed boolean phase no longer wastes the GPU
-- run: the rider still has their face. `final_failed` lets the UI
-- decide whether to grey out the "Full STL" download and apologize.
--
-- `stl_bytes` (the historical column) keeps holding the FINAL mesh on
-- success. New `head_stl_bytes` holds the head-only mesh. New
-- `final_failed` defaults FALSE for legacy rows (they all came from the
-- old single-output handler and the column we're storing — `stl_bytes`
-- — was the merged result, never a head-only). Legacy rows get NULL
-- for `head_stl_bytes` and the UI shows a "head-only not available for
-- this scan" badge.
--
-- `final_error` is the PipelineError code (e.g. 'NECK_NOT_FOUND') so
-- the admin failure dashboard can keep its existing histogram working.

ALTER TABLE generated_designs
  ADD COLUMN IF NOT EXISTS head_stl_bytes BYTEA NULL,
  ADD COLUMN IF NOT EXISTS final_failed   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS final_error    TEXT NULL;

-- Lift the historical NOT NULL on stl_bytes — once finals can fail
-- the column is conditionally populated. We still write a placeholder
-- (zero-length BYTEA) when final_failed=true so existing /download
-- code paths don't 500; this is just belt-and-braces in case that
-- promise ever slips.
ALTER TABLE generated_designs
  ALTER COLUMN stl_bytes DROP NOT NULL;

-- ── Per-stage feedback ──────────────────────────────────────────────
-- The dual-output pipeline ships TWO STLs per generation. Riders may
-- want to thumbs-up the head and thumbs-down the head+cap (or vice
-- versa) — they're different artifacts. Add a `stage` discriminator
-- to design_feedback and rebuild the uniqueness constraint as
-- (design_id, account_id, stage) so a rider can rate both stages
-- independently.
--
-- Backfill: existing rows came from the single-output era; tag them
-- as 'final' (the only thing that could have been rated then).
ALTER TABLE design_feedback
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'final'
    CHECK (stage IN ('head', 'final'));

-- Drop the old single-stage uniqueness, add the new tri-key one.
-- Wrapped in DO block because the constraint name varies by Postgres
-- version (auto-generated suffix) — find it by columns instead.
DO $mig$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'design_feedback'::regclass
     AND contype = 'u'
     AND ARRAY(
       SELECT attname
         FROM unnest(conkey) AS k
         JOIN pg_attribute a ON a.attnum = k AND a.attrelid = 'design_feedback'::regclass
        ORDER BY attname
     ) = ARRAY['account_id', 'design_id'];
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE design_feedback DROP CONSTRAINT %I', cname);
  END IF;
END
$mig$;

ALTER TABLE design_feedback
  ADD CONSTRAINT design_feedback_design_account_stage_uniq
  UNIQUE (design_id, account_id, stage);

CREATE INDEX IF NOT EXISTS design_feedback_design_idx
  ON design_feedback (design_id);
CREATE INDEX IF NOT EXISTS design_feedback_created_idx
  ON design_feedback (created_at DESC);
