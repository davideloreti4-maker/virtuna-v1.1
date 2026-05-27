import { createLogger } from "@/lib/logger";
import {
  normalizeWeights,
  type PersonaWeights,
  type WeightsSource,
} from "../persona-weights";
import type { HeatmapPayload, SegmentGrid } from "../types";

const log = createLogger({ module: "engine.wave3.weighted-aggregator" });

/** D-06 (Pass 2): ≥7/10 Pass 2 successes for non-null heatmap. */
export const SUCCESS_THRESHOLD = 7;

/** R2.3 default mix per D-13. */
export const DEFAULT_WEIGHTS: PersonaWeights = {
  fyp: 0.65,
  niche: 0.20,
  loyalist: 0.10,
  cross_niche: 0.05,
};

/**
 * Provisional shared type — Plan 06 (pass2.ts) re-exports from here.
 * Single source of truth for the Pass 2 persona result shape.
 */
export interface Pass2PersonaResult {
  persona_id: string;
  archetype:
    | "high_engager"
    | "saver"
    | "lurker"
    | "sharer"
    | "viewer"
    | "niche_deep"
    | "loyalist"
    | "cross_niche_curiosity";
  slot_type: "fyp" | "niche" | "loyalist" | "cross_niche";
  segment_reactions: Array<{
    t_start: number;
    t_end: number;
    attention: number; // 0-1
    reason?: string;
    swipe_predicted: boolean;
  }>;
  pass2_latency_ms: number;
  pass2_cost_cents: number;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Pitfall 6: redistribute weight when a persona slot_type has 0 survivors.
 * Zeroes out absent types then normalizes to sum=1.0 over remaining types.
 */
function normalizeOverSurvivors(
  survivors: Pass2PersonaResult[],
  weights: PersonaWeights,
): PersonaWeights {
  const presentTypes = new Set(survivors.map((s) => s.slot_type));
  const filtered: PersonaWeights = {
    fyp: presentTypes.has("fyp") ? weights.fyp : 0,
    niche: presentTypes.has("niche") ? weights.niche : 0,
    loyalist: presentTypes.has("loyalist") ? weights.loyalist : 0,
    cross_niche: presentTypes.has("cross_niche") ? weights.cross_niche : 0,
  };
  return normalizeWeights(filtered);
}

/** Per-persona weight lookup based on slot_type.
 * WR-05: "niche_deep" from PersonaSlot maps to the "niche" weight bucket.
 * Without this mapping, w["niche_deep"] is undefined → NaN in weighted sums.
 */
function getPersonaWeight(r: Pass2PersonaResult, w: PersonaWeights): number {
  // PersonaSlot.slot_type includes "niche_deep" but PersonaWeights only has "niche".
  // The cast in pass2.ts allows "niche_deep" through — map it to "niche" here.
  const key = (r.slot_type as string) === "niche_deep" ? "niche" : r.slot_type;
  return w[key as keyof PersonaWeights] ?? 0;
}

/**
 * D-12 — Pass 2 timeline → weighted retention curve + canonical metrics.
 *
 * For each segment index: compute weight-normalized mean of attention across
 * all surviving personas (Pitfall 6: redistribute weight for absent slot types).
 *
 * Returns zero scalars when pass2Results or segments is empty.
 */
export function buildWeightedCurve(
  pass2Results: Pass2PersonaResult[],
  segments: SegmentGrid[],
  weights: PersonaWeights,
): {
  weighted_curve: number[];
  weighted_completion_pct: number;
  weighted_top_dropoff_t: number;
  weighted_hook_score: number;
  // WR-02: expose normalizedWeights so callers (assembleHeatmapPayload, aggregator)
  // can reuse it without a redundant normalizeOverSurvivors call.
  normalizedWeights: PersonaWeights;
} {
  if (pass2Results.length === 0 || segments.length === 0) {
    log.warn("buildWeightedCurve: no survivors or no segments — returning zeros");
    return {
      weighted_curve: [],
      weighted_completion_pct: 0,
      weighted_top_dropoff_t: 0,
      weighted_hook_score: 0,
      normalizedWeights: weights,
    };
  }

  const normalizedW = normalizeOverSurvivors(pass2Results, weights);

  // Per-segment weighted-mean attention
  const weighted_curve = segments.map((_seg, segIdx) => {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of pass2Results) {
      const reaction = r.segment_reactions[segIdx];
      const att = reaction?.attention ?? 0;
      const w = getPersonaWeight(r, normalizedW);
      weightedSum += att * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  });

  // Top dropoff: t_start of segment with biggest segment-to-segment loss
  let maxDrop = 0;
  let maxDropT = segments[0]?.t_start ?? 0;
  for (let i = 1; i < weighted_curve.length; i++) {
    const drop = (weighted_curve[i - 1] ?? 0) - (weighted_curve[i] ?? 0);
    if (drop > maxDrop) {
      maxDrop = drop;
      maxDropT = segments[i]?.t_start ?? 0;
    }
  }

  // Hook score: mean attention across is_hook_zone segments
  const hookIndices = segments
    .map((s, i) => (s.is_hook_zone ? i : -1))
    .filter((i) => i >= 0);
  const hookValues = hookIndices.map((i) => weighted_curve[i] ?? 0);
  const weighted_hook_score = mean(hookValues);

  // weighted_completion_pct: weight-normalized mean of per-persona timeline mean
  let completionWeightedSum = 0;
  let completionTotalWeight = 0;
  for (const r of pass2Results) {
    const personaMean = mean(r.segment_reactions.map((sr) => sr.attention));
    const w = getPersonaWeight(r, normalizedW);
    completionWeightedSum += personaMean * w;
    completionTotalWeight += w;
  }
  const weighted_completion_pct =
    completionTotalWeight > 0
      ? completionWeightedSum / completionTotalWeight
      : 0;

  return {
    weighted_curve,
    weighted_completion_pct,
    weighted_top_dropoff_t: maxDropT,
    weighted_hook_score,
    normalizedWeights: normalizedW, // WR-02: expose for reuse
  };
}

/**
 * D-13 — Assemble full HeatmapPayload from Pass 2 results.
 *
 * keyframe_uri starts null for every segment; the filmstrip background job
 * (Plan 07) fills entries via SSE `filmstrip_segment_ready` events.
 * Phase 4 must render without keyframes initially (Pitfall 3).
 *
 * WR-07: accepts optional preComputedCurve so callers that already have a
 * curveResult (e.g. aggregator.ts) can pass it in and avoid a second
 * buildWeightedCurve call. When absent, buildWeightedCurve is called once here.
 */
export function assembleHeatmapPayload(
  pass2Results: Pass2PersonaResult[],
  segments: SegmentGrid[],
  weights: PersonaWeights,
  weightsSource: WeightsSource,
  preComputedCurve?: ReturnType<typeof buildWeightedCurve>,
): HeatmapPayload {
  // WR-02 + WR-07: reuse pre-computed curve when available; otherwise compute once.
  const { weighted_curve, normalizedWeights: effectiveWeights } =
    preComputedCurve ?? buildWeightedCurve(pass2Results, segments, weights);

  return {
    segments: segments.map((s, idx) => ({
      idx,
      t_start: s.t_start,
      t_end: s.t_end,
      label: s.visual_event,
      is_hook_zone: s.is_hook_zone ?? false,
      keyframe_uri: null, // Pitfall 3: filled by filmstrip queue later
    })),
    personas: pass2Results.map((r) => {
      const swipeReaction = r.segment_reactions.find((sr) => sr.swipe_predicted);
      // segment_reasons is sparse — only inflection points with a reason string
      const segment_reasons: Record<number, string> = {};
      r.segment_reactions.forEach((sr, i) => {
        if (sr.reason) segment_reasons[i] = sr.reason;
      });
      return {
        id: r.persona_id,
        attentions: r.segment_reactions.map((sr) => sr.attention),
        swipe_predicted_at: swipeReaction?.t_start ?? null,
        segment_reasons,
      };
    }),
    weighted_curve,
    weights: effectiveWeights,
    weights_source: weightsSource,
  };
}
