'use client';

/**
 * AmbientPresence — the persistent living-audience presence (Surfaces 1/2/4 — AMBIENT-01,
 * D-01/D-02/D-04). A thin, always-docked persona-cloud strip: your calibrated people felt
 * even between cards, spotlighting ONE in-focus concept with a `reacting to: {concept}`
 * subject, idling honestly when nothing is in focus, and (when expanded) carrying a
 * type-to-room input that fires the Wave-1 `POST /api/tools/react` route on explicit submit.
 *
 * This is NOT a new visual language and NOT a new engine — it REUSES the shipped primitives:
 *  - the `PersonaCloud` / `PersonaGraph` dot-cloud family (golden-angle layout idiom,
 *    `mulberry32` deterministic, cream-alpha fill, worst-cluster coral, `<animate>` pulse
 *    gated on `reducedMotion`, sr-only `<ul>` mirror) — reduced to a thin horizontal strip,
 *  - the honest `cardScrollQuoteReactions(fraction, scrollQuote)` data path (real counts, one
 *    real lead quote, `[]` on bad input — never fabricated),
 *  - the ONE shipped `<AudienceLens>` (every open door routes here, scoped to the in-focus
 *    concept — D-05, no fork, no restyle).
 *
 * Driven entirely by a `focus` prop the composer supplies (scroll-spy + tap, Plan 13-04):
 *  - `focus` non-null  → spotlight: subject + dots toned to that ONE concept's real reaction.
 *  - `focus` null      → IDLE: roster dots at calm uniform cream, NO reaction, idle copy.
 *
 * Honesty spine (binding — DESIGN constraint, not just engineering): exactly one labeled
 * concept at a time, NEVER an aggregate; idle when nothing is in focus; degrade to quiet on
 * thin signal; never fabricate a reaction or a per-persona quote. Coral is FORBIDDEN on the
 * container / border / title / subject / liveness — liveness reads via motion + cream opacity
 * only (UI-SPEC §Color). Deterministic only — `mulberry32` seeded layout, no nondeterministic
 * randomness or wall-clock reads in render (SSR-hydration + engine-determinism-gate safe).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import { cardScrollQuoteReactions } from './flat-card-reactions';
import { AudienceLens } from './AudienceLens';
import type { AmbientPresenceProps } from './ambient-presence-types';

// ── Copy (UI-SPEC §Copywriting) ────────────────────────────────────────────────
const TITLE = 'Your audience';
const IDLE_COPY = 'Your people are here. Make something — or type a thought to test it.';
const GENERAL_SUBTITLE = 'General audience · default panel';

// ── Dot-cloud strip geometry ────────────────────────────────────────────────────
// A thin horizontal band sized to the collapsed 48px strip. Dots are laid out evenly
// across the width with a small deterministic vertical jitter (mulberry32 — SSR-stable,
// never nondeterministic). The default roster size when an audience has no personas.
const STRIP_VB_W = 320;
const STRIP_VB_H = 28;
const DEFAULT_ROSTER_DOTS = 10;

/** Deterministic seeded PRNG — copied verbatim from PersonaGraph (no nondeterministic source). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** A laid-out strip dot: position + cream-alpha (or worst-cluster coral) fill + sr label. */
interface StripDot {
  id: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  /** sr-only roster line for this persona. */
  srLabel: string;
}

/** Archetype-derived display fallback when a persona has no creator-set label (mirrors the repo idiom). */
function personaName(label: string | undefined, archetype: string, index: number): string {
  if (label && label.trim().length > 0) return label.trim();
  if (archetype && archetype.length > 0) {
    return archetype
      .split('_')
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return `Persona ${index + 1}`;
}

export function AmbientPresence({
  audience,
  focus,
  reducedMotion = false,
  onFocusChange,
}: AmbientPresenceProps) {
  const [expanded, setExpanded] = useState(false);
  const [lensOpen, setLensOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isFocused = focus !== null;
  const personas = audience?.personas ?? [];
  const isGeneral = audience == null || audience.is_general || personas.length === 0;

  // Subtitle: `{N} calibrated people` for a real calibrated roster; the General panel otherwise.
  const subtitle = isGeneral ? GENERAL_SUBTITLE : `${personas.length} calibrated people`;

  // The in-focus concept's honest flat reactions (real counts + one real lead quote). `[]` when
  // idle OR when the fraction can't be parsed — both collapse to the calm roster, no fabrication.
  const flatPersonas: FlatPersonaReaction[] = useMemo(
    () => (focus ? cardScrollQuoteReactions(focus.fraction, focus.scrollQuote) : []),
    [focus],
  );

  // ── Strip dots ────────────────────────────────────────────────────────────────
  // One dot per calibrated persona (or a small calm default roster for General/empty).
  // When focused, tone each dot from the concept's flat reaction: a `stop` reads brighter
  // cream, a `scroll` dimmer cream, and the FIRST scroll persona (the worst slot) reads coral
  // — exactly as PersonaCloud/PersonaGraph paint the worst cluster. When idle, ALL dots render
  // at one calm uniform cream (the roster, no verdict). Coral never appears on the idle roster.
  const dots: StripDot[] = useMemo(() => {
    const count = personas.length > 0 ? personas.length : DEFAULT_ROSTER_DOTS;
    const rnd = mulberry32(1013904223 + count * 2654435761);
    const worstScrollIndex = flatPersonas.findIndex((p) => p.verdict === 'scroll');
    const padX = 14;
    const usableW = STRIP_VB_W - padX * 2;

    const out: StripDot[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const cx = padX + t * usableW;
      const jitter = (rnd() - 0.5) * (STRIP_VB_H * 0.4);
      const cy = STRIP_VB_H / 2 + jitter;

      const persona = personas[i];
      const reaction = flatPersonas[i];
      const isWorst = isFocused && i === worstScrollIndex && worstScrollIndex >= 0;

      let fill: string;
      let r: number;
      if (isWorst) {
        // The single worst slot — the only data-driven coral on the presence (UI-SPEC §Color).
        fill = 'var(--color-accent)';
        r = 4.5;
      } else if (isFocused && reaction) {
        // Toned to the concept's real verdict: stop brighter, scroll dimmer (cream only).
        const alpha = reaction.verdict === 'stop' ? 0.7 : 0.28;
        fill = `rgba(236, 231, 222, ${alpha.toFixed(2)})`;
        r = reaction.verdict === 'stop' ? 4.5 : 3.5;
      } else {
        // IDLE: calm uniform cream — the roster, no reaction (D-01 honesty spine).
        fill = `rgba(236, 231, 222, ${(0.45).toFixed(2)})`;
        r = 4;
      }

      const name = persona
        ? personaName(persona.label, persona.archetype, i)
        : `Persona ${i + 1}`;
      const srLabel = isFocused && reaction ? `${name}: ${reaction.verdict}` : name;

      out.push({ id: persona?.archetype ?? `roster_${i}`, cx, cy, r: r * clamp01(1), fill, srLabel });
    }
    return out;
  }, [personas, flatPersonas, isFocused]);

  // ── Outside-click / Escape collapses the expanded panel (reuse composer-controls idiom) ──
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  // The open cue routes to the ONE shipped Lens scoped to the in-focus concept (D-05). It is a
  // no-op at idle (nothing to open — never fabricate a reaction to nothing).
  const openLens = () => {
    if (!isFocused) return;
    setLensOpen(true);
  };

  const audienceName = isGeneral ? 'General' : audience?.name ?? 'General';

  return (
    <div
      ref={rootRef}
      data-testid="ambient-presence"
      // Local stacking context (below the composer popovers / --z-sticky 200). No coral on the
      // container / border (UI-SPEC §Color). Matte --color-surface when expanded; the strip rests
      // on the thread column background.
      className="relative w-full border-b border-[var(--color-border)] bg-[var(--color-background)]"
      style={{ zIndex: 1 }}
    >
      {/* ── Collapsed strip (default, 48px tall) ─────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4"
        style={{ minHeight: 48 }}
      >
        {/* Title + subtitle */}
        <div className="flex min-w-0 shrink-0 flex-col justify-center">
          <span className="text-[15px] font-semibold leading-snug text-[var(--color-foreground)]">
            {TITLE}
          </span>
          <span className="text-[11px] font-medium leading-snug text-[var(--color-foreground-muted)]">
            {subtitle}
          </span>
        </div>

        {/* The thin dot-cloud strip — the open cue into the Lens (≥44px tap, role=button). */}
        <div
          role="button"
          tabIndex={0}
          aria-label={
            isFocused ? 'Open the audience reaction for the in-focus concept' : 'Your audience'
          }
          aria-disabled={!isFocused}
          onClick={openLens}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openLens();
            }
          }}
          style={{ minHeight: 44, cursor: isFocused ? 'pointer' : 'default' }}
          className="flex min-w-0 flex-1 items-center rounded-[8px] px-1 transition-colors hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
        >
          <svg
            viewBox={`0 0 ${STRIP_VB_W} ${STRIP_VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-7 w-full"
            role="img"
            aria-label={`Your audience — ${dots.length} people`}
          >
            {dots.map((d, i) => {
              const accent = d.fill === 'var(--color-accent)';
              return (
                <circle key={d.id} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill}>
                  {/* Calm "alive" pulse — gated on reducedMotion (hard-stop under reduce). Never
                      a coral glow: liveness reads via motion + cream opacity only. */}
                  {!reducedMotion && !accent && (
                    <animate
                      attributeName="opacity"
                      values="0.85;1;0.85"
                      dur={`${3 + (i % 4)}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
              );
            })}
          </svg>
        </div>

        {/* Subject (Surface 2) — `reacting to: {concept}`, one line truncated. Present only when
            focused; ABSENT at idle (the spotlight is never ambiguous, never fabricated). */}
        {isFocused && (
          <div
            data-testid="ambient-subject"
            className="flex min-w-0 max-w-[40%] shrink items-center truncate text-[13px] font-medium leading-snug"
            title={focus.conceptText}
          >
            <span className="shrink-0 text-[var(--color-foreground-muted)]">reacting to:&nbsp;</span>
            <span className="truncate text-[var(--color-foreground)]">{focus.conceptText}</span>
          </div>
        )}

        {/* Expand toggle */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse audience presence' : 'Expand audience presence'}
          onClick={() => setExpanded((v) => !v)}
          style={{ minHeight: 44, minWidth: 44 }}
          className="flex shrink-0 items-center justify-center rounded-[8px] text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d={expanded ? 'M3 9l4-4 4 4' : 'M3 5l4 4 4-4'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Idle copy — shown inline when nothing is in focus (roster shows, NO reaction). */}
        {!isFocused && (
          <span
            data-testid="ambient-idle-copy"
            className="hidden shrink truncate text-[13px] font-medium leading-snug text-[var(--color-foreground-muted)] sm:block"
          >
            {IDLE_COPY}
          </span>
        )}
      </div>

      {/* ── Expanded panel (self-sizing, capped at 40vh) ─────────────────────────── */}
      {expanded && (
        <div
          data-testid="ambient-expanded"
          className="flex max-h-[40vh] flex-col gap-3 overflow-y-auto border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4"
        >
          {!isFocused && (
            <p className="text-[13px] font-medium leading-snug text-[var(--color-foreground-muted)]">
              {IDLE_COPY}
            </p>
          )}
          {/* Type-to-room input slot (Surface 4) — lands here in Task 2. */}
          <div data-testid="ambient-typetoroom-slot" />
        </div>
      )}

      {/* sr-only mirror — the roster always; the in-focus subject + its stop/total when focused.
          Always present regardless of motion state (accessibility, UI-SPEC §Cross-Cutting). */}
      <div className="sr-only" role="status" aria-live="polite">
        <p>
          {TITLE} — {subtitle}.
          {isFocused
            ? ` Reacting to: ${focus.conceptText}. ${focus.fraction}.`
            : ` ${IDLE_COPY}`}
        </p>
        <ul>
          {dots.map((d) => (
            <li key={`sr_${d.id}`}>{d.srLabel}</li>
          ))}
        </ul>
      </div>

      {/* The ONE shipped Lens, scoped to the in-focus concept (D-05 — no fork, no restyle). */}
      {isFocused && (
        <AudienceLens
          heatmap={null}
          simResults={undefined}
          flatPersonas={flatPersonas}
          conceptText={focus.conceptText}
          reducedMotion={reducedMotion}
          open={lensOpen}
          onOpenChange={setLensOpen}
        />
      )}

      {/* onFocusChange + audienceName are consumed by the Task-2 type-to-room input; reference
          them so the isolated-build (no composer) keeps the contract live without unused warnings. */}
      <span hidden aria-hidden="true" data-audience-name={audienceName} data-has-focus-cb={onFocusChange ? '1' : '0'} />
    </div>
  );
}
