-- Phase 6 — Per-analysis post-time override (D-28)
-- Created: 2026-05-30

ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS optimal_post_override JSONB;

-- Shape: { day_of_week: 'Mon'..'Sun', hour_range: [number, number], saved_at: ISO8601 string }
-- No RLS change needed: existing UPDATE policy "Users can update their own analysis results" covers writes.
-- No CHECK: Zod parses on POST.

COMMENT ON COLUMN analysis_results.optimal_post_override IS
  'Phase 6 D-28: user-editable override of optimal_post_window for this specific analysis. NULL = use engine-provided optimal_post_window.';
