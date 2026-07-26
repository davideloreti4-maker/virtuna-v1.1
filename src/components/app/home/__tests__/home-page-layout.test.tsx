/** @vitest-environment happy-dom */
/**
 * HomePageLayout — empty-state welcome hero (Claude-style start screen).
 *
 * The serif greeting is visible only before conversation content exists.
 * Once blocks stream in or a turn is submitted, the greeting is removed entirely
 * (not receded to a top banner).
 *
 * FLAG-AWARE (2026-07-24): these assertions describe the LEGACY empty home. Under
 * `AMBIENT_V2_ENABLED` the v2 Start surface carries its own greeting, so this one is deliberately
 * suppressed (`home-page-layout.tsx`). The suite used to inherit whatever `NEXT_PUBLIC_AMBIENT_V2`
 * happened to be in the environment — green on a dev box with the flag off, RED the moment you ran
 * it the way you ship. The flag is now mocked as a live binding and pinned per-test, so both paths
 * are asserted and neither depends on ambient env.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

/** Live-binding flag mock: the getter is re-read on every access, so flipping `ambientV2` between
 *  tests flips the branch the component takes without a module reset. */
let ambientV2 = false;
vi.mock('@/lib/flags/ambient-v2', () => ({
  get AMBIENT_V2_ENABLED() {
    return ambientV2;
  },
}));

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

let ideasMockBlocks: unknown[] = [];
vi.mock('@/hooks/queries/use-ideas-stream', () => ({
  useIdeasStream: () => ({
    start: vi.fn(),
    isStreaming: false,
    statusMessage: null,
    error: null,
    toBlocks: () => ideasMockBlocks,
  }),
}));

vi.mock('@/hooks/queries/use-hooks-stream', () => ({
  useHooksStream: () => ({
    start: vi.fn(),
    isStreaming: false,
    statusMessage: null,
    error: null,
    toBlocks: () => [],
  }),
}));

import { HomePageLayout } from '../home-page-layout';

beforeEach(() => {
  ideasMockBlocks = [];
  ambientV2 = false;
  cleanup();
});

describe('HomePageLayout — welcome hero visibility', () => {
  it('shows the serif greeting on an empty home', () => {
    renderWithClient(<HomePageLayout />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // The headline is the short time-of-day greeting (2026-07-20); the product
    // voice lives in the hero's promise line beneath it.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /good (morning|afternoon|evening)|welcome back/i,
    );
    expect(screen.getByText(/simulate your audience/i)).toBeInTheDocument();
  });

  it('removes the greeting entirely when conversation content exists', () => {
    ideasMockBlocks = [{ type: 'idea-card', props: { headline: 'Test idea' } }];
    renderWithClient(<HomePageLayout />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  /**
   * The SHIP path. Under the flag the v2 Start surface owns the greeting, so the LEGACY hero is
   * suppressed — the creator still sees exactly one greeting, never two stacked. The tell is the
   * legacy hero's promise line ("simulate your audience"), which v2 Start does not carry: assert on
   * that rather than on the h1 count alone, or a regression that dropped BOTH greetings would pass.
   */
  it('suppresses the LEGACY hero under AMBIENT_V2_ENABLED — v2 Start carries the only greeting', () => {
    ambientV2 = true;
    renderWithClient(<HomePageLayout />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toMatch(/good (morning|afternoon|evening)|welcome back/i);
    // the legacy hero's promise line is gone — this greeting is v2 Start's, not the old one
    expect(screen.queryByText(/simulate your audience/i)).toBeNull();
  });
});
