/** @vitest-environment happy-dom */
/**
 * Composer two-layout position (SHELL-04 / D-24).
 *
 * The same composer component serves both states; position is driven by
 * whether a Simulation exists (the route id, mirroring ContentForm's
 * isOnResultRoute = !!params.id):
 *  - no id  (empty home)        → data-layout="centered"
 *  - id present (permalink)     → data-layout="pinned"
 *
 * Asserted on a stable data attribute (not styling) so the test is not
 * brittle to flat-warm class changes.
 *
 * Written first (Task 1) — RED until the slim composer (Task 2) exposes the
 * data-layout signal.
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

// Mutable route id drives the layout branch. The composer reads useParams().id.
let routeId: string | undefined;
vi.mock('next/navigation', () => ({
  useParams: () => (routeId ? { id: routeId } : {}),
  usePathname: () => (routeId ? `/analyze/${routeId}` : '/home'),
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

import { Composer } from '../composer';

function layoutHost(): HTMLElement {
  return screen.getByTestId('composer');
}

beforeEach(() => {
  routeId = undefined;
  cleanup();
});

describe('Composer — two-layout position (SHELL-04 / D-24)', () => {
  it('renders centered when there is no Simulation id (empty home)', () => {
    routeId = undefined;
    render(<Composer />);
    expect(layoutHost()).toHaveAttribute('data-layout', 'centered');
  });

  it('renders bottom-pinned when a Simulation id is present (permalink route)', () => {
    routeId = 'abc123';
    render(<Composer />);
    expect(layoutHost()).toHaveAttribute('data-layout', 'pinned');
  });

  it('switches the active-state placeholder when a Simulation exists', () => {
    routeId = 'abc123';
    render(<Composer />);
    expect(
      screen.getByPlaceholderText(/ask about this simulation/i),
    ).toBeInTheDocument();
  });
});
