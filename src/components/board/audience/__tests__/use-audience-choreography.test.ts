// @vitest-environment happy-dom
/**
 * Plan 04-04 Task 1 — useAudienceChoreography skeleton emit + row state machine.
 *
 * Strategy: inject a mock stream object via the optional `stream` parameter.
 * No SSE or network activity — pure React state machine test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudienceChoreography } from '../use-audience-choreography';
import { buildStageEvent } from './fixtures/streaming-fixture';
import type { AnalysisStreamReturn } from '@/hooks/queries/use-analysis-stream';
import type { StageEvent } from '@/lib/engine/events';

// Stub @pmndrs/detect-gpu so perf-tier.ts dynamic import doesn't fail in test env
vi.mock('@pmndrs/detect-gpu', () => ({
  getGPUTier: vi.fn(() => Promise.resolve({ tier: 3 })),
}));

// Mock useAnalysisStream so internal hook call is harmless
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(() => makeMockStream()),
}));

// Mock usePrefersReducedMotion — default no reduced motion
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(() => false),
}));

// Mock zustand perf store
vi.mock('@/lib/perf-tier', () => ({
  usePerfStore: vi.fn((selector: (s: { tier: string }) => unknown) => selector({ tier: 'high' })),
}));

// Mock a11y announce
vi.mock('@/lib/a11y', () => ({
  announce: vi.fn(),
}));

// Mock anti-virality (returns gated=false by default)
vi.mock('@/lib/engine/anti-virality', () => ({
  isAntiViralityGatedFull: vi.fn(() => ({ gated: false, reason: null, dropoff_segment_indices: [] })),
}));

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
    abort: vi.fn(),
    analysisId: null,
    filmstrips: {},
    ...overrides,
  };
}

const WAVE_0_START: StageEvent = buildStageEvent('stage_start', {
  stage: 'wave_0_segmentation',
  wave: 0,
  timestamp_ms: 0,
});

const WAVE_0_END: StageEvent = buildStageEvent('stage_end', {
  stage: 'wave_0_segmentation',
  wave: 0,
  duration_ms: 2000,
});

describe('useAudienceChoreography — skeleton + row state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('1. rowStates is {} before any stage events', () => {
    const stream = makeMockStream({ stages: [], phase: 'idle' });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    expect(result.current.rowStates).toEqual({});
  });

  it('2. rowStates has exactly 10 skeleton keys after wave_0_segmentation stage_end', () => {
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END],
      phase: 'idle',
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    const keys = Object.keys(result.current.rowStates);
    expect(keys).toHaveLength(10);
    // Keys should be slot-0..slot-9
    expect(keys.sort()).toEqual(
      ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5', 'slot-6', 'slot-7', 'slot-8', 'slot-9'],
    );
    // All in skeleton state
    for (const v of Object.values(result.current.rowStates)) {
      expect(v).toBe('skeleton');
    }
  });

  it('3. pass2_persona_start with high_engager replaces a slot key with the real persona_id in streaming state', () => {
    const startEvent = buildStageEvent('pass2_persona_start', {
      persona_id: 'fyp_1',
      archetype: 'high_engager',
    });
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END, startEvent],
      phase: 'analyzing',
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    // After hook processes: fyp_1 should be in rowStates with 'streaming'
    expect(result.current.rowStates['fyp_1']).toBe('streaming');
    // One slot key should have been consumed (9 remaining slot keys + 1 real persona)
    const slotKeys = Object.keys(result.current.rowStates).filter((k) => k.startsWith('slot-'));
    expect(slotKeys).toHaveLength(9);
    // Total still 10
    expect(Object.keys(result.current.rowStates)).toHaveLength(10);
  });

  it('4. pass2_persona_end + 180ms wait → state is "complete"', async () => {
    const startEvent = buildStageEvent('pass2_persona_start', {
      persona_id: 'fyp_1',
      archetype: 'high_engager',
    });
    const endEvent = buildStageEvent('pass2_persona_end', {
      persona_id: 'fyp_1',
      archetype: 'high_engager',
      ok: true,
      attentions: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05],
    });
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END, startEvent, endEvent],
      phase: 'analyzing',
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));

    // After end event: should be 'filling'
    expect(result.current.rowStates['fyp_1']).toBe('filling');

    // After 180ms: should be 'complete'
    await act(async () => {
      vi.advanceTimersByTime(180);
    });
    expect(result.current.rowStates['fyp_1']).toBe('complete');
  });

  it('5. With prefers-reduced-motion: pass2_persona_end skips "filling" and writes "complete" immediately', async () => {
    const { usePrefersReducedMotion } = await import('@/hooks/usePrefersReducedMotion');
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);

    const startEvent = buildStageEvent('pass2_persona_start', {
      persona_id: 'fyp_1',
      archetype: 'high_engager',
    });
    const endEvent = buildStageEvent('pass2_persona_end', {
      persona_id: 'fyp_1',
      archetype: 'high_engager',
      ok: true,
      attentions: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05],
    });
    const stream = makeMockStream({
      stages: [WAVE_0_START, WAVE_0_END, startEvent, endEvent],
      phase: 'analyzing',
    });
    const { result } = renderHook(() => useAudienceChoreography(stream));

    // No timer needed — should be 'complete' immediately
    expect(result.current.rowStates['fyp_1']).toBe('complete');

    // Verify no timer fires (advance time, still complete)
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.rowStates['fyp_1']).toBe('complete');
  });

  it('6. curveState is "idle" initially', () => {
    const stream = makeMockStream({ stages: [], phase: 'idle' });
    const { result } = renderHook(() => useAudienceChoreography(stream));
    expect(result.current.curveState).toBe('idle');
  });
});
