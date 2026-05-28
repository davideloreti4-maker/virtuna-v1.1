-- Phase: Result Surface
-- Adds the assembled heatmap payload (segments, personas, weighted_curve,
-- weights) to analysis_results so /api/analysis/[id] can return the same
-- structure the engine emitted in-flight, without the server-side synthesis
-- shim used as a backstop.
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS heatmap jsonb;

COMMENT ON COLUMN public.analysis_results.heatmap IS
  'Full HeatmapPayload from PredictionResult: segments[], personas[] (with attentions), weighted_curve[], weights, weights_source. Null on rows from before this column existed; the /api/analysis/[id] handler synthesizes a fallback in that case.';
