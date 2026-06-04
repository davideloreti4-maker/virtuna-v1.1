/**
 * Plan 01-05 Task 0 extraction — kept helper split from stage11-counterfactuals.ts.
 *
 * maybeAppendLikelyFlopWarning is a pure-TS check (NOT model-generated). It appends a
 * LIKELY_FLOP warning to result.warnings[] when overall_score < 30 AND post-critique
 * confidence > 0.70. Uses POST-CRITIQUE confidence (PredictionResult.confidence after
 * Stage 10 adjustment).
 *
 * Extracted here so aggregator.ts retains its kept import after stage11-counterfactuals.ts
 * moves to _dormant/ (Plan 05 Task 1).
 */
import { createLogger } from "@/lib/logger";
import type { PredictionResult } from "./types";

const log = createLogger({ module: "flop-warning" });

/**
 * Pure-TS check (NOT model-generated). Appends a LIKELY_FLOP warning to
 * result.warnings[] when overall_score < 30 AND post-critique confidence > 0.70.
 * Uses POST-CRITIQUE confidence (PredictionResult.confidence after Stage 10 adjustment).
 */
export function maybeAppendLikelyFlopWarning(result: PredictionResult): void {
  const score = result.overall_score;
  const confidence = result.confidence;

  if (score < 30 && confidence > 0.70) {
    log.warn("LIKELY_FLOP detected", { score, confidence });
    result.warnings.push(
      "LIKELY_FLOP: This content scores below 30 with high confidence (>70%), " +
        "indicating strong consensus that it will underperform. Consider significant " +
        "revisions to the hook, structure, or platform targeting before publishing.",
    );
  }
}
