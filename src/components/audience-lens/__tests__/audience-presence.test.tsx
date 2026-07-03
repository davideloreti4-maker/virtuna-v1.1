/** @vitest-environment happy-dom */
/**
 * audience-presence — the persistent living-audience PRESENCE (P13, redesigned 2026-06-21).
 * TWO clean states (NOT a 3-step drawer): a PEEK band docked above the composer, and a PANEL
 * that expands UPWARD over the composer field (the composer stays the audience-chat input).
 *
 * These tests lock the redesign + the honesty spine:
 *  - PEEK idle (focus=null): identity + a READINESS pulse ("N personas ready"), no stale reaction,
 *    and NO input of its own (the composer field owns it now).
 *  - PEEK focused: a live read pulse ("6 of 10 would stop"), never an aggregate fabrication.
 *  - Tapping the band toggles the panel via the controlled `onOpenChange`.
 *  - The PRESENCE owns switching: the switcher lists audiences + fires onSelectAudience.
 *  - open + focus → the v6 Room body (The people ⇄ Population · 1,000) mounts in the Bloom panel.
 *  - open + Population toggle → the stay/bounce hero + weak-spot render from the focus's reactions.
 *  - open + idle → the hero prompt ("type below to test a thought"), no fabricated reaction.
 *  - Determinism guards: no Math.random / Date.now / new Date, mulberry32 seeded, reducedMotion gated.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within, act } from '@testing-library/react';
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
// The deterministic constellation render (mulberry32 PRNG + reducedMotion gating) was
// extracted to brand/constellation.tsx (P0 thread-shell). Guard both sources.
const CONSTELLATION_PATH = join(process.cwd(), 'src/components/brand/constellation.tsx');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = () => stripComments(readFileSync(SRC_PATH, 'utf8'));
const readConstellationCode = () => stripComments(readFileSync(CONSTELLATION_PATH, 'utf8'));

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
    mode: 'socials',
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
  return { ...calibrated10(), id: 'general', name: 'General', mode: 'socials', is_general: true, personas: [] };
}

/** A General PANEL SIM (multi-persona) — mode:'general', drives the multi-persona reactor. */
function generalPanel(): Audience {
  return {
    ...calibrated10(),
    id: 'gen-panel',
    name: 'Analyst Panel',
    mode: 'general',
    is_general: false,
    is_preset: false,
    personas: Array.from({ length: 3 }, (_, i) => persona(i)),
  };
}

/** A General PERSON SIM (exactly one persona) — presents as a single reactor. */
function generalPerson(): Audience {
  return {
    ...calibrated10(),
    id: 'gen-person',
    name: 'Mentor SIM',
    mode: 'general',
    is_general: false,
    is_preset: false,
    personas: [persona(0)],
  };
}

const FOCUS: AmbientFocus = {
  conceptText: 'what if I open with a question?',
  fraction: '6/10 stop',
  scrollQuote: 'This made me stop scrolling.',
};

/** A card focus carrying REAL per-persona reactions (6 stops + 4 bouncers who SPOKE) — the shape
 *  the Population weak-spot + the PR-3 Rewrite CTA need (a real bouncer quote to steer the lever). */
const FOCUS_BOUNCERS: AmbientFocus = {
  id: 'hook-0',
  conceptText: 'quit your gym membership',
  fraction: '6/10 stop',
  scrollQuote: 'This made me stop.',
  personas: [
    ...Array.from({ length: 6 }, (_, i) => ({
      archetype: ARCHETYPES[i % ARCHETYPES.length]!,
      verdict: 'stop' as const,
      quote: `stopped ${i}`,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      archetype: ARCHETYPES[(i + 6) % ARCHETYPES.length]!,
      verdict: 'scroll' as const,
      quote: `too preachy ${i}`,
    })),
  ],
};

function setup(over: Partial<React.ComponentProps<typeof AudiencePresence>> = {}) {
  const props: React.ComponentProps<typeof AudiencePresence> = {
    audience: calibrated10(),
    audiences: [general(), calibrated10()],
    selectedAudienceId: 'aud-1',
    onSelectAudience: vi.fn(),
    focus: null,
    reducedMotion: true,
    open: false,
    onOpenChange: vi.fn(),
    ...over,
  };
  return { props, ...render(<AudiencePresence {...props} />) };
}

// ── PEEK — readiness (identity + ready, no stale reaction, no own input) ──
describe('AudiencePresence — PEEK band (readiness)', () => {
  it('shows the identity + a readiness pulse, never a fabricated reaction', () => {
    setup({ audience: calibrated10(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/10 personas ready/i);
    expect(screen.getByTestId('audience-pulse').textContent).not.toMatch(/would stop/i);
    expect(screen.getByRole('button', { name: /audience: growth audience/i })).toBeInTheDocument();
  });

  it('owns NO input of its own (the composer field is the audience-chat input)', () => {
    setup({ focus: null, open: false });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByPlaceholderText(/ask your audience/i)).toBeNull();
  });

  it('reads "6 of 10 would stop" from the focused concept when focused', () => {
    setup({ focus: FOCUS });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/6 of 10 would stop/i);
  });

  it('keeps the sr-only roster mirror present (a11y)', () => {
    const { container } = setup({ focus: null });
    const roster = container.querySelector('.sr-only ul');
    expect(roster).not.toBeNull();
    expect(roster!.querySelectorAll('li').length).toBe(10);
  });

  it('tapping the band toggles the panel via the controlled onOpenChange', () => {
    const onOpenChange = vi.fn();
    setup({ open: false, onOpenChange });
    fireEvent.click(screen.getByRole('button', { name: /open your audience/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

// ── General / null audience ──
describe('AudiencePresence — General / null audience (no crash)', () => {
  it('renders the General readiness pulse + a default roster of 10', () => {
    const { container } = setup({ audience: general(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/general · 10 personas ready/i);
    expect(container.querySelectorAll('.sr-only ul li').length).toBe(10);
  });

  it('treats a null audience as General without crashing', () => {
    setup({ audience: null, focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/general/i);
  });
});

// ── Switching — the PRESENCE owns it ──
describe('AudiencePresence — owns audience switching', () => {
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

// ── Mode-sectioned switcher (UX-01 / D-02) ──
describe('AudiencePresence — Mode-sectioned switcher', () => {
  const openSwitcher = () =>
    fireEvent.click(screen.getByRole('button', { name: /switch audience/i }));

  it('renders NO General section header for a Socials-only list (byte-identical)', () => {
    setup({ audience: calibrated10(), audiences: [calibrated10()] });
    openSwitcher();
    const menu = screen.getByRole('menu', { name: /your audiences/i });
    expect(within(menu).getByText('Socials')).toBeInTheDocument();
    // No General audience + no General section → no "General" text anywhere in the menu.
    expect(within(menu).queryByText('General')).toBeNull();
  });

  it('renders both Socials and General sections when a General audience is owned', () => {
    setup({ audience: calibrated10(), audiences: [calibrated10(), generalPanel()] });
    openSwitcher();
    const menu = screen.getByRole('menu', { name: /your audiences/i });
    expect(within(menu).getByText('Socials')).toBeInTheDocument();
    // The "General" section header (no audience is named "General" in this fixture).
    expect(within(menu).getByText('General')).toBeInTheDocument();
    // The General SIM appears as a selectable row.
    expect(within(menu).getByRole('menuitemradio', { name: /analyst panel/i })).toBeInTheDocument();
  });

  it('shows a neutral trust badge on each row (Directional for General, Validated for Socials)', () => {
    setup({ audience: calibrated10(), audiences: [calibrated10(), generalPanel()] });
    openSwitcher();
    const menu = screen.getByRole('menu', { name: /your audiences/i });
    expect(within(menu).getByText('Validated')).toBeInTheDocument();
    expect(within(menu).getByText('Directional')).toBeInTheDocument();
  });

  it('renders a "+ Build an audience" row that fires onBuildAudience', () => {
    const onBuildAudience = vi.fn();
    setup({ audiences: [calibrated10()], onBuildAudience });
    openSwitcher();
    const menu = screen.getByRole('menu', { name: /your audiences/i });
    fireEvent.click(within(menu).getByRole('button', { name: /build an audience/i }));
    expect(onBuildAudience).toHaveBeenCalledTimes(1);
  });
});

// ── Generalized reactor (UX-03 / D-06) ──
describe('AudiencePresence — General reactor', () => {
  it('drives the reactor for a General panel SIM (multi-persona, no crash)', () => {
    const { container } = setup({ audience: generalPanel(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/analyst panel · 3 personas ready/i);
    expect(container.querySelectorAll('.sr-only ul li').length).toBe(3);
  });

  it('presents a General person SIM (1 persona) as a SINGLE reactor', () => {
    const { container } = setup({ audience: generalPerson(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/mentor sim · 1 reactor ready/i);
    expect(screen.getByTestId('audience-pulse').textContent).not.toMatch(/personas ready/i);
    // A single reactor → exactly one dot in the sr-only roster mirror.
    expect(container.querySelectorAll('.sr-only ul li').length).toBe(1);
  });
});

// ── PANEL (open) — the one Lens + the audience-chat conversation ──
describe('AudiencePresence — PANEL (expanded over the composer)', () => {
  it('mounts the v6 Room body (The people ⇄ Population · 1,000) when open + focused', () => {
    setup({ open: true, focus: FOCUS });
    const panel = screen.getByTestId('audience-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /audience scale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /the people/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /population · 1,000/i })).toBeInTheDocument();
    // The honest serif score for the ONE in-focus concept lives in the room header.
    expect(within(panel).getByText(/6 of 10/i)).toBeInTheDocument();
  });

  it('shows the idle hero prompt (no fabricated reaction) when open + idle', () => {
    setup({ open: true, focus: null });
    expect(screen.getByText(/type below to test a thought/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /audience scale/i })).toBeNull();
  });

  it('swaps to the v6 Population view (stay / bounce hero + weak spot) on the scale toggle', () => {
    setup({ open: true, focus: FOCUS });
    fireEvent.click(screen.getByRole('button', { name: /population · 1,000/i }));
    const panel = screen.getByTestId('audience-panel');
    expect(within(panel).getByText(/would stay/i)).toBeInTheDocument();
    expect(within(panel).getByText(/would bounce/i)).toBeInTheDocument();
    expect(within(panel).getByText(/1,000 modeled from your/i)).toBeInTheDocument();
  });

  it('surfaces the "Reading the room…" loading state while asking', () => {
    setup({ open: true, focus: null, asking: true });
    expect(screen.getByText(/reading the room/i)).toBeInTheDocument();
  });
});

// ── PR-4 Desktop persistent rail ──
describe('AudiencePresence — desktop rail (PR-4)', () => {
  it('renders the persistent rail with an idle roster — NOT the dock peek/Bloom', () => {
    setup({ layout: 'rail', focus: null });
    const rail = screen.getByTestId('audience-rail');
    expect(rail).toBeInTheDocument();
    // The dock surfaces (peek band toggle + Bloom panel + the dock root) are absent in the rail.
    expect(screen.queryByRole('button', { name: /open your audience/i })).toBeNull();
    expect(screen.queryByTestId('audience-panel')).toBeNull();
    expect(screen.queryByTestId('audience-presence')).toBeNull();
    // Idle roster: one row per persona (calibrated10 → 10), and the readiness copy.
    expect(rail.querySelectorAll('ul li').length).toBe(10);
    expect(within(rail).getByText(/they react the moment you make/i)).toBeInTheDocument();
    // The switcher lives in the rail header.
    expect(screen.getByRole('button', { name: /audience: growth audience/i })).toBeInTheDocument();
  });

  it('surfaces the stubbed variant seam as data-variant (defaults to thread)', () => {
    setup({ layout: 'rail', focus: null });
    expect(screen.getByTestId('audience-rail').getAttribute('data-variant')).toBe('thread');
  });

  it('fills the rail with the Room (honest score + scale toggle) when a card is in focus', () => {
    setup({ layout: 'rail', focus: FOCUS });
    const rail = screen.getByTestId('audience-rail');
    // AmbientRoom's honest serif score for the ONE in-focus concept (also mirrored sr-only).
    expect(within(rail).getAllByText(/6 of 10/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('group', { name: /audience scale/i })).toBeInTheDocument();
    // The idle roster/readiness is replaced by the Room.
    expect(within(rail).queryByText(/they react the moment you make/i)).toBeNull();
  });
});

// ── PR-3 Rewrite loop (Population weak-spot) ──
describe('AudiencePresence — PR-3 Rewrite loop', () => {
  const openPopulation = () =>
    fireEvent.click(screen.getByRole('button', { name: /population · 1,000/i }));
  const ctaMatcher = { name: /win back the viewers who bounced/i };

  it('shows the coral "Rewrite to win back the N% who bounced →" CTA when the skill is rewritable + bouncers spoke', () => {
    setup({ open: true, focus: FOCUS_BOUNCERS, canRewrite: true, onRewrite: vi.fn() });
    openPopulation();
    const cta = screen.getByRole('button', ctaMatcher);
    expect(cta).toBeInTheDocument();
    expect(cta.textContent).toMatch(/Rewrite to win back the \d+% who bounced/i);
  });

  it('hides the CTA when the skill is NOT rewritable (e.g. remix — canRewrite false)', () => {
    setup({ open: true, focus: FOCUS_BOUNCERS, canRewrite: false, onRewrite: vi.fn() });
    openPopulation();
    expect(screen.queryByRole('button', ctaMatcher)).toBeNull();
  });

  it('keeps the CTA off the People tab (Population weak-spot only)', () => {
    setup({ open: true, focus: FOCUS_BOUNCERS, canRewrite: true, onRewrite: vi.fn() });
    // People is the default scale — the CTA must not be here.
    expect(screen.queryByRole('button', ctaMatcher)).toBeNull();
  });

  it("fires onRewrite with the lead bouncer's real words (the lever) on tap", () => {
    const onRewrite = vi.fn().mockResolvedValue(undefined);
    setup({ open: true, focus: FOCUS_BOUNCERS, canRewrite: true, onRewrite });
    openPopulation();
    fireEvent.click(screen.getByRole('button', ctaMatcher));
    expect(onRewrite).toHaveBeenCalledTimes(1);
    expect(onRewrite.mock.calls[0]![0]).toMatch(/too preachy/i);
  });

  it('reveals the honest delta (prior → new stop-count) once the rewrite lands + the nonce advances', async () => {
    const onRewrite = vi.fn().mockResolvedValue(undefined);
    const { props, rerender } = setup({
      open: true,
      focus: FOCUS_BOUNCERS,
      canRewrite: true,
      onRewrite,
      rewriteNonce: 0,
    });
    openPopulation();
    // Tap sets the prior snapshot (6/10) on the mounted CTA instance.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', ctaMatcher));
    });
    // The composer lands a stronger steered rewrite (8/10) + bumps the nonce past tap-time; we
    // re-render the SAME instance (keeps `prior`) so the delta is honest prior → new.
    const NEW_FOCUS: AmbientFocus = { ...FOCUS_BOUNCERS, fraction: '8/10 stop' };
    rerender(<AudiencePresence {...props} focus={NEW_FOCUS} rewriteNonce={1} />);
    expect(await screen.findByText(/the lever moved the room/i)).toBeInTheDocument();
    expect(screen.getByText(/8\/10 stop/i)).toBeInTheDocument();
    expect(screen.getByText(/6\/10 stop/i)).toBeInTheDocument();
  });

  it('keeps the payoff delta visible even when the winning rewrite gates the CTA off (≥90% → nothing left to win back)', async () => {
    const onRewrite = vi.fn().mockResolvedValue(undefined);
    const { props, rerender } = setup({
      open: true,
      focus: FOCUS_BOUNCERS,
      canRewrite: true,
      onRewrite,
      rewriteNonce: 0,
    });
    openPopulation();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', ctaMatcher));
    });
    // The rewrite lands a 10/10 winner — no bouncers left, so the CTA MUST gate off; the delta MUST stay.
    const PERFECT: AmbientFocus = {
      id: 'hook-0',
      conceptText: 'the winning rewrite',
      fraction: '10/10 stop',
      scrollQuote: 'perfect',
      personas: Array.from({ length: 10 }, (_, i) => ({
        archetype: ARCHETYPES[i % ARCHETYPES.length]!,
        verdict: 'stop' as const,
        quote: '',
      })),
    };
    rerender(<AudiencePresence {...props} focus={PERFECT} rewriteNonce={1} />);
    // The payoff delta is present (6/10 → 10/10)…
    expect(await screen.findByText(/the lever moved the room/i)).toBeInTheDocument();
    expect(screen.getByText(/10\/10 stop/i)).toBeInTheDocument();
    // …but the button is gone — nothing left to win back.
    expect(screen.queryByRole('button', ctaMatcher)).toBeNull();
  });
});

// ── Source guards ──
describe('AudiencePresence — source guards', () => {
  it('is deterministic: no Math.random / Date.now / new Date in code', () => {
    for (const code of [readCode(), readConstellationCode()]) {
      expect(code).not.toMatch(/Math\.random/);
      expect(code).not.toMatch(/Date\.now/);
      expect(code).not.toMatch(/new Date\(/);
    }
  });

  it('uses the mulberry32 seeded PRNG + gates motion on reducedMotion', () => {
    // Lives in the extracted Constellation component since P0.
    const code = readConstellationCode();
    expect(code).toMatch(/mulberry32/);
    expect(code).toMatch(/reducedMotion/);
  });
});
