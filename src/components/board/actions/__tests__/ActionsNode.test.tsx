/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), event: vi.fn() } }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }));
// ActionsNode hydrates from permalink REST cache via usePermalinkAnalysis.
// Stub it so tests don't need a QueryClientProvider + Next router param.
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => ({ id: null, data: null, isLoading: false }),
}));
// @phosphor-icons/react is ESM-only; vi.resetModules() makes named exports undefined in happy-dom.
// Provide stub SVG components for all icons used by slot wrappers.
vi.mock('@phosphor-icons/react', () => ({
  FilmScript: ({ size, ...rest }: { size?: number; 'aria-hidden'?: boolean }) => (
    <svg width={size} height={size} data-testid="icon-film-script" {...rest} />
  ),
  Clock: ({ size, ...rest }: { size?: number; 'aria-hidden'?: boolean }) => (
    <svg width={size} height={size} data-testid="icon-clock" {...rest} />
  ),
  ShareNetwork: ({ size, ...rest }: { size?: number; 'aria-hidden'?: boolean }) => (
    <svg width={size} height={size} data-testid="icon-share-network" {...rest} />
  ),
  Copy: ({ size, ...rest }: { size?: number }) => (
    <svg width={size} height={size} data-testid="icon-copy" {...rest} />
  ),
  CheckCircle: ({ size, ...rest }: { size?: number }) => (
    <svg width={size} height={size} data-testid="icon-check-circle" {...rest} />
  ),
  Info: ({ size, ...rest }: { size?: number }) => (
    <svg width={size} height={size} data-testid="icon-info" {...rest} />
  ),
}));

// Phase 6: stub script + optimal-post hooks so slot wrappers don't fetch
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

// Stub Sheet primitive — Radix portal doesn't render in happy-dom in some Vitest setups
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

// useIsMobile defaults to desktop
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

// useCopyToClipboard returns simple stub
vi.mock('@/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copied: false,
    copy: async () => true,
  }),
}));

// Mock useAnalysisStream + useBoardStore based on actual hook shape.
// Replace `phase` + `result` + `boardState` values per test.
function mockStream(overrides: { phase?: string; result?: unknown } = {}) {
  vi.doMock('@/hooks/queries/use-analysis-stream', () => ({
    useAnalysisStream: () => ({
      phase: overrides.phase ?? 'complete',
      result: overrides.result ?? {
        ...fixtures.complete,
        id: 'analysis-id-stub',
        optimal_post_window: {
          day_of_week: 'Tue',
          hour_range: [18, 21],
          timezone: 'UTC',
          reasoning: 'Niche peaks Tue (n=12 videos)',
          source: 'niche',
        },
        optimal_post_override: null,
      },
    }),
  }));
}

function mockBoardState(state: string) {
  vi.doMock('@/stores/board-store', () => ({
    useBoardStore: (selector: (s: { boardState: string }) => unknown) =>
      selector({ boardState: state }),
  }));
}

describe('ActionsNode', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('renders actions-grid container', async () => {
    mockStream({ phase: 'complete', result: fixtures.complete });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid')).toBeInTheDocument();
  });

  it('default state: data-av=false on grid', async () => {
    mockStream({ phase: 'complete', result: fixtures.complete });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-av')).toBe('false');
  });

  it('AV state: data-av=true on grid', async () => {
    mockStream({ phase: 'complete', result: fixtures.antiVirality });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-grid').getAttribute('data-av')).toBe('true');
  });

  it('renders Reshoot teaser in default state when script loads', async () => {
    mockStream({ phase: 'complete', result: { ...fixtures.complete, id: 'analysis-id-stub', optimal_post_window: { day_of_week: 'Tue', hour_range: [18, 21], timezone: 'UTC', reasoning: 'Niche peaks Tue (n=12 videos)', source: 'niche' }, optimal_post_override: null } });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-reshoot-teaser')).toBeInTheDocument();
  });

  it('renders OptimalPost card + ShareSlot placeholder in default state', async () => {
    mockStream({ phase: 'complete', result: { ...fixtures.complete, id: 'analysis-id-stub', optimal_post_window: { day_of_week: 'Tue', hour_range: [18, 21], timezone: 'UTC', reasoning: 'Niche peaks Tue (n=12 videos)', source: 'niche' }, optimal_post_override: null } });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-optimal-post-card')).toBeInTheDocument();
    expect(screen.getByTestId('actions-share-placeholder')).toBeInTheDocument();
  });

  it('B2: AV state renders Optimal + Share in bottom row', async () => {
    mockStream({ phase: 'complete', result: { ...fixtures.antiVirality, id: 'analysis-id-stub', optimal_post_window: { day_of_week: 'Tue', hour_range: [18, 21], timezone: 'UTC', reasoning: 'Niche peaks Tue (n=12 videos)', source: 'niche' }, optimal_post_override: null } });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    // AV bottom row container
    expect(screen.getByTestId('actions-av-bottom-row')).toBeInTheDocument();
    // Both slots in AV bottom row must be present
    expect(screen.getByTestId('actions-optimal-post-card')).toBeInTheDocument();
    expect(screen.getByTestId('actions-share-placeholder')).toBeInTheDocument();
  });

  it('B2: ReshootHero spans col-span-2 in AV state', async () => {
    mockStream({ phase: 'complete', result: { ...fixtures.antiVirality, id: 'analysis-id-stub', optimal_post_window: { day_of_week: 'Tue', hour_range: [18, 21], timezone: 'UTC', reasoning: 'Niche peaks Tue (n=12 videos)', source: 'niche' }, optimal_post_override: null } });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    const hero = screen.getByTestId('actions-reshoot-hero-slot');
    expect(hero.className).toContain('col-span-2');
  });

  it('applies transition style on grid (non-RM)', async () => {
    mockStream({ phase: 'complete', result: fixtures.complete });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    const grid = screen.getByTestId('actions-grid') as HTMLElement;
    expect(grid.style.transition).toContain('grid-template-rows');
    expect(grid.style.transition).toContain('200ms');
  });

  it('Phase 6: pre-complete phase keeps placeholders visible (streaming continuity)', async () => {
    mockStream({ phase: 'analyzing', result: null });
    mockBoardState('streaming');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-reshoot-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('actions-optimal-post-placeholder')).toBeInTheDocument();
  });

  it('Phase 6: AV state renders Reshoot AV chrome (Try this instead headline)', async () => {
    mockStream({
      phase: 'complete',
      result: {
        ...fixtures.antiVirality,
        id: 'aid-1',
        optimal_post_window: {
          day_of_week: 'Tue',
          hour_range: [18, 21],
          timezone: 'UTC',
          reasoning: 'Niche peaks (n=12 videos)',
          source: 'niche',
        },
        optimal_post_override: null,
      },
    });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByText('Try this instead')).toBeInTheDocument();
    expect(screen.getByTestId('actions-reshoot-body')).toBeInTheDocument();
  });

  it('Phase 6: empty-state ScriptResult renders ScriptEmptyState even in default slot', async () => {
    // Re-mock useScript to return empty-state shape
    vi.doMock('@/components/board/actions/script/use-script', () => ({
      useScript: () => ({
        data: {
          is_empty_state: true,
          opening_variants: ['Lead with X', 'Lead with Y'],
          engine_version: 'v3.0.0',
          generated_at: '2026-05-28T00:00:00Z',
        },
        isLoading: false,
        isError: false,
        refetch: () => {},
      }),
    }));
    mockStream({ phase: 'complete', result: { ...fixtures.complete, id: 'analysis-id-stub', optimal_post_window: { day_of_week: 'Tue', hour_range: [18, 21], timezone: 'UTC', reasoning: 'Niche peaks Tue (n=12 videos)', source: 'niche' }, optimal_post_override: null } });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByText('Your video is solid')).toBeInTheDocument();
    expect(screen.getByTestId('script-empty-state')).toBeInTheDocument();
  });
});
