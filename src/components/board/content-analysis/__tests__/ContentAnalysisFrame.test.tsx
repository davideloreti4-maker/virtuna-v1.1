/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// =====================================================
// Mocks — hook dependencies
// =====================================================

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: vi.fn(() => ({ data: null })),
}));

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(),
}));

// =====================================================
// Mocks — HookDecompNode sub-dependencies
// =====================================================

vi.mock('@/lib/logger', () => ({ logger: { event: vi.fn() } }));

// =====================================================
// Mocks — EmotionArcNode sub-dependencies
// =====================================================

vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }));
vi.mock('@/lib/perf-tier', () => ({
  usePerfStore: (selector: (s: { tier: 'high' | 'medium' | 'low' }) => unknown) =>
    selector({ tier: 'high' }),
}));

// Recharts renders nothing meaningful in jsdom — stub to avoid ResizeObserver errors.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { ContentAnalysisFrame } from '../ContentAnalysisFrame';
import { COPY } from '../content-analysis-constants';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import type { Camera, GroupFrameLayout } from '../../board-types';

// Minimal valid props for ContentAnalysisFrame
const camera: Camera = { x: 0, y: 0, scale: 1 };
const layout: GroupFrameLayout = {
  id: 'content-analysis',
  label: 'Content Analysis',
  bounds: { x: 0, y: 0, width: 800, height: 600 },
};

// =====================================================
// Tests — Quick 260528-nqx
// =====================================================

describe('ContentAnalysisFrame (Quick 260528-nqx)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders HookDecompNode + EmotionArcNode with real data; no (unavailable) copy', () => {
    (useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue({
      phase: 'complete',
      result: fixtures.complete, // has populated hook_decomposition + emotion_arc
      start: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
      stages: [],
      partial: null,
      panelReady: true,
      error: null,
      reconnect: vi.fn(),
    });

    render(<ContentAnalysisFrame camera={camera} layout={layout} />);

    // Neither unavailable string appears when data is populated
    expect(screen.queryByText(COPY.HOOK_DECOMP_UNAVAILABLE)).toBeNull();
    expect(screen.queryByText(COPY.EMOTION_ARC_UNAVAILABLE)).toBeNull();
  });

  it('renders unavailable copy when result.hook_decomposition and emotion_arc are null', () => {
    (useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue({
      phase: 'complete',
      result: { ...fixtures.complete, hook_decomposition: null, emotion_arc: null },
      start: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
      stages: [],
      partial: null,
      panelReady: true,
      error: null,
      reconnect: vi.fn(),
    });

    render(<ContentAnalysisFrame camera={camera} layout={layout} />);

    // Both unavailable strings appear (regression guard)
    expect(screen.getByText(COPY.HOOK_DECOMP_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.getByText(COPY.EMOTION_ARC_UNAVAILABLE)).toBeInTheDocument();
  });
});
