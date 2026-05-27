-- =========================================================================
-- Phase 3 — Engine Rework
-- Outcomes table (D-18) + filmstrips Storage bucket (D-10) + pg_cron sweep
-- Created: 2026-05-26
-- Migration is forward-compatible: outcomes empty (M2-III will write rows).
-- =========================================================================
--
-- D-18: outcomes table — locked schema, no ingestion in Phase 3.
--   M2-III feedback loop will write rows. Empty table now; index cost zero.
-- D-10: filmstrips Storage bucket — private, signed-URL-only, 5MB limit,
--   JPEG mime restricted. Cleanup via daily pg_cron sweep.
-- RLS: enabled on outcomes; creator can SELECT own rows via analysis_id
--   ownership; service role writes only; anon denied.
-- All statements idempotent (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT).

-- =========================================================================
-- SECTION 1 — outcomes table (D-18)
-- =========================================================================

-- Phase 3 (D-18): outcomes table — forward-compatible schema, no ingestion yet.
-- M2-III feedback loop will write rows. Empty table here; index cost is zero.
CREATE TABLE IF NOT EXISTS outcomes (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID         NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  posted_at        TIMESTAMPTZ,
  real_views       INTEGER,
  real_completion_pct NUMERIC(5,2),
  real_share_pct      NUMERIC(5,2),
  real_comment_pct    NUMERIC(5,2),
  real_save_pct       NUMERIC(5,2),
  creator_rating SMALLINT CHECK (creator_rating BETWEEN 1 AND 5),
  creator_note     TEXT,
  source           TEXT         NOT NULL DEFAULT 'creator_self_report',
  captured_at      TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outcomes_analysis_id_idx ON outcomes(analysis_id);

-- RESEARCH §Outcomes Indexing — M2-III temporal queries; zero cost while empty.
CREATE INDEX IF NOT EXISTS outcomes_posted_at_idx ON outcomes(posted_at) WHERE posted_at IS NOT NULL;

-- ---- RLS (T-03-03-01, T-03-03-02) ----
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;

-- Read: creator can SELECT outcomes where the joined analyses row belongs to them.
CREATE POLICY outcomes_select_own ON outcomes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM analyses
      WHERE analyses.id = outcomes.analysis_id
        AND analyses.creator_id = auth.uid()
    )
  );

-- No client INSERT/UPDATE/DELETE policy → only service role (which bypasses RLS) writes.
-- M2-III will add explicit service-role write path; Phase 3 is read-only forward-compat.

-- =========================================================================
-- SECTION 2 — filmstrips Storage bucket (D-10)
-- =========================================================================

-- Phase 3 (D-10): filmstrips bucket — private; 5MB cap; JPEG only.
-- Access via signed URLs (Plan 07 mints them). No public reads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('filmstrips', 'filmstrips', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- No object-level SELECT policy — signed URLs bypass RLS (storage-internal key).
-- Service role writes; never expose direct anon SELECT.

-- =========================================================================
-- SECTION 3 — pg_cron cleanup function + schedule (D-10)
-- =========================================================================

-- Cleanup function: explicit search_path to prevent search_path-hijack escalation
-- (T-03-03-05 mitigation). Owner = postgres (default Supabase service role).
-- Mirrors refresh_niche_post_windows() pattern from niche_post_windows migration.
CREATE OR REPLACE FUNCTION cleanup_expired_filmstrips()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = storage, pg_temp
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'filmstrips'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Restrict EXECUTE to service-role contexts only (T-03-03-05).
REVOKE EXECUTE ON FUNCTION cleanup_expired_filmstrips() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_expired_filmstrips() FROM anon, authenticated;

-- ---- pg_cron schedule ----
-- Drop existing schedule first (idempotent re-run safe).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-filmstrips') THEN
    PERFORM cron.unschedule('cleanup-expired-filmstrips');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-expired-filmstrips',
  '0 3 * * *',
  $$SELECT cleanup_expired_filmstrips()$$
);
