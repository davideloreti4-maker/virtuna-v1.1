/** @vitest-environment happy-dom */
/**
 * AudienceNode empty-state tests — verifies the persona-data-unavailable overlay
 * is shown when heatmap is absent (null) or personas array is empty.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mock the presentational zones so we can test AudienceNode wiring in isolation ──
vi.mock('../AudienceHero', () => ({ AudienceHero: () => <div data-testid="audience-hero-stub" /> }));
vi.mock('../RetentionChart', () => ({ RetentionChart: () => <div data-testid="retention-chart-stub" /> }));
vi.mock('../SegmentTable', () => ({ SegmentTable: () => <div data-testid="segment-table-stub" /> }));
vi.mock('../MixFooter', () => ({ MixFooter: () => <div data-testid="mix-footer-stub" /> }));
vi.mock('../WeightOverrideDrawer', () => ({ WeightOverrideDrawer: () => null }));
vi.mock('../use-audience-choreography', () => ({
  useAudienceChoreography: () => ({ rowStates: {}, curveState: 'idle' }),
}));
vi.mock('../use-client-weights', () => ({
  useClientWeights: () => ({
    weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    setWeights: vi.fn(),
    recomputedCurve: [],
    recomputedMetrics: {
      weighted_completion_pct: 0,
      weighted_top_dropoff_t: 0,
      weighted_hook_score: 0,
    },
    antiViralityState: { dropoff_segment_indices: [] },
    isDirty: false,
    reset: vi.fn(),
  }),
}));
vi.mock('@/stores/board-store', () => ({
  useBoardStore: (
    selector: (s: { boardState: string; setActivePreset: () => void; pendingVideo: null }) => unknown,
  ) => selector({ boardState: 'complete', setActivePreset: vi.fn(), pendingVideo: null }),
}));
vi.mock('@/lib/engine/persona-weights', () => ({
  DEFAULT_PERSONA_WEIGHT_CONFIG: { default: {} },
}));

// usePermalinkAnalysis wraps TanStack useQuery + useParams — stub it out so
// the test doesn't need a QueryClientProvider or a Next router mock.
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => ({ id: null, data: null, isLoading: false }),
}));

// usePermalinkFilmstrips also wraps useQuery + useParams — stub to {} so the
// test needs no QueryClientProvider.
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => ({}),
}));

function mockStream(result: unknown, phase = 'complete') {
  vi.doMock('@/hooks/queries/use-analysis-stream', () => ({
    useAnalysisStream: () => ({ result, phase, partial: null, filmstrips: null, analysisId: 'test' }),
  }));
}

describe('AudienceNode empty state', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('shows empty-state overlay when heatmap is null (post-analysis, no data)', async () => {
    mockStream({ heatmap: null, confidence: 0.5 });
    const { AudienceNode } = await import('../AudienceNode');
    render(<AudienceNode camera={{} as never} layout={{ bounds: { x: 0, y: 0, width: 400, height: 300 } } as never} />);
    expect(screen.getByTestId('audience-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('audience-empty-state')).toHaveTextContent(
      "Persona data isn't available for this analysis",
    );
  });

  it('shows empty-state overlay when personas array is empty', async () => {
    mockStream({ heatmap: { personas: [], segments: [], weighted_curve: [], weights: {} }, confidence: 0.5 });
    const { AudienceNode } = await import('../AudienceNode');
    render(<AudienceNode camera={{} as never} layout={{ bounds: { x: 0, y: 0, width: 400, height: 300 } } as never} />);
    expect(screen.getByTestId('audience-empty-state')).toBeInTheDocument();
  });

  it('does NOT show empty-state when personas exist', async () => {
    mockStream({
      heatmap: {
        personas: [{ id: 'p1', attentions: [], segment_reasons: [] }],
        segments: [],
        weighted_curve: [],
        weights: {},
      },
      confidence: 0.8,
    });
    const { AudienceNode } = await import('../AudienceNode');
    render(<AudienceNode camera={{} as never} layout={{ bounds: { x: 0, y: 0, width: 400, height: 300 } } as never} />);
    expect(screen.queryByTestId('audience-empty-state')).toBeNull();
  });

  it('does NOT show empty-state during streaming phase', async () => {
    mockStream(null, 'analyzing');
    const { AudienceNode } = await import('../AudienceNode');
    render(<AudienceNode camera={{} as never} layout={{ bounds: { x: 0, y: 0, width: 400, height: 300 } } as never} />);
    expect(screen.queryByTestId('audience-empty-state')).toBeNull();
  });
});
