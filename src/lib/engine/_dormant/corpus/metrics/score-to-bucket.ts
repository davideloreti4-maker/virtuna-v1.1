import type { Bucket, Niche } from "../eval-config";
import { VIRAL_SCORE_CUT, UNDER_SCORE_CUT } from "../eval-config";

/**
 * Map the engine's continuous overall_score (0-100) to a bucket label.
 *
 * Phase 1 simplification: same cuts for all niches (70/30). Phase 10 (ML
 * audit + calibration) revisits per-niche cuts. The niche argument is
 * currently unused but preserved in the signature for forward compatibility —
 * underscore-prefixed to suppress the unused-parameter lint.
 *
 * Boundary semantics: score ≥ 70 → viral, score ≤ 30 → under, else average.
 */
export function bucketFromScore(score: number, _niche: Niche): Bucket {
  if (score >= VIRAL_SCORE_CUT) return "viral";
  if (score <= UNDER_SCORE_CUT) return "under";
  return "average";
}
