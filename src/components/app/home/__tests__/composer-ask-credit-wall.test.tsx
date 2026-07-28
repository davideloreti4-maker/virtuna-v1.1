/** @vitest-environment happy-dom */
/**
 * "ASK THE ROOM" IS A PAID ACTION NOW — and its 402 must raise the wall, not an error row.
 *
 * `/api/tools/react` was free until 2026-07-28; it is priced at 1 credit under its own `react`
 * key. The `ask` verb is one of its two callers.
 *
 * ⚠️ Why the wall is not a nicety here. A failed ask records `error: true`, and the ONLY consumer
 * of the ask trail filters errored asks out (`audience-presence.tsx:417`). So a refused ask
 * renders NOTHING — the field clears, the room says nothing, and the creator is left to conclude
 * the button is broken. Verified, not assumed: the second test below asserts that silence
 * directly. The dialog is the only feedback a 402 produces.
 *
 * (This is NOT the stream hooks' CreditWallRefusal case, where an error card genuinely drew a
 * futile retry underneath the modal. Different failure, same 402.)
 *
 * Nobody sees this today (BILLING_ENFORCE_QUOTA is off in production), which is precisely why it
 * needs a test rather than a walk-through — the failure is invisible until the flag flips.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';
import { CREDIT_WALL_EVENT } from '@/lib/billing/credit-wall';
import { CREDIT_QUOTA_EXCEEDED } from '@/lib/billing/quota-error';

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

/** The exact 402 body the route's `quotaRefusalBody` writes — the only shape the wall recognises. */
const QUOTA_402 = {
  error: CREDIT_QUOTA_EXCEEDED,
  message: 'That needs 1 credits — you have 0 credits left this month.',
  tier: 'starter',
  used: 500,
  limit: 500,
  inTrial: false,
  reason: 'allowance',
  cost: 1,
};

let reactStatus = 402;
let reactBody: unknown = QUOTA_402;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/threads/open')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ threadId: 't1', messages: [], simSeals: {} }),
    } as Response);
  }
  if (url.includes('/api/tools/react')) {
    return Promise.resolve({
      ok: reactStatus < 400,
      status: reactStatus,
      json: async () => reactBody,
    } as Response);
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
});

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  reactStatus = 402;
  reactBody = QUOTA_402;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Arm the `ask` verb through the skill menu, then send a thought. */
async function askTheRoom(thought: string) {
  const { Composer } = await import('../composer');
  renderWithClient(<Composer />);

  fireEvent.click(await waitFor(() => screen.getByRole('button', { name: /skill:/i })));
  fireEvent.click(await waitFor(() => screen.getByRole('menuitemradio', { name: /ask the room/i })));

  const field = await waitFor(() => screen.getByRole('textbox'));
  fireEvent.change(field, { target: { value: thought } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

describe('the ask verb against a refused credit gate', () => {
  it('raises the ONE wall dialog and draws no retryable error row under it', async () => {
    const walls: unknown[] = [];
    const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
    window.addEventListener(CREDIT_WALL_EVENT, onWall);

    try {
      await askTheRoom('does this hook land?');

      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/react'))).toBe(true),
      );

      // The wall went up exactly once, carrying the SERVER's sentence — never a slug, never our
      // own copy. This is the whole user-visible outcome of a refused ask.
      await waitFor(() => expect(walls).toHaveLength(1));
      expect((walls[0] as { message: string }).message).toBe(QUOTA_402.message);
    } finally {
      window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    }
  });

  it('a NON-credit failure raises no wall — and proves how silent a bare failure is', async () => {
    reactStatus = 502;
    reactBody = { error: 'reaction_failed' };

    const walls: unknown[] = [];
    const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
    window.addEventListener(CREDIT_WALL_EVENT, onWall);

    try {
      await askTheRoom('does this hook land?');
      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/react'))).toBe(true),
      );
      // A 502 is not a refusal — the wall is for 402s only.
      expect(walls).toHaveLength(0);

      // And this is the finding that makes the wall load-bearing above: a failed ask leaves NO
      // trace on screen. The thought does not come back as a row, errored or otherwise, because
      // the ask trail filters `error: true` out. Whatever feedback a 402 gives, the dialog is it.
      await waitFor(() => expect(screen.queryByText('does this hook land?')).toBeNull());
    } finally {
      window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    }
  });
});
