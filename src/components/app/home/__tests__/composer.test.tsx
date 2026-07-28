/** @vitest-environment happy-dom */
/**
 * Composer — TikTok URL validation + upload mount (SHELL-02/03, D-21).
 *
 * London-style: useAnalysisStream, useProfile, next/navigation, and the
 * motion/viewport hooks are mocked so the test drives the composer's pure
 * UX behavior deterministically.
 *  - A TikTok URL (tiktok.com / vm.tiktok.com) enables the submit control.
 *  - A non-TikTok URL (youtube / instagram) shows the exact D-21 copy and
 *    keeps submit disabled.
 *  - The `+` control mounts VideoUpload (its hidden "Upload video file" input).
 *
 * Written first (Task 1) — RED until the slim composer (Task 2) lands.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

// ── controllable stream mock ────────────────────────────────────────────
const start = vi.fn();
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
// id absent by default → composer is in the centered/empty layout
let routeId: string | undefined;
vi.mock('next/navigation', () => ({
  useParams: () => (routeId ? { id: routeId } : {}),
  usePathname: () => '/home',
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

// Supabase client is only touched on an upload submit; stub it so a stray
// import never throws under happy-dom.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    storage: {
      from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }),
    },
  }),
}));

// ── hooks stream mock (07-04 byte-identical Socials guard) ───────────────────
// Mocked so a Socials submit (hooks) can be observed via a spy without driving the
// real SSE reader. The other stream hooks stay real (idle) — the existing tests rely
// on that. Shape mirrors what composer.tsx reads off useHooksStream.
const hooksStart = vi.fn();
vi.mock('@/hooks/queries/use-hooks-stream', () => ({
  useHooksStream: () => ({
    start: hooksStart,
    startRefine: vi.fn(),
    reset: vi.fn(),
    toBlocks: () => [],
    isStreaming: false,
    statusMessage: undefined,
    stages: [],
    followupText: undefined,
    error: null,
  }),
}));

import { Composer } from '../composer';
import { HORIZONTAL_ENABLED } from '@/lib/flags/horizontal';
import { AMBIENT_V2_ENABLED } from '@/lib/flags/ambient-v2';
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from '@/lib/threads/active-thread-cookie';

const D21 = 'Maven reads TikTok videos for now';

// ── General-verb (07-04) test scaffolding ────────────────────────────────────
// A General-mode audience (non-UUID id so handleSelectAudience skips the thread PATCH).
const GENERAL_AUD = {
  id: 'gen-1',
  name: 'Analyst Panel',
  mode: 'general',
  is_general: false,
  is_preset: false,
  platform: 'tiktok',
  goal_label: null,
  goal_intent: null,
  personas: [],
};

type FetchCall = { url: string; init?: RequestInit };
let fetchCalls: FetchCall[] = [];

/** Route the composer's mount + submit fetches to inert JSON; record every call. */
function installFetchMock() {
  fetchCalls = [];
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetchCalls.push({ url, init });
    let body: unknown = {};
    if (url.includes('/api/audiences')) body = { audiences: [GENERAL_AUD] };
    else if (url.includes('/api/threads/new')) body = { threadId: 't-new' };
    else if (url.includes('/api/threads/open')) body = { threadId: 't1', messages: [] };
    else if (url.includes('/api/tracked-accounts')) body = { accounts: [] };
    else if (url.includes('/api/tools/simulate') || url.includes('/api/tools/predict')) {
      body = { block: { type: 'reaction-distribution', props: {} } };
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    } as Response);
  }) as typeof fetch;
}

function calledWith(substr: string): boolean {
  return fetchCalls.some((c) => c.url.includes(substr));
}

function submitBtn(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button[type="submit"]') as HTMLButtonElement;
}

/**
 * Select a skill via the `/` slash menu (Enter resolves firstSlashSkill).
 * NOTE: firstSlashSkill shares isSkillVisible with the menu — Socials skills resolve
 * only in socials mode, but the General verbs (Profile/Simulate/Predict) are ALWAYS
 * resolvable (refine lane), matching the always-visible General group. The home
 * quick-actions grid reaches the creator skills the same way (handleUserSelectTool).
 */
function selectSkillBySlash(command: string) {
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: `/${command}` } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

function urlInput(): HTMLInputElement {
  // The single URL/text input — match by its empty-state placeholder.
  return screen.getByPlaceholderText(/paste a tiktok link/i) as HTMLInputElement;
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /simulate|submit|send/i }) as HTMLButtonElement;
}

beforeEach(() => {
  start.mockClear();
  push.mockClear();
  analysisId = null;
  routeId = undefined;
  cleanup();
});

/**
 * ⚠️ These arm Test explicitly, and did not always have to.
 *
 * The composer used to BOOT into Test, so a bare <Composer /> was already a URL field and
 * these tests could paste straight into it. It now boots into Chat (the app's front door is
 * a sentence, not a demand for an asset), so Test is one pick away — exactly as it is for a
 * real creator. Arming it here is not test scaffolding; it is the test finally doing what
 * the user does.
 */
describe('Composer — TikTok URL validation (D-21)', () => {
  it('enables submit when a tiktok.com URL is pasted', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.tiktok.com/@creator/video/123' },
    });
    expect(submitButton()).not.toBeDisabled();
  });

  it('enables submit for a vm.tiktok.com short link', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), { target: { value: 'https://vm.tiktok.com/AbCdEf/' } });
    expect(submitButton()).not.toBeDisabled();
  });

  it('rejects a non-TikTok URL with the exact D-21 copy and keeps submit disabled', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.youtube.com/watch?v=abc' },
    });
    expect(screen.getByText(new RegExp(D21, 'i'))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('rejects an Instagram URL (TikTok-only — ContentForm allowed IG, the slim composer must not)', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.instagram.com/reel/abc/' },
    });
    expect(screen.getByText(new RegExp(D21, 'i'))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('does not fire stream.start while the URL is invalid', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), { target: { value: 'not-a-url' } });
    const btn = submitButton();
    fireEvent.click(btn);
    expect(start).not.toHaveBeenCalled();
  });
});

describe('Composer — upload control (SHELL-03)', () => {
  it('mounts VideoUpload (its hidden file input) for the + control', () => {
    renderWithClient(<Composer />);
    // VideoUpload renders an <input type=file aria-label="Upload video file">.
    expect(screen.getByLabelText(/upload video file/i)).toBeInTheDocument();
  });
});

// ── General-verb submit semantics (07-04 / UX-02 / D-07) ─────────────────────
describe('Composer — General verbs (Profile / Simulate / Predict)', () => {
  beforeEach(() => {
    installFetchMock();
    hooksStart.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Open the audience switcher and pick the General-mode audience. */
  async function selectGeneralAudience() {
    // Wait for the mount /api/audiences fetch to populate the picker.
    await waitFor(() => expect(calledWith('/api/audiences')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /switch audience/i }));
    const menu = await screen.findByRole('menu', { name: /your audiences/i });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /analyst panel/i }));
  }

  it.skipIf(!HORIZONTAL_ENABLED)('a General verb with NO General audience does not fire a stimulus and routes to Build', async () => {
    const { container } = renderWithClient(<Composer />);
    // No audience selected (General/null). A General verb (Predict) is activated via
    // the `/` slash menu — always resolvable for the General verbs. The T-07-04-01
    // gate (shared by simulate + predict) then routes to Build without firing — same
    // behavior whether the verb was picked via a quick action, menu, or slash.
    selectSkillBySlash('predict');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'will this resonate?' } });
    fireEvent.click(submitBtn(container));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/audience/new'));
    // The gate held — no stimulus fired (T-07-04-01).
    expect(calledWith('/api/tools/predict')).toBe(false);
  });

  it.skipIf(!HORIZONTAL_ENABLED)('Simulate with a selected General audience POSTs /api/tools/simulate with the audienceId', async () => {
    const { container } = renderWithClient(<Composer />);
    await selectGeneralAudience();
    selectSkillBySlash('simulate');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'will this resonate?' } });
    fireEvent.click(submitBtn(container));

    await waitFor(() => expect(calledWith('/api/tools/simulate')).toBe(true));
    const call = fetchCalls.find((c) => c.url.includes('/api/tools/simulate'))!;
    const body = JSON.parse(String(call.init?.body));
    expect(body.audienceId).toBe('gen-1');
    expect(body.message).toBe('will this resonate?');
    expect(push).not.toHaveBeenCalledWith('/audience/new');
  });

  it.skipIf(!HORIZONTAL_ENABLED)('Predict with a selected General audience POSTs /api/tools/predict with the audienceId + scenario', async () => {
    const { container } = renderWithClient(<Composer />);
    await selectGeneralAudience();
    selectSkillBySlash('predict');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'we double our price' } });
    fireEvent.click(submitBtn(container));

    await waitFor(() => expect(calledWith('/api/tools/predict')).toBe(true));
    const call = fetchCalls.find((c) => c.url.includes('/api/tools/predict'))!;
    const body = JSON.parse(String(call.init?.body));
    expect(body.audienceId).toBe('gen-1');
    expect(body.scenario).toBe('we double our price');
  });

  it.skipIf(!HORIZONTAL_ENABLED)('selecting Profile opens the evidence-drop file input (not a topic submit)', () => {
    const { container } = renderWithClient(<Composer />);
    const evidenceInput = container.querySelector(
      'input[type="file"][accept*=".txt"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(evidenceInput, 'click');
    // Profile is a General verb — always resolvable via the `/` slash menu, which
    // calls handleUserSelectTool("profile") and opens the evidence-drop picker.
    selectSkillBySlash('profile');
    expect(clickSpy).toHaveBeenCalled();
    // Profile never routes through the topic submit path.
    expect(calledWith('/api/tools/profile')).toBe(false);
  });

  it('a Socials submit (hooks) still fires its stream path, never a General route', async () => {
    const { container } = renderWithClient(<Composer />);
    selectSkillBySlash('hooks');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'morning routine' } });
    fireEvent.click(submitBtn(container));

    await waitFor(() => expect(hooksStart).toHaveBeenCalled());
    expect(calledWith('/api/tools/simulate')).toBe(false);
    expect(calledWith('/api/tools/predict')).toBe(false);
  });
});

// ── Persisted Read restore (P3 follow-up) ─────────────────────────────────────
// The rehydration whitelist never included `multi-audience-read`, so a persisted
// Read NEVER re-rendered on the thread surface — the block sat valid in the DB
// while the thread showed everything around it (live-caught 2026-07-17). It now
// rides the tool-agnostic bucket (profile-read / reaction-distribution /
// prediction-gauge), rendered via MessageBlocks regardless of activeTool.
describe('Composer — persisted multi-audience-read restores on the thread', () => {
  beforeEach(() => {
    installFetchMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a persisted Read block after rehydration', async () => {
    // Override the open-thread mount fetch: ONE assistant message holding a
    // single-audience Read (the P3 default shape).
    const READ_BLOCK = {
      type: 'multi-audience-read',
      props: {
        model: 'sim1-flash',
        tier: 'Validated',
        concept: 'I fired my whole marketing team.',
        audiences: [
          {
            name: 'General',
            band: 'Strong',
            fraction: '7/10 stop',
            interpretation: 'General wins (Strong).',
            lever: 'Strong for General. Calibrate a second audience to see where it diverges.',
            whoNotFor: '',
            personas: [],
          },
        ],
      },
    };
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown = {};
      if (url.includes('/api/audiences')) body = { audiences: [] };
      else if (url.includes('/api/threads/open')) {
        body = {
          threadId: 't1',
          messages: [{ id: 'm1', role: 'assistant', blocks: [READ_BLOCK] }],
        };
      } else if (url.includes('/api/tracked-accounts')) body = { accounts: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }) as typeof fetch;

    renderWithClient(<Composer />);

    // The Read card renders through the real MessageBlocks registry — the interpretation
    // line proves the actual renderer mounted, not a placeholder. (The old "The Read" eyebrow
    // was removed 2026-07-21 as generic restatement; asserting on it left this test waiting on
    // deleted chrome — the timeout is what surfaced the stray :3000 fetch during teardown.)
    await waitFor(() => {
      expect(screen.getByText(/General wins \(Strong\)\./)).toBeInTheDocument();
    });
  });
});

// ── Chat-as-agent unified reload (CHAT_AGENT_DISPATCH) ───────────────────────
// On reload of a thread STAMPED chat-agent, the composer must land in the chat view and render the
// whole ordered stream there — NOT split the cards into the ideas view. The discriminator: the
// co-pilot markdown line only renders in the chat view (the ideas view renders idea-cards only), so
// asserting BOTH the card AND the co-pilot line prove activeTool flipped to "chat".
describe('Composer — chat-agent unified reload', () => {
  const IDEA_CARD = {
    type: 'idea-card',
    props: {
      title: 'The 5am myth', angle: 'contrarian', whyItFits: 'your audience distrusts hustle culture',
      mechanism: 'pattern-break', seedHook: 'Everyone lied about 5am', needsTake: false,
      topic: 'morning routines', take: '', format: null, band: 'Strong', fraction: '4/5',
      scored: true, scrollQuote: 'Everyone lied to you about 5am', model: 'sim1-flash',
    },
  };
  const COPILOT_LINE = { type: 'markdown', props: { text: 'I generated 3 angles — want hooks?', origin: 'chat-agent' } };

  function installFetchMockWithThread(messages: unknown[]) {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown = {};
      if (url.includes('/api/audiences')) body = { audiences: [GENERAL_AUD] };
      else if (url.includes('/api/threads/open')) body = { threadId: 't1', messages };
      else if (url.includes('/api/tracked-accounts')) body = { accounts: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }) as typeof fetch;
  }

  afterEach(() => vi.restoreAllMocks());

  it('a stamped thread reloads into the unified stream: card AND co-pilot line both render', async () => {
    installFetchMockWithThread([
      { role: 'user', blocks: [{ type: 'markdown', props: { text: 'ideas about morning routines' } }] },
      { role: 'assistant', blocks: [IDEA_CARD] },
      { role: 'assistant', blocks: [COPILOT_LINE] },
    ]);
    renderWithClient(<Composer />);
    // The card lands...
    expect(await screen.findByText('The 5am myth')).toBeInTheDocument();
    // ...and the co-pilot line renders too — the unified PersistedThreadStream renders every block type.
    expect(await screen.findByText(/want hooks/i)).toBeInTheDocument();
  });

  it('an UNSTAMPED thread (selector) ALSO renders its co-pilot line — unified stream, no more vanishing text', async () => {
    // Thread-unification (symptom 1 fix): the co-pilot markdown line beside the cards used to DISAPPEAR on
    // reload of an ordinary selector thread — the old per-tool partition dropped every block type its
    // active tool didn't own, so the ideas view showed cards but never the markdown. PersistedThreadStream
    // now renders the whole ordered thread (any block type) regardless of the chat-agent stamp, so the
    // line survives the reload. This assertion is the INVERSE of the retired guard (which locked the bug).
    installFetchMockWithThread([
      { role: 'user', blocks: [{ type: 'markdown', props: { text: 'ideas about morning routines' } }] },
      { role: 'assistant', blocks: [IDEA_CARD] },
      { role: 'assistant', blocks: [{ type: 'markdown', props: { text: 'Here are 3 ideas — want hooks?' } }] },
    ]);
    renderWithClient(<Composer />);
    expect(await screen.findByText('The 5am myth')).toBeInTheDocument();
    // The unmarked co-pilot line IS now surfaced (the disappearing-text bug is fixed).
    expect(await screen.findByText(/want hooks/i)).toBeInTheDocument();
  });
});

// ── Lane 2 (2026-07-28): the skill pill is DELETED, and an arm lasts exactly one send ──
//
// Three owner calls land here at once, and they only make sense together:
//   step 3 — the skill PILL is gone. It was a picker; the `/` slash menu is the picker now.
//   step 4 — the `ask` VERB is gone. It POSTed the (newly priced) /api/tools/react and its
//            result rendered nowhere, so it billed for silence. The ROUTE and its price stay,
//            reached through the room's own armed sim.
//   step 5 — a skill is armed for ONE send (the one-shot), then the composer is back on chat.
//
// Step 5 is not a nicety layered on step 3: without the pill there is no chip to un-arm
// yourself with, so an arm that outlived its run would silently bill every later sentence as
// another pack. These assertions FAIL against the pre-Lane-2 composer.
describe('Composer — the skill pill is gone (step 3)', () => {
  beforeEach(() => {
    installFetchMock();
    hooksStart.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('mounts no skill picker at rest — no pill, no popover trigger, no rows', () => {
    renderWithClient(<Composer />);
    // document, not the container: the pill's popover PORTALED to <body>, so a container-only
    // query would pass even with the pill mounted and open.
    expect(document.getElementById('composer-skill-pill')).toBeNull();
    expect(screen.queryByRole('button', { name: /^skill:/i })).toBeNull();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });

  it('still opens the `/` slash menu — the door the owner kept', () => {
    renderWithClient(<Composer />);
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: '/' } });
    expect(screen.getByRole('menu', { name: /skills/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /hooks/i })).toBeInTheDocument();
  });

  it('and that door still arms a skill that then runs', async () => {
    const { container } = renderWithClient(<Composer />);
    selectSkillBySlash('hooks');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'protein timing' } });
    fireEvent.click(submitBtn(container));
    await waitFor(() => expect(hooksStart).toHaveBeenCalled());
  });
});

describe('Composer — the armed skill is STATED, since nothing else says it (step 3)', () => {
  beforeEach(() => {
    installFetchMock();
    hooksStart.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows nothing while chat (the front door) is armed', () => {
    renderWithClient(<Composer />);
    expect(screen.queryByTestId('composer-armed-skill')).toBeNull();
  });

  it('names the armed skill once one is armed', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('hooks');
    const armed = screen.getByTestId('composer-armed-skill');
    expect(armed).toHaveTextContent('Hooks');
    expect(armed).toHaveAttribute('data-skill', 'hooks');
  });

  /**
   * The indicator is NOT a smaller pill: it states, it does not pick. Its only control is the
   * one that gets you out. If this ever grows a menu it has become the thing that was deleted.
   */
  it('offers no menu — only a way back to chat', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    const armed = screen.getByTestId('composer-armed-skill');
    expect(within(armed).getAllByRole('button')).toHaveLength(1);
    expect(armed).not.toHaveAttribute('aria-haspopup');

    fireEvent.click(within(armed).getByRole('button', { name: /back to chat/i }));
    expect(screen.queryByTestId('composer-armed-skill')).toBeNull();
    expect(screen.getByPlaceholderText(/ask about your niche/i)).toBeInTheDocument();
  });
});

describe('Composer — an arm lasts exactly ONE send (step 5, the one-shot)', () => {
  beforeEach(() => {
    installFetchMock();
    hooksStart.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('disarms the moment the run is dispatched, and the NEXT send is a chat turn', async () => {
    const { container } = renderWithClient(<Composer />);
    selectSkillBySlash('hooks');
    expect(screen.getByTestId('composer-armed-skill')).toHaveAttribute('data-skill', 'hooks');

    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'protein timing' } });
    fireEvent.click(submitBtn(container));
    await waitFor(() => expect(hooksStart).toHaveBeenCalledTimes(1));

    // Disarmed: the indicator is gone and the placeholder is chat's again.
    await waitFor(() => expect(screen.queryByTestId('composer-armed-skill')).toBeNull());
    expect(screen.getByPlaceholderText(/ask about your niche/i)).toBeInTheDocument();

    // THE POINT: the next sentence is a conversation, not a second billed hooks pack.
    fireEvent.change(field, { target: { value: 'which one should I shoot?' } });
    fireEvent.click(submitBtn(container));
    await waitFor(() => expect(calledWith('/api/tools/chat')).toBe(true));
    expect(hooksStart).toHaveBeenCalledTimes(1);
  });

  /**
   * The other half of the contract. A branch that BAILS before dispatching must keep the arm,
   * or a creator whose upload failed would have to walk back to the Start grid to try again.
   * Test with an empty field: canSubmit is false, handleSubmit never dispatches.
   */
  it('keeps the arm when a send does NOT dispatch a run', () => {
    const { container } = renderWithClient(<Composer />);
    selectSkillBySlash('remix'); // remix requires a URL — an empty send cannot fire
    fireEvent.click(submitBtn(container));
    expect(screen.getByTestId('composer-armed-skill')).toHaveAttribute('data-skill', 'remix');
  });

  /**
   * The trap this design exists to avoid. A reload used to restore the arm from the thread's
   * last card — so opening a thread of hook cards left Hooks silently armed. With no pill to
   * disarm with, every later sentence would have bought another pack.
   */
  it('never restores an arm from a reloaded thread', async () => {
    // A thread whose LAST card is a hook-card — exactly what used to restore an armed Hooks.
    const messages = [
      { role: 'user', blocks: [{ type: 'markdown', props: { text: 'hooks about protein' } }] },
      {
        role: 'assistant',
        blocks: [
          { type: 'markdown', props: { text: 'A PRIOR TURN' } },
          { type: 'hook-card', props: { rank: 1, hook: 'A prior hook', band: 'Strong', fraction: '4/5' } },
        ],
      },
    ];
    fetchCalls = [];
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      fetchCalls.push({ url });
      let body: unknown = {};
      if (url.includes('/api/audiences')) body = { audiences: [GENERAL_AUD] };
      else if (url.includes('/api/threads/open')) body = { threadId: 't1', messages };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }) as typeof fetch;

    renderWithClient(<Composer />);
    // Wait for the rehydration to actually land before asserting on the arm — otherwise this
    // passes trivially against the pre-fix composer, which had not restored anything yet.
    expect(await screen.findByText('A PRIOR TURN')).toBeInTheDocument();
    expect(screen.queryByTestId('composer-armed-skill')).toBeNull();
    expect(screen.getByPlaceholderText(/ask about your niche/i)).toBeInTheDocument();
  });
});

describe('Composer — "Ask the room" is gone from the field (step 4)', () => {
  beforeEach(() => {
    installFetchMock();
    hooksStart.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('has no ask skill to arm — `/ask` matches nothing', () => {
    renderWithClient(<Composer />);
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: '/ask' } });
    expect(screen.queryByRole('menuitemradio', { name: /ask the room/i })).toBeNull();
    fireEvent.keyDown(field, { key: 'Enter' });
    // Nothing resolved, so nothing was armed and the query is still sitting in the field.
    expect(field.value).toBe('/ask');
    expect(screen.queryByTestId('composer-armed-skill')).toBeNull();
  });

  /**
   * The billing half. /api/tools/react is priced at 1 credit; the composer field used to be a
   * second, blind door to it. No path through the field may reach it now.
   */
  it('never POSTs /api/tools/react, whatever is sent', async () => {
    const { container } = renderWithClient(<Composer />);
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: 'does this hook land?' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(calledWith('/api/tools/chat')).toBe(true));

    selectSkillBySlash('hooks');
    fireEvent.change(field, { target: { value: 'protein timing' } });
    fireEvent.click(submitBtn(container));
    await waitFor(() => expect(hooksStart).toHaveBeenCalled());

    expect(calledWith('/api/tools/react')).toBe(false);
  });

  it('still streams a real skill — removing the verb did not touch generation', async () => {
    const { container } = renderWithClient(<Composer />);
    selectSkillBySlash('hooks');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'protein timing' } });
    fireEvent.click(submitBtn(container));
    await waitFor(() => expect(hooksStart).toHaveBeenCalled());
    expect(calledWith('/api/tools/react')).toBe(false);
  });
});

// ── F-019: the paid video-Test card must land in a thread the UI can open ────
// A Test sent as the FIRST send of a new thread used to strand its own result. Two
// independent breaks, one symptom (a ~4.5-min paid Max run completing into a blank screen):
//   L1 — `test` was excluded from ensureThreadForSend, so the active-thread pointer stayed
//        on the sentinel for the whole run and every server-side createOpenThreadLazy minted
//        a FRESH row; the sealed card landed in a thread the client never pointed at.
//   L2 — even pointed at the RIGHT thread, hasConversationContent counted only the per-skill
//        buckets, and `video-test-card` is the one block type outside all of them, so the
//        Start grid rendered OVER the card the API had just returned.
// Both assertions below FAIL against the pre-fix composer.
describe('Composer — the Test send materialises its thread (F-019 layer 1)', () => {
  beforeEach(() => {
    installFetchMock();
    document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
  });
  afterEach(() => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
    vi.restoreAllMocks();
  });

  it('a Test send off a NEW thread POSTs /api/threads/new before starting the run', async () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.tiktok.com/@creator/video/123' },
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(calledWith('/api/threads/new')).toBe(true));
    // ...and the run itself still fires (the thread creation is a prelude, not a detour).
    await waitFor(() => expect(start).toHaveBeenCalled());
  });

  it('persists the Test user turn AFTER the thread exists, so a reload shows the question above the card', async () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.tiktok.com/@creator/video/123' },
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(calledWith('/api/threads/user-turn')).toBe(true));
    const turnCall = fetchCalls.find((c) => c.url.includes('/api/threads/user-turn'))!;
    expect(JSON.parse(String(turnCall.init?.body)).text).toBe(
      'https://www.tiktok.com/@creator/video/123',
    );
    // ORDERING is the contract: the turn must target the thread ensureThreadForSend just
    // created, never the sentinel (which would mint a second row server-side).
    const newIdx = fetchCalls.findIndex((c) => c.url.includes('/api/threads/new'));
    const turnIdx = fetchCalls.findIndex((c) => c.url.includes('/api/threads/user-turn'));
    expect(newIdx).toBeGreaterThanOrEqual(0);
    expect(newIdx).toBeLessThan(turnIdx);
  });

  it('an EXISTING thread is reused — no second row minted on a Test send', async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=t1; path=/`;
    renderWithClient(<Composer />);
    selectSkillBySlash('test');
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.tiktok.com/@creator/video/123' },
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(calledWith('/api/threads/new')).toBe(false);
  });

  // T-03-13 in its original form: arming the seal is EXCLUSIVE to the Test path. The Idea
  // send must still never navigate to /analyze — adding `test` to the two sets above must
  // not have widened either one.
  it('an Idea send still creates its thread and never routes to /analyze', async () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('idea');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'morning routines' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() => expect(calledWith('/api/threads/new')).toBe(true));
    expect(start).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/analyze/'));
  });
});

describe('Composer — a Test-only thread renders its card (F-019 layer 2)', () => {
  const VIDEO_TEST_CARD = {
    type: 'video-test-card',
    props: {
      craftScore: 77,
      drivers: [{ name: 'Hook', score: 82, band: 'strong' }],
      filmstrip: [],
      dropLabel: null,
      durationLabel: '0:29',
      working: ['The cold open lands'],
      notWorking: [],
      fixes: [],
      audienceName: 'Your audience',
      analysisId: 'an-1',
      model: 'sim1-max',
      tier: 'Validated',
    },
  };

  /**
   * The stranded thread EXACTLY as F-019 left it: ONE assistant message holding the sealed
   * card, and NO user turn (pre-fix, `test` was outside USER_TURN_TOOLS, so nothing else was
   * ever written). The user message is deliberately absent — with one present, `lastUserTurn`
   * flips hasConversationContent on its own and the layer-2 break hides.
   */
  function installThreadWithCard() {
    fetchCalls = [];
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      fetchCalls.push({ url });
      let body: unknown = {};
      if (url.includes('/api/audiences')) body = { audiences: [GENERAL_AUD] };
      else if (url.includes('/api/threads/open')) {
        body = {
          threadId: 't1',
          messages: [{ id: 'm1', role: 'assistant', blocks: [VIDEO_TEST_CARD] }],
        };
      } else if (url.includes('/api/tracked-accounts')) body = { accounts: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }) as typeof fetch;
  }

  afterEach(() => vi.restoreAllMocks());

  it('renders the sealed card on rehydration — the one block type outside every per-skill bucket', async () => {
    installThreadWithCard();
    renderWithClient(<Composer />);
    // The working-ledger line proves the real VideoTestCardRenderer mounted, not a placeholder.
    expect(await screen.findByText('The cold open lands')).toBeInTheDocument();
  });

  it.skipIf(!AMBIENT_V2_ENABLED)('does NOT render the Start grid over it', async () => {
    installThreadWithCard();
    renderWithClient(<Composer />);
    await screen.findByText('The cold open lands');
    // "Concepts worth making" is the Ideas tile's lens — present only on the Start grid.
    expect(screen.queryByText(/Concepts worth making/i)).toBeNull();
  });
});
