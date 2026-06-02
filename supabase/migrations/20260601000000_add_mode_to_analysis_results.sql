-- Phase: Viral Remix (v3.2) — Plan 02-01
-- Adds the `mode` column to analysis_results to distinguish score vs remix submissions.
-- Distinct from `input_mode` (how the content was provided: text/url/video).
-- `mode` captures intent: 'score' (predict my content) vs 'remix' (decode a viral video).
-- DEFAULT 'score' backfills all historical rows in the same ADD COLUMN — no separate UPDATE needed (D-13).
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'score' CHECK (mode IN ('score', 'remix'));

COMMENT ON COLUMN public.analysis_results.mode IS
  'Submission intent: ''score'' (predict own content, default) or ''remix'' (decode a third-party viral video for adaptation). Distinct from input_mode which captures the input mechanism (text/tiktok_url/video_upload). DEFAULT ''score'' backfills all historical rows (D-13). Board uses mode as source of truth to swap frame config: Score+Actions vs Decode+Adapt (D-12).';
