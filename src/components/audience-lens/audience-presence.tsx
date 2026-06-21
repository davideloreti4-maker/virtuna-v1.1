'use client';

/**
 * AudiencePresence — the persistent, premium living-audience PRESENCE (P13, design LOCKED
 * 2026-06-21). It is the always-on FRONT DOOR to the ONE shipped AudienceLens, built as
 * ONE panel at THREE heights (the iOS sheet-detent model), docked on the composer. Mobile-first.
 *
 *   • PEEK (at rest) — a real matte band docked directly above the composer (it travels with
 *     the composer; both bottom-pinned on mobile). Carries the audience IDENTITY (name + a
 *     small live persona constellation that breathes/drifts) and a ONE-LINE PULSE: a live read
 *     when there's a focus ("3 of 10 would stop"), readiness when idle ("General · 10 personas
 *     ready") — NEVER a stale reaction. Tap / chevron / drag-up opens further.
 *   • PREVIEW (tap / drag up) — a taller sheet: a slice of the room (the live read + the one
 *     real lead quote + the toned constellation) and a compact "ask your audience…" entry.
 *     A preview + door, not a reimplementation.
 *   • FULL (drag further / "Open the room →") — the SAME sheet renders <AudienceLensContent>
 *     (The Read + lever, Panel·10 ⇄ Population·1,000, replay/swarm, sticky Rewrite). One object
 *     the creator keeps opening — not a modal that jumps in over the top (fork #5).
 *
 * The PRESENCE owns audience identity + switching (the composer's icon-only audience chip
 * retires — fork #3). Alive mechanic: it reacts to FOCUS — the card you tapped / the latest
 * card (driven `focus`) or a thought you type (type-to-room → POST /api/tools/react). Honesty
 * spine (binding): exactly ONE labeled concept at a time, idle when nothing is in focus, never
 * a fabricated reaction or per-persona quote. Coral is reserved for the worst dot + the Lens's
 * own CTAs; liveness reads via motion + cream opacity only. Deterministic (mulberry32 seeded,
 * no wall-clock / PRNG in render) — SSR-hydration + engine-determinism-gate safe.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Users, Check, Plus, ChevronUp, ChevronRight, ArrowUp } from 'lucide-react';
import type { Audience } from '@/lib/audience/audience-types';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import { cardScrollQuoteReactions } from './flat-card-reactions';
import { AudienceLensContent } from './AudienceLensContent';
import type { AmbientFocus } from './ambient-presence-types';

// ── Copy ──────────────────────────────────────────────────────────────────────
const TITLE = 'Your audience';
const ASK_PLACEHOLDER = 'Ask your audience…';
const OPEN_ROOM_LABEL = 'Open the room →';
const LOADING_COPY = 'Reading the room…';
const ERROR_COPY =
  "Couldn't reach the audience right now. Your thought is saved — try again in a moment.";
const MANAGE_LABEL = 'Manage audiences';

// ── Detents (one continuous panel — the iOS sheet-detent model) ──────────────────
type Detent = 'peek' | 'preview' | 'full';
const FULL_VH = 94;
const PREVIEW_VH = 56;
/** translateY of the FULL-height sheet to reveal each detent (0% = fully up). */
const TRANSLATE_PCT: Record<Detent, number> = {
  full: 0,
  preview: (1 - PREVIEW_VH / FULL_VH) * 100,
  peek: 100,
};

// ── Constellation geometry ──────────────────────────────────────────────────────
const DEFAULT_ROSTER_DOTS = 10;
const CREAM = '236, 231, 222'; // --color-cream-primary, used as rgba(CREAM, α) for liveness

/** Deterministic seeded PRNG — verbatim from PersonaGraph (no nondeterministic source). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Archetype-derived display fallback when a persona has no creator-set label. */
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

/** Parse "6/10 stop" → { stop, total }; null on any unexpected shape (→ readiness copy). */
function parseStop(fraction: string): { stop: number; total: number } | null {
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const stop = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(stop) || !Number.isFinite(total) || total <= 0 || stop > total) return null;
  return { stop, total };
}

interface ConDot {
  id: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  accent: boolean;
  /** SMIL stagger seed (deterministic per index). */
  phase: number;
  srLabel: string;
}

/**
 * Build the constellation dots: one per calibrated persona (or a calm default roster). When a
 * focus is present each dot is toned from the concept's real verdict (stop brighter cream,
 * scroll dimmer, the single worst slot coral); idle = one calm uniform cream (no verdict).
 */
function buildDots(
  personas: Audience['personas'],
  flat: FlatPersonaReaction[],
  vbW: number,
  vbH: number,
): ConDot[] {
  const count = personas.length > 0 ? personas.length : DEFAULT_ROSTER_DOTS;
  const rnd = mulberry32(1013904223 + count * 2654435761);
  const focused = flat.length > 0;
  const worstScrollIndex = flat.findIndex((p) => p.verdict === 'scroll');
  const padX = vbH * 0.5;
  const usableW = vbW - padX * 2;

  const out: ConDot[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const cx = padX + t * usableW;
    const jitter = (rnd() - 0.5) * (vbH * 0.46);
    const cy = vbH / 2 + jitter;

    const persona = personas[i];
    const reaction = flat[i];
    const isWorst = focused && i === worstScrollIndex && worstScrollIndex >= 0;

    let fill: string;
    let r: number;
    if (isWorst) {
      fill = 'var(--color-accent)';
      r = vbH * 0.17;
    } else if (focused && reaction) {
      const alpha = reaction.verdict === 'stop' ? 0.72 : 0.28;
      fill = `rgba(${CREAM}, ${alpha.toFixed(2)})`;
      r = reaction.verdict === 'stop' ? vbH * 0.17 : vbH * 0.13;
    } else {
      fill = `rgba(${CREAM}, 0.5)`;
      r = vbH * 0.15;
    }

    const name = persona ? personaName(persona.label, persona.archetype, i) : `Persona ${i + 1}`;
    out.push({
      id: persona?.archetype ? `${persona.archetype}-${i}` : `roster_${i}`,
      cx,
      cy,
      r,
      fill,
      accent: isWorst,
      phase: rnd(),
      srLabel: focused && reaction ? `${name}: ${reaction.verdict}` : name,
    });
  }
  return out;
}

/** The breathing/drifting persona constellation (SVG). Liveness via motion + cream opacity. */
function Constellation({
  dots,
  reducedMotion,
  width,
  height,
  vbW,
  vbH,
}: {
  dots: ConDot[];
  reducedMotion: boolean;
  width: number | string;
  height: number;
  vbW: number;
  vbH: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width, height }}
      role="img"
      aria-label={`Your audience — ${dots.length} people`}
    >
      {dots.map((d, i) => (
        <g key={d.id} transform={`translate(${d.cx.toFixed(2)} ${d.cy.toFixed(2)})`}>
          {!reducedMotion && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -1.1; 0 0.9; 0 0"
              dur={`${(6 + d.phase * 4).toFixed(2)}s`}
              begin={`${(d.phase * -3).toFixed(2)}s`}
              repeatCount="indefinite"
              additive="sum"
            />
          )}
          <circle cx={0} cy={0} r={d.r} fill={d.fill}>
            {!reducedMotion && !d.accent && (
              <animate
                attributeName="opacity"
                values="0.78;1;0.78"
                dur={`${(3 + (i % 4)).toFixed(0)}s`}
                begin={`${(d.phase * -2).toFixed(2)}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        </g>
      ))}
    </svg>
  );
}

export interface AudiencePresenceProps {
  /** The active calibrated audience (null ⇒ treated as General — no crash). */
  audience: Audience | null;
  /** All selectable audiences (the PRESENCE owns switching — fork #3). */
  audiences: Audience[];
  /** The selected audience id (or null = General). */
  selectedAudienceId: string | null;
  /** Switch the active audience. */
  onSelectAudience: (audience: Audience) => void;
  /** The driven in-focus concept (or null = idle). The composer owns focus tracking. */
  focus: AmbientFocus;
  /** Gates ALL dot motion (hard-stop under reduce). */
  reducedMotion?: boolean;
  /** Type-to-room: notifies the composer's focus state of a just-typed thought's reaction. */
  onFocusChange?: (focus: AmbientFocus) => void;
}

export function AudiencePresence({
  audience,
  audiences,
  selectedAudienceId,
  onSelectAudience,
  focus,
  reducedMotion = false,
  onFocusChange,
}: AudiencePresenceProps) {
  const [detent, setDetent] = useState<Detent>('peek');
  // The audience switcher renders in BOTH the peek band and the sheet header (both are
  // mounted at once), so it is scoped to a LOCATION — only the active one is in the DOM,
  // and it opens UPWARD from the bottom-docked peek / DOWNWARD from the top-docked sheet.
  const [switcherAt, setSwitcherAt] = useState<null | 'peek' | 'sheet'>(null);
  const [mounted, setMounted] = useState(false);

  // Type-to-room (held LOCALLY, ephemeral — a typed thought wins over the driven focus until a
  // newer tap/scroll re-points it).
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [typedFocus, setTypedFocus] = useState<AmbientFocus>(null);
  const [lastSubmitted, setLastSubmitted] = useState('');

  // Live drag translate (px) while a pointer-drag is in progress; null = snap to the detent.
  const [dragTranslate, setDragTranslate] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startTranslate: number; sheetPx: number } | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  const inflightRef = useRef<AbortController | null>(null);

  const effectiveFocus: AmbientFocus = typedFocus ?? focus;
  // Stable reference (a fresh `?? []` each render would churn the dot memos below).
  const personas = useMemo(() => audience?.personas ?? [], [audience]);
  const isGeneral = audience == null || audience.is_general || personas.length === 0;
  const audienceName = isGeneral ? 'General' : audience?.name ?? 'General';
  const rosterCount = personas.length > 0 ? personas.length : DEFAULT_ROSTER_DOTS;

  const flatPersonas: FlatPersonaReaction[] = useMemo(
    () =>
      effectiveFocus
        ? cardScrollQuoteReactions(effectiveFocus.fraction, effectiveFocus.scrollQuote)
        : [],
    [effectiveFocus],
  );

  const stopRead = useMemo(
    () => (effectiveFocus ? parseStop(effectiveFocus.fraction) : null),
    [effectiveFocus],
  );

  // The one-line pulse: a live read when focused, readiness (NEVER a stale reaction) when idle.
  const pulseText = stopRead
    ? `${stopRead.stop} of ${stopRead.total} would stop`
    : `${audienceName} · ${rosterCount} personas ready`;

  const peekDots = useMemo(
    () => buildDots(personas, flatPersonas, 132, 30),
    [personas, flatPersonas],
  );
  const bigDots = useMemo(
    () => buildDots(personas, flatPersonas, 320, 96),
    [personas, flatPersonas],
  );

  // ── Focus reconciliation: a new driven focus drops the local typed override. ──
  useEffect(() => {
    setTypedFocus(null);
  }, [focus]);

  // Abort any in-flight type-to-room reaction on unmount.
  useEffect(() => () => inflightRef.current?.abort(), []);

  // Portal target only exists client-side.
  useEffect(() => setMounted(true), []);

  const open = detent !== 'peek';

  // Lock body scroll while the sheet is open (mobile sheet idiom).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes the switcher first, then collapses the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (switcherAt) setSwitcherAt(null);
      else if (open) setDetent('peek');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, switcherAt]);

  // Outside-click closes the switcher popover (switcherRef wraps the active button + popover).
  useEffect(() => {
    if (!switcherAt) return;
    const onDown = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherAt(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [switcherAt]);

  // Changing detent closes any open switcher (it belonged to the prior surface).
  useEffect(() => setSwitcherAt(null), [detent]);

  const goFull = useCallback(() => setDetent('full'), []);
  const collapse = useCallback(() => setDetent('peek'), []);

  // ── Pointer-drag between detents (grab handle) — snaps to the nearest detent. ──
  const onDragDown = (e: React.PointerEvent) => {
    if (typeof window === 'undefined') return;
    const sheetPx = (window.innerHeight * FULL_VH) / 100;
    dragRef.current = {
      startY: e.clientY,
      startTranslate: (sheetPx * TRANSLATE_PCT[detent]) / 100,
      sheetPx,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const next = Math.min(Math.max(d.startTranslate - (d.startY - e.clientY), 0), d.sheetPx);
    setDragTranslate(next);
  };
  const onDragUp = () => {
    const d = dragRef.current;
    if (!d) return;
    const visible = d.sheetPx - (dragTranslate ?? d.startTranslate);
    const fullV = d.sheetPx;
    const previewV = (d.sheetPx * PREVIEW_VH) / FULL_VH;
    // Snap to the nearest of {full, preview, peek(0)}.
    const targets: Array<[Detent, number]> = [
      ['full', fullV],
      ['preview', previewV],
      ['peek', 0],
    ];
    let best: Detent = 'peek';
    let bestDist = Infinity;
    for (const [name, v] of targets) {
      const dist = Math.abs(visible - v);
      if (dist < bestDist) {
        bestDist = dist;
        best = name;
      }
    }
    dragRef.current = null;
    setDragTranslate(null);
    setDetent(best);
  };

  // ── Type-to-room: explicit-submit Flash reaction (no client model call; server route only). ──
  const submitThought = async (raw: string) => {
    const text = raw.trim();
    if (text.length === 0 || loading) return;
    inflightRef.current?.abort();
    const controller = new AbortController();
    inflightRef.current = controller;
    setLoading(true);
    setError(false);
    setLastSubmitted(text);
    try {
      const res = await fetch('/api/tools/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error('reaction_failed');
      const data: { fraction?: string; scrollQuote?: string } = await res.json();
      if (controller.signal.aborted) return;
      const next: AmbientFocus = {
        conceptText: text,
        fraction: data.fraction ?? '',
        scrollQuote: data.scrollQuote ?? '',
      };
      setTypedFocus(next);
      onFocusChange?.(next);
      setDraft('');
      setDetent('full'); // route the typed thought into the room (the shipped Lens)
    } catch (e) {
      if (controller.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
      setError(true);
    } finally {
      if (inflightRef.current === controller) setLoading(false);
    }
  };

  const handleSelect = (a: Audience) => {
    onSelectAudience(a);
    setSwitcherAt(null);
  };

  // ── Identity (name + live constellation) — shared by the peek band + the sheet header. ──
  // `location` scopes the single-active switcher; it opens upward from the bottom-docked peek
  // and downward from the top-docked sheet header.
  const identity = (location: 'peek' | 'sheet') => {
    const isActive = switcherAt === location;
    const up = location === 'peek';
    return (
    <div
      className="relative flex min-w-0 items-center gap-2.5"
      ref={isActive ? switcherRef : undefined}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isActive}
        aria-label={`Audience: ${audienceName}. Switch audience`}
        onClick={(e) => {
          e.stopPropagation();
          setSwitcherAt((v) => (v === location ? null : location));
        }}
        className="flex min-w-0 items-center gap-2.5 rounded-[10px] px-1.5 py-1 transition-colors hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-hover)]"
      >
        <Constellation
          dots={peekDots}
          reducedMotion={reducedMotion}
          width={56}
          height={26}
          vbW={132}
          vbH={30}
        />
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-foreground)]">
            <span className="truncate">{audienceName}</span>
            {!reducedMotion && (
              <span
                aria-hidden
                className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
                style={{
                  backgroundColor: `rgba(${CREAM}, 0.85)`,
                  animation: 'audpulse 2.4s ease-in-out infinite',
                }}
              />
            )}
          </span>
        </span>
        <ChevronUp
          className="h-3.5 w-3.5 shrink-0 text-[var(--color-foreground-muted)]"
          aria-hidden
        />
      </button>

      {/* Switcher popover — UPWARD from the bottom-docked peek, DOWNWARD from the sheet. */}
      {isActive && (
        <div
          role="menu"
          aria-label="Your audiences"
          className={
            'absolute left-0 z-10 max-h-[44vh] w-[280px] overflow-y-auto rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[var(--shadow-float)] ' +
            (up ? 'bottom-full mb-2' : 'top-full mt-2')
          }
        >
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
            {TITLE}
          </p>
          {audiences.length === 0 && (
            <p className="px-2 py-2 text-[12px] text-[var(--color-foreground-muted)]">
              No audiences yet.
            </p>
          )}
          {audiences.map((a) => {
            const on = a.is_general ? isGeneral : a.id === selectedAudienceId;
            const sub = a.is_general
              ? 'Default — keeps the regression gate'
              : `${a.platform}${a.goal_label ? ` · ${a.goal_label}` : ''}`;
            return (
              <button
                key={a.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => handleSelect(a)}
                className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-[var(--color-hover)]"
              >
                <Users className="h-4 w-4 shrink-0 text-[var(--color-foreground-secondary)]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      'block text-[13px] font-medium ' +
                      (on ? 'text-[var(--color-accent)]' : 'text-[var(--color-foreground)]')
                    }
                  >
                    {a.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--color-foreground-muted)]">
                    {sub}
                  </span>
                </span>
                <Check
                  className={
                    'h-4 w-4 shrink-0 text-[var(--color-accent)] ' + (on ? 'opacity-100' : 'opacity-0')
                  }
                  aria-hidden
                />
              </button>
            );
          })}
          <div className="mx-1 my-1.5 h-px bg-[var(--color-border)]" />
          <Link
            href="/audience"
            onClick={() => setSwitcherAt(null)}
            className="flex items-center gap-2.5 rounded-[8px] px-2 py-2 text-[13px] text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-foreground)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="flex-1">{MANAGE_LABEL}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
          </Link>
        </div>
      )}
    </div>
    );
  };

  // ── The "ask your audience…" entry (preview) — explicit-submit Flash reaction. ──
  const askEntry = (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submitThought(draft);
            }
          }}
          rows={1}
          aria-label="Ask your audience — test a thought against the room"
          placeholder={ASK_PLACEHOLDER}
          className="min-h-[44px] flex-1 resize-none rounded-[10px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.04)] px-3.5 py-3 text-[14px] text-[var(--color-foreground)] transition-colors placeholder:text-[var(--color-foreground-muted)] focus:border-[var(--color-border-hover)] focus:outline-none"
        />
        <button
          type="button"
          aria-label="Ask your audience"
          onClick={() => void submitThought(draft)}
          disabled={loading || draft.trim().length === 0}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[10px] text-[var(--color-accent-foreground)] transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
      {loading && (
        <p
          role="status"
          aria-live="polite"
          className="text-[13px] font-medium text-[var(--color-foreground-muted)]"
        >
          {LOADING_COPY}
        </p>
      )}
      {error && !loading && (
        <div className="flex flex-col gap-1" role="alert">
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-cream-secondary)' }}>
            {ERROR_COPY}
          </p>
          <button
            type="button"
            onClick={() => void submitThought(lastSubmitted)}
            disabled={loading || lastSubmitted.trim().length === 0}
            className="self-start text-[13px] font-medium transition-colors disabled:opacity-40"
            style={{ color: 'var(--color-cream-secondary)' }}
          >
            Retry →
          </button>
        </div>
      )}
    </div>
  );

  // ── The PEEK band (always inline — the at-rest dock above the composer). ──
  const peekBand = (
    <div
      ref={rootRef}
      data-testid="audience-presence"
      className="w-full"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Open your audience"
        aria-expanded={open}
        onClick={() => setDetent('preview')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetent('preview');
          }
        }}
        className="flex items-center gap-2 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 shadow-[var(--shadow-float)] transition-colors hover:border-[var(--color-border-hover)]"
        style={{ cursor: 'pointer' }}
      >
        {identity('peek')}
        <div className="mx-1 h-5 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />
        <span
          data-testid="audience-pulse"
          className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-foreground-secondary)]"
          title={effectiveFocus?.conceptText}
        >
          {pulseText}
        </span>
        <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-foreground-muted)]" aria-hidden />
      </div>

      {/* sr-only roster mirror — always present (a11y), regardless of motion state. */}
      <div className="sr-only" role="status" aria-live="polite">
        <p>
          {TITLE} — {pulseText}.
          {effectiveFocus ? ` Reacting to: ${effectiveFocus.conceptText}.` : ''}
        </p>
        <ul>
          {peekDots.map((d) => (
            <li key={`sr_${d.id}`}>{d.srLabel}</li>
          ))}
        </ul>
      </div>
    </div>
  );

  // ── The overlay sheet (preview / full) — portaled, viewport-bottom-pinned. ──
  const sheet = mounted
    ? createPortal(
        <>
          {/* Scrim */}
          <div
            aria-hidden
            onClick={collapse}
            className="fixed inset-0 z-[120] bg-black/50 transition-opacity duration-300"
            style={{
              opacity: open ? 1 : 0,
              pointerEvents: open ? 'auto' : 'none',
            }}
          />
          {/* Sheet — FULL height, translated down to reveal the active detent. */}
          <div
            data-testid="audience-presence-sheet"
            data-detent={detent}
            role="dialog"
            aria-modal={open}
            aria-label="Your audience"
            className="fixed inset-x-0 bottom-0 z-[121] mx-auto flex w-full max-w-[760px] flex-col rounded-t-[22px] border-t border-[var(--color-border-hover)] bg-[var(--color-background)] shadow-[var(--shadow-float)]"
            style={{
              height: `${FULL_VH}vh`,
              transform:
                dragTranslate != null
                  ? `translateY(${dragTranslate}px)`
                  : `translateY(${TRANSLATE_PCT[detent]}%)`,
              transition: dragTranslate != null ? 'none' : 'transform 360ms cubic-bezier(.32,.72,0,1)',
              touchAction: 'none',
              visibility: open || dragTranslate != null ? 'visible' : 'hidden',
            }}
          >
            {/* Inner content is mounted only while open — at rest the PEEK band is the sole
                representation (no hidden duplicate identity / ask input behind the scrim). */}
            {open && (
            <>
            {/* Grab handle + header (the drag region) */}
            <div
              onPointerDown={onDragDown}
              onPointerMove={onDragMove}
              onPointerUp={onDragUp}
              onPointerCancel={onDragUp}
              className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5 active:cursor-grabbing"
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--color-border-hover)]" />
              <div className="flex items-center gap-2">
                {identity('sheet')}
                <div className="flex-1" />
                {detent === 'preview' && (
                  <button
                    type="button"
                    onClick={goFull}
                    className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-hover)]"
                  >
                    {OPEN_ROOM_LABEL}
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close audience"
                  onClick={collapse}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-hover)]"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      d="M3 11l8-8M3 3l8 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body — preview slice OR the full shipped Lens content. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {detent === 'full' ? (
                <AudienceLensContent
                  heatmap={null}
                  simResults={undefined}
                  flatPersonas={flatPersonas}
                  conceptText={effectiveFocus?.conceptText}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <div className="flex flex-col gap-5 px-5 pb-8 pt-3">
                  {/* The live read (or readiness) + the toned constellation. */}
                  <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <p className="text-[15px] font-semibold text-[var(--color-foreground)]">
                      {pulseText}
                    </p>
                    <Constellation
                      dots={bigDots}
                      reducedMotion={reducedMotion}
                      width="100%"
                      height={96}
                      vbW={320}
                      vbH={96}
                    />
                    {effectiveFocus && effectiveFocus.scrollQuote ? (
                      <blockquote className="border-l-2 border-[var(--color-border-hover)] pl-3 text-[13.5px] leading-relaxed text-[var(--color-foreground-secondary)]">
                        “{effectiveFocus.scrollQuote}”
                      </blockquote>
                    ) : (
                      <p className="text-[12.5px] leading-relaxed text-[var(--color-foreground-muted)]">
                        {effectiveFocus
                          ? 'The room reacted — open it to read every persona.'
                          : 'Type a thought below, or open the room to test your latest idea.'}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={goFull}
                      className="self-start rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:border-[var(--color-border-hover)]"
                    >
                      {OPEN_ROOM_LABEL}
                    </button>
                  </div>

                  {/* The compact "ask your audience…" entry. */}
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
                      Ask the room
                    </p>
                    {askEntry}
                  </div>
                </div>
              )}
            </div>
            </>
            )}
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      {peekBand}
      {sheet}
    </>
  );
}
