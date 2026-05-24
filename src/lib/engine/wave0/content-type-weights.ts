import type { GeminiVideoSignals, ContentTypeSlug } from "../types";

export type SignalMultipliers = {
  visual_production_quality: number;
  hook_visual_impact: number;
  pacing_score: number;
  transition_quality: number;
};

/**
 * LOCKED matrix per CONTEXT D-12 (Phase 4).
 * Phase 10 may revise based on Phase 1 corpus benchmark evidence.
 * DO NOT modify here — modification requires a Phase 10 commit + version bump.
 */
export const CONTENT_TYPE_WEIGHT_MATRIX: Record<ContentTypeSlug, SignalMultipliers> = {
  talking_head: { visual_production_quality: 1.0, hook_visual_impact: 1.1, pacing_score: 1.0, transition_quality: 0.8 },
  b_roll:       { visual_production_quality: 1.2, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.2 },
  slideshow:    { visual_production_quality: 0.8, hook_visual_impact: 0.9, pacing_score: 0.5, transition_quality: 0.7 },
  action:       { visual_production_quality: 1.3, hook_visual_impact: 1.2, pacing_score: 1.2, transition_quality: 1.3 },
  tutorial:     { visual_production_quality: 1.0, hook_visual_impact: 1.2, pacing_score: 1.1, transition_quality: 1.0 },
  vlog:         { visual_production_quality: 0.9, hook_visual_impact: 0.8, pacing_score: 0.9, transition_quality: 0.9 },
  // Phase 5 CR-04: comedy is neutral per CONTEXT D-06 (no CTA penalty; no signal up-weighting).
  // The 1.0 passthrough mirrors `other` — comedy hooks rely on punchline timing more than
  // visual production, so leaving signals untouched is the conservative locked baseline.
  // Phase 10 ML audit may revise (mirror CONTENT_TYPE_WEIGHT_MATRIX docstring contract).
  comedy:       { visual_production_quality: 1.0, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.0 },
  other:        { visual_production_quality: 1.0, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.0 },
};

export const MULTIPLIER_FLOOR = 0.5;
export const MULTIPLIER_CEILING = 1.5;

/**
 * Applies content-type weights to Gemini video signals.
 * Returns a NEW object (does not mutate input).
 * - Each multiplier clamped to [MULTIPLIER_FLOOR, MULTIPLIER_CEILING] (defensive — locked matrix
 *   already stays in range, but a future edit might violate caps).
 * - Adjusted value clamped to Math.min(10, raw * multiplier) since GeminiVideoSignals are 0..10
 *   (Pitfall 7 — without this, 10 * 1.5 = 15 would leak into FeatureVector).
 * - Null contentType uses `other` row (1.0× passthrough) — keeps null-safety contract intact when
 *   Wave 0 fails (D-16) or no video provided.
 */
export function applyContentTypeWeights(
  signals: GeminiVideoSignals,
  contentType: ContentTypeSlug | null,
): GeminiVideoSignals {
  const mult = CONTENT_TYPE_WEIGHT_MATRIX[contentType ?? "other"];
  const clamp = (m: number) =>
    Math.max(MULTIPLIER_FLOOR, Math.min(MULTIPLIER_CEILING, m));
  return {
    visual_production_quality:
      Math.min(10, signals.visual_production_quality * clamp(mult.visual_production_quality)),
    hook_visual_impact:
      Math.min(10, signals.hook_visual_impact * clamp(mult.hook_visual_impact)),
    pacing_score:
      Math.min(10, signals.pacing_score * clamp(mult.pacing_score)),
    transition_quality:
      Math.min(10, signals.transition_quality * clamp(mult.transition_quality)),
  };
}
