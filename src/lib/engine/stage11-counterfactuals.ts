import type { PredictionResult, CounterfactualResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";

/**
 * Phase 9 contract: counterfactual suggestions tied to retention drop points.
 * Per CONTEXT.md D-18. Returns null when no actionable counterfactuals.
 *
 * `_aggregateResult` is intentionally unused in the no-op (Phase 9 will analyze it).
 */
export async function runStage11Counterfactuals(
  _aggregateResult: PredictionResult,
  onEvent?: StageEventCallback,
): Promise<CounterfactualResult | null> {
  const start = emitStageStart(onEvent, "stage_11_counterfactuals", "post");

  // No-op — Phase 9 swaps with real V3 counterfactual call
  const result: CounterfactualResult | null = null;

  emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, { cost_cents: 0, ok: true });

  return result;
}
