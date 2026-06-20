/** @vitest-environment happy-dom */
/**
 * ambient-presence — the persistent living-audience presence (Surfaces 1/2/4 — AMBIENT-01,
 * D-01/D-02/D-04). A thin always-docked persona-cloud strip that spotlights ONE in-focus
 * concept, idles honestly when nothing is in focus, and opens the ONE shipped AudienceLens.
 *
 * These tests lock the honesty spine + the reuse contract:
 *  - IDLE (focus=null): roster dots + idle copy, NO `reacting to:` subject (never fabricate).
 *  - FOCUSED: exactly ONE `reacting to: {concept}` subject (never aggregated), dots toned.
 *  - One dot per calibrated persona; sr-only roster mirror present in BOTH states.
 *  - General audience (no personas): the `General audience · default panel` subtitle, no crash.
 *  - The open cue opens the shipped Lens when focused; a no-op at idle.
 *  - Source token/determinism guards: no legacy coral hex, no Math.random/Date.now, mulberry32,
 *    reducedMotion gated.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Audience, CalibratedPersona } from '@/lib/audience/audience-types';
import { ARCHETYPES } from '@/lib/engine/wave3/persona-registry';
import { AmbientPresence } from '../ambient-presence';
import type { AmbientFocus } from '../ambient-presence-types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SRC_PATH = join(process.cwd(), 'src/components/audience-lens/ambient-presence.tsx');
const readSrc = () => readFileSync(SRC_PATH, 'utf8');
/** Strip block + line comments so honesty-framing prose (which names the forbidden tokens to
 *  explain the rule) does not trip the file-level grep guards — assert against CODE, not prose. */
const readCode = () =>
  readSrc()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

// ── Fixtures ────────────────────────────────────────────────────────────────────
function persona(i: number): CalibratedPersona {
  return {
    archetype: ARCHETYPES[i % ARCHETYPES.length]!,
    repaint: `repaint-${i}`,
    temperature: 'warm',
    disposition: 'collector',
    share: 0.1,
  };
}

function calibrated10(): Audience {
  return {
    id: 'aud-1',
    user_id: 'u-1',
    name: 'Growth Audience',
    type: 'target',
    platform: 'tiktok',
    goal_label: 'grow',
    goal_intent: 'grow',
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: Array.from({ length: 10 }, (_, i) => persona(i)),
    profile: null,
    calibration: null,
    created_at: '2026-06-20T00:00:00Z',
    updated_at: '2026-06-20T00:00:00Z',
  };
}

function general(): Audience {
  return { ...calibrated10(), id: 'general', name: 'General', is_general: true, personas: [] };
}

const FOCUS: AmbientFocus = {
  conceptText: 'what if I open with a question?',
  fraction: '6/10 stop',
  scrollQuote: 'This made me stop scrolling.',
};

// ── Task 1: shell — dot-cloud + spotlight + idle + Lens door ─────────────────────
describe('AmbientPresence — idle state (D-01 honesty spine)', () => {
  it('shows the idle copy and renders the roster, with NO `reacting to:` subject', () => {
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    // Idle copy present (the inline sr-mirror always carries it; the visible strip too).
    expect(screen.getByTestId('ambient-presence').textContent).toContain(
      'Your people are here. Make something — or type a thought to test it.',
    );
    // The honesty assertion: NO subject rendered when nothing is in focus.
    expect(screen.queryByTestId('ambient-subject')).toBeNull();
    expect(screen.getByTestId('ambient-presence').textContent).not.toContain('reacting to:');
  });

  it('renders the roster dots at idle (one <circle> per calibrated persona)', () => {
    const { container } = render(<AmbientPresence audience={calibrated10()} focus={null} />);
    expect(container.querySelectorAll('circle').length).toBe(10);
  });

  it('renders the sr-only roster mirror at idle', () => {
    const { container } = render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const mirror = container.querySelector('.sr-only ul');
    expect(mirror).toBeTruthy();
    expect(mirror!.querySelectorAll('li').length).toBe(10);
  });
});

describe('AmbientPresence — focused spotlight (Surface 2, D-02 never aggregate)', () => {
  it('shows exactly ONE `reacting to: {concept}` subject (never two — no aggregation)', () => {
    render(<AmbientPresence audience={calibrated10()} focus={FOCUS} />);
    const subjects = screen.getAllByTestId('ambient-subject');
    expect(subjects.length).toBe(1);
    expect(subjects[0]!.textContent).toContain('reacting to:');
    expect(subjects[0]!.textContent).toContain('what if I open with a question?');
  });

  it('truncates the subject concept to one line (UI-SPEC §Typography)', () => {
    render(<AmbientPresence audience={calibrated10()} focus={FOCUS} />);
    expect(screen.getByTestId('ambient-subject').innerHTML).toContain('truncate');
  });

  it('renders one <circle> per persona when focused + keeps the sr-only mirror', () => {
    const { container } = render(<AmbientPresence audience={calibrated10()} focus={FOCUS} />);
    expect(container.querySelectorAll('circle').length).toBe(10);
    expect(container.querySelector('.sr-only ul')!.querySelectorAll('li').length).toBe(10);
  });
});

describe('AmbientPresence — General audience (empty personas, no crash)', () => {
  it('renders the `General audience · default panel` subtitle and does not crash', () => {
    render(<AmbientPresence audience={general()} focus={null} />);
    expect(screen.getByTestId('ambient-presence').textContent).toContain(
      'General audience · default panel',
    );
  });

  it('renders a small default roster for General (does not divide-by-zero on empty personas)', () => {
    const { container } = render(<AmbientPresence audience={general()} focus={null} />);
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
  });

  it('treats a null audience as General without crashing', () => {
    render(<AmbientPresence audience={null} focus={null} />);
    expect(screen.getByTestId('ambient-presence').textContent).toContain(
      'General audience · default panel',
    );
  });
});

describe('AmbientPresence — one Lens, many doors (D-05)', () => {
  it('opens the shipped AudienceLens when the cue is tapped while focused', () => {
    render(<AmbientPresence audience={calibrated10()} focus={FOCUS} />);
    // The Lens Sheet title is "Audience" — absent until the cue opens it.
    expect(screen.queryByText('Audience')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open the audience reaction for the in-focus concept',
      }),
    );
    // The shipped Lens mounted (its SheetTitle), scoped to the in-focus concept.
    expect(screen.getAllByText('Audience').length).toBeGreaterThan(0);
  });

  it('the open cue is a no-op at idle (nothing to open — never fabricate a reaction)', () => {
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Your audience' }));
    expect(screen.queryByText('Audience')).toBeNull();
  });
});

describe('AmbientPresence — source guards (token / determinism)', () => {
  it('has no legacy #FF7F50 / rgba(255,127,80) coral (THEME-06 SSOT is var(--color-accent))', () => {
    const code = readCode();
    expect(code).not.toMatch(/#FF7F50/i);
    expect(code).not.toMatch(/255\s*,\s*127\s*,\s*80/);
  });

  it('uses mulberry32 and no Math.random / Date.now in code (deterministic, SSR-safe)', () => {
    const code = readCode();
    expect(code).toContain('mulberry32');
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/Date\.now/);
  });

  it('gates motion on reducedMotion (UI-SPEC §Motion)', () => {
    const src = readSrc();
    expect(src).toMatch(/reducedMotion/);
  });

  it('makes no client-side Qwen call (no runFlashTextMode / getQwenClient — server-only)', () => {
    const code = readCode();
    expect(code).not.toMatch(/runFlashTextMode/);
    expect(code).not.toMatch(/getQwenClient/);
  });
});

// ── Task 2: type-to-room input — explicit-submit Flash reaction (D-04) ───────────
/** Expand the presence and return the type-to-room textarea + send button. */
function expandAndGetInput() {
  fireEvent.click(screen.getByRole('button', { name: 'Expand audience presence' }));
  const textarea = screen.getByLabelText(
    'Type a thought to test against the room',
  ) as HTMLTextAreaElement;
  const send = screen.getByRole('button', { name: 'Test this →' });
  return { textarea, send };
}

function mockFetchOk(body: { fraction: string; scrollQuote: string }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('AmbientPresence — type-to-room input (Surface 4, D-04)', () => {
  it('renders the placeholder + `Test this →` send affordance in the expanded panel', () => {
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea, send } = expandAndGetInput();
    expect(textarea.placeholder).toBe('Type a thought — see how the room reacts');
    expect(send).toBeTruthy();
  });

  it('disables send for empty / whitespace-only input and enables it once a char is typed', () => {
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea, send } = expandAndGetInput();
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: 'open with a question' } });
    expect((send as HTMLButtonElement).disabled).toBe(false);
  });

  it('does NOT fetch on keystroke — only on explicit submit (no keystroke-fired calls)', () => {
    const fetchMock = mockFetchOk({ fraction: '7/10 stop', scrollQuote: 'Stopped me.' });
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'a thought' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fires exactly ONE POST to /api/tools/react with the typed text on explicit submit', async () => {
    const fetchMock = mockFetchOk({ fraction: '7/10 stop', scrollQuote: 'Stopped me.' });
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea, send } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'open with a question' } });
    fireEvent.click(send);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/tools/react');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      text: 'open with a question',
    });
  });

  it('submits on Enter (Shift+Enter does NOT submit — newline idiom)', async () => {
    const fetchMock = mockFetchOk({ fraction: '7/10 stop', scrollQuote: 'Stopped me.' });
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'a thought' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('on success: sets the subject to the typed thought, calls onFocusChange, shows the caption, opens the Lens', async () => {
    mockFetchOk({ fraction: '7/10 stop', scrollQuote: 'Stopped me.' });
    const onFocusChange = vi.fn();
    render(<AmbientPresence audience={calibrated10()} focus={null} onFocusChange={onFocusChange} />);
    const { textarea, send } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'open with a question' } });
    fireEvent.click(send);

    // onFocusChange fires with the typed thought's returned reaction.
    await vi.waitFor(() =>
      expect(onFocusChange).toHaveBeenCalledWith({
        conceptText: 'open with a question',
        fraction: '7/10 stop',
        scrollQuote: 'Stopped me.',
      }),
    );
    // Subject becomes the typed thought.
    expect(screen.getByTestId('ambient-subject').textContent).toContain('open with a question');
    // Honesty caption renders.
    expect(screen.getByTestId('ambient-caption').textContent).toContain(
      'A quick SIM read on your Growth Audience — not a full Test.',
    );
    // The ONE Lens opened, scoped to the typed thought.
    expect(screen.getAllByText('Audience').length).toBeGreaterThan(0);
  });

  it('shows `Reading the room…` in an aria-live polite region while awaiting', async () => {
    // A deferred fetch keeps the loading state observable.
    let resolveFetch: (v: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((res) => {
          resolveFetch = res;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea, send } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'a thought' } });
    fireEvent.click(send);
    await vi.waitFor(() => expect(screen.getByTestId('ambient-loading')).toBeTruthy());
    const loading = screen.getByTestId('ambient-loading');
    expect(loading.textContent).toBe('Reading the room…');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    // Resolve to settle the promise.
    resolveFetch({ ok: true, json: async () => ({ fraction: '5/10 stop', scrollQuote: 'x' }) } as Response);
  });

  it('on error: renders the verbatim error copy + a Retry affordance (never error-red)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'reaction_failed' }) } as Response);
    vi.stubGlobal('fetch', fetchMock);
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea, send } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'a thought' } });
    fireEvent.click(send);
    await vi.waitFor(() => expect(screen.getByTestId('ambient-error')).toBeTruthy());
    expect(screen.getByTestId('ambient-error').textContent).toContain(
      "Couldn't reach the audience right now. Your thought is saved — try again in a moment.",
    );
    expect(screen.getByRole('button', { name: 'Retry →' })).toBeTruthy();
  });

  it('error branch source is never error-red (no color-error / text-red / #ef)', () => {
    // Assert against the CODE (comments stripped) so prose never trips the guard.
    const code = readCode();
    // Narrow to the error testid block and confirm no error-red token appears in the component.
    expect(code).not.toMatch(/color-error/);
    expect(code).not.toMatch(/text-red/);
    expect(code).not.toMatch(/#ef[0-9a-f]{2,}/i);
  });
});

// ── Regression: focus reconciliation + stale-error reset (WR-01 / WR-04) ─────────
describe('AmbientPresence — focus reconciliation (WR-01, D-02 moving spotlight)', () => {
  it('re-points the spotlight when the driven focus prop changes after a typed submit (no stuck typedFocus)', async () => {
    mockFetchOk({ fraction: '7/10 stop', scrollQuote: 'Stopped me.' });
    const { rerender } = render(<AmbientPresence audience={calibrated10()} focus={FOCUS} />);

    // Type a thought → the spotlight becomes the typed thought (local override).
    const { textarea, send } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'open with a question' } });
    fireEvent.click(send);
    await vi.waitFor(() =>
      expect(screen.getByTestId('ambient-subject').textContent).toContain('open with a question'),
    );

    // A deliberate tap/scroll drives a NEW focus from the composer (parent = source of truth).
    const NEXT: AmbientFocus = {
      conceptText: 'a totally different card',
      fraction: '3/10 stop',
      scrollQuote: 'Kept scrolling.',
    };
    rerender(<AmbientPresence audience={calibrated10()} focus={NEXT} />);

    // The spotlight follows the parent — it does NOT stay frozen on the typed thought (WR-01).
    const subject = screen.getByTestId('ambient-subject');
    expect(subject.textContent).toContain('a totally different card');
    expect(subject.textContent).not.toContain('open with a question');
  });
});

describe('AmbientPresence — stale-error reset (WR-04)', () => {
  it('clears the stale error + Retry the moment the user edits the draft', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 502, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', fetchMock);
    render(<AmbientPresence audience={calibrated10()} focus={null} />);
    const { textarea, send } = expandAndGetInput();
    fireEvent.change(textarea, { target: { value: 'a thought' } });
    fireEvent.click(send);
    await vi.waitFor(() => expect(screen.getByTestId('ambient-error')).toBeTruthy());

    // Editing the draft clears the stale banner — no misleading state, no Retry of old text.
    fireEvent.change(textarea, { target: { value: 'a thought v2' } });
    expect(screen.queryByTestId('ambient-error')).toBeNull();
  });
});
