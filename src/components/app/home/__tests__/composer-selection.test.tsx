/** @vitest-environment happy-dom */
/**
 * Composer — the SELECTION contract (2026-07-14 owner call).
 *
 * Three signals tell the creator where they are, and each one used to lie:
 *
 *   what the app can do     → the starter grid       (was: redrew itself per skill)
 *   what is armed RIGHT NOW → the armed indicator    (was: the skill CHIP, which named the
 *                                                     VERB GROUP rather than the skill)
 *   what that skill wants   → the placeholder        (was: vague, and Test was the boot default)
 *
 * ⚠️ 2026-07-28: the skill chip was a PICKER and the owner deleted it (Lane 2 step 3). The
 * middle signal survives as a non-interactive indicator — see `armedSkill()` below. One
 * assertion here is deliberately INVERTED by the same change; it carries its own note.
 *
 * This suite locks the composer half of that (the grid is locked in home-starter.test.tsx).
 * Everything here is a REGRESSION lock on a bug that shipped, not a hypothetical:
 *
 *  - The app booted into `test`, so a fresh thread demanded a TikTok URL before the creator
 *    had said a word. Front door is now Chat.
 *  - "New Thread" INHERITED the previous thread's skill: the rehydration restore only ran
 *    `setActiveTool` when it FOUND a card to restore from, so an empty thread — which has
 *    nothing to find — silently kept whatever was armed before. Open a hooks thread, hit New
 *    Thread, get a blank page still armed with Hooks.
 *  - Account was unsubmittable (`canSubmit: false`), which is what forced the starter to
 *    carry a bespoke per-skill card. It now RUNS on send — and that spends a Reading, so the
 *    "never on render" half matters as much as the "runs on send" half.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

// ── mocks ─────────────────────────────────────────────────────────────────────
const analysisStart = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start: analysisStart,
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

/** The Account read stream — the thing send must fire, and must never fire on its own. */
const accountStart = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/queries/use-account-read-stream', () => ({
  useAccountReadStream: () => ({
    start: accountStart,
    block: null,
    isStreaming: false,
    error: null,
    fallbackMessage: null,
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
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
  }),
}));

import { Composer } from '../composer';

/** The open-thread fetch. `blocks` decides what the tool-restore finds (or doesn't). */
function mockOpenThread(blocks: Array<{ type: string; props?: unknown }>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/threads/open')) {
      return new Response(
        JSON.stringify({
          threadId: 't1',
          messages: blocks.length ? [{ role: 'assistant', blocks }] : [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });
}

/**
 * What is armed, read off the surface that states it.
 *
 * This used to be `screen.getByRole('button', { name: /skill:/i })` — the skill PILL, deleted
 * on 2026-07-28 (Lane 2 step 3). The signal did not go with it: the armed indicator states the
 * same fact and is the composer's only claim about what the next send will do. Chat is the
 * front door, so it renders NOTHING at all — an absent indicator IS "Chat", which is why this
 * returns the string rather than an element.
 */
const armedSkill = () =>
  screen.queryByTestId('composer-armed-skill')?.textContent?.trim() ?? 'Chat';
const sendBtn = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;

function selectSkillBySlash(command: string) {
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: `/${command}` } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

beforeEach(() => {
  vi.restoreAllMocks();
  analysisStart.mockClear();
  accountStart.mockClear();
  cleanup();
});

/**
 * Restore the global `fetch` spy on the way OUT, not just on the way in.
 *
 * mockOpenThread() replaces globalThis.fetch. Restoring only in beforeEach leaves the spy
 * installed after the last test in this file — and vitest reuses a worker across files, so
 * the stub leaked into whichever suite ran next in the same worker and starved it of its own
 * fetch. It surfaced as an unrelated sidebar test failing in the full run while passing in
 * isolation, which is the most expensive kind of failure to read. Clean up after yourself.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

// ── The front door ────────────────────────────────────────────────────────────

describe('Composer — the app opens on Chat', () => {
  it('boots into Chat, not Test — a fresh thread never demands a URL first', async () => {
    mockOpenThread([]);
    renderWithClient(<Composer />);

    await waitFor(() => expect(armedSkill()).toBe('Chat'));
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    // The placeholder is the per-skill instruction now — it must invite a sentence.
    expect(field.placeholder).toMatch(/ask about your niche/i);
    expect(field.placeholder).not.toMatch(/paste a tiktok/i);
  });

  /**
   * ⚠️ THIS ASSERTION IS INVERTED ON PURPOSE (2026-07-28, Lane 2 step 5).
   *
   * It used to read "restores the tool of a thread that HAS cards" — reloading a thread of hook
   * cards came back with Hooks armed, because every thread-view gate needed `activeTool ===`
   * its tool to render anything at all. Lane 1 deleted those gates, and the one-shot makes the
   * restore actively dangerous: with the skill pill gone there is nothing to disarm with, so a
   * reload that silently re-armed Hooks would bill the creator's next plain sentence as another
   * pack. THE ARM NEVER SURVIVES A RELOAD.
   *
   * What the thread's last card still tells us is which skill produced what is on screen —
   * that is `runningTool`, which is seeded here and keeps the Room Rewrite CTA alive without
   * arming anything. The thread still renders in full; only the ARM resets.
   */
  it('does NOT restore an arm from a thread that HAS cards — reloading is not re-arming', async () => {
    mockOpenThread([{ type: 'hook-card', props: {} }]);
    renderWithClient(<Composer />);

    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
    expect(armedSkill()).toBe('Chat');
    expect(screen.queryByTestId('composer-armed-skill')).toBeNull();
  });

  /**
   * THE BUG. An empty thread has no card to restore from, and the restore had no else — so
   * `setActiveTool` simply never ran and the previous thread's skill stayed armed.
   */
  it('a thread with NO cards resets to Chat — it does not inherit the last skill', async () => {
    mockOpenThread([]);
    renderWithClient(<Composer />);
    await waitFor(() => expect(armedSkill()).toBe('Chat'));

    // Arm Hooks by hand, exactly as a creator would…
    selectSkillBySlash('hooks');
    await waitFor(() => expect(armedSkill()).toBe('Hooks'));

    // …then land on an empty thread. It must come back to the front door, not to Hooks.
    // (A user pick wins over the restore while in flight — hence the explicit remount.)
    cleanup();
    mockOpenThread([]);
    renderWithClient(<Composer />);
    await waitFor(() => expect(armedSkill()).toBe('Chat'));
  });
});

// ── The chip names the skill ──────────────────────────────────────────────────

describe('Composer — the armed skill is named by its own label, not its verb group', () => {
  it.each([
    ['hooks', 'Hooks'],
    ['script', 'Script'],
    ['explore', 'Explore'],
    ['remix', 'Remix'],
  ])('arming /%s states "%s" (all four used to say "Make")', async (cmd, label) => {
    mockOpenThread([]);
    renderWithClient(<Composer />);
    await waitFor(() => expect(armedSkill()).toBe('Chat'));

    selectSkillBySlash(cmd);
    await waitFor(() => expect(armedSkill()).toBe(label));
    expect(armedSkill()).not.toContain('Make');
  });
});

// ── Account rides the send button ─────────────────────────────────────────────

describe('Composer — Account is sendable (its door in every state)', () => {
  it('enables send on an EMPTY field — the empty field is not a missing input', async () => {
    mockOpenThread([]);
    renderWithClient(<Composer />);
    await waitFor(() => expect(armedSkill()).toBe('Chat'));

    // Chat with an empty field: nothing to send.
    expect(sendBtn()).toBeDisabled();

    selectSkillBySlash('account');
    await waitFor(() => expect(armedSkill()).toBe('Your account'));

    // Account takes no input, so send is live with the field untouched.
    expect(sendBtn()).not.toBeDisabled();
  });

  it('send RUNS the read', async () => {
    mockOpenThread([]);
    renderWithClient(<Composer />);
    await waitFor(() => expect(armedSkill()).toBe('Chat'));

    selectSkillBySlash('account');
    await waitFor(() => expect(armedSkill()).toBe('Your account'));
    expect(accountStart).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(sendBtn());
    });

    expect(accountStart).toHaveBeenCalledTimes(1);
    // The read resolves the creator's own handle server-side — the client sends no body,
    // and above all it does NOT route through the video/analysis stream.
    expect(analysisStart).not.toHaveBeenCalled();
  });

  it('NEVER runs the read on render or on mere selection — it spends a Reading (D-05)', async () => {
    mockOpenThread([]);
    renderWithClient(<Composer />);
    await waitFor(() => expect(armedSkill()).toBe('Chat'));

    expect(accountStart).not.toHaveBeenCalled();

    selectSkillBySlash('account');
    await waitFor(() => expect(armedSkill()).toBe('Your account'));

    // Arming is not running. Only the send (or the starter card) may spend.
    expect(accountStart).not.toHaveBeenCalled();
  });

  it('announces itself as a Read, not as "Simulate"', async () => {
    mockOpenThread([]);
    renderWithClient(<Composer />);
    await waitFor(() => expect(armedSkill()).toBe('Chat'));

    selectSkillBySlash('account');
    await waitFor(() => expect(armedSkill()).toBe('Your account'));

    expect(sendBtn()).toHaveAttribute('aria-label', 'Read my account');
  });
});
