-- =========================================================================
-- Phase 4 — Live Audience Node
-- analysis_override column (JSONB) on analysis_results
--   + creator_persona_weights table for "Save as my default" opt-in (D-22)
-- Created: 2026-05-27
-- Migration is forward-compatible: analysis_override defaults null.
-- =========================================================================

-- D-22 + Phase 3 D-20 schema (column was referenced but never shipped — verified by grep)
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS analysis_override JSONB;

-- D-22: creator default weights table
CREATE TABLE IF NOT EXISTS creator_persona_weights (
  user_id     UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fyp         NUMERIC(5,4) NOT NULL DEFAULT 0.65,
  niche       NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  loyalist    NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  cross_niche NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

-- Sanity constraint: weights in valid [0,1] range, sum ≈ 1.0 (±0.01 epsilon for NUMERIC rounding)
ALTER TABLE creator_persona_weights
  ADD CONSTRAINT creator_persona_weights_sum_check
  CHECK (
    fyp >= 0 AND fyp <= 1 AND
    niche >= 0 AND niche <= 1 AND
    loyalist >= 0 AND loyalist <= 1 AND
    cross_niche >= 0 AND cross_niche <= 1 AND
    ABS((fyp + niche + loyalist + cross_niche) - 1.0) < 0.01
  );

ALTER TABLE creator_persona_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpw_select_own ON creator_persona_weights
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY cpw_upsert_own ON creator_persona_weights
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
