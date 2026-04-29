-- P2-019 — extend the purchases.status CHECK to include 'pending_action'
-- so 3DS / SCA flows can park rows mid-confirmation without being demoted
-- back to 'pending' (which our admin queries treat as "checkout not yet
-- attempted"). The set otherwise mirrors the values added in 004.
--
-- The companion P3-011 design_feedback table already lives in 004 — this
-- migration deliberately does NOT re-create it; we just need the CHECK
-- update so payments.verifySession can persist the intermediate state.

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('pending','paid','failed','expired','refunded','pending_action',
                    'in_queue','printing','shipped','delivered'));
