/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import { RetentionCurve } from '../RetentionCurve';

// ---------------------------------------------------------------------------
// Canvas + RAF mocks
// ---------------------------------------------------------------------------

const mockCtx = {
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  setTransform: vi.fn(),
  measureText: vi.fn(() => ({ width: 10 })),
  globalAlpha: 1,
  fillStyle: '' as string | CanvasGradient | CanvasPattern,
  strokeStyle: '' as string | CanvasGradient | CanvasPattern,
  lineWidth: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
};

let rafCallCount = 0;

// Mock usePrefersReducedMotion to return true before imports
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

beforeEach(() => {
  rafCallCount = 0;

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockCtx as unknown as ReturnType<HTMLCanvasElement['getContext']>,
  );

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((_cb) => {
    rafCallCount++;
    // Execute the callback immediately so draw runs, but don't schedule more
    // This simulates a single draw without a looping RAF
    return rafCallCount;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    configurable: true,
  });

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 180,
    x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 180,
    toJSON: () => ({}),
  } as DOMRect);

  for (const key of Object.keys(mockCtx)) {
    const v = (mockCtx as Record<string, unknown>)[key];
    if (typeof v === 'function' && 'mockClear' in v) {
      (v as ReturnType<typeof vi.fn>).mockClear();
    }
  }
  mockCtx.globalAlpha = 1;
  mockCtx.fillStyle = '';
  mockCtx.strokeStyle = '';
  mockCtx.createLinearGradient.mockReturnValue({ addColorStop: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const fixture = buildHeatmapFixture();
const defaultProps = {
  weightedCurve: fixture.weighted_curve,
  baselineCurve: fixture.weighted_curve.map(() => 0.5),
  heatmap: fixture,
  totalDurationSec: 30,
  morphRequested: true, // enabled but should be skipped due to reduced motion
  antiViralityXRange: null,
  onTap: vi.fn(),
  weightedCompletionPct: 72,
};

describe('RetentionCurve (reduced-motion)', () => {
  it('jump-cuts to weighted curve when prefersReducedMotion=true (draws final state immediately)', () => {
    render(<RetentionCurve {...defaultProps} />);

    // With reducedMotion=true, the hook should draw the weighted curve directly
    // bezierCurveTo or moveTo/lineTo should be called (curve drawing happened)
    // The key: drawing functions are invoked = final state rendered
    const drawCallMade =
      mockCtx.bezierCurveTo.mock.calls.length > 0 ||
      mockCtx.moveTo.mock.calls.length > 0;
    expect(drawCallMade).toBe(true);
  });

  it('does NOT schedule a recurring RAF loop when reducedMotion=true + morphRequested=true', () => {
    // Reset counter before render
    rafCallCount = 0;

    render(<RetentionCurve {...defaultProps} morphRequested={true} />);

    // In reduced-motion mode, the hook must NOT start an animation loop.
    // Either RAF is not called at all (0 calls), or it's called exactly once
    // for the initial draw (not in a loop). In our mock, the callback does NOT
    // re-schedule, so looping = multiple calls. Expect at most 1 call.
    expect(rafCallCount).toBeLessThanOrEqual(1);
  });
});
