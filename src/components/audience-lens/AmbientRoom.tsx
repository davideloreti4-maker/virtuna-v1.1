'use client';

/**
 * AmbientRoom — the ambient presence's Room BODY, rebuilt to the v6 mobile prototype IA
 * (The Room, Phase 1 Task B). It renders INSIDE the persistent presence panel (not the
 * video Reading — that keeps its own `AudienceLensContent`), so the moat surface the creator
 * keeps opening reads like the prototype: a named-people room, not an analytics panel.
 *
 *   • Focus header — the honest serif score for the ONE in-focus concept ("N of T would
 *     stop") + the concept it's reacting to. (The anchored-focus stepper / ⤺ compare +
 *     the desktop rail + variant='surface' land in a follow-up — B2b/B2c.)
 *   • The people ⇄ Population · 1,000 — a quiet segmented toggle that SWAPS the view.
 *   • The people = pure voices: each real persona is a named row with its OWN verbatim
 *     serif quote + `ask →` (opens the in-voice PersonaChatDrawer). "▶ Replay" streams the
 *     room's reactions back in one-by-one. No stats, no cluster clutter (prototype spec).
 *   • Population · 1,000 = the honest `PopulationSwarm` (1,000 modeled from your N — NOT
 *     1,000 calls), reused verbatim (counters + swarm + per-archetype breakdown).
 *
 * Honesty spine (binding): the voices are the REAL per-persona reactions carried on the
 * focus (registry-enum archetypes → named cast, PR-B1). `ask →` is gated to personas whose
 * archetype is a genuine registry enum (the chat route validates it — CR-01). Coral is
 * reserved for signal only; People rows stay calm cream (liveness via the quote, not colour).
 * Deterministic — no wall-clock / PRNG in render (nodes built by the pure derive helpers).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildFlatPersonaNodes,
  type FlatPersonaReaction,
} from '@/components/board/audience/audience-derive';
import type { PersonaNode } from '@/components/board/_kit';
import { ARCHETYPES, type Archetype } from '@/lib/engine/wave3/persona-registry';
import { cascadeOrder } from './lens-derive';
import { PopulationSwarm } from './PopulationSwarm';
import { PersonaChatDrawer, type PersonaChatTarget } from './PersonaChatDrawer';

export interface AmbientRoomProps {
  /** The focused concept's REAL per-persona reactions (from the ambient focus — PR-B1). */
  flatPersonas: FlatPersonaReaction[];
  /** The concept the room is reacting to (grounds the header + the persona chat). */
  conceptText: string;
  /** The concept's real `"N/T stop"` aggregate — drives the honest score header. */
  fraction: string;
  /** Honors the OS motion preference (gates the replay stream + swarm cascade). */
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
/** The Population cascade tick (mirrors AudienceLensContent's PopulationRegion). */
const CASCADE_STEP = 0.06;
const CASCADE_TICK_MS = 40;

const groundable = (n: PersonaNode): boolean =>
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
    if (!groundable(n)) return;
    setChatTarget({
      archetype: n.archetype!,
      name: n.name ?? n.label,
      segment: n.segment,
      reactionToConcept: { verdict: verdictOf(n), quote: n.quote ?? '' },
    });
  };

  const hasReaction = nodes.length > 0;

  return (
    <div className="flex flex-col">
      {/* ── Focus header — the honest score for the ONE in-focus concept ── */}
      <div className="px-5 pb-1 pt-1">
        <p className="font-serif text-[22px] leading-tight text-foreground">
          {stopCount} of {total}{' '}
          <span className="text-[var(--color-foreground-muted)]">would stop</span>
        </p>
        <p className="mt-1 truncate text-[12px] text-[var(--color-foreground-muted)]" title={conceptText}>
          {conceptText}
        </p>
      </div>

      {/* ── The people ⇄ Population · 1,000 — swaps the view (each its own motion) ── */}
      <div className="px-5 pt-3">
        <div
          role="group"
          aria-label="Audience scale"
          className="inline-flex w-full rounded-[10px] border border-[var(--color-border)] bg-surface p-0.5"
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
                  'flex-1 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ' +
                  (active
                    ? 'bg-[var(--color-active)] text-foreground'
                    : 'text-[var(--color-foreground-muted)] hover:bg-[var(--color-hover)]')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-4 pt-4">
        {!hasReaction ? (
          <p className="py-6 text-center text-[13px] text-[var(--color-foreground-muted)]">
            No reaction yet — test a concept to hear the room.
          </p>
        ) : scale === 'people' ? (
          <PeopleView
            ordered={ordered}
            reducedMotion={reducedMotion}
            onAsk={openChat}
          />
        ) : (
          <PopulationView nodes={nodes} reducedMotion={reducedMotion} />
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
 * The people — pure named voices. Each real persona is a calm row: neutral avatar, name,
 * `ask →`, and its OWN verbatim serif quote (the hero). "▶ Replay" streams them in one by
 * one; otherwise all voices are shown (the honest full roster of the focus's reactions).
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
          const canAsk = n.archetype != null && ARCHETYPES.includes(n.archetype as Archetype);
          return (
            <li
              key={n.id}
              className="border-t border-white/[0.045] first:border-t-0"
            >
              <button
                type="button"
                onClick={() => onAsk(n)}
                disabled={!canAsk}
                className={
                  'group flex w-full items-start gap-3 rounded-[10px] px-1.5 py-3 text-left transition-colors ' +
                  (canAsk ? 'hover:bg-white/[0.02]' : 'cursor-default')
                }
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-white/[0.07] text-[12px] font-semibold text-[var(--color-foreground-secondary)]"
                >
                  {initialOf(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-foreground">{name}</span>
                    {canAsk && (
                      <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wide text-[var(--color-foreground-muted)] transition-colors group-hover:text-accent">
                        ask →
                      </span>
                    )}
                  </span>
                  {n.quote ? (
                    <span className="mt-1.5 block font-serif text-[15px] leading-snug text-foreground">
                      &ldquo;{n.quote}&rdquo;
                    </span>
                  ) : (
                    <span className="mt-1.5 block text-[12px] italic text-[var(--color-foreground-muted)]">
                      {verdictOf(n) === 'stop' ? 'stopped — no words this time' : 'scrolled past'}
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
          className="mt-3 inline-flex items-center gap-2 self-start rounded-[8px] border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-[11px] text-[var(--color-foreground-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-foreground-secondary)] disabled:opacity-50"
        >
          {reveal !== null ? 'Reading the room…' : '▶ Replay how the room reacted'}
        </button>
      )}
      <p className="mt-2 font-mono text-[10.5px] tracking-wide text-[var(--color-foreground-muted)]">
        Your {ordered.length} people
      </p>
    </div>
  );
}

/**
 * Population · 1,000 — the honest swarm (1,000 modeled from your N, NOT 1,000 calls),
 * reused verbatim from `PopulationSwarm` (counters + swarm + per-archetype breakdown).
 * "Play" runs a single batched cascade over the dot layer (deterministic, reduced-motion safe).
 */
function PopulationView({
  nodes,
  reducedMotion,
}: {
  nodes: PersonaNode[];
  reducedMotion: boolean;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const cascadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cascading = progress !== null;

  useEffect(() => {
    if (!cascading || reducedMotion) return;
    cascadeTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p === null) return null;
        const next = p + CASCADE_STEP;
        return next >= 1 ? null : next;
      });
    }, CASCADE_TICK_MS);
    return () => {
      if (cascadeTimer.current) clearInterval(cascadeTimer.current);
    };
  }, [cascading, reducedMotion]);

  return (
    <div className="flex flex-col gap-3">
      <PopulationSwarm nodes={nodes} reducedMotion={reducedMotion} cascadeProgress={progress ?? undefined} />
      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setProgress(0)}
          disabled={cascading}
          className="self-start rounded-[8px] border border-[var(--color-border)] bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50"
        >
          {cascading ? 'Reading the room…' : '▶ Play the room'}
        </button>
      )}
    </div>
  );
}
