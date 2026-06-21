-- =========================================================================
-- Phase 7 — Audience Manager
-- audiences table (audience-scoped PersonaWeights + calibration metadata)
--   + threads.active_audience_id nullable FK (D-04 per-thread pin)
--
-- Design decisions:
--   - mirrors creator_persona_weights RLS + NUMERIC(5,4) + sum-CHECK idiom
--     (VERBATIM from 20260527000000_audience_overrides.sql)
--   - mirrors threads ON DELETE SET NULL nullable-FK pattern
--     (VERBATIM from 20260617000000_threads_messages.sql)
--   - id is UUID PK (audience_id) — multi-select-ready (Pitfall 5)
--   - General + 2 presets are virtual constants in audience-repo.ts (no seed rows)
--   - DO NOT alter analysis_results or creator_persona_weights (regression gate)
-- =========================================================================

-- =========================================================================
-- TABLE: public.audiences
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.audiences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  type            text        NOT NULL CHECK (type IN ('personal','target')),
  platform        text        NOT NULL CHECK (platform IN ('tiktok','instagram','youtube','custom')),
  goal_label      text,
  goal_intent     text        CHECK (goal_intent IN ('grow','sell','authority','nurture')),
  is_general      boolean     NOT NULL DEFAULT false,
  is_preset       boolean     NOT NULL DEFAULT false,
  -- PersonaWeights: goal-bias pre-baked at calibration — NUMERIC(5,4) verbatim from creator_persona_weights
  fyp             NUMERIC(5,4) NOT NULL DEFAULT 0.65,
  niche           NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  loyalist        NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  cross_niche     NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  -- Calibrated persona repaint + AudienceProfile (jsonb)
  personas        jsonb       NOT NULL DEFAULT '[]',
  profile         jsonb,
  calibration     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Sanity constraint: weights in valid [0,1] range, sum ≈ 1.0 (±0.01 epsilon for NUMERIC rounding)
-- Verbatim from creator_persona_weights_sum_check in 20260527000000_audience_overrides.sql
ALTER TABLE public.audiences
  ADD CONSTRAINT audiences_weights_sum_check
  CHECK (
    fyp >= 0 AND fyp <= 1 AND
    niche >= 0 AND niche <= 1 AND
    loyalist >= 0 AND loyalist <= 1 AND
    cross_niche >= 0 AND cross_niche <= 1 AND
    ABS((fyp + niche + loyalist + cross_niche) - 1.0) < 0.01
  );

COMMENT ON TABLE public.audiences IS
  'Persisted Audience objects. Each row is a creator-owned audience with a pre-baked PersonaWeights bias (goal-intent cached at calibration). General + presets are virtual constants in audience-repo.ts (no rows needed). id is the audience_id PK, multi-select-ready (audience_ids[] is purely additive).';

COMMENT ON COLUMN public.audiences.fyp IS
  'FYP persona weight (0..1). Goal-intent bias pre-baked at calibration via GOAL_INTENT_BIAS table. Default 0.65 matches DEFAULT_PERSONA_WEIGHT_CONFIG.';
COMMENT ON COLUMN public.audiences.niche IS
  'Niche persona weight (0..1). Default 0.20 matches DEFAULT_PERSONA_WEIGHT_CONFIG.';
COMMENT ON COLUMN public.audiences.loyalist IS
  'Loyalist persona weight (0..1). Default 0.10 matches DEFAULT_PERSONA_WEIGHT_CONFIG.';
COMMENT ON COLUMN public.audiences.cross_niche IS
  'Cross-niche persona weight (0..1). Default 0.05 matches DEFAULT_PERSONA_WEIGHT_CONFIG.';

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS audiences_user_id_idx ON public.audiences (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;

-- SELECT: own audiences only (verbatim from cpw_select_own in 20260527000000_audience_overrides.sql)
DROP POLICY IF EXISTS audiences_select_own ON public.audiences;
CREATE POLICY audiences_select_own ON public.audiences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ALL (INSERT/UPDATE/DELETE): own audiences only (verbatim from cpw_upsert_own)
DROP POLICY IF EXISTS audiences_all_own ON public.audiences;
CREATE POLICY audiences_all_own ON public.audiences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- threads.active_audience_id (D-04 per-thread pin)
-- =========================================================================
-- NULL = General default (absence of override → DEFAULT_PERSONA_WEIGHT_CONFIG).
-- ON DELETE SET NULL: deleting an Audience nulls the thread pin without erroring,
-- and the thread automatically falls back to General — the safest degradation path.
-- Pattern: mirrors threads.reading_id nullable-FK in 20260617000000_threads_messages.sql.
-- =========================================================================

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS active_audience_id uuid NULL
    REFERENCES public.audiences(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.threads.active_audience_id IS
  'Per-thread active Audience pin (D-04). NULL = General default → DEFAULT_PERSONA_WEIGHT_CONFIG (regression gate free by construction). Set by the composer chip; switching mid-thread re-grounds future turns only. ON DELETE SET NULL: deleting an Audience degrades this thread to General gracefully.';
