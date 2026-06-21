/** @vitest-environment happy-dom */
/**
 * audience-presence — the persistent detent PRESENCE (P13, design LOCKED 2026-06-21). One
 * panel at three heights (peek → preview → full), docked above the composer, owning audience
 * identity + switching and opening the ONE shipped AudienceLens at its FULL detent.
 *
 * These tests lock the LOCKED design + the honesty spine:
 *  - PEEK idle (focus=null): identity + a READINESS pulse ("N personas ready") — NEVER a stale
 *    reaction, and NO second text input at rest (fork #4).
 *  - PEEK focused: a live read pulse ("6 of 10 would stop"), never an aggregate fabrication.
 *  - The PRESENCE owns switching (fork #3): the switcher lists audiences + fires onSelectAudience.
 *  - peek → preview reveals the room slice + the "ask your audience…" entry + "Open the room →".
 *  - preview → FULL mounts the ONE shipped Lens content (Panel · 10 ⇄ Population) — the door.
 *  - General / null audience: readiness, default roster, no crash; sr-only roster mirror present.
 *  - Determinism guards: no Math.random / Date.now / new Date, mulberry32 seeded, reducedMotion gated.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Audience, CalibratedPersona } from '@/lib/audience/audience-types';
import { ARCHETYPES } from '@/lib/engine/wave3/persona-registry';
import { AudiencePresence } from '../audience-presence';
import type { AmbientFocus } from '../ambient-presence-types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SRC_PATH = join(process.cwd(), 'src/components/audience-lens/audience-presence.tsx');
/** Strip comments so honesty-framing prose that NAMES a forbidden token can't trip the guards. */
const readCode = () =>
  readFileSync(SRC_PATH, 'utf8')
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

function setup(over: Partial<React.ComponentProps<typeof AudiencePresence>> = {}) {
  const props: React.ComponentProps<typeof AudiencePresence> = {
    audience: calibrated10(),
    audiences: [general(), calibrated10()],
    selectedAudienceId: 'aud-1',
    onSelectAudience: vi.fn(),
    focus: null,
    reducedMotion: true, // deterministic, no SMIL/CSS motion in the assertions
    ...over,
  };
  return { props, ...render(<AudiencePresence {...props} />) };
}

// ── PEEK — idle readiness (fork #4: identity + ready, NO stale reaction, NO second input) ──
describe('AudiencePresence — PEEK idle (readiness, not a stale reaction)', () => {
  it('shows the audience identity + a readiness pulse, never a fabricated reaction', () => {
    setup({ audience: calibrated10(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/10 personas ready/i);
    expect(screen.getByTestId('audience-pulse').textContent).not.toMatch(/would stop/i);
    // The presence identity is present.
    expect(
      screen.getByRole('button', { name: /audience: growth audience/i }),
    ).toBeInTheDocument();
  });

  it('has NO second text input at rest (peek) — the ask entry only exists once opened', () => {
    setup({ focus: null });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByPlaceholderText(/ask your audience/i)).toBeNull();
  });

  it('keeps the sr-only roster mirror present (a11y, UI-SPEC §Cross-Cutting)', () => {
    const { container } = setup({ focus: null });
    const roster = container.querySelector('.sr-only ul');
    expect(roster).not.toBeNull();
    expect(roster!.querySelectorAll('li').length).toBe(10);
  });
});

// ── PEEK — focused live read (never an aggregate fabrication) ──
describe('AudiencePresence — PEEK focused (live read)', () => {
  it('reads "6 of 10 would stop" from the focused concept, not a fabricated aggregate', () => {
    setup({ focus: FOCUS });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/6 of 10 would stop/i);
  });
});

// ── General / null audience — readiness, default roster, no crash ──
describe('AudiencePresence — General / null audience (no crash)', () => {
  it('renders the General readiness pulse + a default roster of 10 when personas are empty', () => {
    const { container } = setup({ audience: general(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/general · 10 personas ready/i);
    expect(container.querySelectorAll('.sr-only ul li').length).toBe(10);
  });

  it('treats a null audience as General without crashing', () => {
    setup({ audience: null, focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/general/i);
  });
});

// ── Switching — the PRESENCE owns it (fork #3) ──
describe('AudiencePresence — owns audience switching (fork #3)', () => {
  it('lists audiences in the switcher and fires onSelectAudience on pick', () => {
    const onSelectAudience = vi.fn();
    setup({ onSelectAudience });
    fireEvent.click(screen.getByRole('button', { name: /switch audience/i }));
    const menu = screen.getByRole('menu', { name: /your audiences/i });
    expect(within(menu).getByText('General')).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: /manage audiences/i })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /general/i }));
    expect(onSelectAudience).toHaveBeenCalled();
  });
});

// ── Detents — peek → preview → full opens the ONE shipped Lens (the door) ──
describe('AudiencePresence — detents (peek → preview → full = the one Lens)', () => {
  it('opens to PREVIEW with the room slice + the "ask your audience…" entry', () => {
    setup({ focus: FOCUS });
    expect(screen.getByTestId('audience-presence-sheet').getAttribute('data-detent')).toBe('peek');
    fireEvent.click(screen.getByRole('button', { name: /open your audience/i }));
    const sheet = screen.getByTestId('audience-presence-sheet');
    expect(sheet.getAttribute('data-detent')).toBe('preview');
    expect(screen.getByPlaceholderText(/ask your audience/i)).toBeInTheDocument();
    expect(screen.getAllByText(/open the room/i).length).toBeGreaterThan(0);
  });

  it('drives PREVIEW → FULL into the ONE shipped Lens content (Panel · 10 ⇄ Population)', () => {
    setup({ focus: FOCUS });
    fireEvent.click(screen.getByRole('button', { name: /open your audience/i }));
    // "Open the room →" advances to the full Lens.
    fireEvent.click(screen.getAllByRole('button', { name: /open the room/i })[0]!);
    const sheet = screen.getByTestId('audience-presence-sheet');
    expect(sheet.getAttribute('data-detent')).toBe('full');
    // The shipped Lens content is mounted (its scale toggle), not a duplicate surface.
    expect(screen.getByRole('group', { name: /audience scale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /panel · 10/i })).toBeInTheDocument();
  });
});

// ── Source guards: determinism + colour/motion discipline ──
describe('AudiencePresence — source guards', () => {
  it('is deterministic: no Math.random / Date.now / new Date in code', () => {
    const code = readCode();
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/Date\.now/);
    expect(code).not.toMatch(/new Date\(/);
  });

  it('uses the mulberry32 seeded PRNG for the constellation layout', () => {
    expect(readCode()).toMatch(/mulberry32/);
  });

  it('gates motion on reducedMotion', () => {
    expect(readCode()).toMatch(/reducedMotion/);
  });
});
