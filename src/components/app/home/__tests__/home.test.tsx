/** @vitest-environment happy-dom */
/**
 * Home composition (SHELL-01, THEME-04, D-18/D-20/D-25).
 *
 * Asserts the clean authed home surface — the serif greeting (font-serif) +
 * the NumenMark stele glyph + the composer — and the ABSENCE of the things the
 * locked decisions removed:
 *  - NO starter chips (D-18: "Paste link" / "Upload" / "Try a demo")
 *  - NO demo affordance (D-25 — deferred to Phase 5)
 *  - NO Simulation list under the composer (it lives in the sidebar)
 *
 * Renders the two client pieces (HomeGreeting + Composer) the server page
 * composes — the server page itself is an async RSC and is covered structurally
 * by the plan's file-presence verify, not rendered here.
 *
 * Written first (Task 1) — RED until the greeting (Task 3) + composer (Task 2)
 * land.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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

/** Mirror of what (app)/home/page.tsx composes: greeting + composer, nothing else. */
function Home() {
  return (
    <main>
      <HomeGreeting />
      <Composer />
    </main>
  );
}

beforeEach(() => {
  cleanup();
});

describe('Home — serif greeting + glyph + composer (SHELL-01, THEME-04)', () => {
  it('renders a serif greeting (font-serif voice moment)', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('font-serif');
  });

  it('renders the NumenMark stele glyph (D-20, not an asterisk)', () => {
    const { container } = render(<Home />);
    // NumenMark is an aria-hidden <svg> with the stele path.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders the composer', () => {
    render(<Home />);
    expect(screen.getByTestId('composer')).toBeInTheDocument();
  });

  it('greets with the simulate-your-audience voice (D-09/D-19, never "Reading")', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /simulate your audience/i,
    );
    expect(screen.queryByText(/reading/i)).toBeNull();
  });
});

describe('Home — locked omissions (D-18 / D-25)', () => {
  it('shows NO starter chips (D-18 — composer-only home)', () => {
    render(<Home />);
    // The locked-and-overridden 3-chip spec: none of these affordances exist.
    expect(screen.queryByRole('button', { name: /paste link/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^upload$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /try a demo/i })).toBeNull();
  });

  it('shows NO demo affordance (D-25 — demo deferred to Phase 5)', () => {
    render(<Home />);
    expect(screen.queryByText(/try a demo/i)).toBeNull();
    expect(screen.queryByText(/demo/i)).toBeNull();
  });

  it('shows NO Simulation list under the composer (the sidebar owns history)', () => {
    const { container } = render(<Home />);
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
