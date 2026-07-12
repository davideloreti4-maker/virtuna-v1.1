'use client';

/**
 * AmbientRoom — the ambient presence's Room BODY, rebuilt to the v6 mobile prototype IA
 * (The Room, Phase 1 Task B; `docs/prototypes/the-room-prototype-v6.html`). It renders INSIDE
 * the persistent presence Bloom (not the video Reading — that keeps its own
 * `AudienceLensContent`), so the moat surface the creator keeps opening reads like the
 * prototype: a named-people room, not an analytics panel.
 *
 *   • Focus header — the honest serif score for the ONE in-focus concept ("N of T would
 *     stop") + the concept it reacts to, PLUS the anchored-focus stepper ‹ Hook N of M › and
 *     the `⤺ all N` view-all (PR-2). The stepper appears only when the focus resolved from a
 *     real thread card (`focusId`) with sibling cards in the batch (`siblings`) — tapping ‹/›
 *     re-focuses the Room on the prev/next sibling in place; `⤺ all N` opens the ranked
 *     "How the room ranked your N" list → tap a row to re-focus. Ranked by the real stop-count;
 *     an ad-hoc typed thought (no `focusId`) shows no stepper (the honest state).
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
import type { AmbientFocusSibling } from './ambient-presence-types';

export interface AmbientRoomProps {
  /** The focused concept's REAL per-persona reactions (from the ambient focus — PR-B1).
   *  The flat text-skill shape (binary verdict + quote); rebuilt into nodes here. Optional
   *  when `personaNodes` is supplied instead (the rich video-Read path). */
  flatPersonas?: FlatPersonaReaction[];
  /** Pre-built rich PersonaNodes (the video Read's `buildAudienceNodes` — real names,
   *  quotes, archetypes, continuous watch-through). When present it is used DIRECTLY,
   *  bypassing the flat rebuild, so the video's richer signal is not binarised away. The
   *  per-segment timeline it carries drives the SEPARATE ReplayController (D-06); this
   *  Room reads only the verdict/quote/name from it, exactly like the flat path. */
  personaNodes?: PersonaNode[];
  /** Embedded variant (the video Read's Audience section, Phase 3). Drops the fixed-height
   *  Bloom layout (no `h-full`, no internal scroll — the Read page scrolls) and hides the
   *  focus header (the Read carries its own Hero + section label). The people/population
   *  toggle + body render at natural height inline. */
  embedded?: boolean;
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
  // ── Anchored-focus stepper + `⤺ all N` view-all (PR-2) ────────────────────────
  /** The resolved focus's card id — present only for a real card focus (absent for a typed
   *  thought). Placed among `siblings` to render `‹ Hook N of M ›` + the ranked compare. */
  focusId?: string;
  /** The current batch's sibling cards (the composer's flat per-tool list). >1 ⇒ the stepper +
   *  `⤺ all N` show; ranked by the parsed stop-count (best first) for both the stepper + compare. */
  siblings?: AmbientFocusSibling[];
  /** Re-focus the Room on a sibling by id (= the composer's `focusByTap`) — steps in place. */
  onStep?: (id: string) => void;
  /** The batch's kind label ("Hook" | "Idea" | "Script" | "Remix") for the stepper + compare copy. */
  kindLabel?: string;
  // ── Rewrite loop on the Population weak-spot (PR-3, LIVE-07) ───────────────────
  /** The active skill is text-seedable (hooks/idea/script) ⇒ the Population weak-spot shows the
   *  coral "Rewrite to win back the N% who bounced →" CTA. Remix (URL-seeded) has no lever-reseed
   *  path, so the CTA is gated OFF there (the honest state — the prototype gates it conditionally too). */
  canRewrite?: boolean;
  /** Re-run the originating skill steered by the bouncers' real words (the `lever`) → a new card +
   *  Read stream into the SAME thread; resolves when the reseed's SSE closes. The composer owns the
   *  actual re-run (its own stream hook) + then re-focuses the Room on the winning card. */
  onRewrite?: (lever: string) => Promise<void>;
  /** Bumped by the composer once a reseed has landed AND the Room has re-focused on the winning
   *  card — the CTA reveals the honest delta (prior → new stop-count) only after this advances past
   *  tap-time, so the "current" read it compares against is guaranteed to be the post-rewrite one. */
  rewriteNonce?: number;
  /** Seed the ranked-overview state at mount. Defaults true (the bloom lands on "how the room
   *  ranked your N" first). A targeted entry — a card's "See the room →" that pre-focuses ONE
   *  card — passes false so the Room drills straight into that card's people (prototype parity). */
  initialCompareOpen?: boolean;
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

/** The compare-row meter tone — sage ≥60% stop, coral ≤40%, else neutral (prototype `toneOf`).
 *  Dosage LOCKED: coral is the bounce SIGNAL, sage the loved one; neither paints en masse. */
const meterTone = (stop: number, total: number): string => {
  if (total <= 0) return 'rgba(255,255,255,0.4)';
  const r = stop / total;
  return r >= 0.6 ? 'var(--color-positive)' : r <= 0.4 ? 'var(--color-accent)' : 'rgba(255,255,255,0.4)';
};

export function AmbientRoom({
  flatPersonas,
  personaNodes,
  embedded = false,
  conceptText,
  fraction,
  reducedMotion = false,
  personaNameOverrides,
  platform = 'tiktok',
  focusId,
  siblings,
  onStep,
  kindLabel = 'Concept',
  canRewrite = false,
  onRewrite,
  rewriteNonce = 0,
  initialCompareOpen = true,
}: AmbientRoomProps) {
  const [scale, setScale] = useState<Scale>('people');
  const [chatTarget, setChatTarget] = useState<PersonaChatTarget | null>(null);
  // The `⤺ all N` ranked view-all (prototype code name: compare). Opens on the OVERVIEW (the ranked
  // list) so the bloom always lands on "how the room ranked your N" first, not a single card's
  // personas. A focus CHANGE (step, re-target, tapping a row, a new thought) drills into that card.
  // We reset only when focusId ACTUALLY changes from the mount value (ref seeded to the initial
  // focusId) — a plain mount-skip flag would be defeated by StrictMode's double-invoked effects.
  const [compareOpen, setCompareOpen] = useState(initialCompareOpen);
  const compareFocusRef = useRef(focusId);
  useEffect(() => {
    // A typed thought carries no card id (`undefined`). It must land on ITS OWN read — never
    // under a lingering ranked list — so it closes the compare view. The list stays exactly one
    // `⤺ all N` tap away (that button no longer needs a card focus), which is also the creator's
    // way BACK to the batch after an ad-hoc ask.
    if (focusId == null) {
      setCompareOpen(false);
      return;
    }
    if (focusId !== compareFocusRef.current) {
      compareFocusRef.current = focusId;
      setCompareOpen(false);
    }
  }, [focusId]);

  // Rank the batch siblings by the REAL stop-count (best first, stable on ties) — the one order
  // the stepper steps through AND the compare list shows ("How the room ranked your N"). PR-2.
  const rankedSiblings = useMemo(() => {
    if (!siblings || siblings.length === 0) return [];
    return siblings
      .map((s, i) => {
        const p = parseStop(s.fraction);
        return { id: s.id, conceptText: s.conceptText, stop: p?.stop ?? -1, total: p?.total ?? 0, order: i };
      })
      .sort((a, b) => b.stop - a.stop || a.order - b.order);
  }, [siblings]);
  const focusIdx = focusId ? rankedSiblings.findIndex((s) => s.id === focusId) : -1;
  // The stepper shows only for a real card focus with >1 sibling in the batch (prototype `n>1`).
  const showStepper = focusId != null && rankedSiblings.length > 1 && focusIdx >= 0;
  // The `⤺ all N` ranked view needs only the batch — NOT a current card focus. A typed thought
  // (no focusId) keeps it reachable, so the creator can always step back from an ad-hoc ask to
  // "how the room ranked your N" (before this, the ask was a one-way door out of the batch).
  const showViewAll = rankedSiblings.length > 1;
  const inCompare = compareOpen && showViewAll;
  const stepTo = (idx: number) => {
    const target = rankedSiblings[idx];
    if (target && onStep) onStep(target.id);
  };

  // Real per-persona nodes (named cast). The cascade order (stops first, heaviest first)
  // is the same order the room reveals in — People rows read in that order too (D-06).
  // Rich video-Read path passes pre-built nodes directly; the flat text path rebuilds
  // from the {archetype, verdict, quote} reactions.
  const nodes = useMemo(
    () => personaNodes ?? buildFlatPersonaNodes(flatPersonas ?? [], personaNameOverrides),
    [personaNodes, flatPersonas, personaNameOverrides],
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

  // ── Rewrite loop state (PR-3) — LIFTED here (not inside the CTA) so the delta survives the CTA
  // hiding: a successful rewrite can push the winning card to 10/10 → no bounce left → the CTA
  // gates off, but the payoff ("3/10 → 10/10 the lever moved the room") must still show. The
  // prior is snapshotted at tap-time; the delta freezes when the composer bumps `rewriteNonce`
  // (after it re-focuses the Room on the winning card); a later manual step clears the stale delta.
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteDelta, setRewriteDelta] = useState<{
    prior: { stop: number; total: number };
    next: { stop: number; total: number };
  } | null>(null);
  const rewritePriorRef = useRef<{ stop: number; total: number } | null>(null);
  const lastNonceRef = useRef(rewriteNonce);
  const lastFocusRef = useRef(focusId);

  useEffect(() => {
    if (rewriteNonce !== lastNonceRef.current) {
      // The rewrite landed (nonce advanced) — freeze the honest delta from the tap-time prior +
      // the new focus's read. `next` is frozen so a later manual step doesn't mutate the readout.
      lastNonceRef.current = rewriteNonce;
      lastFocusRef.current = focusId;
      if (rewritePriorRef.current) {
        setRewriteDelta({ prior: rewritePriorRef.current, next: { stop: stopCount, total } });
        rewritePriorRef.current = null;
      }
      return;
    }
    if (focusId !== lastFocusRef.current) {
      // A manual step / re-target (focus changed with NO rewrite) — the delta is now stale.
      lastFocusRef.current = focusId;
      setRewriteDelta(null);
    }
  }, [rewriteNonce, focusId, stopCount, total]);

  const handleRewriteTap = async (lever: string) => {
    if (!onRewrite || rewriteBusy || lever.trim().length === 0) return;
    rewritePriorRef.current = { stop: stopCount, total };
    setRewriteError(null);
    setRewriteBusy(true);
    try {
      await onRewrite(lever);
    } catch {
      setRewriteError("Couldn't rewrite right now. Your concept is saved — try again in a moment.");
      rewritePriorRef.current = null;
    } finally {
      setRewriteBusy(false);
    }
  };

  return (
    <div className={embedded ? 'flex flex-col' : 'flex h-full min-h-0 flex-col'}>
      {inCompare ? (
        /* ── `⤺ all N` view-all — the ranked list "How the room ranked your N" (PR-2).
              Tap a row to re-focus the Room on that sibling → back to the drill view. ── */
        <>
          <div className="shrink-0 px-5 pb-1 pt-1">
            <div className="flex min-h-[24px] items-center gap-2">
              <span className="whitespace-nowrap font-mono text-[10.5px] tracking-[0.02em] text-[var(--color-foreground-muted)]">
                {kindLabel}s · ranked
              </span>
            </div>
            <p className="mt-2 font-serif text-[18px] leading-tight tracking-[-0.01em] text-foreground">
              How the room ranked your {rankedSiblings.length} {kindLabel.toLowerCase()}s
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
            <p className="px-1.5 pb-2 pt-1 text-[11px] text-[var(--color-foreground-muted)]">
              Tap any one to open the room on it.
            </p>
            <ul className="flex flex-col">
              {rankedSiblings.map((s, i) => {
                const scoreLabel = s.total > 0 ? `${s.stop}/${s.total}` : '—';
                const width = s.total > 0 ? `${Math.round((s.stop / s.total) * 100)}%` : '0%';
                const isCurrent = s.id === focusId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onStep?.(s.id);
                        setCompareOpen(false);
                      }}
                      aria-current={isCurrent ? 'true' : undefined}
                      className="flex w-full items-center gap-[11px] rounded-[8px] border-t border-[var(--color-border)] px-2 py-[11px] text-left transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="w-[15px] shrink-0 font-serif text-[17px] text-[var(--color-foreground-secondary)]">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[11.5px] leading-[1.35] text-foreground">
                          {s.conceptText}
                        </span>
                        <span className="mt-1.5 block h-[6px] overflow-hidden rounded-[4px] bg-white/[0.08]">
                          <span
                            className="block h-full rounded-[4px]"
                            style={{ width, background: meterTone(s.stop, s.total) }}
                          />
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11.5px] text-foreground tabular-nums">
                        {scoreLabel}
                      </span>
                      <span aria-hidden className="shrink-0 text-[var(--color-foreground-muted)]">
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : (
        <>
          {/* ── Focus header — the anchored-focus stepper (PR-2) + the honest serif score.
                Hidden in the embedded (video-Read) variant: the Read carries its own Hero +
                "The audience" section label, so a second serif score would double up. ── */}
          {!embedded && (
          <div className="shrink-0 px-5 pb-1 pt-1">
            {(showStepper || showViewAll) && (
              <div className="mb-2 flex min-h-[24px] items-center gap-2">
                {showStepper && (
                  <div className="flex min-w-0 items-center gap-[7px]">
                    <button
                      type="button"
                      disabled={focusIdx <= 0}
                      onClick={() => stepTo(focusIdx - 1)}
                      aria-label={`Previous ${kindLabel.toLowerCase()}`}
                      className="grid h-[23px] w-[23px] shrink-0 place-items-center rounded-[7px] border border-[var(--color-border)] bg-transparent text-[12px] leading-none text-[var(--color-foreground-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                    >
                      ‹
                    </button>
                    <span className="whitespace-nowrap font-mono text-[10.5px] tracking-[0.02em] text-foreground">
                      <span className="text-[var(--color-foreground-muted)]">{kindLabel}</span> {focusIdx + 1}{' '}
                      <span className="text-[var(--color-foreground-muted)]">of {rankedSiblings.length}</span>
                    </span>
                    <button
                      type="button"
                      disabled={focusIdx >= rankedSiblings.length - 1}
                      onClick={() => stepTo(focusIdx + 1)}
                      aria-label={`Next ${kindLabel.toLowerCase()}`}
                      className="grid h-[23px] w-[23px] shrink-0 place-items-center rounded-[7px] border border-[var(--color-border)] bg-transparent text-[12px] leading-none text-[var(--color-foreground-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                    >
                      ›
                    </button>
                  </div>
                )}
                {/* Reachable from a typed-thought read too (no stepper then) — the back path. */}
                {showViewAll && (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    aria-label={`View all ${rankedSiblings.length} ${kindLabel.toLowerCase()}s ranked`}
                    className="ml-auto shrink-0 whitespace-nowrap rounded-[7px] border border-[var(--color-border)] px-[9px] py-1 font-mono text-[10px] text-[var(--color-foreground-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-foreground-secondary)]"
                  >
                    ⤺ all {rankedSiblings.length}
                  </button>
                )}
              </div>
            )}
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
          )}

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

          {/* ── The body — scrolls inside the Bloom; renders at natural height when embedded
                in the Read (the page owns the scroll). ── */}
          <div className={embedded ? 'px-5 pb-5 pt-4' : 'min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4'}>
            {!hasReaction ? (
              <p className="py-8 text-center text-[13px] text-[var(--color-foreground-muted)]">
                No reaction yet — test a concept to hear the room.
              </p>
            ) : scale === 'people' ? (
              <PeopleView ordered={ordered} reducedMotion={reducedMotion} onAsk={openChat} />
            ) : (
              <PopulationView
                nodes={nodes}
                total={total}
                stopCount={stopCount}
                reducedMotion={reducedMotion}
                canRewrite={canRewrite}
                onRewriteTap={handleRewriteTap}
                rewriteBusy={rewriteBusy}
                rewriteError={rewriteError}
                rewriteDelta={rewriteDelta}
              />
            )}
          </div>
        </>
      )}

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
        {shown.map((n, i) => {
          const name = n.name ?? n.label;
          const canAsk = isGroundable(n);
          const bounced = verdictOf(n) === 'scroll';
          return (
            // Reactions-arrive rise-in (Phase 2): each voice rises in staggered as the room's
            // reactions land (prototype `.prow` rise). Reuses `.reading-reveal` (self-disables
            // under reduced-motion via its media query, so the inline delay is harmless there).
            <li
              key={n.id}
              className="reading-reveal border-t border-white/[0.045] first:border-t-0"
              style={reducedMotion ? undefined : { animationDelay: `${i * 40}ms` }}
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
                {/* Tonal avatar — dosage LOCKED: coral only marks the bounce (the signal). */}
                <span
                  aria-hidden
                  className={
                    'mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-semibold ' +
                    (bounced
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]'
                      : 'bg-[rgba(142,166,138,0.16)] text-[#a6bfa1]')
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
  stopCount,
  reducedMotion,
  canRewrite,
  onRewriteTap,
  rewriteBusy,
  rewriteError,
  rewriteDelta,
}: {
  nodes: PersonaNode[];
  total: number;
  stopCount: number;
  reducedMotion: boolean;
  canRewrite: boolean;
  onRewriteTap: (lever: string) => void | Promise<void>;
  rewriteBusy: boolean;
  rewriteError: string | null;
  rewriteDelta: { prior: { stop: number; total: number }; next: { stop: number; total: number } } | null;
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

  // The Rewrite BUTTON (PR-3) shows only when it is HONEST + actionable: the active skill is
  // text-seedable (canRewrite), there is a real bouncer quote to steer by (weakVoices > 0), and
  // the concept isn't already near-perfect (prototype gates at stop ≥ 9/10 → we hide at ≥ 90%).
  // The DELTA readout is gated separately (rewriteDelta) so the payoff survives the button hiding.
  const showRewrite =
    canRewrite && weakVoices.length > 0 && total > 0 && stopCount / total < 0.9;
  const lever = weakVoices[0]?.quote ?? '';

  return (
    <div className="flex flex-col">
      {/* HERO — the 1,000-strong room, modeled from your N. */}
      <div className="flex justify-center gap-8 pb-1 pt-1">
        <div className="text-center">
          <span className="block font-serif text-[26px] leading-none text-[var(--color-positive)]">{stayK}</span>
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
              (d === 'bounce' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-positive)]')
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
          <span className="h-full bg-[var(--color-positive)]" style={{ width: `${pct(stops.length)}%` }} />
          <span className="h-full bg-[var(--color-accent)]" style={{ width: `${pct(bounces.length)}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-[var(--color-foreground-muted)] tabular-nums">
          <span>
            <b className="font-semibold text-[var(--color-positive)]">{pct(stops.length)}%</b> loved
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

      {/* REWRITE — the loop that IS the product: steer a fresh Read by the bouncers' real words,
          then read the honest delta. (PR-3; mirrors the prototype's `renderFoot` coral CTA + its
          before→after toast.) The DELTA renders whenever a rewrite has landed — even once the
          button has gated off (a 10/10 winner has no bounce left to win back). */}
      {(showRewrite || rewriteDelta || rewriteError) && (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
          {rewriteDelta && (
            <p
              className="text-center text-[12px] leading-snug text-foreground"
              role="status"
              aria-live="polite"
            >
              <span className="text-[var(--color-foreground-muted)]">
                {rewriteDelta.prior.stop}/{rewriteDelta.prior.total} stop
              </span>
              <span className="mx-1.5 text-[var(--color-foreground-muted)]">→</span>
              <span className="font-semibold">
                {rewriteDelta.next.stop}/{rewriteDelta.next.total} stop
              </span>
              <span className="ml-1.5 text-[var(--color-foreground-muted)]">
                {rewriteDelta.next.stop > rewriteDelta.prior.stop
                  ? 'the lever moved the room.'
                  : rewriteDelta.next.stop < rewriteDelta.prior.stop
                    ? 'the lever cost you stops.'
                    : 'no change from the lever.'}
              </span>
            </p>
          )}
          {rewriteError && (
            <p className="text-center text-[12px] text-[var(--color-error)]" role="alert">
              {rewriteError}
            </p>
          )}
          {showRewrite && (
            <button
              type="button"
              onClick={() => void onRewriteTap(lever)}
              disabled={rewriteBusy}
              className="w-full rounded-[11px] bg-action px-4 py-3 text-center text-[12.5px] font-semibold tracking-[0.005em] text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              aria-label="Rewrite this concept to win back the viewers who bounced"
            >
              {rewriteBusy
                ? 'Rewriting for the room…'
                : `Rewrite to win back the ${pct(bounces.length)}% who bounced →`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
