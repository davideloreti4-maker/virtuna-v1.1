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

describe('Composer — TikTok URL validation (D-21)', () => {
  it('enables submit when a tiktok.com URL is pasted', () => {
    renderWithClient(<Composer />);
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.tiktok.com/@creator/video/123' },
    });
    expect(submitButton()).not.toBeDisabled();
  });

  it('enables submit for a vm.tiktok.com short link', () => {
    renderWithClient(<Composer />);
    fireEvent.change(urlInput(), { target: { value: 'https://vm.tiktok.com/AbCdEf/' } });
    expect(submitButton()).not.toBeDisabled();
  });

  it('rejects a non-TikTok URL with the exact D-21 copy and keeps submit disabled', () => {
    renderWithClient(<Composer />);
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.youtube.com/watch?v=abc' },
    });
    expect(screen.getByText(new RegExp(D21, 'i'))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('rejects an Instagram URL (TikTok-only — ContentForm allowed IG, the slim composer must not)', () => {
    renderWithClient(<Composer />);
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.instagram.com/reel/abc/' },
    });
    expect(screen.getByText(new RegExp(D21, 'i'))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('does not fire stream.start while the URL is invalid', () => {
    renderWithClient(<Composer />);
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

  it('a General verb with NO General audience does not fire a stimulus and routes to Build', async () => {
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

  it('Simulate with a selected General audience POSTs /api/tools/simulate with the audienceId', async () => {
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

  it('Predict with a selected General audience POSTs /api/tools/predict with the audienceId + scenario', async () => {
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

  it('selecting Profile opens the evidence-drop file input (not a topic submit)', () => {
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
