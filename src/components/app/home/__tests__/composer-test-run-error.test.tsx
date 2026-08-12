/** @vitest-environment happy-dom */
/**
 * The Test run's FAILURE turn (2026-07-27, session 9).
 *
 * Every other skill renders <SkillRunError> off its stream's `error`. Test never did: the
 * composer read `phase`/`analysisId`/`isStreaming`/`quotaError` and dropped `stream.error`,
 * so a dead run just unmounted the progress spine — the echoed link and the whole in-flight
 * turn vanished and the visitor got an empty composer with no word of what happened. That is
 * the /go funnel's own failure path (a private, deleted or region-locked post is an ordinary
 * TikTok outcome), so the silence landed on exactly the visitor the page exists to convert.
 *
 * The three cases that keep it honest:
 *   - a dead run says so, and offers a free retry (billing only happens in /api/analyze's
 *     success branch, so "nothing was charged" is true);
 *   - the quota 402 does NOT get an inline block — it sets `quotaError` too, and the wall
 *     dialog owns that refusal;
 *   - the polling-ceiling timeout is the ONE error where the pipeline may still be alive
 *     server-side, so it must NOT offer a retry that would start a second billed run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';
import { STREAM_TIMEOUT_ERROR } from '@/lib/engine/stream-errors';

// The stream's reported state, swapped per test before render.
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

/**
 * Land the way a /go visitor actually lands: the Seam-4 launch URL WITH `run=1`, so the
 * auto-run fires and `captureUserTurn` records the echoed link. That turn is what makes
 * `hasConversationContent` true — and under AMBIENT_V2 the thread region only renders at
 * all once it is (otherwise the v2 Start grid holds the scroll). An earlier version of
 * this file armed the verb WITHOUT run=1 and passed flags-OFF while asserting nothing
 * flags-ON: the composer was rendering the Start grid, not the failure turn.
 */
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

describe("the Test run's failure turn", () => {
  it('a dead run says what happened and offers a free retry', async () => {
    streamState = { phase: 'error', error: 'Analysis failed', quotaError: null };
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(screen.getByText('Couldn’t finish that read.')).toBeTruthy());
    expect(screen.getByText(/nothing was charged/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry the video test' })).toBeTruthy();
  });

  it('an idle stream renders NO failure turn (a clean run is untouched)', async () => {
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText('Couldn’t finish that read.')).toBeNull();
  });

  it('the quota 402 gets NO inline block — the wall dialog owns that refusal', async () => {
    streamState = {
      phase: 'error',
      error: 'Your free test is used up.',
      quotaError: {
        error: 'credit_quota_exceeded',
        message: 'Your free test is used up.',
        tier: 'free',
        used: 10,
        limit: 10,
        inTrial: false,
        reason: 'allowance',
        cost: 10,
      },
    };
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText('Couldn’t finish that read.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry the video test' })).toBeNull();
  });

  /**
   * THE ONE-SHOT'S SHARPEST EDGE (Lane 2 step 5, 2026-07-28).
   *
   * A dispatched run disarms the composer immediately — `activeTool` is back to chat long
   * before this failure turn exists. So a retry wired as a bare `handleSubmit()` would read
   * the CURRENT arm and send the failed video's URL as a chat message, under a button that
   * says "Retry the video test". Green suite, plausible UI, wrong run: the creator would be
   * told their video was being re-read while a text model answered a question about a link.
   *
   * The fix is `handleSubmit("test")` — the tool passed explicitly, not inferred. This asserts
   * the OUTCOME (a real video analysis starts), not the call shape, so it stays honest if the
   * plumbing is ever refactored.
   */
  it('the retry re-runs the VIDEO TEST, not a chat turn — the arm is long gone by then', async () => {
    streamState = { phase: 'error', error: 'Analysis failed', quotaError: null };
    landFromFunnel();
    renderWithClient(<Composer />);

    const retry = await waitFor(() =>
      screen.getByRole('button', { name: 'Retry the video test' }),
    );
    streamStart.mockClear();
    fetchMock.mockClear();
    retry.click();

    // The video pipeline is what re-runs, on the same URL.
    await waitFor(() => expect(streamStart).toHaveBeenCalledTimes(1));
    expect(streamStart).toHaveBeenCalledWith(
      expect.objectContaining({ input_mode: 'tiktok_url', tiktok_url: TIKTOK_URL }),
    );
    // …and emphatically NOT the chat route, which is what the disarmed composer would send.
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/chat')),
    ).toBe(false);
  });

  it('the polling-ceiling timeout offers NO retry — the run may still be billing', async () => {
    streamState = { phase: 'error', error: STREAM_TIMEOUT_ERROR, quotaError: null };
    landFromFunnel();
    renderWithClient(<Composer />);

    await waitFor(() =>
      expect(screen.getByText('This read is taking longer than usual.')).toBeTruthy(),
    );
    expect(screen.queryByRole('button', { name: 'Retry the video test' })).toBeNull();
    expect(screen.queryByText(/nothing was charged/)).toBeNull();
  });
});
