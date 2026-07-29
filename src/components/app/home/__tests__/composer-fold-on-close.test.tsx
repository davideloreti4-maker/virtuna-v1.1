/** @vitest-environment happy-dom */
/**
 * THE FOLD WAITS FOR THE STREAM TO CLOSE, NOT FOR `done` (2026-07-29).
 *
 * Every generative route emits `done` BEFORE its closing line — S2, so the composer unblocks while
 * a second model call writes the outro — then persists that line as a trailing markdown message and
 * only THEN closes the SSE. A fold that fires on `done` therefore reloads history a beat too early
 * to ever contain the outro, which is exactly why this used to cost a SECOND
 * `GET /api/threads/open` per run to collect one sentence.
 *
 * What this holds shut, in both directions:
 *
 *  - folding on `done` alone (the regression) — the run is done, the stream is still open, and
 *    nothing may reload yet;
 *  - never folding at all — once the stream closes the reload must happen, exactly once.
 *
 * Counting `/api/threads/open` is the assertion rather than a spy on some internal, because the
 * whole point of the change is the NUMBER OF ROUND TRIPS. A version that folds correctly but still
 * schedules the old second reload would pass a behavioural test and fail this one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

/** The hooks stream's state, swapped between renders to walk done → closed. */
let hooksState: Record<string, unknown>;

const resetHooksState = () => {
  hooksState = {
    streamingCards: [],
    statusMessage: null,
    isStreaming: false,
    error: null,
    isDone: false,
    isClosed: false,
    stages: [{ name: 'Ran your audience', status: 'done' }],
    followupText: null,
    warnings: [],
    outliersAvailable: false,
    start: vi.fn(),
    findOutliers: vi.fn(),
    startRefine: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    toBlocks: () => [{ type: 'markdown', props: { text: 'a finished hook run' } }],
  };
};
resetHooksState();

vi.mock('@/hooks/queries/use-hooks-stream', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, useHooksStream: () => hooksState };
});

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: { name: 'Davide' }, isLoading: false }),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
  }),
}));

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/threads/open')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ threadId: 't1', messages: [], simSeals: {} }),
    } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
});

const openCalls = () =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/threads/open')).length;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  resetHooksState();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('folding a finished run into the thread', () => {
  it('does not reload while the run is done but the stream is still open', async () => {
    const { Composer } = await import('../composer');
    const { rerender } = renderWithClient(<Composer />);

    // Let any mount-time thread load settle, then take that as the baseline.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const baseline = openCalls();

    // `done` arrives — cards finished, outro still being written server-side.
    hooksState = { ...hooksState, isDone: true, isClosed: false };
    rerender(<Composer />);

    // Give the effects several ticks. Nothing may reload: the closing line is not on disk yet, so
    // a reload here would fetch a turn missing its outro and force a second one to collect it.
    await new Promise((r) => setTimeout(r, 50));
    expect(openCalls()).toBe(baseline);
  });

  it('reloads exactly once when the stream closes', async () => {
    const { Composer } = await import('../composer');
    const { rerender } = renderWithClient(<Composer />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const baseline = openCalls();

    hooksState = { ...hooksState, isDone: true, isClosed: false };
    rerender(<Composer />);
    await new Promise((r) => setTimeout(r, 20));

    // The route persisted its closing line and closed the stream.
    hooksState = { ...hooksState, isDone: true, isClosed: true, followupText: 'Hook #1 wins.' };
    rerender(<Composer />);

    await waitFor(() => expect(openCalls()).toBe(baseline + 1));

    // And it stays one. The old shape scheduled a second reload off the follow-up text landing on
    // an already-folded stream; that effect is gone, and this is what would notice it coming back.
    await new Promise((r) => setTimeout(r, 60));
    expect(openCalls()).toBe(baseline + 1);
  });
});
