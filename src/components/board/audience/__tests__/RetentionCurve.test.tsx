/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
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

let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 0;

beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 0;

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockCtx as unknown as ReturnType<HTMLCanvasElement['getContext']>,
  );

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return ++rafIdCounter;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

  // DPR
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    configurable: true,
  });

  // getBoundingClientRect default — used by the pointer→world mapping path.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 180,
    x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 180,
    toJSON: () => ({}),
  } as DOMRect);

  // offsetWidth/offsetHeight — the canvas hook sizes its buffer from
  // offsetWidth × dpr (CSS layout size, not getBoundingClientRect). happy-dom
  // does no layout, so without these stubs the canvas measures 0.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 400,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 180,
  });

  // Reset ctx mocks between tests
  for (const key of Object.keys(mockCtx)) {
    const v = (mockCtx as Record<string, unknown>)[key];
    if (typeof v === 'function' && 'mockClear' in v) {
      (v as ReturnType<typeof vi.fn>).mockClear();
    }
  }
  mockCtx.globalAlpha = 1;
  mockCtx.fillStyle = '';
  mockCtx.strokeStyle = '';
  // Reset gradient mock
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
  morphRequested: false,
  antiViralityXRange: null,
  onTap: vi.fn(),
  weightedCompletionPct: 72,
};

describe('RetentionCurve', () => {
  it('renders <canvas> with role=img and aria-label containing "retention curve"', () => {
    const { container } = render(<RetentionCurve {...defaultProps} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('role')).toBe('img');
    expect(canvas?.getAttribute('aria-label')).toMatch(/retention curve/i);
  });

  it('DPR-aware: canvas physical width = offsetWidth × devicePixelRatio', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });

    const { container } = render(<RetentionCurve {...defaultProps} />);

    // Trigger first RAF frame
    act(() => {
      const cb = rafCallbacks[0];
      if (cb) cb(16);
    });

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    // canvas.width set by hook to Math.round(offsetWidth(400) * dpr(2)) = 800
    expect(canvas.width).toBe(800);
  });

  it('draws hook zone warm band (fillRect called)', () => {
    const { } = render(<RetentionCurve {...defaultProps} />);

    act(() => {
      const cb = rafCallbacks[0];
      if (cb) cb(16);
    });

    // fillRect should be called for the hook zone band (and possibly other fills)
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it('schedules RAF when morphRequested=true and reducedMotion=false', () => {
    // Need to mock usePrefersReducedMotion to return false
    vi.doMock('@/hooks/usePrefersReducedMotion', () => ({
      usePrefersReducedMotion: () => false,
    }));

    render(<RetentionCurve {...defaultProps} morphRequested={true} />);
    // requestAnimationFrame should be called (initial draw + morph loop)
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it('onTap callback fires with kind=curve-point when no marker hit at tap position', () => {
    const onTap = vi.fn();
    const { container } = render(
      <RetentionCurve {...defaultProps} heatmap={fixture} onTap={onTap} />,
    );

    // Trigger RAF to initialize
    act(() => {
      const cb = rafCallbacks[0];
      if (cb) cb(16);
    });

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    // Fire pointerdown at center — no markers since fixture has no swipe_predicted_at
    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 200,
      clientY: 90,
    });
    act(() => {
      canvas.dispatchEvent(event);
    });

    expect(onTap).toHaveBeenCalled();
    const payload = onTap.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    // When no marker hit and weightedCurve is set, should be curve-point
    expect(payload.kind).toBe('curve-point');
  });
});
