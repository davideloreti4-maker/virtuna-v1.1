/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fixtures } from '../../verdict/__tests__/fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), event: vi.fn() } }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }));
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
}));

// Mock useAnalysisStream + useBoardStore based on actual hook shape.
// Replace `phase` + `result` + `boardState` values per test.
function mockStream(overrides: { phase?: string; result?: unknown } = {}) {
  vi.doMock('@/hooks/queries/use-analysis-stream', () => ({
    useAnalysisStream: () => ({
      phase: overrides.phase ?? 'complete',
      result: overrides.result ?? fixtures.complete,
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

  it('renders ReshootHeroSlot placeholder in default state', async () => {
    mockStream({ phase: 'complete', result: fixtures.complete });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-reshoot-placeholder')).toBeInTheDocument();
  });

  it('renders OptimalPostSlot + ShareSlot placeholders in default state', async () => {
    mockStream({ phase: 'complete', result: fixtures.complete });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-optimal-post-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('actions-share-placeholder')).toBeInTheDocument();
  });

  it('B2: AV state renders Optimal + Similar slot + Share in bottom row (Share MUST be present)', async () => {
    mockStream({ phase: 'complete', result: fixtures.antiVirality });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    // AV bottom row container
    expect(screen.getByTestId('actions-av-bottom-row')).toBeInTheDocument();
    // All three slots in AV bottom row must be present per D-10
    expect(screen.getByTestId('actions-optimal-post-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('actions-similar-videos-slot-av')).toBeInTheDocument();
    expect(screen.getByTestId('actions-share-placeholder')).toBeInTheDocument();
  });

  it('B2: ReshootHero spans col-span-2 in AV state', async () => {
    mockStream({ phase: 'complete', result: fixtures.antiVirality });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    const hero = screen.getByTestId('actions-reshoot-hero-slot');
    expect(hero.className).toContain('col-span-2');
  });

  it('reserves slot for SimilarVideosCard (default state — Plan 5.6 fills)', async () => {
    mockStream({ phase: 'complete', result: fixtures.complete });
    mockBoardState('complete');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-similar-videos-slot')).toBeInTheDocument();
  });

  it('reserves slot for SimilarVideosCard (AV state variant — Plan 5.6 also fills this)', async () => {
    mockStream({ phase: 'complete', result: fixtures.antiVirality });
    mockBoardState('anti-virality');
    const { ActionsNode: Fresh } = await import('../ActionsNode');
    render(<Fresh camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('actions-similar-videos-slot-av')).toBeInTheDocument();
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
});
