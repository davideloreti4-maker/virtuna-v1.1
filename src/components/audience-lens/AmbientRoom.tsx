'use client';

/**
 * AmbientRoom — the ambient presence's Room BODY, rebuilt to the v6 mobile prototype IA
 * (The Room, Phase 1 Task B; `docs/prototypes/the-room-prototype-v6.html`). It renders INSIDE
 * the persistent presence Bloom (not the video Reading — that keeps its own
 * `AudienceLensContent`), so the moat surface the creator keeps opening reads like the
 * prototype: a named-people room, not an analytics panel.
 *
 *   • Focus header — the honest serif score for the ONE in-focus concept ("N of T would
 *     stop") + the concept it reacts to. (The anchored-focus stepper ‹N of M› / ⤺ compare
 *     land in PR-2 — they need the sibling descriptor list the composer must thread down.)
 *   • The people ⇄ Population · 1,000 — a quiet segmented toggle that SWAPS the view.
 *   • The people = pure voices: each real persona is a named row — a TONAL avatar (calm
 *     cream for a stop; accent-soft for a bounce, the signal), the name, `ask →` (opens the
 *     in-voice PersonaChatDrawer), and its OWN verbatim serif quote as the hero. "▶ Replay"
 *     streams the room's reactions back in one-by-one. No stats, no cluster clutter (spec).
 *   • Population · 1,000 = the v6 hero: serif "N would stay / N would bounce" → a 1,000-from-10
 *     swarm (Play reveals it) → a stats bar (loved / mixed / bounced) → the WEAK SPOT (who
 *     bounced + their exact words, coral) — the diagnostic that IS the value. (The Rewrite
 *     lever that acts on the weak spot lands in PR-3 — it needs the skill self-handoff re-POST.)
 *
 * Honesty spine (binding): the voices are the REAL per-persona reactions carried on the focus
 * (registry-enum archetypes → named cast, PR-B1). `ask →` is gated to personas whose archetype
 * is a genuine registry enum (the chat route validates it — CR-01). Dosage (LOCKED): coral is
 * a SIGNAL, never paint — it marks only the bounce (avatar tint, swarm dot, weak-spot name);
 * everything positive stays calm cream (no green en masse). Deterministic — no wall-clock / PRNG
 * in render (nodes built by the pure derive helpers; the swarm reveals by stable index order).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildFlatPersonaNodes,
  type FlatPersonaReaction,
} from '@/components/board/audience/audience-derive';
import type { PersonaNode } from '@/components/board/_kit';
import { ARCHETYPES, type Archetype } from '@/lib/engine/wave3/persona-registry';
import { cascadeOrder } from './lens-derive';
import { PersonaChatDrawer, type PersonaChatTarget } from './PersonaChatDrawer';

export interface AmbientRoomProps {
  /** The focused concept's REAL per-persona reactions (from the ambient focus — PR-B1). */
  flatPersonas: FlatPersonaReaction[];
  /** The concept the room is reacting to (grounds the header + the persona chat). */
  conceptText: string;
  /** The concept's real `"N/T stop"` aggregate — drives the honest score header. */
  fraction: string;
  /** Honors the OS motion preference (gates the replay stream + swarm reveal). */
  reducedMotion?: boolean;
  /** Archetype→creator-label overrides so a renamed person wins (else stable defaults). */
  personaNameOverrides?: Record<string, string>;
  /** Platform for the persona-chat grounding (defaults tiktok). */
  platform?: 'tiktok' | 'instagram' | 'youtube';
}

type Scale = 'people' | 'population';

/** Parse "6/10 stop" → { stop, total }; null on any unexpected shape. */
function parseStop(fraction: string): { stop: number; total: number } | null {
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const stop = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(stop) || !Number.isFinite(total) || total <= 0 || stop > total) return null;
  return { stop, total };
}

/** The replay stream reveals one voice per this many ms (calm, deterministic). */
const REPLAY_STEP_MS = 240;
/** The population swarm reveals this many dots per tick on Play. */
const SWARM_REVEAL_STEP = 6;
const SWARM_TICK_MS = 22;
/** Sample dots in the swarm viz (a honest presentation of 1,000-from-N, not 1,000 calls). */
const SWARM_DOTS = 90;

const isGroundable = (n: PersonaNode): boolean =>
  n.archetype != null && ARCHETYPES.includes(n.archetype as Archetype);

const verdictOf = (n: PersonaNode): 'stop' | 'scroll' => (n.watchThrough >= 0.5 ? 'stop' : 'scroll');

const initialOf = (label: string): string => (label.trim()[0] ?? '·').toUpperCase();

export function AmbientRoom({
  flatPersonas,
  conceptText,
  fraction,
  reducedMotion = false,
  personaNameOverrides,
  platform = 'tiktok',
}: AmbientRoomProps) {
  const [scale, setScale] = useState<Scale>('people');
  const [chatTarget, setChatTarget] = useState<PersonaChatTarget | null>(null);

  // Real per-persona nodes (named cast). The cascade order (stops first, heaviest first)
  // is the same order the room reveals in — People rows read in that order too (D-06).
  const nodes = useMemo(
    () => buildFlatPersonaNodes(flatPersonas, personaNameOverrides),
    [flatPersonas, personaNameOverrides],
  );
  const ordered = useMemo(() => {
    const rank = new Map(cascadeOrder(nodes).map((id, i) => [id, i]));
    return nodes.slice().sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }, [nodes]);

  const parsed = parseStop(fraction);
  const total = parsed?.total ?? nodes.length;
  const stopCount = parsed?.stop ?? nodes.filter((n) => verdictOf(n) === 'stop').length;

  const openChat = (n: PersonaNode) => {
    if (!isGroundable(n)) return;
    setChatTarget({
      archetype: n.archetype!,
      name: n.name ?? n.label,
      segment: n.segment,
      reactionToConcept: { verdict: verdictOf(n), quote: n.quote ?? '' },
    });
  };

  const hasReaction = nodes.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Focus header — the honest serif score for the ONE in-focus concept ── */}
      <div className="shrink-0 px-5 pb-1 pt-1">
        <p className="font-serif text-[22px] leading-tight tracking-[-0.01em] text-foreground">
          {stopCount} of {total}{' '}
          <span className="text-[var(--color-foreground-muted)]">would stop</span>
        </p>
        <p
          className="mt-1.5 truncate text-[12px] leading-snug text-[var(--color-foreground-muted)]"
          title={conceptText}
        >
          {conceptText}
        </p>
      </div>

      {/* ── The people ⇄ Population · 1,000 — swaps the view (each its own motion) ── */}
      <div className="shrink-0 px-5 pt-3">
        <div
          role="group"
          aria-label="Audience scale"
          className="flex w-full gap-1 rounded-[10px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-[3px]"
        >
          {(
            [
              { value: 'people', label: 'The people' },
              { value: 'population', label: 'Population · 1,000' },
            ] as const
          ).map((opt) => {
            const active = opt.value === scale;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setScale(opt.value)}
                className={
                  'flex-1 rounded-[7px] px-3 py-1.5 text-center text-[12px] font-medium transition-colors ' +
                  (active
                    ? 'bg-[var(--color-active)] text-foreground'
                    : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground-secondary)]')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── The body (scrolls) ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
        {!hasReaction ? (
          <p className="py-8 text-center text-[13px] text-[var(--color-foreground-muted)]">
            No reaction yet — test a concept to hear the room.
          </p>
        ) : scale === 'people' ? (
          <PeopleView ordered={ordered} reducedMotion={reducedMotion} onAsk={openChat} />
        ) : (
          <PopulationView nodes={nodes} total={total} reducedMotion={reducedMotion} />
        )}
      </div>

      {/* In-context, in-voice persona chat — one person at a time (D-03). */}
      <PersonaChatDrawer
        target={chatTarget}
        conceptText={conceptText}
        platform={platform}
        onClose={() => setChatTarget(null)}
      />
    </div>
  );
}

/**
 * The people — pure named voices. Each real persona is a calm row: a TONAL avatar (calm cream
 * for a stop; accent-soft for a bounce — the signal), the name, `ask →`, and its OWN verbatim
 * serif quote (the hero). "▶ Replay" streams them in one by one; otherwise every voice shows.
 */
function PeopleView({
  ordered,
  reducedMotion,
  onAsk,
}: {
  ordered: PersonaNode[];
  reducedMotion: boolean;
  onAsk: (n: PersonaNode) => void;
}) {
  // null = show all (at rest); a number = replay in progress, showing the first N voices.
  const [reveal, setReveal] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reveal === null) return;
    if (reducedMotion) {
      setReveal(null); // reduced-motion: no stream, snap to full
      return;
    }
    timer.current = setInterval(() => {
      setReveal((r) => {
        if (r === null) return null;
        const next = r + 1;
        return next >= ordered.length ? null : next;
      });
    }, REPLAY_STEP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [reveal, reducedMotion, ordered.length]);

  const shown = reveal === null ? ordered : ordered.slice(0, reveal);

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {shown.map((n) => {
          const name = n.name ?? n.label;
          const canAsk = isGroundable(n);
          const bounced = verdictOf(n) === 'scroll';
          return (
            <li key={n.id} className="border-t border-white/[0.045] first:border-t-0">
              <button
                type="button"
                onClick={() => onAsk(n)}
                disabled={!canAsk}
                className={
                  'group flex w-full items-start gap-3 rounded-[10px] px-1.5 py-3 text-left transition-colors ' +
                  (canAsk ? 'hover:bg-white/[0.02]' : 'cursor-default')
                }
              >
                {/* Tonal avatar — dosage LOCKED: coral only marks the bounce (the signal). */}
                <span
                  aria-hidden
                  className={
                    'mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-semibold ' +
                    (bounced
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]'
                      : 'bg-white/[0.07] text-[var(--color-foreground-secondary)]')
                  }
                >
                  {initialOf(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold tracking-[0.01em] text-foreground">
                      {name}
                    </span>
                    {canAsk && (
                      <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wide text-[var(--color-foreground-muted)] transition-colors group-hover:text-[var(--color-accent-text)]">
                        ask →
                      </span>
                    )}
                  </span>
                  {n.quote ? (
                    <span className="mt-1.5 block font-serif text-[15px] leading-[1.4] tracking-[-0.005em] text-foreground">
                      &ldquo;{n.quote}&rdquo;
                    </span>
                  ) : (
                    <span className="mt-1.5 block text-[12px] italic text-[var(--color-foreground-muted)]">
                      {bounced ? 'scrolled past' : 'stopped — no words this time'}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setReveal(0)}
          disabled={reveal !== null}
          className="mt-3 inline-flex items-center gap-2 self-start rounded-[8px] border border-[var(--color-border)] bg-transparent px-3 py-[7px] text-[11px] text-[var(--color-foreground-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-foreground-secondary)] disabled:opacity-50"
        >
          {reveal !== null ? 'Reading the room…' : '▶ Replay how the room reacted'}
        </button>
      )}
      <p className="mt-3 text-center font-mono text-[10.5px] tracking-wide text-[var(--color-foreground-muted)]">
        Your {ordered.length} people
      </p>
    </div>
  );
}

/**
 * Population · 1,000 — the v6 hero. Everything is computed PURELY from the real 10's verdicts
 * (never a fabricated crowd): the stay/bounce headline + the stats bar + the weak spot are the
 * same signal at a denser resolution (1,000 modeled from your N — NOT 1,000 model calls). The
 * WEAK SPOT (who bounced + their exact words) is the diagnostic value. Coral marks only the
 * bounce (dosage LOCKED). Play reveals the swarm by stable index order (deterministic).
 */
function PopulationView({
  nodes,
  total,
  reducedMotion,
}: {
  nodes: PersonaNode[];
  total: number;
  reducedMotion: boolean;
}) {
  const stops = nodes.filter((n) => verdictOf(n) === 'stop');
  const bounces = nodes.filter((n) => verdictOf(n) === 'scroll');
  const tot = nodes.length || total || 1;
  const stayK = Math.round((stops.length / tot) * 1000);
  const bounceK = Math.round((bounces.length / tot) * 1000);
  const pct = (x: number) => Math.round((x / tot) * 100);

  // The swarm dot mix — a sample presentation of the 1,000, colored by the REAL stop/bounce
  // split. Cream-alpha for a stop; accent for a bounce (dosage LOCKED). Deterministic order.
  const dots = useMemo(() => {
    const gd = Math.round((stops.length / tot) * SWARM_DOTS);
    return Array.from({ length: SWARM_DOTS }, (_, i): 'stop' | 'bounce' => (i < gd ? 'stop' : 'bounce'));
  }, [stops.length, tot]);

  // Reveal-on-Play: null = all shown (static); a number = the count revealed so far.
  const [revealed, setRevealed] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (revealed === null || reducedMotion) return;
    timer.current = setInterval(() => {
      setRevealed((r) => {
        if (r === null) return null;
        const next = r + SWARM_REVEAL_STEP;
        return next >= SWARM_DOTS ? null : next;
      });
    }, SWARM_TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [revealed, reducedMotion]);
  const shownDots = revealed ?? SWARM_DOTS;

  // The weak spot — the bouncers with their real words (empty-quote bouncers still count in
  // the headline but carry no fabricated words; we surface only those who actually spoke).
  const weakVoices = bounces.filter((n) => (n.quote ?? '').trim().length > 0);

  return (
    <div className="flex flex-col">
      {/* HERO — the 1,000-strong room, modeled from your N. */}
      <div className="flex justify-center gap-8 pb-1 pt-1">
        <div className="text-center">
          <span className="block font-serif text-[26px] leading-none text-foreground">{stayK}</span>
          <span className="mt-1.5 block text-[10.5px] text-[var(--color-foreground-muted)]">
            would stay
          </span>
        </div>
        <div className="text-center">
          <span className="block font-serif text-[26px] leading-none text-[var(--color-accent-text)]">
            {bounceK}
          </span>
          <span className="mt-1.5 block text-[10.5px] text-[var(--color-foreground-muted)]">
            would bounce
          </span>
        </div>
      </div>

      {/* SWARM — a dense sample of the 1,000, colored by the real split. */}
      <div className="mt-3 flex flex-wrap justify-center gap-[3px]">
        {dots.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className={
              'h-[6px] w-[6px] rounded-full transition-opacity duration-200 ' +
              (d === 'bounce' ? 'bg-[var(--color-accent)]' : 'bg-[rgba(236,231,222,0.55)]')
            }
            style={{ opacity: i < shownDots ? 0.95 : 0.16 }}
          />
        ))}
      </div>
      <p className="mt-2.5 text-center font-mono text-[10.5px] tracking-wide text-[var(--color-foreground-muted)]">
        1,000 modeled from your {tot}
        {!reducedMotion && (
          <>
            {' · '}
            <button
              type="button"
              onClick={() => setRevealed(0)}
              disabled={revealed !== null}
              className="text-foreground transition-colors hover:text-[var(--color-accent-text)] disabled:opacity-50"
            >
              {revealed !== null ? 'reading…' : '▶ Play'}
            </button>
          </>
        )}
      </p>

      {/* STATS BAR — the exact split (loved / mixed / bounced). */}
      <div className="mt-4 border-t border-[var(--color-border)] pt-3.5">
        <div className="flex h-[6px] overflow-hidden rounded-[4px] bg-white/[0.05]">
          <span className="h-full bg-[rgba(236,231,222,0.55)]" style={{ width: `${pct(stops.length)}%` }} />
          <span className="h-full bg-[var(--color-accent)]" style={{ width: `${pct(bounces.length)}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-[var(--color-foreground-muted)] tabular-nums">
          <span>
            <b className="font-semibold text-foreground">{pct(stops.length)}%</b> loved
          </span>
          <span>
            <b className="font-semibold text-[var(--color-accent-text)]">{pct(bounces.length)}%</b> bounced
          </span>
        </div>
      </div>

      {/* WEAK SPOT — who you're losing + their exact words (the diagnostic value). */}
      {weakVoices.length > 0 && (
        <div className="mt-3.5 border-t border-[var(--color-border)] pt-3">
          <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.11em] text-[var(--color-foreground-muted)]">
            Where you&rsquo;re losing them · {bounceK} of 1,000
          </p>
          <ul className="flex flex-col">
            {weakVoices.map((n) => (
              <li key={n.id} className="flex items-baseline gap-3 py-[5px]">
                <span className="w-[52px] shrink-0 text-[12px] font-semibold text-[var(--color-accent-text)]">
                  {n.name ?? n.label}
                </span>
                <span className="font-serif text-[13.5px] leading-[1.32] text-[var(--color-foreground-secondary)]">
                  &ldquo;{n.quote}&rdquo;
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
