/** @vitest-environment happy-dom */
/**
 * WR-05 — composer navigate-on-id guard (pinned/permalink layout).
 *
 * The composer pushes to /analyze/[id] on a null->string analysisId flip.
 * In the pinned layout, useAnalysisStream ALSO sets analysisId from the URL on
 * hydration (use-analysis-stream.ts:521) — a null->string flip the user did
 * NOT cause. Board guards this with a ref that marks "an id I started
 * streaming"; the composer must do the same so a hydration-sourced id can
 * never navigate.
 *
 * These tests drive analysisId transitions with NO submit (hydration) and WITH
 * a submit, asserting router.push only fires for the submitted run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

// ── controllable stream mock ────────────────────────────────────────────
const start = vi.fn().mockResolvedValue(undefined);
let analysisId: string | null = null;

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start,
    analysisId,
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

const push = vi.fn();
// Pinned layout: a route id is present (permalink route).
let routeId: string | undefined = 'permalink-xyz';
vi.mock('next/navigation', () => ({
  useParams: () => (routeId ? { id: routeId } : {}),
  usePathname: () => (routeId ? `/analyze/${routeId}` : '/home'),
  useRouter: () => ({ push, replace: vi.fn() }),
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

import { Composer } from '../composer';

function urlInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/ask about this simulation/i) as HTMLInputElement;
}
function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /simulate|submit|send/i }) as HTMLButtonElement;
}

beforeEach(() => {
  start.mockClear();
  push.mockClear();
  analysisId = null;
  routeId = 'permalink-xyz';
  cleanup();
});

describe('Composer navigate guard (WR-05)', () => {
  it('does NOT navigate when analysisId appears via hydration (no submit)', () => {
    // First render: analysisId null (composer mounted on a permalink).
    const { rerender } = render(<Composer />);
    expect(push).not.toHaveBeenCalled();

    // Simulate hydration setting analysisId from the URL — a null->string flip
    // the composer did NOT initiate (no handleSubmit ran).
    analysisId = 'permalink-xyz';
    act(() => {
      rerender(<Composer />);
    });

    // The guard (pendingNavRef never armed) must suppress navigation.
    expect(push).not.toHaveBeenCalled();
  });

  it('DOES navigate after a real submit produces a new id', async () => {
    const { rerender } = render(<Composer />);

    // Type a valid TikTok URL and submit — this arms pendingNavRef.
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.tiktok.com/@creator/video/123' },
    });
    await act(async () => {
      fireEvent.click(submitButton());
    });
    expect(start).toHaveBeenCalledTimes(1);

    // The stream sets analysisId null at start, then emits a fresh id.
    analysisId = null;
    act(() => {
      rerender(<Composer />);
    });
    analysisId = 'fresh-submit-id';
    act(() => {
      rerender(<Composer />);
    });

    expect(push).toHaveBeenCalledWith('/analyze/fresh-submit-id');
  });
});
