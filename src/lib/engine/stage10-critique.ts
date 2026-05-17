import type { PredictionResult, CritiqueResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";

/**
 * Phase 9 contract: self-critique pass that grades aggregator output for consistency.
 * Per CONTEXT.md D-18. Returns null when critique cannot be produced.
 *
 * `_aggregateResult` is intentionally unused in the no-op (Phase 9 will grade against it).
 */
export async function runStage10Critique(
  _aggregateResult: PredictionResult,
  onEvent?: StageEventCallback,
): Promise<CritiqueResult | null> {
  const start = emitStageStart(onEvent, "stage_10_critique", "post");

  // No-op — Phase 9 swaps with real V3 critique call
  const result: CritiqueResult | null = null;

  emitStageEnd(onEvent, "stage_10_critique", "post", start, { cost_cents: 0, ok: true });

  return result;
}
