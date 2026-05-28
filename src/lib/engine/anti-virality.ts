/**
 * Phase 1 (R1.9) — Anti-virality confidence threshold.
 *
 * When a prediction's `confidence` falls below this cutoff, the UI renders the
 * "Don't post yet" verdict state (orange GlassPill warning) instead of a
 * percentile prediction. The threshold marks the point where the model is
 * systematically wrong on high-predicted-score outputs — below which the
 * "Don't post" recommendation is statistically defensible.
 *
 * --- PROVENANCE ---
 * Calibration script:  scripts/calibrate-anti-virality.ts
 * Last calibrated:     2026-05-24 (Phase 1)
 * Method:              Threshold sweep against `outcomes` table.
 *
 * --- VARIANT B: Insufficient-data fallback ---
 * Sample size (N):     <50 — insufficient calibration corpus.
 * Calibration result:  outcomes table empty (0 rows). Per RESEARCH Open
 *                      Question 1 + Assumption A1, the documented fallback
 *                      path is taken.
 * Chosen because:      Matches existing `calculateConfidence()` LOW band cutoff
 *                      (`confidence < 0.4`) in src/lib/engine/aggregator.ts —
 *                      preserves alignment between the UI's "Don't post yet"
 *                      verdict and the engine's confidence_label = "LOW" band.
 * TODO(M2-II):         Revisit once outcome data accumulates. Rerun
 *                      scripts/calibrate-anti-virality.ts when outcomes row
 *                      count ≥ 50, then replace this constant with the
 *                      script-recommended value and switch this provenance
 *                      block to "Variant A: Real corpus result".
 *
 * --- END PROVENANCE ---
 */
import type { HeatmapPayload } from "./types";

export const ANTI_VIRALITY_THRESHOLD = 0.4;

/** True when confidence is below the cutoff (UI renders "Don't post yet"). */
export function isAntiViralityGated(confidence: number): boolean {
  return confidence < ANTI_VIRALITY_THRESHOLD;
}

/**
 * D-17 (Phase 3) — timeline-pattern trigger.
 * Returns true when weighted retention curve loses ≥40% attention in first 5s
 * AND ≥70% of surviving personas show the same drop pattern in the same window.
 *
 * Null heatmap (Pass 2 below threshold) → false (graceful degradation per Pitfall 3).
 */
export function isTimelinePatternTriggered(heatmap: HeatmapPayload | null): boolean {
  if (!heatmap) return false;
  // CR-05: use t_start < 5 to include all segments that BEGIN within the first 5s.
  // Prior filter (t_end <= 5) excluded cross-boundary segments like [4, 7] that
  // start inside the hook window but end past the 5s mark.
  const firstFiveSecondIndices = heatmap.segments
    .map((s, i) => (s.t_start < 5 ? i : -1))
    .filter((i): i is number => i >= 0);
  if (firstFiveSecondIndices.length < 2) return false;

  const startIdx = firstFiveSecondIndices[0]!;
  const endIdx = firstFiveSecondIndices[firstFiveSecondIndices.length - 1]!;
  const aggregateLoss = (heatmap.weighted_curve[startIdx] ?? 0) - (heatmap.weighted_curve[endIdx] ?? 0);
  if (aggregateLoss < 0.40) return false;

  const personaDrops = heatmap.personas.filter(p => {
    const startA = p.attentions[startIdx] ?? 0;
    const endA = p.attentions[endIdx] ?? 0;
    return (startA - endA) >= 0.40;
  }).length;
  const consensus = heatmap.personas.length > 0 ? personaDrops / heatmap.personas.length : 0;
  return consensus >= 0.70;
}

/**
 * D-17 — top-N worst weighted_curve segment-to-segment dips.
 * Returns indices into heatmap.segments[]. Used by Phase 5 anti-virality visual treatment
 * to anchor "top N fixes" to specific timestamps (Stage11 counterfactual mapper joins on timestamp_ms).
 */
export function topDropoffSegmentIndices(heatmap: HeatmapPayload, n = 3): number[] {
  const drops: Array<{ idx: number; drop: number }> = [];
  for (let i = 1; i < heatmap.weighted_curve.length; i++) {
    const drop = (heatmap.weighted_curve[i - 1] ?? 0) - (heatmap.weighted_curve[i] ?? 0);
    if (drop > 0) drops.push({ idx: i, drop });
  }
  drops.sort((a, b) => b.drop - a.drop);
  return drops.slice(0, n).map(d => d.idx);
}

/**
 * D-17 — dual-trigger OR logic with reason discriminator for Phase 5 visual treatment.
 * Backwards-compatible: existing isAntiViralityGated(confidence) preserved.
 */
export function isAntiViralityGatedFull(
  confidence: number,
  heatmap: HeatmapPayload | null,
): {
  gated: boolean;
  reason: "confidence" | "timeline_pattern" | "both" | null;
  dropoff_segment_indices: number[];
} {
  const confidenceGated = isAntiViralityGated(confidence);
  const timelineGated = isTimelinePatternTriggered(heatmap);
  const dropoff_segment_indices = timelineGated && heatmap ? topDropoffSegmentIndices(heatmap) : [];
  if (confidenceGated && timelineGated) {
    return { gated: true, reason: "both", dropoff_segment_indices };
  }
  if (confidenceGated) return { gated: true, reason: "confidence", dropoff_segment_indices: [] };
  if (timelineGated) return { gated: true, reason: "timeline_pattern", dropoff_segment_indices };
  return { gated: false, reason: null, dropoff_segment_indices: [] };
}
