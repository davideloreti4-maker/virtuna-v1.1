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
 *
 * Extended (Plan 01-04 / Pitfall #5): assert that chip selection does NOT arm
 * navigation — a chip click is NOT a submit; pendingNavRef must stay false after
 * clicking a chip. A hydration-sourced analysisId that appears AFTER a chip click
 * must still not navigate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, cleanup, act } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

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

/**
 * The skill chip. Found by aria-label, not by face text: the chip used to render the VERB
 * GROUP ("Test"), and this helper matched that literal string. It now renders the SKILL's
 * own name, so the group name is not on the chip face at all — matching text here would
 * couple the navigation guard to skill copy, which is exactly the kind of brittleness that
 * makes people stop trusting a guard. The aria-label is the stable handle.
 */
function skillChip(): HTMLButtonElement {
  return screen.getByRole('button', { name: /skill:/i }) as HTMLButtonElement;
}

/** Arm a skill through the `/` slash menu (Enter resolves it) — what a real creator does. */
function selectSkillBySlash(command: string) {
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: `/${command}` } });
  fireEvent.keyDown(field, { key: 'Enter' });
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
    const { rerender } = renderWithClient(<Composer />);
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
    const { rerender } = renderWithClient(<Composer />);

    // Arm Test first: the composer boots into Chat now, and only the video skill navigates
    // to /analyze. Chat/ideas/hooks never do — that is the whole point of the guard.
    selectSkillBySlash('test');

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

describe('Composer chip-select does NOT arm navigation (Pitfall #5 / Plan 01-04)', () => {
  it('does NOT navigate after clicking the skill chip (chip is not a submit)', () => {
    // Pinned layout — routeId is set in beforeEach.
    const { rerender } = renderWithClient(<Composer />);
    expect(push).not.toHaveBeenCalled();

    // Click the skill chip — purely opens the picker; it is not a submit (Pitfall #5).
    fireEvent.click(skillChip());
    expect(push).not.toHaveBeenCalled();

    // Even if a hydration analysisId arrives after the chip click, no navigation.
    analysisId = 'hydration-after-chip-click';
    act(() => {
      rerender(<Composer />);
    });

    // pendingNavRef was never armed by the chip click, so navigation is suppressed.
    expect(push).not.toHaveBeenCalled();
  });

  it('hydration id does NOT navigate even after a chip interaction followed by no submit', () => {
    const { rerender } = renderWithClient(<Composer />);

    // Click chip — not a submit
    fireEvent.click(skillChip());

    // Hydration sets analysisId (simulates the URL on mount)
    analysisId = 'permalink-xyz';
    act(() => {
      rerender(<Composer />);
    });

    // Guard holds — no navigation
    expect(push).not.toHaveBeenCalled();
  });
});
