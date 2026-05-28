'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { recomputeWeightedCurve } from '@/lib/engine/wave3/weighted-aggregator-client';
import { normalizeWeights, type PersonaWeights } from '@/lib/engine/persona-weights';
import { isAntiViralityGatedFull } from '@/lib/engine/anti-virality';
import { WEIGHT_PRESET_EPSILON } from './audience-constants';
import type { HeatmapPayload } from '@/lib/engine/types';

/**
 * Proportional rebalance: change `changedKey` to `newValue`, redistribute Δ
 * across the other 3 keys proportionally to their current values.
 * Maintains sum = 1.0 (via normalizeWeights belt-and-suspenders).
 * Exported so WeightOverrideDrawer + tests can call it directly.
 */
export function rebalance(
  w: PersonaWeights,
  changedKey: keyof PersonaWeights,
  newValue: number,
): PersonaWeights {
  const oldValue = w[changedKey];
  const delta = newValue - oldValue;
  const others = (Object.keys(w) as Array<keyof PersonaWeights>).filter((k) => k !== changedKey);
  const otherSum = others.reduce((s, k) => s + w[k], 0);
  if (otherSum === 0) return normalizeWeights({ ...w, [changedKey]: newValue });
  const next = { ...w, [changedKey]: newValue } as PersonaWeights;
  for (const k of others) {
    next[k] = Math.max(0, w[k] - delta * (w[k] / otherSum));
  }
  return normalizeWeights(next);
}

/**
 * Returns true if two PersonaWeights are within `eps` on all four axes.
 * Default epsilon = WEIGHT_PRESET_EPSILON (0.005).
 */
export function weightsEqual(
  a: PersonaWeights,
  b: PersonaWeights,
  eps = WEIGHT_PRESET_EPSILON,
): boolean {
  return (
    Math.abs(a.fyp - b.fyp) < eps &&
    Math.abs(a.niche - b.niche) < eps &&
    Math.abs(a.loyalist - b.loyalist) < eps &&
    Math.abs(a.cross_niche - b.cross_niche) < eps
  );
}

export interface UseClientWeightsReturn {
  weights: PersonaWeights;
  setWeights: (w: PersonaWeights | ((prev: PersonaWeights) => PersonaWeights)) => void;
  recomputedCurve: number[];
  recomputedMetrics: {
    weighted_completion_pct: number;
    weighted_top_dropoff_t: number;
    weighted_hook_score: number;
  };
  antiViralityState: ReturnType<typeof isAntiViralityGatedFull>;
  isDirty: boolean;
  reset: () => void;
}

/**
 * Client-side weight override recompute hook (O-5 / D-20).
 *
 * - Debounces recompute behind a 16ms RAF tick (cancelAnimationFrame on rapid drags)
 * - Calls recomputeWeightedCurve (pure client port of server math) on each RAF tick
 * - Re-evaluates isAntiViralityGatedFull via useMemo when recomputed curve or weights change
 * - Confidence INVARIANT: resultConfidence is passed as-is to anti-virality check (OQ-4)
 */
export function useClientWeights(
  heatmap: HeatmapPayload | null,
  initialWeights: PersonaWeights,
  resultConfidence: number,
): UseClientWeightsReturn {
  const [weights, setWeights] = useState<PersonaWeights>(initialWeights);
  const rafRef = useRef<number | null>(null);

  type RecomputedState = {
    curve: number[];
    metrics: {
      weighted_completion_pct: number;
      weighted_top_dropoff_t: number;
      weighted_hook_score: number;
    };
  };

  const [recomputed, setRecomputed] = useState<RecomputedState>(() => {
    if (!heatmap) {
      return {
        curve: [],
        metrics: { weighted_completion_pct: 0, weighted_top_dropoff_t: 0, weighted_hook_score: 0 },
      };
    }
    const m = recomputeWeightedCurve(heatmap.personas, heatmap.segments, initialWeights);
    return {
      curve: m.weighted_curve,
      metrics: {
        weighted_completion_pct: m.weighted_completion_pct,
        weighted_top_dropoff_t: m.weighted_top_dropoff_t,
        weighted_hook_score: m.weighted_hook_score,
      },
    };
  });

  // RAF-debounced recompute whenever weights or heatmap change
  useEffect(() => {
    if (!heatmap) return;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const m = recomputeWeightedCurve(heatmap.personas, heatmap.segments, weights);
      setRecomputed({
        curve: m.weighted_curve,
        metrics: {
          weighted_completion_pct: m.weighted_completion_pct,
          weighted_top_dropoff_t: m.weighted_top_dropoff_t,
          weighted_hook_score: m.weighted_hook_score,
        },
      });
      rafRef.current = null;
    });
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [weights, heatmap]);

  // Anti-virality re-evaluation on recomputed curve or weight change
  // Confidence INVARIANT: resultConfidence used as-is (RESEARCH OQ-4 resolution)
  const antiViralityState = useMemo(() => {
    if (!heatmap) {
      return isAntiViralityGatedFull(resultConfidence, null);
    }
    const hm: HeatmapPayload = { ...heatmap, weighted_curve: recomputed.curve, weights };
    return isAntiViralityGatedFull(resultConfidence, hm);
  }, [recomputed.curve, heatmap, weights, resultConfidence]);

  const isDirty = !weightsEqual(weights, initialWeights);
  const reset = () => setWeights(initialWeights);

  return {
    weights,
    setWeights,
    reset,
    isDirty,
    recomputedCurve: recomputed.curve,
    recomputedMetrics: recomputed.metrics,
    antiViralityState,
  };
}
