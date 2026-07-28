/** @vitest-environment happy-dom */
/**
 * Explore, on the ONE turn renderer (was explore-thread-view.test.tsx).
 *
 * ⚠️ The idle quick-action contract MOVED long ago: Explore's three starting points live in the
 * ONE starter (THE STARTER CONTRACT) and their locks moved with them to
 * `app/home/__tests__/home-starter.test.tsx`. The inverse lock — a skill surface must NEVER
 * re-grow a bespoke idle grid — is now structural rather than tested: <ThreadTurn> renders TURNS,
 * and a turn with no blocks and no run renders nothing at all. There is no idle branch to guard.
 *
 * What stays locked here:
 *  - The grid carries NO fabricated persona quote / reaction (D-02 — the real reaction is lazy, on
 *    the reused remix-card's LensTrigger downstream).
 *  - The remix pending state clears on BOTH the success and failure paths (WR-01). Those handlers
 *    moved out of the old view into `useOutlierGridActions` + OutlierGridActionsContext (which is
 *    what let Explore join the unified stream at all), so this now exercises the real moved code
 *    through the real block renderer.
 *  - The error state renders SkillRunError with Explore's OWN copy and tap-to-retry — the unified
 *    renderer must stay 1:1 with the per-skill views, not merely uniform.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThreadTurn } from '@/components/thread/thread-turn';
import { OutlierGridActionsContext } from '@/lib/hook-test-context';
import { useOutlierGridActions } from '@/components/app/home/use-outlier-grid-actions';
import type { OutlierGridBlock } from '@/lib/tools/blocks';

afterEach(cleanup);

// An outlier tile mounts SaveAffordance (→ useSaveItem → useQueryClient), so any render that
// includes a tile must sit under a QueryClientProvider.
function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

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

/**
 * The production wiring: the composer owns the actions hook and provides it at the thread root, so
 * a grid stays live whether it just streamed in or came back from the database.
 */
function ExploreTurnHarness({
  blocks,
  onThreadReload,
  error,
  onRetry,
  isStreaming = false,
  stages = [],
}: {
  blocks: unknown[];
  onThreadReload?: () => void;
  error?: string | null;
  onRetry?: () => void;
  isStreaming?: boolean;
  stages?: { name: string; status: 'active' | 'done' | 'pending' }[];
}) {
  const actions = useOutlierGridActions('tiktok', onThreadReload);
  return (
    <OutlierGridActionsContext.Provider value={actions}>
      <ThreadTurn
        userTurn="what's working right now"
        blocks={blocks}
        live={{
          skill: 'explore',
          isStreaming,
          stages,
          error: error ?? null,
          onRetry,
          audienceLabel: 'General',
          platform: 'tiktok',
        }}
      />
    </OutlierGridActionsContext.Provider>
  );
}

describe('Explore turn — honesty spine (D-02)', () => {
  it('renders no fabricated persona quote / blockquote on the grid', () => {
    const { container } = renderWithClient(<ExploreTurnHarness blocks={[oneTileBlock()]} />);
    // The real reaction is lazy (the reused remix-card LensTrigger downstream) — the grid must
    // add NO reaction UI of its own.
    expect(container.querySelector('blockquote')).toBeNull();
  });

  it('shows the honest stage spine while streaming — no fake %', () => {
    renderWithClient(
      <ExploreTurnHarness
        blocks={[]}
        isStreaming
        stages={[{ name: 'Pulling outliers', status: 'active' }]}
      />,
    );

    expect(screen.getByLabelText('Skill run progress')).toBeInTheDocument();
    expect(screen.getByText('Pulling outliers')).toBeInTheDocument();
  });
});

describe('Explore turn — remix pending state (WR-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears the Remixing… pending state after a SUCCESSFUL remix so the tile re-enables', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const onThreadReload = vi.fn();
    renderWithClient(
      <ExploreTurnHarness blocks={[oneTileBlock()]} onThreadReload={onThreadReload} />,
    );

    const remix = screen.getByRole('button', { name: 'Remix this outlier into a Read' });
    expect(remix).toBeEnabled();
    expect(remix).toHaveTextContent('Remix →');

    fireEvent.click(remix);

    // While the fetch is in flight the CTA shows the pending label and is disabled.
    expect(remix).toHaveTextContent('Remixing…');
    expect(remix).toBeDisabled();

    // After the successful remix resolves, the success path reloads the thread AND the pending id
    // is cleared (finally) — the tile re-enables instead of sticking forever.
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
      <ExploreTurnHarness blocks={[oneTileBlock()]} onThreadReload={onThreadReload} />,
    );

    const remix = screen.getByRole('button', { name: 'Remix this outlier into a Read' });
    fireEvent.click(remix);
    expect(remix).toBeDisabled();

    await waitFor(() => expect(remix).toBeEnabled());
    expect(remix).toHaveTextContent('Remix →');
    expect(onThreadReload).not.toHaveBeenCalled();
  });
});

describe('Explore turn — error state', () => {
  it('renders the SkillRunError with Explore’s own copy and a tap-to-retry', () => {
    const onRetry = vi.fn();
    renderWithClient(
      <ExploreTurnHarness blocks={[]} error="Couldn't reach that source." onRetry={onRetry} />,
    );

    // Explore fails on an EXTERNAL fetch, so the generic "the generation or SIM-1 pass dropped
    // out" copy would be a lie. The unified renderer keeps the per-skill wording.
    expect(screen.getByText('Couldn’t reach that source.')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry the Explore pull' });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
