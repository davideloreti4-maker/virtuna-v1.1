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
 *  - open + focus → the ONE shipped Lens content (Panel · 10 ⇄ Population) mounts in the panel.
 *  - open + asks → the audience-chat conversation renders; tapping a turn re-asks (onReask).
 *  - open + idle → the hero prompt ("type below to test a thought"), no fabricated reaction.
 *  - Determinism guards: no Math.random / Date.now / new Date, mulberry32 seeded, reducedMotion gated.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Audience, CalibratedPersona } from '@/lib/audience/audience-types';
import { ARCHETYPES } from '@/lib/engine/wave3/persona-registry';
import { AudiencePresence, type AudienceAsk } from '../audience-presence';
import type { AmbientFocus } from '../ambient-presence-types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SRC_PATH = join(process.cwd(), 'src/components/audience-lens/audience-presence.tsx');
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

// ── PANEL (open) — the one Lens + the audience-chat conversation ──
describe('AudiencePresence — PANEL (expanded over the composer)', () => {
  it('mounts the ONE shipped Lens content (Panel · 10 ⇄ Population) when open + focused', () => {
    setup({ open: true, focus: FOCUS });
    expect(screen.getByTestId('audience-panel')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /audience scale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /panel · 10/i })).toBeInTheDocument();
  });

  it('shows the idle hero prompt (no fabricated reaction) when open + idle', () => {
    setup({ open: true, focus: null });
    expect(screen.getByText(/type below to test a thought/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /audience scale/i })).toBeNull();
  });

  it('renders the audience-chat conversation and re-asks a turn on tap', () => {
    const onReask = vi.fn();
    const asks: AudienceAsk[] = [
      { id: 'a1', thought: 'open with a stat', fraction: '7/10 stop', scrollQuote: 'whoa' },
    ];
    setup({ open: true, focus: FOCUS, asks, onReask });
    const turn = screen.getByRole('button', { name: /open with a stat/i });
    expect(turn.textContent).toMatch(/7 of 10 would stop/i);
    fireEvent.click(turn);
    expect(onReask).toHaveBeenCalledWith(asks[0]);
  });

  it('surfaces the "Reading the room…" loading state while asking', () => {
    setup({ open: true, focus: null, asking: true });
    expect(screen.getByText(/reading the room/i)).toBeInTheDocument();
  });
});

// ── Source guards ──
describe('AudiencePresence — source guards', () => {
  it('is deterministic: no Math.random / Date.now / new Date in code', () => {
    const code = readCode();
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/Date\.now/);
    expect(code).not.toMatch(/new Date\(/);
  });

  it('uses the mulberry32 seeded PRNG + gates motion on reducedMotion', () => {
    const code = readCode();
    expect(code).toMatch(/mulberry32/);
    expect(code).toMatch(/reducedMotion/);
  });
});
