/** @vitest-environment happy-dom */
/**
 * Composer two-layout position (SHELL-04 / D-24) + thread pin (post-UAT UX fix).
 *
 * The same composer component serves three states:
 *  - no id + no thread   (empty home)      → data-layout="centered"
 *  - id present          (permalink)       → data-layout="pinned"
 *  - no id + has thread  (home thread mode)→ data-layout="thread" on the form;
 *                                            composer-shell data-layout="thread",
 *                                            scrollable thread-region above, form pinned below.
 *
 * Asserted on stable data attributes (not styling classes) so the test is not
 * brittle to flat-warm design-system changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
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

// ── Ideas stream mock — mutable so we can simulate thread content ─────────
// ideasMockBlocks controls the value returned by toBlocks().
let ideasMockBlocks: unknown[] = [];
let ideasIsStreaming = false;
vi.mock('@/hooks/queries/use-ideas-stream', () => ({
  useIdeasStream: () => ({
    start: vi.fn(),
    isStreaming: ideasIsStreaming,
    statusMessage: null,
    error: null,
    toBlocks: () => ideasMockBlocks,
  }),
}));

// ── Hooks stream mock — mutable similarly ─────────────────────────────────
let hooksMockBlocks: unknown[] = [];
let hooksIsStreaming = false;
vi.mock('@/hooks/queries/use-hooks-stream', () => ({
  useHooksStream: () => ({
    start: vi.fn(),
    isStreaming: hooksIsStreaming,
    statusMessage: null,
    error: null,
    toBlocks: () => hooksMockBlocks,
  }),
}));

import { Composer } from '../composer';

function composerForm(): HTMLElement {
  return screen.getByTestId('composer');
}

beforeEach(() => {
  routeId = undefined;
  ideasMockBlocks = [];
  ideasIsStreaming = false;
  hooksMockBlocks = [];
  hooksIsStreaming = false;
  cleanup();
});

describe('Composer — two-layout position (SHELL-04 / D-24)', () => {
  it('renders centered when there is no Simulation id (empty home)', () => {
    routeId = undefined;
    renderWithClient(<Composer />);
    expect(composerForm()).toHaveAttribute('data-layout', 'centered');
  });

  it('renders bottom-pinned when a Simulation id is present (permalink route)', () => {
    routeId = 'abc123';
    renderWithClient(<Composer />);
    expect(composerForm()).toHaveAttribute('data-layout', 'pinned');
  });

  it('switches the active-state placeholder when a Simulation exists', () => {
    routeId = 'abc123';
    renderWithClient(<Composer />);
    expect(
      screen.getByPlaceholderText(/ask about this simulation/i),
    ).toBeInTheDocument();
  });
});

describe('Composer — home thread mode (post-UAT UX pin fix)', () => {
  it('form gets data-layout="thread" when idea blocks exist on /home', () => {
    routeId = undefined;
    // Simulate persisted idea blocks being present (ideas.toBlocks() is non-empty).
    // activeTool defaults to "test" in the Composer — we exercise the hasThread
    // signal directly (it checks all block sources, not just the active tool).
    ideasMockBlocks = [{ type: 'idea-card', props: { headline: 'Test idea' } }];
    renderWithClient(<Composer />);
    expect(composerForm()).toHaveAttribute('data-layout', 'thread');
  });

  it('form gets data-layout="thread" when hooks are streaming on /home', () => {
    routeId = undefined;
    hooksIsStreaming = true;
    renderWithClient(<Composer />);
    expect(composerForm()).toHaveAttribute('data-layout', 'thread');
  });

  it('renders a scrollable thread-region above the pinned form in thread mode', () => {
    routeId = undefined;
    ideasMockBlocks = [{ type: 'idea-card', props: { headline: 'Test idea' } }];
    renderWithClient(<Composer />);

    // The composer-shell wraps both regions with data-layout="thread".
    const shell = screen.getByTestId('composer-shell');
    expect(shell).toHaveAttribute('data-layout', 'thread');

    // The scrollable thread region sits above the form.
    const threadRegion = screen.getByTestId('composer-thread-region');
    expect(threadRegion).toBeInTheDocument();
    // The form (pinned bottom row) is also present.
    expect(composerForm()).toBeInTheDocument();

    // Structural order: thread-region precedes the form in the DOM
    // (thread scrolls above, form pinned below).
    const shellChildren = Array.from(shell.querySelectorAll('[data-testid]'));
    const regionIdx = shellChildren.findIndex(
      (el) => el.getAttribute('data-testid') === 'composer-thread-region',
    );
    const formIdx = shellChildren.findIndex(
      (el) => el.getAttribute('data-testid') === 'composer',
    );
    expect(regionIdx).toBeLessThan(formIdx);
  });

  it('stays centered (no thread shell) when no thread content exists on /home', () => {
    routeId = undefined;
    // All blocks empty, no streaming.
    renderWithClient(<Composer />);
    expect(screen.queryByTestId('composer-shell')).toBeNull();
    expect(composerForm()).toHaveAttribute('data-layout', 'centered');
  });

  it('does NOT enter thread mode on the permalink route even when blocks exist', () => {
    routeId = 'abc123';
    ideasMockBlocks = [{ type: 'idea-card', props: { headline: 'Test idea' } }];
    renderWithClient(<Composer />);
    // Permalink always uses layout="pinned" regardless of thread content.
    expect(composerForm()).toHaveAttribute('data-layout', 'pinned');
    expect(screen.queryByTestId('composer-shell')).toBeNull();
  });
});
