-- Phase 4 (MVP Cut) — Schema Drift Fix
-- Persist the four columns the engine has emitted since Phase 9/13 but the DB
-- never stored. Closes the workaround in /api/analyze/[id]/script/route.ts
-- (commit 3bf3eb7, 2026-05-28) which derived confidence_label / anti_virality_gated
-- inline and forced counterfactuals + hook_decomposition to null at request time.
--
-- No backfill: historical rows keep NULL. Script route already handles null
-- counterfactuals via its deterministic fallbacks (computeScript in
-- src/app/api/analyze/[id]/script/route.ts). Newly inserted rows (post-deploy)
-- will be populated by buildInsertRow in src/app/api/analyze/route.ts.

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS counterfactuals JSONB,
  ADD COLUMN IF NOT EXISTS hook_decomposition JSONB,
  ADD COLUMN IF NOT EXISTS confidence_label TEXT,
  ADD COLUMN IF NOT EXISTS anti_virality_gated BOOLEAN;

-- Enforce the ConfidenceLevel domain at the DB layer.
-- IF NOT EXISTS guard via DO block (PostgreSQL lacks ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analysis_results_confidence_label_check'
  ) THEN
    ALTER TABLE public.analysis_results
      ADD CONSTRAINT analysis_results_confidence_label_check
      CHECK (confidence_label IS NULL OR confidence_label IN ('HIGH', 'MEDIUM', 'LOW'));
  END IF;
END $$;

COMMENT ON COLUMN public.analysis_results.counterfactuals IS
  'CounterfactualResult from Stage 11 (engine src/lib/engine/types.ts:CounterfactualResult): { band: "low"|"mid"|"high", suggestions: CounterfactualSuggestionItem[] }. Null on historical rows + when Stage 11 omitted by engine.';

COMMENT ON COLUMN public.analysis_results.hook_decomposition IS
  'HookDecomposition from Wave 1 hook-segment analysis (engine src/lib/engine/gemini/schemas.ts:HookDecompositionZodSchema). Includes weakest_modality + per-modality scores. Null on historical rows + non-video analyses.';

COMMENT ON COLUMN public.analysis_results.confidence_label IS
  'ConfidenceLevel for UI display: HIGH | MEDIUM | LOW. Derived in aggregator from numeric confidence. Required on every PredictionResult; null only on historical rows pre-Phase-4.';

COMMENT ON COLUMN public.analysis_results.anti_virality_gated IS
  'True when post-critique confidence < ANTI_VIRALITY_THRESHOLD. Surfaces "Don''t post yet" verdict in UI. Required on every PredictionResult; null only on historical rows pre-Phase-4.';
