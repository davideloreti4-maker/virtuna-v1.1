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
import { HORIZONTAL_ENABLED } from '@/lib/flags/horizontal';

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
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/10 ready/i);
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

// ── Reactions-arrive dopamine (Phase 2) — the anticipation + the arrival badge ──
describe('AudiencePresence — reactions-arrive (Phase 2)', () => {
  it('reads "Reading the room…" while a generation is in flight (reacting)', () => {
    setup({ focus: null, reacting: true });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/reading the room/i);
  });

  it('does NOT pop a badge on mount without a preceding reacting=true', () => {
    setup({ focus: null, reacting: false });
    expect(screen.queryByRole('status', { name: /new reaction/i })).toBeNull();
  });

  it('pops a "N new" badge on an arrival (arrivalNonce bump); reduced-motion snaps to the roster', () => {
    // The count-up is driven by `arrivalNonce` (bumped by the composer on the reactions true→false
    // edge), NOT this component's own reacting edge — the presence remounts across the empty→thread
    // switch, which used to swallow a mount-seeded edge. See composer.tsx `arrivalNonce`.
    const { props, rerender } = setup({ focus: null, reacting: false, reducedMotion: true, arrivalNonce: 0 });
    // No badge before an arrival.
    expect(screen.queryByRole('status', { name: /new reaction/i })).toBeNull();
    // Reactions land (nonce ticks) → the badge lands at the full roster (10 personas), immediately.
    act(() => rerender(<AudiencePresence {...props} arrivalNonce={1} />));
    expect(screen.getByRole('status', { name: /10 new reactions/i })).toBeInTheDocument();
  });

  it('counts the badge up one-per-persona when motion is allowed', () => {
    vi.useFakeTimers();
    try {
      const { props, rerender } = setup({ focus: null, reacting: false, reducedMotion: false, arrivalNonce: 0 });
      act(() => rerender(<AudiencePresence {...props} arrivalNonce={1} reducedMotion={false} />));
      act(() => vi.advanceTimersByTime(80 * 3));
      expect(screen.getByRole('status', { name: /3 new reactions/i })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(80 * 10));
      expect(screen.getByRole('status', { name: /10 new reactions/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the arrival badge once the Room opens (acknowledged)', () => {
    const { props, rerender } = setup({ focus: null, reacting: false, reducedMotion: true, arrivalNonce: 0 });
    act(() => rerender(<AudiencePresence {...props} arrivalNonce={1} />));
    expect(screen.getByRole('status', { name: /10 new reactions/i })).toBeInTheDocument();
    act(() => rerender(<AudiencePresence {...props} arrivalNonce={1} open />));
    expect(screen.queryByRole('status', { name: /new reaction/i })).toBeNull();
  });

  it('clears a stale badge when a NEW read begins (reacting rises → "Reading the room…")', () => {
    const { props, rerender } = setup({ focus: null, reacting: false, reducedMotion: true, arrivalNonce: 0 });
    act(() => rerender(<AudiencePresence {...props} arrivalNonce={1} />));
    expect(screen.getByRole('status', { name: /10 new reactions/i })).toBeInTheDocument();
    // A fresh generation starts (reacting rises) → the stale "N new" clears; pulse reads "Reading…".
    act(() => rerender(<AudiencePresence {...props} arrivalNonce={1} reacting={true} />));
    expect(screen.queryByRole('status', { name: /new reaction/i })).toBeNull();
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/reading the room/i);
  });

  it('guards the arrival keyframes with a reduced-motion media query (motion-only)', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );
    expect(css).toMatch(/@keyframes badge-pop/);
    expect(css).toMatch(/@keyframes presence-blink/);
    // Both arrival animations are disabled under prefers-reduced-motion.
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*animate-badge-pop[\s\S]*animation:\s*none/);
  });
});

// ── General / null audience ──
describe('AudiencePresence — General / null audience (no crash)', () => {
  it('renders the General readiness pulse + a default roster of 10', () => {
    const { container } = setup({ audience: general(), focus: null });
    // Name lives in the switcher chip now (dropped from the pulse to kill the mobile-dock dup).
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/10 ready/i);
    expect(screen.getByRole('button', { name: /audience: general\. switch audience/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.sr-only ul li').length).toBe(10);
  });

  it('treats a null audience as General without crashing', () => {
    setup({ audience: null, focus: null });
    // A null audience presents as General — the name shows in the switcher chip.
    expect(screen.getByRole('button', { name: /audience: general\. switch audience/i })).toBeInTheDocument();
  });

  /**
   * "General" is a REAL audience — the default socials baseline — so this is not an error
   * state and must never look like one. But it is the UNCALIBRATED one, and it is named
   * innocuously enough that a creator can spend a week of Readings against a generic crowd
   * while believing they are testing against their own people. The tag is the difference
   * between a default and an accident.
   */
  it('tags General as NOT CALIBRATED — a default the creator can actually notice', () => {
    setup({ audience: general(), focus: null });
    const chip = screen.getByRole('button', { name: /audience: general\. switch audience/i });
    expect(chip.textContent).toMatch(/not calibrated/i);
  });

  it('tags a null audience too (it presents as General, so it is just as uncalibrated)', () => {
    setup({ audience: null, focus: null });
    const chip = screen.getByRole('button', { name: /audience: general\. switch audience/i });
    expect(chip.textContent).toMatch(/not calibrated/i);
  });

  it('does NOT tag a calibrated audience — the tag would be a lie, and noise', () => {
    setup({ focus: null }); // setup's default audience is a real, calibrated one
    const chip = screen.getByRole('button', { name: /switch audience/i });
    expect(chip.textContent).not.toMatch(/not calibrated/i);
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

  it('shows a neutral trust badge on a Socials row', () => {
    setup({ audience: calibrated10(), audiences: [calibrated10()] });
    openSwitcher();
    const menu = screen.getByRole('menu', { name: /your audiences/i });
    expect(within(menu).getByText('Validated')).toBeInTheDocument();
  });

  // ── The horizontal (mode:'general') audiences + the Build chooser that mints them.
  //    HIDDEN behind HORIZONTAL_ENABLED (owner call 2026-07-13). Not deleted — these specs
  //    describe real behavior and run again the day the flag flips back on.
  describe.skipIf(!HORIZONTAL_ENABLED)('the General section — while the horizontal is ON', () => {
    it('renders both Socials and General sections when a General audience is owned', () => {
      setup({ audience: calibrated10(), audiences: [calibrated10(), generalPanel()] });
      openSwitcher();
      const menu = screen.getByRole('menu', { name: /your audiences/i });
      expect(within(menu).getByText('Socials')).toBeInTheDocument();
      // The "General" section header (no audience is named "General" in this fixture).
      expect(within(menu).getByText('General')).toBeInTheDocument();
      expect(within(menu).getByRole('menuitemradio', { name: /analyst panel/i })).toBeInTheDocument();
    });

    it('shows the Directional badge on a General row', () => {
      setup({ audience: calibrated10(), audiences: [calibrated10(), generalPanel()] });
      openSwitcher();
      const menu = screen.getByRole('menu', { name: /your audiences/i });
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

  // ── …and the gate. A horizontal audience the user ALREADY owns must not be offered while
  //    the verbs that run on it are gone — that would be a dead end. The row is hidden, never
  //    deleted. The baseline creator audience (is_general, mode:'socials') MUST still show.
  it.skipIf(HORIZONTAL_ENABLED)('hides General audiences and the Build chooser while the horizontal is off', () => {
    const onBuildAudience = vi.fn();
    setup({
      audience: calibrated10(),
      audiences: [calibrated10(), generalPanel()],
      onBuildAudience,
    });
    openSwitcher();
    const menu = screen.getByRole('menu', { name: /your audiences/i });
    // The creator vertical is untouched…
    expect(within(menu).getByText('Socials')).toBeInTheDocument();
    // …and the horizontal is gone: no section, no row, no factory.
    expect(within(menu).queryByText('General')).toBeNull();
    expect(within(menu).queryByRole('menuitemradio', { name: /analyst panel/i })).toBeNull();
    expect(within(menu).queryByRole('button', { name: /build an audience/i })).toBeNull();
  });
});

// ── Generalized reactor (UX-03 / D-06) ──
describe('AudiencePresence — General reactor', () => {
  it('drives the reactor for a General panel SIM (multi-persona, no crash)', () => {
    const { container } = setup({ audience: generalPanel(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/3 ready/i);
    expect(screen.getByRole('button', { name: /audience: analyst panel\. switch audience/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.sr-only ul li').length).toBe(3);
  });

  it('presents a General person SIM (1 persona) as a SINGLE reactor', () => {
    const { container } = setup({ audience: generalPerson(), focus: null });
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/1 ready/i);
    expect(screen.getByTestId('audience-pulse').textContent).not.toMatch(/personas ready/i);
    expect(screen.getByRole('button', { name: /audience: mentor sim\. switch audience/i })).toBeInTheDocument();
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
    // Two honest renders of the same read can coexist (the dock pulse echoes the score);
    // the binding assertion is the ROOM's serif score for the one in-focus concept.
    const scores = within(panel).getAllByText(/6 of 10/i);
    expect(scores.some((el) => el.className.includes('font-serif'))).toBe(true);
  });

  it('shows the idle hero prompt + the real cast (no fabricated reaction) when open + idle', () => {
    setup({ open: true, focus: null });
    expect(screen.getByText(/type a thought below/i)).toBeInTheDocument();
    // "Meet your room" — the General cast renders as real named people (the moat), not an abstract count.
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByText('Dev')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /audience scale/i })).toBeNull();
  });

  it('meet your room — tapping a cast person opens the MEET-MODE persona chat (no reaction yet)', async () => {
    // The drawer rehydrates prior turns on open (GET /api/tools/chat?archetype=…) — stub it.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ turns: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    setup({ open: true, focus: null });

    // The cast rows carry the meet affordance back (the #217 TODO): real buttons + "say hi →".
    const meetMaya = screen.getByRole('button', { name: 'Meet Maya' });
    fireEvent.click(meetMaya);

    // Drawer opens in MEET mode — "Meet Maya" (not "Ask Maya"): no reaction exists yet.
    expect(await screen.findByText('Meet Maya')).toBeInTheDocument();
    expect(screen.getByText(/you're meeting maya/i)).toBeInTheDocument();
    // Rehydration fired for the tapped archetype.
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/tools/chat?archetype='),
      expect.anything(),
    );
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

// ── variant='surface' — the read-only app-wide presence (Seam 3) ──
describe("AudiencePresence — variant='surface' (read-only)", () => {
  const ctaMatcher = { name: /win back the viewers who bounced/i };
  const openPopulation = () =>
    fireEvent.click(screen.getByRole('button', { name: /population · 1,000/i }));

  it('surfaces the seam on the dock root as data-variant', () => {
    setup({ variant: 'surface', focus: null });
    expect(screen.getByTestId('audience-presence').getAttribute('data-variant')).toBe('surface');
  });

  it('keeps the peek band + the honest readiness pulse (no fabricated reaction)', () => {
    setup({ variant: 'surface', focus: null, open: false });
    expect(screen.getByRole('button', { name: /open your audience/i })).toBeInTheDocument();
    expect(screen.getByTestId('audience-pulse').textContent).toMatch(/10 ready/i);
  });

  it('drops the composer "type below" prompt for a read-only idle description (dock)', () => {
    setup({ variant: 'surface', open: true, focus: null });
    expect(screen.getByText(/here on every surface/i)).toBeInTheDocument();
    expect(screen.queryByText(/type below to test a thought/i)).toBeNull();
  });

  it('GATES the Rewrite CTA off even when canRewrite=true + bouncers spoke (no composer to re-run)', () => {
    setup({ variant: 'surface', open: true, focus: FOCUS_BOUNCERS, canRewrite: true, onRewrite: vi.fn() });
    openPopulation();
    // The weak spot still renders (it's read-only diagnostic value)…
    expect(screen.getByText(/where you.?re losing them/i)).toBeInTheDocument();
    // …but the composer-bound Rewrite CTA is forced off (contrast: thread shows it — PR-3 tests).
    expect(screen.queryByRole('button', ctaMatcher)).toBeNull();
  });

  it('still opens the on-focus read-only Room (people ⇄ population), forward-compatible', () => {
    setup({ variant: 'surface', open: true, focus: FOCUS });
    const panel = screen.getByTestId('audience-panel');
    expect(screen.getByRole('group', { name: /audience scale/i })).toBeInTheDocument();
    // Two honest renders of the same read can coexist (the dock pulse echoes the score);
    // the binding assertion is the ROOM's serif score for the one in-focus concept.
    const scores = within(panel).getAllByText(/6 of 10/i);
    expect(scores.some((el) => el.className.includes('font-serif'))).toBe(true);
  });
});

// ── variant='rail' — the PERSISTENT, in-flow presentation (P2, ambient-room-v2) ──
// The rail hosts the SAME Room body as the 'thread' bloom, but shown ALWAYS, in-flow, inside a
// fixed-height column: it never blooms, never collapses, has no z-[55] overlay. The binding
// property a pre-rail build cannot satisfy: with open=false the Room body is STILL mounted (the
// 'thread' variant shows only the peek band there). These guards fail against the old code.
describe("AudiencePresence — variant='rail' (persistent, in-flow, no bloom)", () => {
  it('mounts the Room body PERSISTENTLY even when open=false (the rail never blooms)', () => {
    setup({ variant: 'rail', open: false, focus: FOCUS });
    // The in-flow rail container, never the bloom panel.
    expect(screen.getByTestId('audience-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('audience-panel')).toBeNull();
    // The v6 Room body is mounted DESPITE open=false — the whole point of the rail. (Against the
    // pre-rail code, open=false renders the peek band and this group is absent → red.)
    expect(screen.getByRole('group', { name: /audience scale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /the people/i })).toBeInTheDocument();
  });

  it('is not a dialog and carries no collapse affordance (never dismisses)', () => {
    setup({ variant: 'rail', open: false, focus: FOCUS });
    // role="dialog" belongs to the modal-ish bloom; the persistent rail is in-flow content.
    expect(screen.getByTestId('audience-rail').getAttribute('role')).toBeNull();
    expect(screen.queryByRole('button', { name: /collapse your audience/i })).toBeNull();
  });

  it('surfaces the seam on the dock root as data-variant="rail"', () => {
    setup({ variant: 'rail', open: false, focus: FOCUS });
    expect(screen.getByTestId('audience-presence').getAttribute('data-variant')).toBe('rail');
  });

  // The contrast that makes the persistence meaningful — and documents exactly why the first
  // assertion above fails against pre-rail code: the DEFAULT 'thread' variant with open=false
  // shows ONLY the peek band, no Room body. (This one passes on old and new code alike.)
  it("contrast — the 'thread' variant with open=false shows only the peek band (no Room)", () => {
    setup({ variant: 'thread', open: false, focus: FOCUS });
    expect(screen.queryByTestId('audience-rail')).toBeNull();
    expect(screen.getByRole('button', { name: /open your audience/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /audience scale/i })).toBeNull();
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
