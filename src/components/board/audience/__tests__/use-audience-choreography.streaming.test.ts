// @vitest-environment happy-dom
/**
 * Plan 04-04 Task 2 — Curve state machine + anti-virality + streaming integration.
 *
 * Strategy: inject mock stream objects via the optional `stream` parameter.
 * Tests curve state transitions, anti-virality flag, and end-to-end streaming.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudienceChoreography } from '../use-audience-choreography';
import { buildStageEvent, STREAMING_FIXTURE } from './fixtures/streaming-fixture';
import { buildHeatmapFixture, buildAntiViralityHeatmap } from './fixtures/heatmap-fixture';
import type { AnalysisStreamReturn } from '@/hooks/queries/use-analysis-stream';
import type { PredictionResult, PersonaBehavioralAggregate } from '@/lib/engine/types';

// Stub @pmndrs/detect-gpu so perf-tier.ts dynamic import doesn't fail
vi.mock('@pmndrs/detect-gpu', () => ({
  getGPUTier: vi.fn(() => Promise.resolve({ tier: 3 })),
}));

// Mock useAnalysisStream so internal hook call is harmless
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(() => makeMockStream()),
}));

// Mock usePrefersReducedMotion — default: no reduced motion
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(() => false),
}));

// Mock zustand perf store — default: high tier
vi.mock('@/lib/perf-tier', () => ({
  usePerfStore: vi.fn((selector: (s: { tier: string }) => unknown) => selector({ tier: 'high' })),
}));

// Mock a11y announce
vi.mock('@/lib/a11y', () => ({
  announce: vi.fn(),
}));

// Real anti-virality module (pure function, no side effects)
// We use the real implementation to test isAntiViralityActive correctly.
// However it needs HeatmapPayload which we supply via fixtures.

function makeMockStream(overrides: Partial<AnalysisStreamReturn> = {}): AnalysisStreamReturn {
  return {
    start: vi.fn(),
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {} as AnalysisStreamReturn['panelReady'],
    phase: 'idle',
    error: null,
    reconnect: vi.fn(),
    analysisId: null,
    filmstrips: {},
    ...overrides,
  };
}

const WAVE_0_START = buildStageEvent('stage_start', { stage: 'wave_0_segmentation', wave: 0, timestamp_ms: 0 });
const WAVE_0_END = buildStageEvent('stage_end', { stage: 'wave_0_segmentation', wave: 0, duration_ms: 2000 });

/** Minimal PersonaBehavioralAggregate stub — only needs to be truthy for curve trigger */
const MOCK_PERSONA_AGGREGATE = {
  avg_watch_pct: 0.75,
  loop_pct: 0.3,
  top_dropoff_t: 18,
  hook_score: 0.8,
  vs_niche_pct: 0.15,
} as unknown as PersonaBehavioralAggregate;

/** A minimal PredictionResult with persona_behavioral_aggregate but no heatmap */
function makeResult(overrides: Partial<PredictionResult> = {}): PredictionResult {
  return {
    id: 'test-result-001',
    overall_score: 75,
    confidence: 0.85,
    confidence_label: 'HIGH',
    persona_behavioral_aggregate: MOCK_PERSONA_AGGREGATE,
    heatmap: null,
    ...overrides,
  } as unknown as PredictionResult;
}

describe('useAudienceChoreography — curve state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('1. initial curveState = "idle"', () => {
    const stream = makeMockStream({ stages: [], phase: 'idle' });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    expect(result.current.curveState).toBe('idle');
  });

  it('2. curveState becomes "baseline" when phase=complete and persona_behavioral_aggregate present (no heatmap)', () => {
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END],
      phase: 'complete',
      result: makeResult({ heatmap: null }),
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    expect(result.current.curveState).toBe('baseline');
  });

  it('3. curveState transitions to "morphing" when result.heatmap becomes non-null', () => {
    const heatmap = buildHeatmapFixture();
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END],
      phase: 'complete',
      result: makeResult({ heatmap }),
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    // Should have gone idle → baseline → morphing (since heatmap present at phase=complete)
    expect(result.current.curveState).toBe('morphing');
    expect(result.current.isMorphInProgress).toBe(true);
  });

  it('4. curveState = "final" after CURVE_MORPH_MS (800ms) via fake timers', async () => {
    const heatmap = buildHeatmapFixture();
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END],
      phase: 'complete',
      result: makeResult({ heatmap }),
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    expect(result.current.curveState).toBe('morphing');

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.curveState).toBe('final');
    expect(result.current.isMorphInProgress).toBe(false);
  });

  it('5. With prefers-reduced-motion: heatmap arrival jumps straight to "final", no "morphing"', async () => {
    const { usePrefersReducedMotion } = await import('@/hooks/usePrefersReducedMotion');
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);

    const heatmap = buildHeatmapFixture();
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END],
      phase: 'complete',
      result: makeResult({ heatmap }),
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    // Should jump straight to 'final' — never visit 'morphing'
    expect(result.current.curveState).toBe('final');
    expect(result.current.isMorphInProgress).toBe(false);
  });

  it('6. isAntiViralityActive = true with anti-virality heatmap fixture', () => {
    const heatmap = buildAntiViralityHeatmap();
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END],
      phase: 'complete',
      // Use confidence = 0.35 (below 0.4 threshold) to trigger confidence gate too
      result: makeResult({ heatmap, confidence: 0.35 }),
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    expect(result.current.isAntiViralityActive).toBe(true);
  });
});

describe('useAudienceChoreography — end-to-end streaming integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('7. Full STREAMING_FIXTURE: all rows reach "complete" and curveState reaches "final"', async () => {
    const heatmap = buildHeatmapFixture();

    const stream = makeMockStream({
      stages: [...STREAMING_FIXTURE],
      phase: 'complete',
      result: makeResult({ heatmap }),
    });

    const { result } = renderHook(() => useAudienceChoreography(stream));

    // Initially: curveState should be 'morphing' or 'final' (phase=complete + heatmap present from mount)
    // With fake timers, the morph timer is queued but may not have fired yet — accept either state
    expect(['morphing', 'final']).toContain(result.current.curveState);

    // Advance past CELL_FILL_WAVE_MS (180ms) to let all fill-wave timers complete
    await act(async () => {
      vi.advanceTimersByTime(180);
    });

    // All 10 persona rows should now be 'complete'
    const rowValues = Object.values(result.current.rowStates);
    expect(rowValues).toHaveLength(10);
    for (const state of rowValues) {
      expect(state).toBe('complete');
    }

    // Advance past CURVE_MORPH_MS (800ms) — curveState must be 'final'
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.curveState).toBe('final');
  });
});
