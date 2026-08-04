/** @vitest-environment happy-dom */
/**
 * /welcome must not mistake a BUILT-IN audience for the user's own (2026-08-04).
 *
 * WHAT SHIPPED BROKEN. The page has a recovery branch: if a previous, interrupted attempt
 * already produced a calibrated audience, finish rather than spend a second Apify scrape
 * rebuilding it. It asked `/api/audiences` and adopted anything matching
 * `!is_general && personas.length > 0`.
 *
 * But `/api/audiences` does not return only the user's rows. It also serves five virtual
 * constants that never touch the DB — GENERAL_AUDIENCE, two PRESET_AUDIENCES and two
 * GENERAL_TEMPLATES — and the templates ship a runnable persona panel BY DESIGN while
 * being `is_general: false`. So the predicate matched "Analyst Panel" for an account that
 * owned nothing, and every new signup on numenmachines.com was stamped
 * `onboarding_completed_at` ~9s after creating its account and dropped on /home with
 * `tiktok_handle: null` and no calibrated audience — the exact uncalibrated state the whole
 * flow exists to prevent. Confirmed live: a fresh account's `audiences` table held 0 rows
 * while `/api/audiences` returned 5.
 *
 * `personas.length` is a correct CALIBRATION test. It was never an OWNERSHIP test, and the
 * branch needs both. These assert the premise rather than the symptom: a payload of nothing
 * but built-ins must yield nothing to adopt, checked against the REAL constants so a third
 * template added later cannot quietly re-open it.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import {
  GENERAL_AUDIENCE,
  PRESET_AUDIENCES,
  GENERAL_TEMPLATES,
  SENTINEL_IDS,
} from '@/lib/audience/audience-repo';
import type { Audience } from '@/lib/audience/audience-types';

/** Exactly what `/api/audiences` serves an account that owns no rows. */
const BUILT_INS: Audience[] = [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...GENERAL_TEMPLATES];

/** The page's branch, as it now stands: ownership first, then calibration. */
const adoptable = (list: Audience[]) => {
  const owned = list.filter((a) => !SENTINEL_IDS.has(a.id));
  return {
    calibrated: owned.find((a) => !a.is_general && (a.personas?.length ?? 0) > 0) ?? null,
    pending: owned.find((a) => !a.is_general) ?? null,
  };
};

describe('the built-ins are the trap this branch fell into', () => {
  it('at least one built-in passes the OLD predicate — otherwise this test proves nothing', () => {
    // The negative control. If no built-in could ever have matched, the fix would be
    // addressing a bug that did not exist and every assertion below would be vacuous.
    const wouldHaveMatched = BUILT_INS.filter(
      (a) => !a.is_general && (a.personas?.length ?? 0) > 0,
    );
    expect(wouldHaveMatched.length).toBeGreaterThan(0);
    expect(wouldHaveMatched.map((a) => a.id)).toContain('template-analyst');
  });

  it('every audience the API serves for free is a known sentinel', () => {
    // If someone adds a sixth virtual constant and forgets SENTINEL_IDS, the ownership
    // filter silently stops covering it and the bug returns. This is that alarm.
    for (const a of BUILT_INS) {
      expect(SENTINEL_IDS.has(a.id), `${a.id} is served but is not a sentinel`).toBe(true);
    }
  });

  it('a virtual constant is never a real row — user_id is the sentinel marker', () => {
    for (const a of BUILT_INS) expect(a.user_id).toBe('__virtual__');
  });
});

describe('an account that owns nothing has nothing to adopt', () => {
  it('does not treat a built-in template as a completed calibration', () => {
    // The regression proper: this returned "Analyst Panel" and completed onboarding.
    expect(adoptable(BUILT_INS).calibrated).toBeNull();
  });

  it('does not adopt a preset as the user’s own DRAFT either', () => {
    // The same branch's second half, and the same defect: presets are `is_general: false`
    // with zero personas, so they slipped past the calibrated check straight into the
    // draft slot — where a retry would have PATCHed a virtual row that has no DB id.
    expect(adoptable(BUILT_INS).pending).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The assertions above describe the RULE. This one binds it to the actual page —
// without it they would pass forever while `page.tsx` drifted back, which is the
// shape of every green-test-as-accomplice failure in this repo.
// ─────────────────────────────────────────────────────────────────────────────

const pageMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  update: vi.fn((_patch: Record<string, unknown>) => ({
    eq: vi.fn(async () => ({ error: null })),
  })),
  maybeSingle: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: pageMocks.replace, push: pageMocks.replace }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: pageMocks.maybeSingle }) }),
      insert: async () => ({ error: null }),
      update: pageMocks.update,
    }),
  }),
}));
// The children are not under test and both reach for browser APIs on mount.
vi.mock('@/components/onboarding/connect-step', () => ({
  ConnectStep: () => <div data-testid="connect-step">connect</div>,
}));
vi.mock('@/components/audience/calibration-flow', () => ({
  CalibrationFlow: () => <div data-testid="calibration-flow">calibrating</div>,
}));

import WelcomePage from '../page';

describe('the page itself, on a brand-new account that owns nothing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // A bootstrap row exists and onboarding is NOT complete — the real state of an
    // account that has just signed up.
    pageMocks.maybeSingle.mockResolvedValue({
      data: { onboarding_step: 'connect', onboarding_completed_at: null, tiktok_handle: null },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ audiences: BUILT_INS }) })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the connect form instead of completing itself', async () => {
    render(<WelcomePage />);
    // Before the fix this rendered the "completed" skeleton and bounced to /home.
    await waitFor(() => expect(screen.getByTestId('connect-step')).toBeTruthy());
  });

  it('never stamps onboarding_completed_at', async () => {
    render(<WelcomePage />);
    await waitFor(() => expect(screen.getByTestId('connect-step')).toBeTruthy());
    const stamped = pageMocks.update.mock.calls.some(([patch]) =>
      Boolean(patch?.onboarding_completed_at),
    );
    expect(stamped, 'the page completed onboarding for an account that owns nothing').toBe(
      false,
    );
  });

  it('does not redirect to /home', async () => {
    render(<WelcomePage />);
    await waitFor(() => expect(screen.getByTestId('connect-step')).toBeTruthy());
    expect(pageMocks.replace).not.toHaveBeenCalledWith('/home');
  });
});

describe('finishing SELECTS the audience, not just builds it', () => {
  /**
   * `/home` seeds the composer from `user_settings.last_audience_id` and falls back to
   * General when unset. Onboarding wrote that row nowhere — so an account that had just
   * finished a ~176s calibration landed on "Your audience — General" with its own audience
   * sitting unselected. Audited live 2026-08-04; `user_settings` came back empty.
   */
  const OWN_ID = '9633de26-d365-4b1f-9225-76a1f6e07f76';
  const own = { ...GENERAL_TEMPLATES[0], id: OWN_ID, user_id: 'user-1', is_general: false } as Audience;
  let calls: Array<{ url: string; method?: string; body?: string }>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    calls = [];
    pageMocks.maybeSingle.mockResolvedValue({
      data: { onboarding_step: 'connect', onboarding_completed_at: null, tiktok_handle: null },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
        calls.push({ url, method: init?.method, body: init?.body });
        if (String(url).includes('/api/audiences')) {
          // Built-ins PLUS one genuine calibrated row — the resume path.
          return { ok: true, json: async () => ({ audiences: [...BUILT_INS, own] }) };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('PUTs the calibrated audience as the user’s selection', async () => {
    render(<WelcomePage />);
    await waitFor(() => {
      const put = calls.find((c) => c.url.includes('/api/settings/last-audience'));
      expect(put, 'onboarding finished without selecting the audience').toBeTruthy();
      expect(put?.method).toBe('PUT');
      expect(JSON.parse(put?.body ?? '{}')).toEqual({ audienceId: OWN_ID });
    });
  });

  it('never sends a virtual sentinel id — the route only accepts a uuid', async () => {
    render(<WelcomePage />);
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('/api/settings/last-audience'))).toBe(true),
    );
    for (const c of calls.filter((x) => x.url.includes('/api/settings/last-audience'))) {
      const id = JSON.parse(c.body ?? '{}').audienceId as string | null;
      expect(id === null || !SENTINEL_IDS.has(id)).toBe(true);
    }
  });
});

describe('a genuine interrupted attempt is still adopted — the branch keeps its job', () => {
  const ownRow = (over: Partial<Audience>): Audience =>
    ({
      ...GENERAL_TEMPLATES[0],
      id: '2f1c7a90-0f4a-4b3e-9c11-9a6d2c5e77aa', // a real uuid, not a sentinel
      user_id: 'real-user-1',
      is_general: false,
      ...over,
    }) as Audience;

  it('adopts the user’s own calibrated audience', () => {
    const own = ownRow({});
    expect(own.personas?.length ?? 0).toBeGreaterThan(0); // guards the fixture itself
    expect(adoptable([...BUILT_INS, own]).calibrated?.id).toBe(own.id);
  });

  it('adopts the user’s own uncalibrated draft as pending, not as calibrated', () => {
    const draft = ownRow({ personas: [] });
    const { calibrated, pending } = adoptable([...BUILT_INS, draft]);
    expect(calibrated).toBeNull();
    expect(pending?.id).toBe(draft.id);
  });
});
