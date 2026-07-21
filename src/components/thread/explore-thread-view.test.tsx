/** @vitest-environment happy-dom */
/**
 * ExploreThreadView — behaviour lock (Phase 11, Plan 06, Task 1 — EXPLORE-04/02).
 *
 * ⚠️ The idle quick-action contract MOVED. Explore no longer owns an idle state — its
 * three starting points live in the ONE starter now (THE STARTER CONTRACT), and their
 * locks (LOCKED copy · the tracked-accounts degrade · never-auto-fire · tap→pull) moved
 * with them to `app/home/__tests__/home-starter.test.tsx`. What stays locked HERE is the
 * inverse: this view must NEVER render a quick-action card again, in any state. That is
 * the guard against the drift growing back.
 *
 * Also locked here:
 *  - The grid carries NO fabricated persona quote / reaction (D-02 — the real reaction
 *    is lazy, on the reused remix-card's LensTrigger downstream).
 *  - The remix pending state clears on BOTH the success and failure paths (WR-01).
 *  - The error state renders SkillRunError with tap-to-retry.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExploreThreadView } from './explore-thread-view';
import type { ExploreThreadViewProps } from './explore-thread-view';
import type { OutlierGridBlock } from '@/lib/tools/blocks';

afterEach(cleanup);

// An outlier tile mounts SaveAffordance (→ useSaveItem → useQueryClient), so any render
// that includes a tile must sit under a QueryClientProvider. (PR #79 added the Save shelf
// to the tile; tile-rendering tests need this wrapper.)
function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function baseProps(overrides: Partial<ExploreThreadViewProps> = {}): ExploreThreadViewProps {
  return {
    persistedBlocks: [],
    streamingBlocks: [],
    stages: [],
    isStreaming: false,
    error: null,
    platform: 'tiktok',
    ...overrides,
  };
}

describe('ExploreThreadView — owns NO idle state (THE STARTER CONTRACT)', () => {
  it('renders no quick-action card when idle — the starter owns that now', () => {
    render(<ExploreThreadView {...baseProps()} />);

    // The three starting points belong to HomeStarter. If these ever come back, Explore
    // has re-grown its bespoke idle grid and the four-empty-states drift is back with it.
    expect(
      screen.queryByRole('button', { name: 'Top performers in my niche today' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'What competitors shipped' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Surprise me' }),
    ).not.toBeInTheDocument();
    // …and no idle prose lede either.
    expect(
      screen.queryByText('Find what your audience would actually bite on.'),
    ).not.toBeInTheDocument();
  });
});

describe('ExploreThreadView — honesty spine (D-02)', () => {
  it('renders no fabricated persona quote / blockquote on the idle grid', () => {
    const { container } = render(<ExploreThreadView {...baseProps()} />);
    // The real reaction is lazy (the reused remix-card LensTrigger downstream) —
    // this view must add NO reaction UI to the grid.
    expect(container.querySelector('blockquote')).toBeNull();
  });

  it('shows the no-fake-% loading lead line while streaming, not a quick-action grid', () => {
    render(
      <ExploreThreadView
        {...baseProps({
          isStreaming: true,
          stages: [{ name: 'Pulling outliers', status: 'active' }],
        })}
      />,
    );

    // stages>0 → the consolidated ProgressChecklist stepper (honest, no fake %),
    // not the ThreadLoadingSkeleton caption (that path is stages.length === 0).
    expect(screen.getByLabelText('Skill run progress')).toBeInTheDocument();
    expect(screen.getByText('Pulling outliers')).toBeInTheDocument();
    // Idle quick-actions are gone once a pull is in flight.
    expect(
      screen.queryByRole('button', { name: 'Top performers in my niche today' }),
    ).not.toBeInTheDocument();
  });
});

// ── WR-01: remix pending-state must clear on a SUCCESSFUL remix ─────────────────

/** A minimal schema-valid outlier-grid block with one tile for the remix-CTA tests. */
function oneTileBlock(): OutlierGridBlock {
  return {
    type: 'outlier-grid',
    props: {
      mode: 'niche',
      tiles: [
        {
          platformVideoId: 'vid_1',
          videoUrl: 'https://www.tiktok.com/@creator/video/123',
          caption: 'a tile',
          views: 100_000,
          likes: 8_000,
          comments: 400,
          shares: 600,
          saves: 1_200,
          durationSeconds: 22,
          postedAt: new Date().toISOString(),
          multiplier: 3.2,
          baselineLabel: 'vs niche',
          source: 'fitness',
          fit: null,
          trackable: false,
        },
      ],
    },
  };
}

describe('ExploreThreadView — remix pending state (WR-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears the Remixing… pending state after a SUCCESSFUL remix so the tile re-enables', async () => {
    // Mock the discover→remix POST (/api/tools/remix/run) to succeed.
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const onThreadReload = vi.fn();
    renderWithClient(
      <ExploreThreadView
        {...baseProps({
          persistedBlocks: [oneTileBlock()],
          onThreadReload,
        })}
      />,
    );

    const remix = screen.getByRole('button', { name: 'Remix this outlier into a Read' });
    expect(remix).toBeEnabled();
    expect(remix).toHaveTextContent('Remix →');

    fireEvent.click(remix);

    // While the fetch is in flight the CTA shows the pending label and is disabled.
    expect(remix).toHaveTextContent('Remixing…');
    expect(remix).toBeDisabled();

    // After the successful remix resolves, the success path reloads the thread AND the
    // pending id is cleared (finally) — the tile re-enables instead of sticking forever.
    await waitFor(() => expect(onThreadReload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(remix).toBeEnabled());
    expect(remix).toHaveTextContent('Remix →');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tools/remix/run',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('clears the pending state on a FAILED remix too (no reload, tile re-enables for retry)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), { status: 502 }),
    );

    const onThreadReload = vi.fn();
    renderWithClient(
      <ExploreThreadView
        {...baseProps({ persistedBlocks: [oneTileBlock()], onThreadReload })}
      />,
    );

    const remix = screen.getByRole('button', { name: 'Remix this outlier into a Read' });
    fireEvent.click(remix);
    expect(remix).toBeDisabled();

    await waitFor(() => expect(remix).toBeEnabled());
    expect(remix).toHaveTextContent('Remix →');
    expect(onThreadReload).not.toHaveBeenCalled();
  });
});

describe('ExploreThreadView — error state', () => {
  it('renders the SkillRunError with a tap-to-retry when error is set and not streaming', () => {
    const onRetry = vi.fn();
    render(
      <ExploreThreadView
        {...baseProps({ error: 'Couldn\'t reach that source.', onRetry })}
      />,
    );

    expect(screen.getByText('Couldn’t reach that source.')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry the Explore pull' });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    // The error state replaces idle — no quick-action cards.
    expect(
      screen.queryByRole('button', { name: 'Surprise me' }),
    ).not.toBeInTheDocument();
  });
});
