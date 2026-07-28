/** @vitest-environment happy-dom */
/**
 * THE STOP DISC MUST NOT SUBMIT (measured live 2026-07-28, Lane 1 walk-through).
 *
 * Lane 1 made the cream send disc double as the stop control: one element, `type` swapped on
 * `isAnyStreaming`. That is not enough, and the gap costs real money.
 *
 * Form submission is the CLICK's default action, and the default action is dispatched AFTER React
 * has flushed a discrete event's state updates. So the sequence on a mid-run Stop is:
 *
 *   1. onClick → stopActive() → the stream's AbortController fires, isStreaming goes false
 *   2. React flushes synchronously and re-renders THE SAME DOM NODE to type="submit"
 *   3. the browser now runs the click's default action against a submit button → form submits
 *
 * Observed on a production build: one click on Stop aborted the run and fired a SECOND billed
 * POST /api/tools/hooks within 100ms, and the aborted run's partial cards merged with the second
 * run's into a single ten-card turn in the persisted thread.
 *
 * The fix is to cancel the default action inside the handler, which holds whatever `type` the node
 * carries by the time the default action is dispatched. This test asserts that cancellation
 * directly, because the render-timing race itself cannot be staged in jsdom/happy-dom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

// Hooks is mid-stream for the whole file — that is the only state where the disc is a Stop.
const hooksStop = vi.fn();
vi.mock('@/hooks/queries/use-hooks-stream', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    useHooksStream: () => ({
      streamingCards: [],
      statusMessage: null,
      isStreaming: true,
      error: null,
      isDone: false,
      stages: [{ name: 'Ran your audience', status: 'active' }],
      followupText: null,
      warnings: [],
      outliersAvailable: false,
      start: vi.fn(),
      findOutliers: vi.fn(),
      startRefine: vi.fn(),
      stop: hooksStop,
      reset: vi.fn(),
      toBlocks: () => [],
    }),
  };
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
    return Promise.resolve({ ok: true, json: async () => ({ threadId: 't1', messages: [], simSeals: {} }) } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
});

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  hooksStop.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the send disc while a run streams', () => {
  it('cancels the click default action, so aborting can never submit a second run', async () => {
    const { Composer } = await import('../composer');
    renderWithClient(<Composer />);

    const disc = await waitFor(() => screen.getByLabelText('Stop the run'));

    // A submit event on the form is what a second billed run rides in on.
    const form = disc.closest('form');
    expect(form).not.toBeNull();
    const onSubmit = vi.fn();
    form!.addEventListener('submit', onSubmit);

    // fireEvent.click dispatches a real cancelable MouseEvent and returns false when a handler
    // cancelled it — which is exactly the assertion, and it goes red the moment preventDefault
    // is dropped from the stop branch.
    const notCancelled = fireEvent.click(disc);

    expect(notCancelled).toBe(false); // i.e. defaultPrevented === true
    expect(hooksStop).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
