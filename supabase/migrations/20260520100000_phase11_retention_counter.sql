-- Phase 11: Retention counter + storage opt-in + video path persistence
-- Adds three columns:
--   creator_profiles.analysis_count — lifetime analysis counter for PROFILE-16 re-prompt (D-08)
--   creator_profiles.storage_retention_opted_in — user opt-in to 30-day video retention (INT-05/D-04)
--   analysis_results.video_storage_path — Supabase Storage object path for retention cron deletion (INT-05)
-- Creates increment_creator_analysis_count() helper for atomic increment in /api/analyze (D-08)
-- All statements use IF NOT EXISTS / CREATE OR REPLACE for idempotent re-runs.
-- RLS: creator_profiles RLS from Phase 2 already restricts writes to WHERE user_id = auth.uid().
-- New columns inherit that policy automatically — no new policies needed.

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS analysis_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS storage_retention_opted_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS video_storage_path TEXT NULL;

-- Atomic increment helper: avoids read-then-write race condition in /api/analyze.
-- SECURITY DEFINER runs as migration owner (bypasses RLS) — safe because caller
-- must be authenticated and pass user_id from auth.getUser() result, not user input.
CREATE OR REPLACE FUNCTION increment_creator_analysis_count(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE creator_profiles
  SET analysis_count = analysis_count + 1
  WHERE user_id = p_user_id;
$$;
