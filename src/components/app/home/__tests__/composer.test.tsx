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

    // The Read card renders through the real MessageBlocks registry — eyebrow +
    // interpretation prove the actual renderer mounted, not a placeholder.
    await waitFor(() => {
      expect(screen.getByText('The Read')).toBeInTheDocument();
    });
    expect(screen.getByText(/General wins \(Strong\)\./)).toBeInTheDocument();
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

  it('a stamped thread reloads into the chat view: card AND co-pilot line both render', async () => {
    installFetchMockWithThread([
      { role: 'user', blocks: [{ type: 'markdown', props: { text: 'ideas about morning routines' } }] },
      { role: 'assistant', blocks: [IDEA_CARD] },
      { role: 'assistant', blocks: [COPILOT_LINE] },
    ]);
    renderWithClient(<Composer />);
    // The card lands...
    expect(await screen.findByText('The 5am myth')).toBeInTheDocument();
    // ...and the co-pilot line renders too — only possible in the CHAT view (ideas view shows no markdown).
    expect(await screen.findByText(/want hooks/i)).toBeInTheDocument();
  });

  it('an UNSTAMPED thread (selector) does NOT render the co-pilot line in a card view', async () => {
    // Same cards, but the markdown carries NO origin marker → isChatAgentThread false → activeTool
    // restores to "idea" and the ideas view (idea-cards only) renders — the markdown line is absent.
    installFetchMockWithThread([
      { role: 'user', blocks: [{ type: 'markdown', props: { text: 'ideas about morning routines' } }] },
      { role: 'assistant', blocks: [IDEA_CARD] },
      { role: 'assistant', blocks: [{ type: 'markdown', props: { text: 'Here are 3 ideas — want hooks?' } }] },
    ]);
    renderWithClient(<Composer />);
    expect(await screen.findByText('The 5am myth')).toBeInTheDocument();
    // The unmarked co-pilot line is NOT surfaced (ideas view renders no markdown) — proves no accidental
    // unification of ordinary selector threads.
    await waitFor(() => expect(screen.queryByText(/want hooks/i)).toBeNull());
  });
});

// ── B (07-18): "Ask the room" is a VERB, not a hidden `audienceOpen` MODE ─────
// The old mode silently rerouted the composer field to the room; after P2 made the room
// always-present, a permanently-open rail made handleSubmit unreachable. Ask is a skill now
// (activeTool === "ask" → askAudience → POST /api/tools/react). Each of these FAILS against the
// pre-07-18 composer: `/ask` matched no skill, so send fell through to the chat/skill pipeline,
// /api/tools/react was never called, and the placement-neutral placeholder did not exist. The
// old "Ask your audience…" string only ever appeared while the (now-deleted) mode was open.
describe('Composer — Ask the room is a verb (07-18)', () => {
  beforeEach(() => {
    installFetchMock();
    hooksStart.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('routes send to /api/tools/react when the Ask verb is armed (never the skill pipeline)', async () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('ask');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'a hot take on protein timing' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(calledWith('/api/tools/react')).toBe(true));
    // ...and it did NOT fall through to a content-generation stream.
    expect(hooksStart).not.toHaveBeenCalled();
  });

  it('arming Ask shows the placement-neutral placeholder, never the retired "Ask your audience…" mode string', () => {
    renderWithClient(<Composer />);
    selectSkillBySlash('ask');
    expect(screen.getByPlaceholderText(/watch the whole room react/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask your audience/i)).toBeNull();
  });

  it('still streams a real skill (Hooks) — the verb split did not break content generation', async () => {
    const { container } = renderWithClient(<Composer />);
    selectSkillBySlash('hooks');
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'protein timing' } });
    fireEvent.click(submitBtn(container));
    await waitFor(() => expect(hooksStart).toHaveBeenCalled());
    expect(calledWith('/api/tools/react')).toBe(false);
  });
});
