import { ARCHETYPES } from "./persona-registry";
import type { PersonaSimulationResult, PersonaBehavioralAggregate } from "../types";

/**
 * Phase 7 D-06: per-metric DIFFERENT aggregation rule.
 *   - completion_pct = mean of survivors' watch_through_pct (population rate)
 *   - share_pct / comment_pct / save_pct = top-3-enthusiast-weighted
 *     (top-3 most enthusiastic personas count 60% of weight; remaining 7 split 40%)
 *
 * Phase 7 D-13: ≥7 of 10 personas must succeed; below threshold → null + warning.
 * Top-3 tie-break: stable sort by metric DESC then by ARCHETYPES enum order ASC (deterministic).
 */
const TOP_N = 3;
const TOP_WEIGHT_TOTAL = 0.60;
const REMAINING_WEIGHT_TOTAL = 0.40;

export { TOP_N, TOP_WEIGHT_TOTAL, REMAINING_WEIGHT_TOTAL };

export interface AggregationResult {
  aggregate: PersonaBehavioralAggregate | null;
  warnings: string[];
}

/**
 * Per CONTEXT D-13 + D-06: aggregate surviving persona results into a
 * BehavioralPredictions-shaped object, OR return null + warning if below threshold.
 *
 * @param survivors - successful PersonaSimulationResult entries (out of 10 attempts)
 * @param successThreshold - minimum surviving count for non-null aggregate (default 7 per D-13)
 */
export function aggregatePersonaResults(
  survivors: PersonaSimulationResult[],
  successThreshold: number = 7,
): AggregationResult {
  if (survivors.length < successThreshold) {
    return {
      aggregate: null,
      warnings: [`wave_3_below_threshold (${survivors.length}/${successThreshold})`],
    };
  }

  // D-06 completion_pct = flat mean of watch_through_pct
  const completion_pct = mean(survivors.map((s) => s.watch_through_pct));

  // D-06 share/comment/save = top-3-enthusiast-weighted
  const share_pct = topNWeighted(survivors, "share_intent");
  const comment_pct = topNWeighted(survivors, "comment_intent");
  const save_pct = topNWeighted(survivors, "save_intent");
  // Replay/loop rate — same top-3-enthusiast weighting as the other intents.
  const loop_pct = topNWeighted(survivors, "rewatch_intent");

  // Percentile labels: lightweight decile heuristic for Phase 7 ship.
  // Plan 07-04's runEvalHarness consumer doesn't read percentile labels — only the numeric metrics.
  // Phase 10 may revise to corpus-driven percentile bands.
  const aggregate: PersonaBehavioralAggregate = {
    completion_pct,
    completion_percentile: percentileLabel(completion_pct),
    share_pct,
    share_percentile: percentileLabel(share_pct),
    comment_pct,
    comment_percentile: percentileLabel(comment_pct),
    save_pct,
    save_percentile: percentileLabel(save_pct),
    loop_pct,
    loop_percentile: percentileLabel(loop_pct),
  };

  return { aggregate, warnings: [] };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function topNWeighted(
  survivors: PersonaSimulationResult[],
  metric: "share_intent" | "comment_intent" | "save_intent" | "rewatch_intent",
): number {
  const n = survivors.length;
  if (n === 0) return 0;

  // Stable sort: metric DESC; tie-break by ARCHETYPES enum index ASC.
  // ARCHETYPES order (Plan 07-01): high_engager, saver, lurker, sharer,
  // tough_crowd, purposeful_viewer, niche_deep_buyer, niche_deep_scout,
  // loyalist, cross_niche_curiosity.
  const sorted = [...survivors].sort((a, b) => {
    const diff = b[metric] - a[metric];
    if (diff !== 0) return diff;
    return ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype);
  });

  const topN = Math.min(TOP_N, n);
  const top = sorted.slice(0, topN);
  const remaining = sorted.slice(topN);

  const topMean = mean(top.map((s) => s[metric]));

  // Pitfall 4: when no remaining personas exist (n ≤ TOP_N),
  // return topMean directly — NEVER topMean * 0.60 (silent shrinkage).
  if (remaining.length === 0) return topMean;

  const remainingMean = mean(remaining.map((s) => s[metric]));
  return TOP_WEIGHT_TOTAL * topMean + REMAINING_WEIGHT_TOTAL * remainingMean;
}

/**
 * WR-05 fix: previously labeled buckets as "top 10%" / "top 25%" / etc., which read as
 * "ranks in the top X% of a corpus baseline" — but these values are top-3-weighted
 * INTENT SCORES (0-100), not corpus-percentile ranks. The label propagates to
 * `PredictionResult.behavioral_predictions.share_percentile` (consumer-readable), so
 * the misleading semantics persisted into production schemas.
 *
 * Rename to intent semantics. Phase 10 may replace this lightweight heuristic with
 * corpus-driven percentile bands once calibration data is available.
 */
function percentileLabel(pct: number): string {
  if (pct >= 90) return "very high intent";
  if (pct >= 75) return "high intent";
  if (pct >= 50) return "moderate intent";
  if (pct >= 25) return "low intent";
  return "very low intent";
}
