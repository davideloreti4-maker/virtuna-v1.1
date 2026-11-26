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
const start = vi.fn().mockImplementation(async () => {
  order.push('analyze');
});
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
/** The order of the two calls a Test from a blank chat makes: the chat first, then the run. */
const order: string[] = [];
let cardBody: Record<string, unknown> = { block: {} };
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/tools/test/card')) {
    return Promise.resolve({ ok: cardOk, json: async () => cardBody } as Response);
  }
  if (url.includes('/api/threads/new')) {
    order.push('threads/new');
    return Promise.resolve({ ok: true, json: async () => ({ threadId: 'chat-new' }) } as Response);
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
  order.length = 0;
  push.mockClear();
  fetchMock.mockClear();
  analysisId = null;
  phase = 'idle';
  routeId = 'permalink-xyz';
  cardOk = true;
  cardBody = { block: {} };
  document.cookie = "maven_active_thread=; path=/; max-age=0";
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

/**
 * "Server adds the card" (2026-11-26): the run names the chat it was started in, and the seal
 * names that chat too. Before, the seal used the chat open NOW, so a creator who moved to chat B
 * mid-run got chat A's card in B.
 */
describe("Composer Test run: the card belongs to the chat the run started in", () => {
  const setChat = (id: string) => {
    document.cookie = `maven_active_thread=${encodeURIComponent(id)}; path=/`;
  };
  const sealBody = () => {
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/api/tools/test/card"));
    const init = (call as unknown as [unknown, RequestInit | undefined] | undefined)?.[1];
    return call ? JSON.parse(String(init?.body ?? "{}")) : null;
  };

  it("started in chat A, the creator moves to chat B: the run and the seal both name A", async () => {
    setChat("chat-A");
    const { rerender } = renderWithClient(<Composer />);
    await submitTestRun();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]![0]).toMatchObject({ thread_id: "chat-A" });

    setChat("chat-B"); // the creator opened another chat mid-run
    phase = "complete";
    analysisId = "run-in-A";
    await act(async () => {
      rerender(<Composer />);
    });
    await flush();

    await waitFor(() => expect(sealBody()).not.toBeNull());
    // The run's own nonce, made when it was armed: sent with the run and with its seal, so the
    // server's card and the seal meet on one id, and a run of the same video again gets its own.
    const nonce = (start.mock.calls[0]![0] as { run_nonce?: string }).run_nonce;
    expect(typeof nonce).toBe("string");
    expect(sealBody()).toEqual({ analysisId: "run-in-A", threadId: "chat-A", runNonce: nonce });
  });

  it("each run gets its own nonce", async () => {
    setChat("chat-A");
    renderWithClient(<Composer />);
    await submitTestRun();
    await submitTestRun();
    const nonces = start.mock.calls.map((c) => (c[0] as { run_nonce?: string }).run_nonce);
    expect(nonces).toHaveLength(2);
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it("a Test from a blank new chat makes the chat first, then names it with the run", async () => {
    setChat("__new__");
    renderWithClient(<Composer />);
    await submitTestRun();
    expect(order).toEqual(["threads/new", "analyze"]);
    expect(start.mock.calls[0]![0]).toMatchObject({ thread_id: "chat-new" });
  });

  it("a degraded seal for a run from chat A does not pull a creator out of chat B", async () => {
    setChat("chat-A");
    cardBody = { degraded: "no_craft" };
    const { rerender } = renderWithClient(<Composer />);
    await submitTestRun();
    setChat("chat-B");
    phase = "complete";
    analysisId = "run-in-A";
    await act(async () => {
      rerender(<Composer />);
    });
    await flush();
    await waitFor(() => expect(sealBody()).not.toBeNull());
    await flush();
    expect(push).not.toHaveBeenCalled();
  });
});

/**
 * Pitfall #5 — ARMING IS NOT SUBMITTING, whatever arms it.
 *
 * The gesture under test used to be a click on the skill PILL, deleted on 2026-07-28. The rule
 * it protects is unchanged and now matters more, not less: with the pill gone, arming happens
 * through the `/` slash menu and the Start grid, and the one-shot means an arm is a promise
 * about the NEXT send. If any of those gestures armed `pendingSealRef`, a creator who merely
 * picked a skill on a permalink would be navigated away from the page they were reading.
 */
describe('Composer skill-arming does NOT arm the seal (Pitfall #5 / Plan 01-04)', () => {
  it('does NOT seal or navigate when a skill is armed (arming is not a submit)', () => {
    // Pinned layout — routeId is set in beforeEach.
    const { rerender } = renderWithClient(<Composer />);
    expect(push).not.toHaveBeenCalled();

    // Arm a skill through the surviving door — purely a pick; it is not a submit (Pitfall #5).
    selectSkillBySlash('hooks');
    expect(push).not.toHaveBeenCalled();

    // …and DISARMING (the armed indicator's ×) is not a submit either.
    fireEvent.click(screen.getByRole('button', { name: /back to chat/i }));
    expect(push).not.toHaveBeenCalled();

    // Even if a completed analysisId arrives after the arm, no seal + no navigation.
    analysisId = 'hydration-after-arming';
    phase = 'complete';
    act(() => {
      rerender(<Composer />);
    });

    expect(push).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('/api/tools/test/card')),
    ).toBe(false);
  });

  it('a hydration id does NOT seal even after an arming interaction followed by no submit', () => {
    const { rerender } = renderWithClient(<Composer />);

    // Arm a skill — not a submit
    selectSkillBySlash('hooks');

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
