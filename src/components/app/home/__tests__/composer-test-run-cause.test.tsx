/** @vitest-environment happy-dom */
/**
 * CAUSE BEATS SKILL ON THE TEST RUN'S FAILURE TURN.
 *
 * `composer-test-run-error.test.tsx` proves the turn EXISTS. This proves it says the right thing,
 * which is a separate question and was separately wrong.
 *
 * The composer is a bespoke error surface: unlike every skill that renders through
 * `thread-turn.tsx`, it hand-writes its own headline and body rather than resolving them with
 * `runErrorCopy`. So it never learned rule 1 of `lib/net/run-failure.ts` — the rule PR #449 paid
 * for in calibrate, where the client overwrote three honest server reasons with "Account not
 * found. Check the handle."
 *
 * Its default body is "A private, deleted or region-locked post will do that." That sentence is a
 * good guess for a /go funnel visitor whose TikTok link really is dead. It is an ACCUSATION AGAINST
 * A FILE THAT IS FINE when the real cause was a dead session or a dropped connection — and it is
 * the sentence the creator spends their next action on, deleting and re-uploading a video that was
 * never the problem.
 *
 * Both causes reach this surface for real: `use-analysis-stream`'s `onError` writes whatever
 * `resolveRunError` returns, which is the offline sentinel on a `TypeError` + `navigator.onLine
 * === false`, and (as of this change) the session sentinel on a 401.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';
import { RUN_FAILURE_SENTINEL } from '@/lib/net/run-failure';

let streamState: { phase: string; error: string | null; quotaError: unknown } = {
  phase: 'idle',
  error: null,
  quotaError: null,
};
const streamStart = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start: streamStart,
    analysisId: null,
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase: streamState.phase,
    error: streamState.error,
    quotaError: streamState.quotaError,
    reconnect: vi.fn(),
    filmstrips: {},
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: { name: 'Davide' }, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
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
  return Promise.resolve({ ok: true, json: async () => ({ messages: [] }) } as Response);
});

import { Composer } from '../composer';

const TIKTOK_URL = 'https://www.tiktok.com/@creator/video/7460113355847362834';

/** Land the way a /go visitor lands — see composer-test-run-error.test.tsx for why run=1 matters. */
function landFromFunnel() {
  window.history.replaceState(
    {},
    '',
    `/home?v=Test&seed=${encodeURIComponent(TIKTOK_URL)}&run=1`,
  );
}

beforeEach(() => {
  fetchMock.mockClear();
  streamStart.mockClear();
  streamState = { phase: 'idle', error: null, quotaError: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = fetchMock;
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/home');
});

/** The accusation the default copy makes. No cause may ever let this reach the glass. */
const ACCUSES_THE_POST = /private, deleted or region-locked/;

describe('the Test run died because the session expired', () => {
  beforeEach(() => {
    streamState = { phase: 'error', error: RUN_FAILURE_SENTINEL.session, quotaError: null };
  });

  it('says the session ended', async () => {
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(screen.getByText('You’ve been signed out.')).toBeTruthy());
  });

  it('does not accuse the video', async () => {
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(screen.getByText('You’ve been signed out.')).toBeTruthy());
    expect(screen.queryByText(ACCUSES_THE_POST)).toBeNull();
    expect(screen.queryByText('Couldn’t finish that read.')).toBeNull();
  });

  it('keeps the promise that nothing was charged — the 401 fires above the credit gate', async () => {
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(screen.getByText(/nothing was charged/)).toBeTruthy());
  });

  /**
   * The retry stays — the run really is free to repeat — but it must name the precondition. A
   * button reading "Retry the video test" invites a tap that earns the same 401 forever, which is
   * the futile-retry loop `CreditWallRefusal` exists to prevent.
   */
  it('labels the retry with what has to happen first', async () => {
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry after signing in' })).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Retry the video test' })).toBeNull();
  });
});

/**
 * The same surface, the same defect, a cause that already shipped. `use-analysis-stream` has
 * written the offline sentinel since the offline half merged (#454) — this block has been
 * accusing the post of being region-locked whenever the connection dropped, the whole time.
 */
describe('the Test run died because the device went offline', () => {
  beforeEach(() => {
    streamState = { phase: 'error', error: RUN_FAILURE_SENTINEL.offline, quotaError: null };
  });

  it('says the device is offline and does not accuse the video', async () => {
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(screen.getByText('You’re offline.')).toBeTruthy());
    expect(screen.queryByText(ACCUSES_THE_POST)).toBeNull();
  });
});

/**
 * The regression rail. An ordinary engine failure has NO nameable cause, and there the bespoke
 * copy is exactly right — a dead TikTok link really is the likeliest explanation for a /go
 * visitor. "Always resolve by cause" must not flatten this into the generic run copy.
 */
describe('an unexplained failure keeps the skill copy', () => {
  it('still names the likely TikTok cause, and still offers the video retry', async () => {
    streamState = { phase: 'error', error: 'Analysis failed', quotaError: null };
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(screen.getByText('Couldn’t finish that read.')).toBeTruthy());
    expect(screen.getByText(ACCUSES_THE_POST)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry the video test' })).toBeTruthy();
  });
});
