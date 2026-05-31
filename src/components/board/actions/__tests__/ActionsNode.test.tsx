/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), event: vi.fn() } }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }));
// ActionsNode hydrates from permalink REST cache via usePermalinkAnalysis.
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => ({ id: null, data: null, isLoading: false }),
}));
// @phosphor-icons/react is ESM-only; provide stub SVG components for every icon
// the action-led frame + reused edit panel touch.
vi.mock('@phosphor-icons/react', () => {
  const stub = (name: string) =>
    function Stub({ size, ...rest }: { size?: number }) {
      return <svg width={size} height={size} data-testid={`icon-${name}`} {...rest} />;
    };
  return {
    ArrowUpRight: stub('arrow-up-right'),
    CaretRight: stub('caret-right'),
    CaretDown: stub('caret-down'),
    CaretUp: stub('caret-up'),
    Check: stub('check'),
    PencilSimple: stub('pencil-simple'),
    Clock: stub('clock'),
    Info: stub('info'),
  };
});

// script hook — supplies the hero "Copy rewrite" opening line.
vi.mock('@/components/board/actions/script/use-script', () => ({
  useScript: () => ({
    data: {
      is_empty_state: false,
      script: {
        opening_line: 'Stub opening line',
        scene_order: ['0:00 — Stub scene'],
        voiceover: 'Stub voiceover',
        captions: ['Stub caption'],
      },
      engine_version: 'v3.0.0',
      generated_at: '2026-05-28T00:00:00Z',
    },
    isLoading: false,
    isError: false,
    refetch: () => {},
  }),
}));

vi.mock('@/components/board/actions/optimal-post/use-optimal-post-override', () => ({
  useOptimalPostOverride: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copied: false, copy: async () => true }),
}));

const WINDOW = {
  day_of_week: 'Tue',
  hour_range: [18, 21],
  timezone: 'UTC',
  reasoning: 'Niche peaks Tue (n=12 videos)',
  source: 'niche',
};

function withWindow(result: object) {
  return { ...result, id: 'analysis-id-stub', optimal_post_window: WINDOW, optimal_post_override: null };
}

function mockStream(overrides: { phase?: string; result?: unknown } = {}) {
  vi.doMock('@/hooks/queries/use-analysis-stream', () => ({
    useAnalysisStream: () => ({
      phase: overrides.phase ?? 'complete',
      result: 'result' in overrides ? overrides.result : withWindow(fixtures.complete),
    }),
  }));
}

function mockBoardState(state: string) {
  vi.doMock('@/stores/board-store', () => ({
    useBoardStore: (selector: (s: { boardState: string }) => unknown) =>
      selector({ boardState: state }),
  }));
}

describe('ActionsNode (action-led)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('renders the actions-grid container', async () => {
    mockStream({ phase: 'complete', result: withWindow(fixtures.complete) });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid')).toBeInTheDocument();
  });

  it('grid is a natural-height flex-col stack (no in-frame scroll)', async () => {
    mockStream({ phase: 'complete', result: withWindow(fixtures.complete) });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    const grid = screen.getByTestId('actions-grid') as HTMLElement;
    expect(grid.className).toContain('flex-col');
    expect(grid.className).not.toContain('overflow-y-auto');
    expect(grid.className).not.toContain('h-full');
  });

  it('default state: data-av=false', async () => {
    mockStream({ phase: 'complete', result: withWindow(fixtures.complete) });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-av')).toBe('false');
  });

  it('mid band → needs-work hero (the top fix), Copy rewrite, and best time — no score number', async () => {
    mockStream({ phase: 'complete', result: withWindow(fixtures.complete) });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-view')).toBe('needs-work');
    // Hero is the top counterfactual fix headline.
    expect(screen.getByTestId('actions-hero-fix')).toBeInTheDocument();
    expect(screen.getByText('Tighten text overlay')).toBeInTheDocument();
    // The action is a quiet text-link, not a score.
    expect(screen.getByText('Copy rewrite')).toBeInTheDocument();
    // When-to-post present as a footer.
    expect(screen.getByTestId('actions-best-time')).toBeInTheDocument();
    expect(screen.getByTestId('actions-best-time').getAttribute('data-variant')).toBe('foot');
  });

  it('high band → ship-led: best-time is the hero, fixes become optional polish', async () => {
    const highBand = withWindow({
      ...fixtures.complete,
      counterfactuals: { ...fixtures.complete.counterfactuals, band: 'high' },
    });
    mockStream({ phase: 'complete', result: highBand });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-view')).toBe('strong');
    expect(screen.getByTestId('actions-best-time').getAttribute('data-variant')).toBe('hero');
    expect(screen.getByText('Optional polish')).toBeInTheDocument();
    // No hero fix and no "Fix first" framing on a strong video.
    expect(screen.queryByTestId('actions-hero-fix')).toBeNull();
  });

  it('high score + no counterfactuals → ship-led, not a wall of advice (screenshot regression)', async () => {
    // The live board case: overall_score 78 but Stage-11 counterfactuals null.
    // Must fall back to the score band → "Post it" hero, advice demoted to polish.
    const noCfHigh = withWindow({ ...fixtures.complete, counterfactuals: null });
    mockStream({ phase: 'complete', result: noCfHigh });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-view')).toBe('strong');
    expect(screen.getByTestId('actions-best-time').getAttribute('data-variant')).toBe('hero');
    expect(screen.queryByTestId('actions-hero-fix')).toBeNull();
  });

  it('mid/low score + no counterfactuals → degraded advice as tight expandable rows (not prose paragraphs)', async () => {
    const degraded = withWindow({ ...fixtures.complete, counterfactuals: null, overall_score: 55 });
    mockStream({ phase: 'complete', result: degraded });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-view')).toBe('degraded');
    expect(screen.getByText('Where to focus')).toBeInTheDocument();
    // Each suggestion renders as a clamped expandable row, never raw multi-line text.
    expect(screen.getAllByTestId('actions-advice-row').length).toBeGreaterThan(0);
  });

  it('anti-virality (low band) → critical "Fix before posting" framing', async () => {
    mockStream({ phase: 'complete', result: withWindow(fixtures.antiVirality) });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-av')).toBe('true');
    expect(screen.getByTestId('actions-grid').getAttribute('data-view')).toBe('needs-work');
    expect(screen.getByText(/Fix before posting/)).toBeInTheDocument();
  });

  it('streaming (not ready) → calm skeleton, no boxes', async () => {
    mockStream({ phase: 'analyzing', result: null });
    mockBoardState('streaming');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('actions-hero-fix')).toBeNull();
  });

  it('does NOT render the retired score breakdown / scorecard', async () => {
    mockStream({ phase: 'complete', result: withWindow(fixtures.complete) });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.queryByTestId('actions-scorecard')).toBeNull();
    expect(screen.queryByText('Score breakdown')).toBeNull();
  });
});
