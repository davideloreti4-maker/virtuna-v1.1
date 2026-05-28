-- Phase 1 (R6.1, D-14) — niche_post_windows materialized table.
-- Aggregates day/hour posting windows per niche from scraped_videos.primary_niche.
-- pg_cron refresh at 06:15 UTC daily (15min after refresh-competitors cron @06:00).
-- All statements idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- RLS: enabled; service-role writes; authenticated SELECT only.
--
-- Pitfall #4 — plain TABLE (not MATERIALIZED VIEW) to avoid the CONCURRENTLY
-- unique-index requirement and to match existing codebase precedent
-- (competitor_snapshots, etc. are plain tables refreshed by cron jobs).
--
-- D-12: Niche-only corpus median for P1 (schema future-proofed for creator-aware
-- override via source: 'creator' enum value in the engine layer — TABLE itself
-- only stores niche aggregates for P1).
--
-- D-14: Materialized TABLE refreshed by pg_cron daily — sub-50ms lookup, no
-- per-analysis aggregation latency hit on the 60s SLA budget.
--
-- Open Question 2 + Assumption A2 (RESEARCH): source = scraped_videos.primary_niche,
-- verified to exist via the Phase 8 pgvector backfill (20260518000000_phase8_pgvector.sql).

-- ---- Table ----
CREATE TABLE IF NOT EXISTS niche_post_windows (
  niche        TEXT PRIMARY KEY,
  day_of_week  TEXT NOT NULL CHECK (day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  hour_start   INTEGER NOT NULL CHECK (hour_start >= 0 AND hour_start <= 23),
  hour_end     INTEGER NOT NULL CHECK (hour_end   >= 1 AND hour_end   <= 24),
  sample_size  INTEGER NOT NULL CHECK (sample_size >= 10),
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- RLS ----
ALTER TABLE niche_post_windows ENABLE ROW LEVEL SECURITY;

-- Service role has implicit access (postgres BYPASS RLS); explicit policy below
-- governs end-user reads through PostgREST.
DROP POLICY IF EXISTS "niche_post_windows_read_authenticated" ON niche_post_windows;
CREATE POLICY "niche_post_windows_read_authenticated"
  ON niche_post_windows
  FOR SELECT
  TO authenticated
  USING (true);  -- non-PII aggregated data; visible to any authenticated user

-- Block writes from anon + authenticated; only service_role (via supabase service client) writes.
DROP POLICY IF EXISTS "niche_post_windows_no_user_writes" ON niche_post_windows;
CREATE POLICY "niche_post_windows_no_user_writes"
  ON niche_post_windows
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ---- Refresh function (least-privilege) ----
-- SECURITY-DEFINER + explicit search_path to prevent search_path-hijack escalation
-- (T-01-NPW-cron-role mitigation). Owner = postgres (default Supabase service role).
-- The function picks the TOP window per niche by sample size using ROW_NUMBER() —
-- the plan's note section calls this out as the correct shape when GROUP BY
-- produces multiple windows per niche (which it always does here: niche x day x hour).
CREATE OR REPLACE FUNCTION refresh_niche_post_windows()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM niche_post_windows;

  WITH per_window AS (
    SELECT
      primary_niche AS niche,
      to_char(posted_at AT TIME ZONE 'UTC', 'Dy') AS day_of_week,
      EXTRACT(HOUR FROM posted_at AT TIME ZONE 'UTC')::INT AS hour_start,
      (EXTRACT(HOUR FROM posted_at AT TIME ZONE 'UTC')::INT + 2) AS hour_end,
      COUNT(*) AS sample_size,
      ROW_NUMBER() OVER (
        PARTITION BY primary_niche
        ORDER BY COUNT(*) DESC,
                 to_char(posted_at AT TIME ZONE 'UTC', 'Dy'),
                 EXTRACT(HOUR FROM posted_at AT TIME ZONE 'UTC')
      ) AS rn
    FROM scraped_videos
    WHERE primary_niche IS NOT NULL
      AND posted_at IS NOT NULL
    GROUP BY primary_niche,
             to_char(posted_at AT TIME ZONE 'UTC', 'Dy'),
             EXTRACT(HOUR FROM posted_at AT TIME ZONE 'UTC')
    HAVING COUNT(*) >= 10
  )
  INSERT INTO niche_post_windows (niche, day_of_week, hour_start, hour_end, sample_size)
  SELECT
    niche,
    day_of_week,
    hour_start,
    -- Clamp hour_end to 24 to honor the CHECK (hour_end <= 24) constraint
    -- when hour_start = 23 (the +2 arithmetic would otherwise produce 25).
    LEAST(hour_end, 24) AS hour_end,
    sample_size
  FROM per_window
  WHERE rn = 1
  ON CONFLICT (niche) DO NOTHING;
END;
$$;

-- Restrict EXECUTE to service-role contexts only.
REVOKE EXECUTE ON FUNCTION refresh_niche_post_windows() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_niche_post_windows() FROM anon, authenticated;
-- (service_role automatically has BYPASS — no explicit grant needed.)

-- ---- pg_cron schedule ----
-- Drop existing schedule first (idempotent re-run safe — cron.schedule errors on duplicate jobname)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-niche-post-windows') THEN
    PERFORM cron.unschedule('refresh-niche-post-windows');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-niche-post-windows',
  '15 6 * * *',  -- 06:15 UTC daily (15min after refresh-competitors at 06:00)
  $$SELECT refresh_niche_post_windows()$$
);

-- ---- Initial population (so the table is non-empty immediately post-migration) ----
SELECT refresh_niche_post_windows();
