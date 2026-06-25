'use client';

/**
 * AudiencePresence — the persistent, premium living-audience PRESENCE (P13, redesigned
 * 2026-06-21 per owner feedback). It is the always-on FRONT DOOR to the ONE shipped
 * AudienceLens, rendered as TWO clean states (NOT a 3-step drawer):
 *
 *   • PEEK (at rest) — a matte band docked directly above the composer (it travels with the
 *     composer; both bottom-pinned on mobile). It carries the audience IDENTITY (name + a small
 *     live persona constellation that breathes) + a ONE-LINE PULSE: a live read when there's a
 *     focus ("6 of 10 would stop"), readiness when idle ("General · 10 personas ready") — never
 *     a stale reaction. Tap to open.
 *   • PANEL (tap the band) — it expands UPWARD into a panel anchored over the composer field
 *     (NOT a full-screen drawer, NO scrim): one continuous surface that shows the ONE shipped
 *     <AudienceLensContent> (The Read + lever, Panel·10 ⇄ Population·1,000, replay/swarm,
 *     per-persona chat, Rewrite) for the current focus, plus the conversation of asks. The
 *     COMPOSER FIELD stays the input — when the panel is open, typing + send routes into the
 *     audience chat (the host drives `asks`/`asking` + `focus`), so there is no second input.
 *
 * The PRESENCE owns audience identity + switching (the composer's icon-only audience chip
 * retired). Honesty spine (binding): exactly ONE labeled concept at a time, idle when nothing is
 * in focus, never a fabricated reaction or per-persona quote. Coral is reserved for the worst dot
 * + the Lens's own CTAs; liveness reads via motion + cream opacity only. Deterministic (mulberry32
 * seeded, no wall-clock / PRNG in render) — SSR-hydration + engine-determinism-gate safe.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Users, Check, Plus, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import type { Audience } from '@/lib/audience/audience-types';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import { cardScrollQuoteReactions } from './flat-card-reactions';
import { AudienceLensContent } from './AudienceLensContent';
import type { AmbientFocus } from './ambient-presence-types';
import { ConstellationMark } from '@/components/brand/constellation-mark';
import {
  Constellation,
  buildDots,
  DEFAULT_ROSTER_DOTS,
} from '@/components/brand/constellation';

// ── Copy ──────────────────────────────────────────────────────────────────────
const TITLE = 'Your audience';
const LOADING_COPY = 'Reading the room…';
const MANAGE_LABEL = 'Manage audiences';

/** One in-thread ask + the room's read (the audience-chat turn; host-owned, fetched once). */
export interface AudienceAsk {
  id: string;
  thought: string;
  fraction: string;
  scrollQuote: string;
  error?: boolean;
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

export interface AudiencePresenceProps {
  /** The active calibrated audience (null ⇒ treated as General — no crash). */
  audience: Audience | null;
  /** All selectable audiences (the PRESENCE owns switching). */
  audiences: Audience[];
  /** The selected audience id (or null = General). */
  selectedAudienceId: string | null;
  /** Switch the active audience. */
  onSelectAudience: (audience: Audience) => void;
  /** The driven in-focus concept (or null = idle). The host owns focus tracking. */
  focus: AmbientFocus;
  /** Gates ALL dot motion (hard-stop under reduce). */
  reducedMotion?: boolean;
  /** Panel open state — controlled by the host (so the composer can route its input here). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The audience-chat turns the composer field has sent (host-owned). */
  asks?: AudienceAsk[];
  /** A room read is in flight (the composer just sent an ask). */
  asking?: boolean;
  /** Re-focus the Lens on a past ask (tap a turn in the conversation). */
  onReask?: (ask: AudienceAsk) => void;
  /** When true, the peek band is the top cap of a fused composer dock (no own border/shadow). */
  docked?: boolean;
}

export function AudiencePresence({
  audience,
  audiences,
  selectedAudienceId,
  onSelectAudience,
  focus,
  reducedMotion = false,
  open,
  onOpenChange,
  asks = [],
  asking = false,
  onReask,
  docked = false,
}: AudiencePresenceProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  const personas = useMemo(() => audience?.personas ?? [], [audience]);
  const isGeneral = audience == null || audience.is_general || personas.length === 0;
  const audienceName = isGeneral ? 'General' : audience?.name ?? 'General';
  const rosterCount = personas.length > 0 ? personas.length : DEFAULT_ROSTER_DOTS;

  const flatPersonas: FlatPersonaReaction[] = useMemo(
    () => (focus ? cardScrollQuoteReactions(focus.fraction, focus.scrollQuote) : []),
    [focus],
  );
  const stopRead = useMemo(() => (focus ? parseStop(focus.fraction) : null), [focus]);

  // The one-line pulse: a live read when focused, readiness (never a stale reaction) when idle.
  const pulseText = stopRead
    ? `${stopRead.stop} of ${stopRead.total} would stop`
    : `${audienceName} · ${rosterCount} personas ready`;

  const peekDots = useMemo(() => buildDots(personas, flatPersonas, 132, 30), [personas, flatPersonas]);
  const heroDots = useMemo(() => buildDots(personas, [], 320, 110), [personas]);

  // Esc closes the switcher first, then the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (switcherOpen) setSwitcherOpen(false);
      else if (open) onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, switcherOpen, onOpenChange]);

  // Outside-click closes the switcher popover (not the panel — the composer must stay typable).
  useEffect(() => {
    if (!switcherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [switcherOpen]);

  const handleSelect = (a: Audience) => {
    onSelectAudience(a);
    setSwitcherOpen(false);
  };

  return (
    <div className="relative w-full" data-testid="audience-presence">
      {/* ── The content PANEL — expands UPWARD over the composer (anchored above the peek band,
            flush so peek + panel read as one surface). No scrim, no drawer; the composer below
            stays the input. ────────────────────────────────────────────────────────────── */}
      {open && (
        <div
          data-testid="audience-panel"
          role="dialog"
          aria-label="Your audience"
          className={
            'absolute bottom-full left-0 right-0 z-[55] flex max-h-[58vh] flex-col overflow-hidden border border-b-0 border-[var(--color-border)] bg-[var(--color-surface-elevated)] ' +
            (docked
              ? 'rounded-t-2xl shadow-none'
              : 'rounded-t-[16px] shadow-[var(--shadow-float)]')
          }
        >
          <div className="flex shrink-0 items-center justify-between px-4 pb-1.5 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
              The room
            </span>
            <button
              type="button"
              aria-label="Collapse audience"
              onClick={() => onOpenChange(false)}
              className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-hover)]"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {focus ? (
              <AudienceLensContent
                heatmap={null}
                simResults={undefined}
                flatPersonas={flatPersonas}
                conceptText={focus.conceptText}
                reducedMotion={reducedMotion}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 px-5 pb-4 pt-6 text-center">
                <Constellation
                  dots={heroDots}
                  reducedMotion={reducedMotion}
                  width="100%"
                  height={110}
                  vbW={320}
                  vbH={110}
                />
                <p className="text-[15px] font-semibold text-[var(--color-foreground)]">{pulseText}</p>
                <p className="max-w-[280px] text-[13px] leading-relaxed text-[var(--color-foreground-muted)]">
                  Type below to test a thought — your {audienceName} reacts in real time.
                </p>
              </div>
            )}

            {asking && (
              <p
                role="status"
                aria-live="polite"
                className="px-5 pt-2 text-[13px] font-medium text-[var(--color-foreground-muted)]"
              >
                {LOADING_COPY}
              </p>
            )}

            {/* The audience-chat conversation — every thought the composer sent + the room's read. */}
            {asks.length > 0 && (
              <div className="mt-2 border-t border-[var(--color-border)] px-5 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
                  Your asks
                </p>
                <ul className="flex flex-col gap-2.5">
                  {asks.map((a) => {
                    const read = parseStop(a.fraction);
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => onReask?.(a)}
                          className="w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-border-hover)]"
                        >
                          <span className="block truncate text-[13px] text-[var(--color-foreground)]">
                            “{a.thought}”
                          </span>
                          <span className="mt-1 block text-[12px] text-[var(--color-foreground-muted)]">
                            {a.error
                              ? "Couldn't reach the room — tap to retry"
                              : read
                                ? `${read.stop} of ${read.total} would stop${a.scrollQuote ? ` · “${a.scrollQuote}”` : ''}`
                                : 'The room reacted'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── The PEEK band (always the bottom anchor; tap toggles the panel). ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label={open ? 'Collapse your audience' : 'Open your audience'}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenChange(!open);
          }
        }}
        className={
          docked
            ? 'flex items-center gap-2 px-3 py-2.5 transition-colors ' +
              (open
                ? 'border-t border-[var(--color-border)]'
                : 'border-b border-[var(--color-border)] hover:bg-[var(--color-hover)]')
            : 'flex items-center gap-2 border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 shadow-[var(--shadow-float)] transition-colors hover:border-[var(--color-border-hover)] ' +
              (open ? 'rounded-b-[16px] border-t-0' : 'rounded-[16px]')
        }
        style={{ cursor: 'pointer' }}
      >
        {/* Identity (name + live constellation) — owns the audience switcher. */}
        <div className="relative flex min-w-0 items-center" ref={switcherRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={switcherOpen}
            aria-label={`Audience: ${audienceName}. Switch audience`}
            onClick={(e) => {
              e.stopPropagation();
              setSwitcherOpen((v) => !v);
            }}
            className="flex min-w-0 items-center gap-2.5 rounded-[10px] px-1.5 py-1 transition-colors hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-hover)]"
          >
            <ConstellationMark width={56} />
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-foreground)]">
              <span className="max-w-[120px] truncate">{audienceName}</span>
              {!reducedMotion && (
                <span
                  aria-hidden
                  className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]"
                />
              )}
            </span>
          </button>

          {/* Switcher popover — opens UPWARD (the presence is bottom-docked). */}
          {switcherOpen && (
            <div
              role="menu"
              aria-label="Your audiences"
              className="absolute bottom-full left-0 z-[60] mb-2 max-h-[44vh] w-[280px] overflow-y-auto rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[var(--shadow-float)]"
            >
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
                {TITLE}
              </p>
              {audiences.length === 0 && (
                <p className="px-2 py-2 text-[12px] text-[var(--color-foreground-muted)]">No audiences yet.</p>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(a);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-[var(--color-hover)]"
                  >
                    <Users className="h-4 w-4 shrink-0 text-[var(--color-foreground-secondary)]" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={'block text-[13px] font-medium ' + (on ? 'text-[var(--color-foreground)]' : 'text-[var(--color-foreground)]')}>
                        {a.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--color-foreground-muted)]">{sub}</span>
                    </span>
                    <Check className={'h-4 w-4 shrink-0 text-[var(--color-foreground-secondary)] ' + (on ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  </button>
                );
              })}
              <div className="mx-1 my-1.5 h-px bg-[var(--color-border)]" />
              <Link
                href="/audience"
                onClick={() => setSwitcherOpen(false)}
                className="flex items-center gap-2.5 rounded-[8px] px-2 py-2 text-[13px] text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-foreground)]"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="flex-1">{MANAGE_LABEL}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
              </Link>
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />
        <span
          data-testid="audience-pulse"
          className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-foreground-secondary)]"
          title={focus?.conceptText}
        >
          {pulseText}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-foreground-muted)]" aria-hidden />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-foreground-muted)]" aria-hidden />
        )}
      </div>

      {/* sr-only roster mirror — always present (a11y), regardless of motion state. */}
      <div className="sr-only" role="status" aria-live="polite">
        <p>
          {TITLE} — {pulseText}.{focus ? ` Reacting to: ${focus.conceptText}.` : ''}
        </p>
        <ul>
          {peekDots.map((d) => (
            <li key={`sr_${d.id}`}>{d.srLabel}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
