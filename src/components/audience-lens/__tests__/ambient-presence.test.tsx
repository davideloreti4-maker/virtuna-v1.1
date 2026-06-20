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
});
