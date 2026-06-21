-- =========================================================================
-- Phase 10 Plan 02 — Flywheel persistence: reconciliations (FLYWHEEL-03/05)
--
-- The cross-creator SEED log (D-06). Every reconciliation writes a row carrying
-- the DENORMALIZED, AGGREGABLE, PRIVACY-SAFE fields a FUTURE cross-creator
-- prior-fitting job needs — WITHOUT building that job here. P10 only guarantees
-- the rows exist; the future job runs
--   aggregate divergence_vector GROUP BY (niche, goal_intent, follower_tier).
--
-- Privacy (T-10-04): follower_tier is a BUCKET, never a raw count (RESEARCH §8).
--
-- Rails only — this plan does NOT build the fitting job (RESEARCH §8).
-- RLS own-rows-only mirrors the audiences idiom.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.reconciliations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome_signature_id uuid        REFERENCES public.outcome_signatures(id) ON DELETE CASCADE,
  audience_id          uuid        REFERENCES public.audiences(id) ON DELETE SET NULL,
  -- ── cross-creator prior-fitting rails (D-06): denormalized, privacy-safe aggregables ──
  niche                text,                  -- from creator profile / audience
  goal_intent          text                   -- the bias context
                         CHECK (goal_intent IS NULL OR goal_intent IN ('grow','sell','authority','nurture')),
  follower_tier        text,                  -- BUCKET, not raw count (privacy — T-10-04)
  predicted_vector     jsonb       NOT NULL,
  realized_vector      jsonb       NOT NULL,
  divergence_vector    jsonb       NOT NULL,  -- realized − predicted per disposition
  classification       jsonb       NOT NULL,  -- {collector:"calibration", scanner:"craft", ...}
  proposal_state       text        NOT NULL DEFAULT 'logged'
                         CHECK (proposal_state IN ('logged','proposed','confirmed','declined')),
  proposed_delta       jsonb,                 -- the bounded weight delta if proposed
  confirmed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reconciliations IS
  'Cross-creator SEED log (D-06): one row per reconciliation carrying denormalized privacy-safe fields (niche, goal_intent, follower_tier bucket, divergence_vector, classification) for a FUTURE prior-fitting job. P10 lays the rails only — it does NOT build the fitting job.';

COMMENT ON COLUMN public.reconciliations.follower_tier IS
  'Follower-count BUCKET (e.g. micro/mid/macro) — never a raw count (privacy-safe, T-10-04 / RESEARCH §8).';
COMMENT ON COLUMN public.reconciliations.classification IS
  'Per-disposition routing {disposition: "calibration"|"craft"} per the A1 split. Craft divergences never feed the recalibration path (D-03).';

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS reconciliations_user_idx
  ON public.reconciliations (user_id);
CREATE INDEX IF NOT EXISTS reconciliations_audience_idx
  ON public.reconciliations (audience_id);

-- ── RLS (own rows only — mirrors audiences_all_own) ──────────────────────────
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_all_own ON public.reconciliations;
CREATE POLICY rec_all_own ON public.reconciliations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
