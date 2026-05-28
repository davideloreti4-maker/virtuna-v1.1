-- Phase 6 — Reshoot script + optimal post time
-- Additive JSONB column for script transformation cache (D-09)
-- Created: 2026-05-30

ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS script_result JSONB;

-- No NOT NULL: legacy rows + first-fetch-pending rows have NULL.
-- No index: only queried by primary key (analysis_results.id).
-- No CHECK: Zod parses on read; schema evolution stays cheap.
-- No RLS change: existing UPDATE policy covers writes.

COMMENT ON COLUMN analysis_results.script_result IS
  'Phase 6 D-09: cached ScriptResult JSON. Content-addressed (immutable per analysis_results.id). NULL until first /api/analyze/[id]/script call.';
