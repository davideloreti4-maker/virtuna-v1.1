-- Persist three engine-emitted fields the DB schema never stored, so they
-- survive permalink reload (GET /api/analysis/[id] does select * + spread).
-- Before this, buildInsertRow dropped them on the floor:
--   emotion_arc                  → Content Analysis "Emotion arc" stayed empty
--   persona_behavioral_aggregate → Audience Pass-1 baseline retention curve absent
--   optimal_post_window          → When-to-post fell back to the generic window on reload
--
-- No backfill: historical rows keep NULL (engine output isn't re-derivable).
-- Newly inserted rows are populated by buildInsertRow in src/app/api/analyze/route.ts.

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS emotion_arc JSONB,
  ADD COLUMN IF NOT EXISTS persona_behavioral_aggregate JSONB,
  ADD COLUMN IF NOT EXISTS optimal_post_window JSONB;

COMMENT ON COLUMN public.analysis_results.emotion_arc IS
  'EmotionArcPoint[] from Omni Plus (engine src/lib/engine/types.ts:EmotionArcPoint). Null when video absent or Qwen omitted the field. Consumed by ContentAnalysisFrame emotion arc.';

COMMENT ON COLUMN public.analysis_results.persona_behavioral_aggregate IS
  'PersonaBehavioralAggregate from Wave 3 (engine src/lib/engine/types.ts). Null when Wave 3 below threshold (D-13). Drives the Audience Pass-1 baseline retention curve.';

COMMENT ON COLUMN public.analysis_results.optimal_post_window IS
  'OptimalPostWindow from aggregator niche lookup (engine src/lib/engine/optimal-post.ts). Base recommendation before any optimal_post_override. Drives the Actions When-to-post slot on reload.';
