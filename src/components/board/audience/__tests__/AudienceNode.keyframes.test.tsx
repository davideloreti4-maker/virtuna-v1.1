/** @vitest-environment happy-dom */
/**
 * AudienceNode real-keyframe tests — verifies the "Where they drop" strip + the
 * "Who leaves" cohort thumbs render real `keyframe` cells ONLY when a real video
 * timeline (filmstrips) exists, and that the frame is otherwise unchanged with no
 * keyframe elements in text/url/no-video modes.
 *
 * Strategy: mock only the DATA hooks + the unrelated presentational zones
 * (AudienceHero / RetentionChart / MixFooter / drawer). DropStrip + SegmentTable
 * + KeyframeImage render for real so the `keyframe` / `drop-strip` testids appear.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// Unrelated zones stubbed (keep the test focused on the keyframe placements).
vi.mock('../AudienceHero', () => ({ AudienceHero: () => <div data-testid="audience-hero-stub" /> }));
vi.mock('../RetentionChart', () => ({ RetentionChart: () => <div data-testid="retention-chart-stub" /> }));
vi.mock('../MixFooter', () => ({ MixFooter: () => <div data-testid="mix-footer-stub" /> }));
vi.mock('../WeightOverrideDrawer', () => ({ WeightOverrideDrawer: () => null }));
// NOTE: DropStrip + SegmentTable are intentionally NOT mocked — they render real
// KeyframeImage cells (data-testid="keyframe").

vi.mock('../use-audience-choreography', () => ({
  useAudienceChoreography: () => ({ rowStates: {}, curveState: 'idle' }),
}));
vi.mock('../use-client-weights', () => ({
  useClientWeights: () => ({
    weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    setWeights: vi.fn(),
    recomputedCurve: [],
    recomputedMetrics: {
      weighted_completion_pct: 0.6,
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
  DEFAULT_PERSONA_WEIGHT_CONFIG: { default: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 } },
}));
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => ({ id: null, data: null, isLoading: false }),
}));
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => ({}),
}));

/** Mock the stream hook with a given result + filmstrip map (real video iff non-empty). */
function mockStream(result: unknown, filmstrips: Record<number, string> | null) {
  vi.doMock('@/hooks/queries/use-analysis-stream', () => ({
    useAnalysisStream: () => ({
      result,
      phase: 'complete',
      partial: null,
      filmstrips,
      analysisId: 'test',
    }),
  }));
}

/** Heatmap with a clear monotonic drop so buildDropMoments produces moments. */
function dropHeatmap() {
  const hm = buildHeatmapFixture();
  // monotonic, distinct downward steps so we get 3 drop moments
  hm.weighted_curve = [1, 0.95, 0.9, 0.55, 0.55, 0.55, 0.25, 0.25, 0.25, 0.2];
  return hm;
}

const LAYOUT = { bounds: { x: 0, y: 0, width: 400, height: 600 } } as never;
const CAMERA = {} as never;

describe('AudienceNode real-keyframe placements', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders the "Where they drop" strip with keyframe cells when filmstrips exist', async () => {
    const hm = dropHeatmap();
    const filmstrips = {
      3: 'https://signed/frame-3.jpg',
      6: 'https://signed/frame-6.jpg',
      9: 'https://signed/frame-9.jpg',
    };
    mockStream({ heatmap: hm, confidence: 0.9, behavioral_predictions: { completion_pct: 60 } }, filmstrips);
    const { AudienceNode } = await import('../AudienceNode');
    render(<AudienceNode camera={CAMERA} layout={LAYOUT} />);

    // strip present + at least 3 keyframe cells (the 3 drop moments)
    expect(screen.getByTestId('drop-strip')).toBeInTheDocument();
    expect(screen.getByText('Where they drop')).toBeInTheDocument();
    expect(screen.getAllByTestId('keyframe').length).toBeGreaterThanOrEqual(3);
  });

  it('renders NO keyframe cells and NO strip when there are no filmstrips (text/url mode)', async () => {
    const hm = dropHeatmap();
    // no real video: stream filmstrips null AND permalink filmstrips {} (mocked above)
    mockStream({ heatmap: hm, confidence: 0.9, behavioral_predictions: { completion_pct: 60 } }, null);
    const { AudienceNode } = await import('../AudienceNode');
    render(<AudienceNode camera={CAMERA} layout={LAYOUT} />);

    // frame still renders normally (tiles + tabs present, no empty state) …
    expect(screen.queryByTestId('audience-empty-state')).toBeNull();
    // … but with ZERO keyframe elements and NO drop strip (no layout shift, no empty state)
    expect(screen.queryByTestId('drop-strip')).toBeNull();
    expect(screen.queryAllByTestId('keyframe')).toHaveLength(0);
    expect(screen.queryByText('Where they drop')).toBeNull();
  });
});
