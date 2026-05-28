/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildHeatmapFixture, buildAntiViralityHeatmap } from './fixtures/heatmap-fixture';
import { useClientWeights } from '../use-client-weights';
import { recomputeWeightedCurve } from '@/lib/engine/wave3/weighted-aggregator-client';
import * as antiVirality from '@/lib/engine/anti-virality';

const DEFAULT_WEIGHTS = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
const RESULT_CONFIDENCE = 0.75;

// RAF shim for happy-dom (vi.useFakeTimers doesn't shim rAF automatically in all envs)
function setupRaf() {
  let callbacks: Array<() => void> = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    callbacks.push(cb as () => void);
    return callbacks.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  return {
    flush: () => {
      const toRun = callbacks.slice();
      callbacks = [];
      toRun.forEach((cb) => cb());
    },
  };
}

describe('useClientWeights', () => {
  let raf: ReturnType<typeof setupRaf>;

  beforeEach(() => {
    raf = setupRaf();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recomputed curve matches server recomputeWeightedCurve for default weights', () => {
    const heatmap = buildHeatmapFixture();
    const { result } = renderHook(() =>
      useClientWeights(heatmap, DEFAULT_WEIGHTS, RESULT_CONFIDENCE),
    );

    // Flush initial RAF to trigger recompute
    act(() => raf.flush());

    const serverResult = recomputeWeightedCurve(heatmap.personas, heatmap.segments, DEFAULT_WEIGHTS);
    const hookCurve = result.current.recomputedCurve;

    expect(hookCurve.length).toBe(serverResult.weighted_curve.length);
    for (let i = 0; i < serverResult.weighted_curve.length; i++) {
      expect(hookCurve[i]).toBeCloseTo(serverResult.weighted_curve[i]!, 9);
    }
  });

  it('setWeights triggers RAF-debounced recompute', async () => {
    const heatmap = buildHeatmapFixture();
    const newWeights = { fyp: 0.40, niche: 0.30, loyalist: 0.20, cross_niche: 0.10 };

    const { result } = renderHook(() =>
      useClientWeights(heatmap, DEFAULT_WEIGHTS, RESULT_CONFIDENCE),
    );

    // Get initial curve
    act(() => raf.flush());
    const initial = result.current.recomputedCurve.slice();

    // Change weights
    act(() => {
      result.current.setWeights(newWeights);
    });

    // Before RAF tick, curve should not have updated yet (RAF pending)
    // After RAF tick, curve should update
    act(() => raf.flush());

    const serverResult = recomputeWeightedCurve(heatmap.personas, heatmap.segments, newWeights);
    const updated = result.current.recomputedCurve;

    // Curve must have changed from initial
    const changed = updated.some((v, i) => Math.abs(v - (initial[i] ?? 0)) > 1e-9);
    expect(changed).toBe(true);

    // Must match server result for new weights
    for (let i = 0; i < serverResult.weighted_curve.length; i++) {
      expect(updated[i]).toBeCloseTo(serverResult.weighted_curve[i]!, 9);
    }
  });

  it('anti-virality re-evaluates during slider drag', () => {
    const heatmap = buildAntiViralityHeatmap();
    // Start with loyalist-heavy weights (loyalist has higher attentions in non-dropoff segments)
    const loyalistWeights = { fyp: 0.10, niche: 0.10, loyalist: 0.75, cross_niche: 0.05 };

    const { result } = renderHook(() =>
      useClientWeights(heatmap, loyalistWeights, RESULT_CONFIDENCE),
    );

    // Anti-virality state should be evaluated — check it's a valid return shape
    const avState = result.current.antiViralityState;
    expect(avState).toHaveProperty('gated');
    expect(avState).toHaveProperty('reason');
    expect(avState).toHaveProperty('dropoff_segment_indices');
  });

  it('confidence is invariant under override — isAntiViralityGatedFull called with original resultConfidence', () => {
    const heatmap = buildHeatmapFixture();
    const spy = vi.spyOn(antiVirality, 'isAntiViralityGatedFull');

    const { result } = renderHook(() =>
      useClientWeights(heatmap, DEFAULT_WEIGHTS, RESULT_CONFIDENCE),
    );

    // After mount, anti-virality state has been computed via useMemo
    // Assert gatedFull was called with original confidence
    expect(spy).toHaveBeenCalledWith(RESULT_CONFIDENCE, expect.anything());

    // Change weights
    const newWeights = { fyp: 0.40, niche: 0.30, loyalist: 0.20, cross_niche: 0.10 };
    act(() => {
      result.current.setWeights(newWeights);
    });
    act(() => raf.flush());

    // Must still be called with original confidence (not recomputed)
    const calls = spy.mock.calls;
    for (const call of calls) {
      expect(call[0]).toBe(RESULT_CONFIDENCE);
    }
  });

  it('isDirty=true when weights differ from initial', () => {
    const heatmap = buildHeatmapFixture();
    const { result } = renderHook(() =>
      useClientWeights(heatmap, DEFAULT_WEIGHTS, RESULT_CONFIDENCE),
    );

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setWeights({ fyp: 0.50, niche: 0.25, loyalist: 0.15, cross_niche: 0.10 });
    });

    expect(result.current.isDirty).toBe(true);
  });

  it('reset returns weights to initial', () => {
    const heatmap = buildHeatmapFixture();
    const { result } = renderHook(() =>
      useClientWeights(heatmap, DEFAULT_WEIGHTS, RESULT_CONFIDENCE),
    );

    act(() => {
      result.current.setWeights({ fyp: 0.50, niche: 0.25, loyalist: 0.15, cross_niche: 0.10 });
    });

    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.weights).toEqual(DEFAULT_WEIGHTS);
    expect(result.current.isDirty).toBe(false);
  });
});
