/** @vitest-environment happy-dom */
/**
 * Composer Test seal-in-thread guard (D-05 rework — supersedes the WR-05 navigate-on-id guard).
 *
 * The composer's Test path USED to push to /analyze/[id] the moment analysisId flipped null->string.
 * It now stays IN-THREAD for the whole run and, on `phase: 'complete'`, POSTs the analysisId to
 * /api/tools/test/card (the seal) — the card lands in the open thread, no navigate-out. The only
 * navigate-out that survives is the honest degrade: a row with no craft material (route →
 * { degraded }) or a build/network failure falls back to the full frame-by-frame page.
 *
 * The guard that mattered before still matters: a hydration-sourced analysisId (permalink layout,
 * use-analysis-stream sets it from the URL) is NOT a real submit, so it must neither seal nor
 * navigate. pendingSealRef — armed ONLY in handleSubmit's Test branch — is what distinguishes the
 * two, mirroring the old pendingNavRef. Chip selection is not a submit and must not arm it either.
 *
 * These tests drive analysisId/phase transitions with NO submit (hydration) and WITH a submit,
 * asserting the seal POST + the degrade fallback fire only for the submitted run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

// ── controllable stream mock ────────────────────────────────────────────
const start = vi.fn().mockResolvedValue(undefined);
let analysisId: string | null = null;
let phase = 'idle';

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start,
    analysisId,
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase,
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

// ── fetch mock: the seal POST (/api/tools/test/card) + the thread reload (/api/threads/open) ──
// `cardOk`/`cardBody` let each test choose the seal outcome (sealed vs degraded); everything else
// resolves to a benign empty payload so an incidental mount fetch never throws.
let cardOk = true;
let cardBody: Record<string, unknown> = { block: {} };
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/tools/test/card')) {
    return Promise.resolve({ ok: cardOk, json: async () => cardBody } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({ messages: [] }) } as Response);
});

import { Composer } from '../composer';

function urlInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/ask about this simulation/i) as HTMLInputElement;
}
function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /simulate|submit|send/i }) as HTMLButtonElement;
}

/**
 * The skill chip. Found by aria-label, not by face text: the chip renders the SKILL's own name,
 * so matching text here would couple this guard to skill copy. The aria-label is the stable handle.
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

/** Drive a real Test submit (arm Test → type a valid URL → click send). */
async function submitTestRun() {
  selectSkillBySlash('test');
  fireEvent.change(urlInput(), {
    target: { value: 'https://www.tiktok.com/@creator/video/123' },
  });
  await act(async () => {
    fireEvent.click(submitButton());
  });
}

/** Flush the seal effect's async work (fetch → reloadChatThread) after a phase→complete rerender. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  start.mockClear();
  push.mockClear();
  fetchMock.mockClear();
  analysisId = null;
  phase = 'idle';
  routeId = 'permalink-xyz';
  cardOk = true;
  cardBody = { block: {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = fetchMock;
  cleanup();
});

describe('Composer Test seal guard', () => {
  it('does NOT seal or navigate when analysisId appears via hydration (no submit)', () => {
    // First render: analysisId null (composer mounted on a permalink).
    const { rerender } = renderWithClient(<Composer />);
    expect(push).not.toHaveBeenCalled();

    // Simulate hydration surfacing a COMPLETED analysisId from the URL — a flip the composer did
    // NOT initiate (no handleSubmit ran), so pendingSealRef was never armed.
    analysisId = 'permalink-xyz';
    phase = 'complete';
    act(() => {
      rerender(<Composer />);
    });

    // The guard suppresses both the seal POST and any navigation.
    expect(push).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/test/card')),
    ).toBe(false);
  });

  it('SEALS in-thread (POSTs the card) and does NOT navigate after a real submit completes', async () => {
    const { rerender } = renderWithClient(<Composer />);

    await submitTestRun();
    expect(start).toHaveBeenCalledTimes(1);

    // The stream connects (analysisId null at start) then completes with a fresh id.
    phase = 'complete';
    analysisId = 'fresh-submit-id';
    await act(async () => {
      rerender(<Composer />);
    });
    await flush();

    // Sealed in-thread — the card adapter was POSTed the fresh id, and NO navigate-out fired.
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/test/card')),
      ).toBe(true);
    });
    expect(push).not.toHaveBeenCalledWith('/analyze/fresh-submit-id');
  });

  it('falls back to the full breakdown page when the seal degrades', async () => {
    const { rerender } = renderWithClient(<Composer />);
    cardBody = { degraded: 'no_craft' }; // route: nothing to card in-thread

    await submitTestRun();

    phase = 'complete';
    analysisId = 'fresh-submit-id';
    await act(async () => {
      rerender(<Composer />);
    });
    await flush();

    // Degrade honesty: the only navigate-out that survives.
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/analyze/fresh-submit-id');
    });
  });
});

describe('Composer chip-select does NOT arm the seal (Pitfall #5 / Plan 01-04)', () => {
  it('does NOT seal or navigate after clicking the skill chip (chip is not a submit)', () => {
    // Pinned layout — routeId is set in beforeEach.
    const { rerender } = renderWithClient(<Composer />);
    expect(push).not.toHaveBeenCalled();

    // Click the skill chip — purely opens the picker; it is not a submit (Pitfall #5).
    fireEvent.click(skillChip());
    expect(push).not.toHaveBeenCalled();

    // Even if a completed analysisId arrives after the chip click, no seal + no navigation.
    analysisId = 'hydration-after-chip-click';
    phase = 'complete';
    act(() => {
      rerender(<Composer />);
    });

    expect(push).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/test/card')),
    ).toBe(false);
  });

  it('a hydration id does NOT seal even after a chip interaction followed by no submit', () => {
    const { rerender } = renderWithClient(<Composer />);

    // Click chip — not a submit
    fireEvent.click(skillChip());

    // Hydration surfaces a completed analysisId (simulates the URL on mount)
    analysisId = 'permalink-xyz';
    phase = 'complete';
    act(() => {
      rerender(<Composer />);
    });

    // Guard holds — no seal, no navigation
    expect(push).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/test/card')),
    ).toBe(false);
  });
});
