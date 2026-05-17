-- Phase 3: Pipeline Infrastructure — provenance + content-hash cache columns.
-- Adds two columns and one compound index to analysis_results.
-- All statements use IF NOT EXISTS for idempotent re-runs.

-- =====================================================
-- ANALYSIS RESULTS — 2 new columns for Phase 3 provenance + cache
-- =====================================================

-- signal_availability JSONB: which signals fired during this prediction.
-- Shape per CONTEXT.md D-07: { behavioral: bool, gemini: bool, ml: bool, rules: bool, trends: bool }.
-- Forward-compat: future phases (4: content_type+niche; 6: audio; 7: personas; 8: retrieval; 9: algo+critique+counter; 10: calibration) add keys.
-- Consumers MUST null-check / default-to-false missing keys.
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS signal_availability JSONB DEFAULT '{}';

-- content_hash TEXT: SHA-256 hex digest of the input (buffer/url/text).
-- Cache key component along with engine_version + user_id (per CONTEXT.md D-10).
-- Populated by /api/analyze route before pipeline call (Plan 03).
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- =====================================================
-- INDEX — compound index supporting the L2 cache SELECT
-- =====================================================

-- Query shape (per prediction-cache.ts L2 lookup):
--   WHERE user_id = ? AND content_hash = ? AND engine_version = ? AND created_at > ?
--   ORDER BY created_at DESC LIMIT 1
-- Partial index excludes soft-deleted rows (matches existing analysis_results index style).
CREATE INDEX IF NOT EXISTS idx_analysis_results_cache_lookup
  ON analysis_results(user_id, content_hash, engine_version, created_at DESC)
  WHERE deleted_at IS NULL;
