-- PROFILE-16 (re-prompt micro-card) is DEFERRED to Phase 11 per D-14 — no counter column added here.
-- Phase 02 — Creator Profile & 9-Card Interview
-- D-15/D-16: Extend creator_profiles with 9-card interview columns (all nullable for graceful
-- degradation when the user skips). D-08: Add source field on user_competitors so reference
-- creators added via Card 5 can be distinguished from manually-added competitors.
-- D-17: New columns inherit existing RLS policies (20260202000000_v16_schema.sql lines 200-211).
-- Pitfall #5: Re-map legacy onboarding_step values left over from the v2.0 welcome flow.

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS target_platforms          TEXT[],
  ADD COLUMN IF NOT EXISTS niche_primary             TEXT,
  ADD COLUMN IF NOT EXISTS niche_sub                 TEXT,
  ADD COLUMN IF NOT EXISTS target_audience           JSONB,
  ADD COLUMN IF NOT EXISTS creator_stage             TEXT,
  ADD COLUMN IF NOT EXISTS content_style             TEXT,
  ADD COLUMN IF NOT EXISTS cuts_per_second           TEXT,
  ADD COLUMN IF NOT EXISTS reference_creators        JSONB,
  ADD COLUMN IF NOT EXISTS past_wins                 JSONB,
  ADD COLUMN IF NOT EXISTS past_flops                JSONB,
  ADD COLUMN IF NOT EXISTS posting_frequency         TEXT,
  ADD COLUMN IF NOT EXISTS time_of_day_aware         BOOLEAN,
  ADD COLUMN IF NOT EXISTS pain_points               TEXT,
  ADD COLUMN IF NOT EXISTS profile_interview_seen_at TIMESTAMPTZ;

-- D-08: source provenance on the user-competitor junction
ALTER TABLE user_competitors
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_add'
    CHECK (source IN ('manual_add', 'profile_reference'));

-- D-03/Pitfall #5: Welcome trim removes the 'goal' and 'preview' steps. Re-map any in-flight
-- rows so the narrowed OnboardingStep union ("connect" | "completed") can hydrate without
-- a runtime error.
UPDATE creator_profiles
SET onboarding_step = 'connect'
WHERE onboarding_step IN ('goal', 'preview');
