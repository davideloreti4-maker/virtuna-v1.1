/** @vitest-environment happy-dom */
/**
 * Home composition (SHELL-01, THEME-04, UX-05 / D-04).
 *
 * Asserts the clean authed home surface — the serif greeting (font-serif) +
 * the MavenMark gull glyph + the composer — and the P7 empty-state UNLOCK:
 *  - the 3 LOCKED-verbatim starter chips (Test / Profile / Predict)
 *  - the one-tap, show-once first-run demo (See it in action + Dismiss)
 *  - show-once: with the localStorage flag set, the demo is hidden but the chips
 *    still render
 *  - tapping "See it in action" POSTs the canned fixture to /api/tools/profile
 *  - NO Simulation list under the composer (it lives in the sidebar)
 *
 * Renders the two client pieces (HomeGreeting + Composer) the server page
 * composes — the server page itself is an async RSC and is covered structurally
 * by the plan's file-presence verify, not rendered here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
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
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    storage: { from: () => ({ upload: vi.fn() }) },
  }),
}));

import { HomeGreeting } from '../home-greeting';
import { Composer } from '../composer';
import { HORIZONTAL_ENABLED } from '@/lib/flags/horizontal';

/** Mirror of what (app)/home/page.tsx composes: greeting + composer, nothing else. */
function Home() {
  return (
    <main>
      <HomeGreeting />
      <Composer />
    </main>
  );
}

const DEMO_SEEN_KEY = 'numen.home.demo.seen';

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  // Benign fetch stub: composer mount (GET /api/threads/open) + the demo POST both
  // resolve to an empty-ok JSON so nothing throws; individual tests inspect the spy.
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response);
});

describe('Home — serif greeting + glyph + composer (SHELL-01, THEME-04)', () => {
  it('renders a serif greeting (font-serif voice moment)', () => {
    renderWithClient(<Home />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('font-serif');
  });

  it('renders the MavenMark gull glyph (D-20, not an asterisk)', () => {
    const { container } = renderWithClient(<Home />);
    // MavenMark is an aria-hidden <svg> with the gull path.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders the composer', () => {
    renderWithClient(<Home />);
    expect(screen.getByTestId('composer')).toBeInTheDocument();
  });

  it('greets with the simulate-your-audience voice (D-09/D-19, never "Reading")', () => {
    renderWithClient(<Home />);
    // The voice moved from the headline to the hero's promise line (2026-07-20 —
    // the headline is now a short time-of-day greeting; the PROMISE carries the
    // product voice). The contract is unchanged: the empty home says "simulate
    // your audience" and never says "Reading".
    expect(screen.getByText(/simulate your audience/i)).toBeInTheDocument();
    expect(screen.queryByText(/reading/i)).toBeNull();
  });
});

describe('Home — empty-state quick actions + first-run demo (UX-05 / D-04)', () => {
  it('renders the creator quick-action cards on the empty home', () => {
    renderWithClient(<Home />);
    // A representative sample of the QUICK_ACTIONS model (idea / hooks / test).
    expect(
      screen.getByRole('button', { name: 'Get content ideas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Write scroll-stopping hooks' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Test a video' }),
    ).toBeInTheDocument();
  });

  it.skipIf(!HORIZONTAL_ENABLED)('renders the one-tap first-run demo (See it in action + Dismiss) when the show-once flag is absent', async () => {
    renderWithClient(<Home />);
    expect(
      await screen.findByRole('button', { name: /see it in action/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^dismiss$/i }),
    ).toBeInTheDocument();
  });

  it('show-once: with the flag set the demo is hidden but the quick actions still render', async () => {
    window.localStorage.setItem(DEMO_SEEN_KEY, '1');
    renderWithClient(<Home />);
    // Quick actions always render…
    expect(
      screen.getByRole('button', { name: 'Get content ideas' }),
    ).toBeInTheDocument();
    // …but the demo CTA never appears (flag already consumed). Wait a tick so the
    // mounted-effect would have surfaced it if the gate were wrong.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /see it in action/i }),
      ).toBeNull();
    });
  });

  it.skipIf(!HORIZONTAL_ENABLED)('tapping "See it in action" POSTs the canned fixture to /api/tools/profile and sets the show-once flag', async () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    renderWithClient(<Home />);
    const cta = await screen.findByRole('button', {
      name: /see it in action/i,
    });
    fireEvent.click(cta);
    await waitFor(() => {
      const calledProfile = fetchSpy.mock.calls.some(
        (c) => String(c[0]).includes('/api/tools/profile') && c[1]?.method === 'POST',
      );
      expect(calledProfile).toBe(true);
    });
    expect(window.localStorage.getItem(DEMO_SEEN_KEY)).toBe('1');
  });

  it('shows NO Simulation list under the composer (the sidebar owns history)', () => {
    const { container } = renderWithClient(<Home />);
    // No Simulation HISTORY list region on the home body. The only `list` on the
    // page is the AmbientPresence's always-present sr-only roster mirror (the
    // calibrated-people accessibility list — UI-SPEC §Cross-Cutting; the presence
    // never hides, even idle on empty home, D-01). That is NOT a Simulation history
    // list, so scope the "no list" invariant to lists OUTSIDE the presence's sr-only
    // mirror (a `<ul>` whose closest `.sr-only` ancestor is absent).
    const lists = Array.from(container.querySelectorAll('ul, ol, [role="list"]'));
    const nonRosterLists = lists.filter((el) => el.closest('.sr-only') === null);
    expect(nonRosterLists).toHaveLength(0);
    expect(screen.queryByTestId('sidebar-board-label')).toBeNull();
  });
});
