/** @vitest-environment happy-dom */
/**
 * The funnel-return inlet (ONBOARDING-FUNNEL-DESIGN.md §0b② — session 7).
 *
 * After the claim step's OAuth round-trip the visitor lands back on /home with
 * every seal open — but nothing used to re-open the verdict they paid for. The
 * inlet arms on `?claimed=1` (the claim redirect) or `?checkout=success`
 * (Whop's funnel redirect_url), strips the marker immediately (a refresh must
 * never re-celebrate), and once the thread's seals rehydrate it opens the
 * tested video's drill — plus an "Account linked" toast on the claimed path
 * only (the checkout path re-opens a still-sealed wall whose own CTA already
 * says "Finish unlocking").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start: vi.fn(),
    analysisId: null,
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase: 'idle',
    error: null,
    reconnect: vi.fn(),
    filmstrips: {},
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: { name: 'Davide' }, isLoading: false }),
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn(), replace }),
}));

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
  }),
}));

// /api/threads/open answers with ONE video seal in the SEALED wire form
// (verdict-seal.ts `SealedSimSeal`) — the shape a checkout-return visitor
// actually has, and the only wire shape without a full depth payload. The
// inlet's filter and simulateVideoInRoom's guard both key on `.video`.
const SEALED_VIDEO_SEAL = {
  sealed: true,
  at: '2026-07-27T00:00:00.000Z',
  video: { analysisId: 'analysis-1', craftScore: 77 },
};
let openThreadBody: Record<string, unknown> = {
  threadId: 't1',
  messages: [],
  simSeals: { 'analysis-1': SEALED_VIDEO_SEAL },
};
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/threads/open')) {
    return Promise.resolve({ ok: true, json: async () => openThreadBody } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({ messages: [] }) } as Response);
});

import { Composer } from '../composer';

function setSearch(search: string) {
  window.history.replaceState({}, '', `/home${search}`);
}

beforeEach(() => {
  replace.mockClear();
  fetchMock.mockClear();
  openThreadBody = {
    threadId: 't1',
    messages: [],
    simSeals: { 'analysis-1': SEALED_VIDEO_SEAL },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = fetchMock;
});

afterEach(() => {
  cleanup();
  setSearch('');
});

describe('the funnel-return inlet', () => {
  it('?claimed=1 — strips the marker, then celebrates once the seals hydrate', async () => {
    setSearch('?claimed=1');
    renderWithClient(<Composer />);

    // The marker is stripped immediately (refresh must never re-celebrate).
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/home', { scroll: false }),
    );

    // Once /api/threads/open lands the video seal, the claimed path toasts.
    await waitFor(() => expect(screen.getByText('Account linked')).toBeTruthy());
  });

  it('?checkout=success — strips the marker and re-opens the drill WITHOUT the linked toast', async () => {
    setSearch('?checkout=success');
    renderWithClient(<Composer />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/home', { scroll: false }),
    );
    // Give the seals effect the same window the claimed test needed.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Account linked')).toBeNull();
  });

  it('no marker — no strip, no toast (a plain /home visit is untouched)', async () => {
    setSearch('');
    renderWithClient(<Composer />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(replace).not.toHaveBeenCalledWith('/home', { scroll: false });
    expect(screen.queryByText('Account linked')).toBeNull();
  });

  it('a thread with NO video seal leaves the arm to expire silently — no toast, marker still stripped', async () => {
    openThreadBody = { threadId: 't1', messages: [], simSeals: {} };
    setSearch('?claimed=1');
    renderWithClient(<Composer />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/home', { scroll: false }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Account linked')).toBeNull();
  });
});
