/**
 * Wave 3 Pass 2 — pure helpers module (Phase 4 Plan 05: 10-pass deleted).
 *
 * The LLM orchestration loop (runWave3Pass2) and all per-persona API call code
 * have been removed. The fold (fold.ts) is now the sole audience-sim path.
 *
 * This file is retained for:
 *   - Pass2PersonaResult type re-export (single source of truth in weighted-aggregator.ts)
 *   - Wave3Pass2Outcome type (may still appear in dormant imports / archived types)
 *   - applyPass1DropFallback: pure helper (no LLM calls); kept in case future
 *     fold post-processing needs the Pass-1 drop heuristic.
 *
 * NOTE: runWave3Pass2 is DELETED. pipeline.ts no longer imports it. If you need to
 * reference the old orchestrator, check git history for commit feat(04): delete 10-pass.
 */

import type { PersonaSimulationResult, SegmentGrid } from "../types";

// Re-export Pass2PersonaResult — single source of truth lives in weighted-aggregator.ts.
export type { Pass2PersonaResult } from "./weighted-aggregator";
import type { Pass2PersonaResult } from "./weighted-aggregator";

type Pass2SegmentReaction = Pass2PersonaResult["segment_reactions"][number];

/**
 * Phase 3 D-06 Pass 2 wave outcome.
 * Kept for type back-compat (may be referenced in archived/dormant modules).
 */
export interface Wave3Pass2Outcome {
  pass2Results: Pass2PersonaResult[];
  warnings: string[];
  cost_cents: number;
  pass2_success_count: number;
  pass2_aggregate_built: boolean;
}

/**
 * Derive a realistic drop point when the model leaves swipe_predicted all-false.
 *
 * Pure helper (no LLM calls). Retained as a utility for fold post-processing
 * or future use. No longer called by the deleted runWave3Pass2 orchestrator.
 *
 * Pass 1 already predicts where each persona scrolls away (scroll_past_second,
 * with watch_through_pct as the secondary signal). Use this when a segment
 * timeline has swipe_predicted=false everywhere to synthesize a drop point.
 */
export function applyPass1DropFallback(
  reactions: Pass2SegmentReaction[],
  pass1: PersonaSimulationResult,
  segments: SegmentGrid[],
): Pass2SegmentReaction[] {
  if (reactions.some((r) => r.swipe_predicted)) return reactions; // model emitted a drop — trust it
  const totalDuration = segments[segments.length - 1]?.t_end ?? 0;
  if (totalDuration <= 0) return reactions;

  // Prefer Pass 1's direct scroll-away second; fall back to its watch-through %.
  const dropT =
    pass1.scroll_past_second > 0
      ? pass1.scroll_past_second
      : (pass1.watch_through_pct / 100) * totalDuration;

  // Genuine full-watch (or no usable signal) → leave the timeline as completed.
  if (dropT <= 0 || dropT >= totalDuration * 0.98) return reactions;

  const idx = reactions.findIndex((r) => dropT >= r.t_start && dropT < r.t_end);
  const dropIdx = idx === -1 ? reactions.length - 1 : idx;
  return reactions.map((r, i) => (i >= dropIdx ? { ...r, swipe_predicted: true } : r));
}
