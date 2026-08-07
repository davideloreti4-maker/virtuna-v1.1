/** @vitest-environment happy-dom */
/**
 * THE SEND DISC IS GATED ON THE CONNECTION — BUT STOP NEVER IS.
 *
 * One element does both jobs: it is Send until a run starts and Stop while one is in flight
 * (composer.tsx, `isAnyStreaming ? … : …`). So the offline gate has to fold into the NON-streaming
 * arm only. Disabling Stop at the moment the connection drops would take away the control at
 * exactly the moment the user most wants it — and, per composer-stop-disc.test.tsx, Stop is also
 * the control that prevents a second billed run.
 *
 * Harness mirrors composer-stop-disc.test.tsx, which is the file that already mounts the whole
 * composer and drives this same button through its streaming state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

/** Flipped per-test; the mocked hook reads it at render time. */
let hooksStreaming = false;

vi.mock('@/hooks/queries/use-hooks-stream', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    useHooksStream: () => ({
      streamingCards: [],
      statusMessage: null,
      get isStreaming() {
        return hooksStreaming;
      },
      error: null,
      isDone: false,
      stages: hooksStreaming ? [{ name: 'Ran your audience', status: 'active' }] : [],
      followupText: null,
      warnings: [],
      outliersAvailable: false,
      start: vi.fn(),
      findOutliers: vi.fn(),
      startRefine: vi.fn(),
      stop: vi.fn(),
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
    return Promise.resolve({
      ok: true,
      json: async () => ({ threadId: 't1', messages: [], simSeals: {} }),
    } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  hooksStreaming = false;
  setOnLine(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setOnLine(true);
});

/** The one disc, whichever job it is doing. */
async function disc() {
  return waitFor(() => {
    const el = document.querySelector('button[aria-label]:not([aria-label=""])');
    const found = Array.from(document.querySelectorAll('button')).find((b) =>
      /stop the run|generate|send message|simulate|read /i.test(b.getAttribute('aria-label') ?? ''),
    );
    if (!found) throw new Error(`no send/stop disc yet (saw ${el?.getAttribute('aria-label')})`);
    return found as HTMLButtonElement;
  });
}

describe('the send disc and the connection', () => {
  it('is disabled while offline, with a submittable draft', async () => {
    const { Composer } = await import('../composer');
    setOnLine(false);
    renderWithClient(<Composer />);

    const box = await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(box, { target: { value: 'a hook about compound interest' } });

    expect((await disc()).disabled).toBe(true);
  });

  it('enables the moment the connection returns — no remount', async () => {
    const { Composer } = await import('../composer');
    setOnLine(false);
    renderWithClient(<Composer />);

    const box = await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(box, { target: { value: 'a hook about compound interest' } });
    expect((await disc()).disabled).toBe(true);

    await act(async () => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });

    expect((await disc()).disabled).toBe(false);
  });

  it('NEVER disables Stop while a run streams — that is when you most want it', async () => {
    const { Composer } = await import('../composer');
    hooksStreaming = true;
    setOnLine(false);
    renderWithClient(<Composer />);

    const stop = await waitFor(() => screen.getByLabelText('Stop the run'));
    expect((stop as HTMLButtonElement).disabled).toBe(false);
  });
});
