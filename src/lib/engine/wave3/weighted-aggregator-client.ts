/**
 * Client-safe pure-function port of server weighted-aggregator math.
 * O-5 / D-20 — no logger, no server-only imports, no Node APIs.
 * Numerical parity vs src/lib/engine/wave3/weighted-aggregator.ts buildWeightedCurve.
 */
import { normalizeWeights, type PersonaWeights } from '@/lib/engine/persona-weights';
import type { HeatmapPayload } from '@/lib/engine/types';

/** Per-persona weight lookup. Niche_deep maps to niche (mirrors server line 79). */
export function getPersonaWeight(slotType: string, w: PersonaWeights): number {
  const key = slotType === 'niche_deep' ? 'niche' : slotType;
  return (w as Record<string, number>)[key] ?? 0;
}

/**
 * Redistribute weight when a slot_type has no survivors (mirrors server lines 58-70).
 * Accepts HeatmapPayload['personas'] because client only sees payload shape (not Pass2PersonaResult[]).
 */
export function normalizeOverSurvivors(
  personas: HeatmapPayload['personas'],
  weights: PersonaWeights,
): PersonaWeights {
  const presentTypes = new Set(
    personas.map((p) => (p.slot_type === 'niche_deep' ? 'niche' : p.slot_type)),
  );
  const filtered: PersonaWeights = {
    fyp:         presentTypes.has('fyp')         ? weights.fyp         : 0,
    niche:       presentTypes.has('niche')       ? weights.niche       : 0,
    loyalist:    presentTypes.has('loyalist')    ? weights.loyalist    : 0,
    cross_niche: presentTypes.has('cross_niche') ? weights.cross_niche : 0,
  };
  return normalizeWeights(filtered);
}

/**
 * Recompute weighted aggregate curve + headline metrics from heatmap personas (O-5 / D-20).
 * Mirrors server src/lib/engine/wave3/weighted-aggregator.ts buildWeightedCurve numerically.
 *
 * Parity guarantee:
 * - weighted_curve[j]: identical to server (same weight-normalized mean of attention per segment)
 * - weighted_completion_pct: matches server (per-persona mean × weight, normalized)
 * - weighted_top_dropoff_t: t_start of segment with largest consecutive drop (same formula)
 * - weighted_hook_score: mean attention over is_hook_zone segments (same formula)
 */
export function recomputeWeightedCurve(
  personas: HeatmapPayload['personas'],
  segments: HeatmapPayload['segments'],
  weights: PersonaWeights,
): {
  weighted_curve: number[];
  weighted_completion_pct: number;
  weighted_top_dropoff_t: number;
  weighted_hook_score: number;
} {
  if (personas.length === 0 || segments.length === 0) {
    return {
      weighted_curve: [],
      weighted_completion_pct: 0,
      weighted_top_dropoff_t: 0,
      weighted_hook_score: 0,
    };
  }

  const normalizedW = normalizeOverSurvivors(personas, weights);
  const segCount = segments.length;

  // Per-segment weighted-mean attention (mirrors server lines 118-129)
  const weighted_curve: number[] = new Array(segCount).fill(0);
  for (let j = 0; j < segCount; j++) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const p of personas) {
      const att = p.attentions[j] ?? 0;
      const w = getPersonaWeight(p.slot_type, normalizedW);
      weightedSum += att * w;
      totalWeight += w;
    }
    weighted_curve[j] = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Top dropoff: t_start of segment with biggest segment-to-segment loss (mirrors server lines 133-140)
  let maxDrop = 0;
  let maxDropT = segments[0]?.t_start ?? 0;
  for (let i = 1; i < weighted_curve.length; i++) {
    const drop = (weighted_curve[i - 1] ?? 0) - (weighted_curve[i] ?? 0);
    if (drop > maxDrop) {
      maxDrop = drop;
      maxDropT = segments[i]?.t_start ?? 0;
    }
  }

  // Hook score: mean attention across is_hook_zone segments (mirrors server lines 143-147)
  const hookValues = segments
    .map((s, i) => (s.is_hook_zone ? weighted_curve[i] ?? 0 : null))
    .filter((v): v is number => v !== null);
  const weighted_hook_score =
    hookValues.length > 0
      ? hookValues.reduce((a, b) => a + b, 0) / hookValues.length
      : 0;

  // weighted_completion_pct: weight-normalized mean of per-persona timeline mean (mirrors server lines 150-162)
  let completionWeightedSum = 0;
  let completionTotalWeight = 0;
  for (const p of personas) {
    const personaMean =
      p.attentions.length > 0
        ? p.attentions.reduce((a, b) => a + b, 0) / p.attentions.length
        : 0;
    const w = getPersonaWeight(p.slot_type, normalizedW);
    completionWeightedSum += personaMean * w;
    completionTotalWeight += w;
  }
  const weighted_completion_pct =
    completionTotalWeight > 0 ? completionWeightedSum / completionTotalWeight : 0;

  return {
    weighted_curve,
    weighted_completion_pct,
    weighted_top_dropoff_t: maxDropT,
    weighted_hook_score,
  };
}
