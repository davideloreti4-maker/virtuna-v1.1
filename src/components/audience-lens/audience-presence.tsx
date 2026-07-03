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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Users, Check, Plus, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import type { Audience } from '@/lib/audience/audience-types';
import { groupAudiences } from '@/components/audience/audience-display';
// Import the LEAF tier resolver, never the SOCIALS_PACK barrel (BUILD-01 bundle-leak
// discipline — the barrel drags runPredictionPipeline → apify-client → Node `dns` into
// this `"use client"` surface). resolveTier reads only `audience.mode`.
import { resolveTier } from '@/lib/audience/resolve-tier';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import { personaNameMap } from '@/lib/audience/persona-names';
import { cardScrollQuoteReactions } from './flat-card-reactions';
import { AmbientRoom } from './AmbientRoom';
import type { AmbientFocus, AmbientFocusSibling, AmbientPersonaReaction } from './ambient-presence-types';
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
const SOCIALS_LABEL = 'Socials';
const GENERAL_LABEL = 'General';
const BUILD_LABEL = 'Build an audience';

/** One in-thread ask + the room's read (the audience-chat turn; host-owned, fetched once). */
export interface AudienceAsk {
  id: string;
  thought: string;
  fraction: string;
  scrollQuote: string;
  /** The react route's real per-persona reactions (registry-enum archetypes) for this ask —
   *  re-focusing on it keeps the named People cast intact. Absent on errored/legacy asks. */
  personas?: AmbientPersonaReaction[];
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
  /** Open the Build-an-audience chooser (the `+ Build an audience` switcher row). Optional. */
  onBuildAudience?: () => void;
  // ── Anchored-focus stepper + `⤺ all N` view-all (PR-2) — threaded from the composer. ──
  /** The current batch's sibling cards (the composer's flat per-tool descriptor list). The Room
   *  renders `‹ Hook N of M ›` + the ranked view-all only when this holds >1 sibling. */
  focusList?: AmbientFocusSibling[];
  /** Re-focus the Room on a sibling by id (= the composer's `focusByTap`) — the stepper callback. */
  onStep?: (id: string) => void;
  /** The batch's kind label ("Hook" | "Idea" | "Script" | "Remix") for the stepper + compare copy. */
  kindLabel?: string;
  // ── Rewrite loop on the Population weak-spot (PR-3) — threaded from the composer. ──
  /** The active skill is text-seedable (hooks/idea/script) ⇒ the Room's Population weak-spot shows
   *  the "Rewrite to win back the N% who bounced →" CTA. Remix (URL-seeded) ⇒ the CTA stays off. */
  canRewrite?: boolean;
  /** Re-run the originating skill steered by the bouncers' words → new card + Read in-thread
   *  (the composer owns the re-run via its own stream hook, then re-focuses the Room on the winner). */
  onRewrite?: (lever: string) => Promise<void>;
  /** Bumped once a reseed lands + the Room re-focuses — gates the honest delta reveal in the CTA. */
  rewriteNonce?: number;
  // ── Desktop persistent rail + surface seam (PR-4) ──────────────────────────
  /** 'dock' (default) = the mobile bottom-docked peek + Bloom panel. 'rail' = the desktop
   *  persistent right-rail presentation: an identity header + an ALWAYS-open Room (an idle
   *  roster when nothing is in focus), no peek toggle, no Bloom sheet. The host picks per
   *  viewport (useMediaQuery ≥ xl) so exactly ONE presentation mounts — never a hidden second
   *  AmbientRoom running its timers. */
  layout?: 'dock' | 'rail';
  /** 'thread' (default) = the /home making surface (the composer field drives asks). 'surface'
   *  = a read-only presence for non-thread pages (app-wide peek, no composer field). The seam is
   *  STUBBED here (accepted + surfaced as `data-variant`) and DEFERRED — only 'thread' is
   *  implemented (owner scope-confirm 2026-07-04; the sister surfaces session owns those pages). */
  variant?: 'thread' | 'surface';
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
  // `asks`/`onReask` stay in the props contract (the composer wires them), but the v6 Bloom
  // reflects the CURRENT focus rather than a stacked ask history — the room re-focuses on a
  // typed ask via the composer's `focusByThought`, so no in-room history list is rendered.
  asking = false,
  docked = false,
  onBuildAudience,
  focusList,
  onStep,
  kindLabel,
  canRewrite,
  onRewrite,
  rewriteNonce,
  layout = 'dock',
  variant = 'thread',
}: AudiencePresenceProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // The Bloom rise: the panel mounts translated-down + faded, then transitions to rest on the
  // next tick so it grows UP out of the presence band (the signature moment). Reset on close.
  const [risen, setRisen] = useState(false);
  useEffect(() => {
    if (!open) {
      setRisen(false);
      return;
    }
    const t = setTimeout(() => setRisen(true), 16);
    return () => clearTimeout(t);
  }, [open]);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  // The switcher menu is PORTALED to <body> so it escapes the composer surface's
  // `overflow-hidden` rounded-corner clip (the dropdown opens UPWARD, well above
  // that surface). Anchored as a fixed box just above the trigger.
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Anchored above (dock — the peek is bottom-pinned) or below (rail — the identity is at the
  // TOP of the right rail). One of top/bottom is set per `layout`.
  const [menuPos, setMenuPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);

  const personas = useMemo(() => audience?.personas ?? [], [audience]);
  // Named-people reframe (The Room, Task A): archetype→creator-label overrides so a renamed
  // person wins in the Lens + persona chat; every other archetype falls back to its stable
  // default name. Memoized off `personas` so the Lens node build stays stable.
  const personaNameOverrides = useMemo(() => personaNameMap(personas), [personas]);
  const isGeneral = audience == null || audience.is_general || personas.length === 0;
  const audienceName = isGeneral ? 'General' : audience?.name ?? 'General';
  // A General person-SIM is exactly ONE persona (mode==='general' && personas.length===1):
  // it presents as a SINGLE reactor reacting *as that one person* (UI-SPEC S5 / D-06), not a
  // swarm. Detect via the persisted mode + persona count — never re-derive from is_general.
  // A General panel-SIM (>1 persona) keeps the existing multi-persona presentation unchanged.
  const isPersonSim = audience?.mode === 'general' && personas.length === 1;
  const rosterCount = isPersonSim ? 1 : personas.length > 0 ? personas.length : DEFAULT_ROSTER_DOTS;

  // Prefer the focus's REAL per-persona reactions (registry-enum archetypes carried from a
  // generated card's own S3′ personas or the react route) — that lights up the named People
  // cast + the "Ask them why →" chat. Only when they are absent do we honestly fall back to
  // expanding the aggregate fraction into placeholder `viewer_N` reactions (chat gated off).
  const flatPersonas: FlatPersonaReaction[] = useMemo(() => {
    if (!focus) return [];
    if (focus.personas && focus.personas.length > 0) return focus.personas;
    return cardScrollQuoteReactions(focus.fraction, focus.scrollQuote);
  }, [focus]);
  const stopRead = useMemo(() => (focus ? parseStop(focus.fraction) : null), [focus]);

  // The one-line pulse: a live read when focused, readiness (never a stale reaction) when idle.
  // A person-SIM frames readiness for the SINGLE reactor ("1 reactor ready"), not a roster.
  const readinessText = isPersonSim
    ? `${audienceName} · 1 reactor ready`
    : `${audienceName} · ${rosterCount} personas ready`;
  const pulseText = stopRead
    ? `${stopRead.stop} of ${stopRead.total} would stop`
    : readinessText;

  const peekDots = useMemo(() => buildDots(personas, flatPersonas, 132, 30), [personas, flatPersonas]);
  const heroDots = useMemo(() => buildDots(personas, [], 320, 110), [personas]);
  // The desktop rail's idle roster — one row per persona (or the General default roster). Derived
  // from the SAME deterministic dot roster as the peek band so the names stay consistent across
  // the presence. Built off an always-idle dot list (flat=[]) so the srLabel is a plain name, not
  // a "name: verdict" (the idle rail shows who is READY, not a stale reaction).
  const rosterRows = useMemo(() => {
    const idleDots = buildDots(personas, [], 132, 30);
    return idleDots.map((d) => ({
      key: d.id,
      name: d.srLabel,
      initial: (d.srLabel.trim()[0] ?? '·').toUpperCase(),
    }));
  }, [personas]);

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
  // The menu is portaled outside switcherRef, so it must be excluded too — otherwise the
  // mousedown on a menu item would close the popover before its click handler fires.
  useEffect(() => {
    if (!switcherOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (switcherRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [switcherOpen]);

  // Anchor the portaled menu just above the trigger; keep it pinned on scroll/resize.
  useLayoutEffect(() => {
    if (!switcherOpen) return;
    const place = () => {
      const r = switcherRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 280;
      if (layout === 'rail') {
        // Rail identity sits at the top-right → open DOWNWARD; clamp so the menu stays on-screen.
        const left = Math.min(r.left, window.innerWidth - width - 12);
        setMenuPos({ left, top: r.bottom + 8, width });
      } else {
        // Dock peek is bottom-pinned → open UPWARD (anchored above the trigger).
        setMenuPos({ left: r.left, bottom: window.innerHeight - r.top + 8, width });
      }
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [switcherOpen, layout]);

  const handleSelect = (a: Audience) => {
    onSelectAudience(a);
    setSwitcherOpen(false);
  };

  // Section the switcher by Mode (D-02). `groupAudiences` routes mode==='general' FIRST
  // (before is_general), so GENERAL_AUDIENCE (mode:'socials') stays in Socials (Pitfall 5).
  const { baseline, templates, generalTemplates, yours } = groupAudiences(audiences);
  const socialsRows = [
    ...baseline,
    ...templates,
    // WR-04: treat "not general" as socials so legacy rows with null/undefined
    // mode (pre-backfill) still surface in the switcher rather than vanishing.
    ...yours.filter((a) => a.mode !== 'general'),
  ];
  const generalRows = [
    ...generalTemplates,
    ...yours.filter((a) => a.mode === 'general'),
  ];

  // One row renderer reused by both sections — existing markup verbatim + a neutral,
  // right-aligned trust badge (resolveTier → Directional/Validated, NO accent).
  const renderRow = (a: Audience) => {
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
          <span className="block text-[13px] font-medium text-[var(--color-foreground)]">
            {a.name}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--color-foreground-muted)]">{sub}</span>
        </span>
        {/* Trust badge — honest tier text, neutral muted (never accent). */}
        <span className="shrink-0 text-[11px] font-medium text-[var(--color-foreground-muted)]">
          {resolveTier(a)}
        </span>
        <Check className={'h-4 w-4 shrink-0 text-[var(--color-foreground-secondary)] ' + (on ? 'opacity-100' : 'opacity-0')} aria-hidden />
      </button>
    );
  };

  // The switcher popover — PORTALED to <body> (fixed) so it escapes any overflow-clip. Opens
  // UPWARD for the dock (bottom-pinned) or DOWNWARD for the rail (top-anchored) via `menuPos`.
  // Extracted so BOTH the dock peek band and the desktop rail header render the same menu.
  const switcherMenu = switcherOpen
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Your audiences"
          style={{
            left: menuPos?.left ?? 0,
            top: menuPos?.top,
            bottom: menuPos?.bottom,
            width: menuPos?.width ?? 280,
          }}
          className="fixed z-[60] max-h-[44vh] overflow-y-auto rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[var(--shadow-float)]"
        >
          {audiences.length === 0 && (
            <p className="px-2 py-2 text-[12px] text-[var(--color-foreground-muted)]">No audiences yet.</p>
          )}

          {/* ── Socials ── — baseline + presets + your socials audiences. */}
          {socialsRows.length > 0 && (
            <>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
                {SOCIALS_LABEL}
              </p>
              {socialsRows.map(renderRow)}
            </>
          )}

          {/* ── General ── — authored templates + your General SIMs. Rendered ONLY when a
                General audience is owned (byte-identical: a Socials-only creator never sees it). */}
          {generalRows.length > 0 && (
            <>
              <p className="mt-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
                {GENERAL_LABEL}
              </p>
              {generalRows.map(renderRow)}
            </>
          )}

          <div className="mx-1 my-1.5 h-px bg-[var(--color-border)]" />
          {/* + Build an audience — opens the Build chooser (plain glyph, NO accent). */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBuildAudience?.();
              setSwitcherOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left text-[13px] text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-hover)]"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">{BUILD_LABEL}</span>
          </button>
          <Link
            href="/audience"
            onClick={() => setSwitcherOpen(false)}
            className="flex items-center gap-2.5 rounded-[8px] px-2 py-2 text-[13px] text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-foreground)]"
          >
            <span className="flex-1">{MANAGE_LABEL}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
          </Link>
        </div>,
        document.body,
      )
    : null;

  // ── Desktop persistent rail (PR-4) ─────────────────────────────────────────
  // The always-present right rail: an identity header (with the same switcher) + an ALWAYS-open
  // Room (the AmbientRoom when a card is in focus, an idle roster otherwise). No peek toggle, no
  // Bloom sheet — the audience is simply on screen beside the making surface. The host mounts
  // this only at ≥ xl (useMediaQuery), so there is never a hidden second AmbientRoom.
  if (layout === 'rail') {
    return (
      <aside
        data-testid="audience-rail"
        data-variant={variant}
        aria-label="Your audience"
        className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-background)]"
      >
        {/* Identity header — constellation + switchable audience name + one-line pulse. */}
        <div className="relative flex shrink-0 items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-4">
          <div className="relative flex min-w-0 flex-1 items-center" ref={switcherRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
              aria-label={`Audience: ${audienceName}. Switch audience`}
              onClick={(e) => {
                e.stopPropagation();
                setSwitcherOpen((v) => !v);
              }}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-1.5 py-1 text-left transition-colors hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-hover)]"
            >
              <ConstellationMark width={52} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--color-foreground-muted)]">
                  Your audience
                </span>
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-foreground)]">
                  <span className="max-w-[190px] truncate">{audienceName}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-foreground-muted)]" aria-hidden />
                </span>
              </span>
            </button>
            {switcherMenu}
          </div>
        </div>

        {/* Body — the always-open Room (focus) or the idle roster (readiness). */}
        <div className="flex min-h-0 flex-1 flex-col">
          {focus ? (
            <AmbientRoom
              flatPersonas={flatPersonas}
              conceptText={focus.conceptText}
              fraction={focus.fraction}
              reducedMotion={reducedMotion}
              personaNameOverrides={personaNameOverrides}
              focusId={focus.id}
              siblings={focusList}
              onStep={onStep}
              kindLabel={kindLabel}
              canRewrite={canRewrite}
              onRewrite={onRewrite}
              rewriteNonce={rewriteNonce}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-4">
              <p className="text-[15px] font-semibold text-[var(--color-foreground)]">{pulseText}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-foreground-muted)]">
                They react the moment you make something — then it opens the room on it.
              </p>
              {rosterRows.length > 0 && (
                <ul className="mt-4 flex flex-col">
                  {rosterRows.map((r) => (
                    <li
                      key={`roster_${r.key}`}
                      className="flex items-center gap-3 border-t border-[var(--color-border)] px-1 py-2.5 first:border-t-0"
                    >
                      <span
                        aria-hidden
                        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[var(--color-hover)] text-[12px] font-bold text-[var(--color-foreground-secondary)]"
                      >
                        {r.initial}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-foreground)]">
                        {r.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* sr-only roster mirror — a11y parity with the dock band. */}
        <div className="sr-only" role="status" aria-live="polite">
          <p>
            {TITLE} — {pulseText}.{focus ? ` Reacting to: ${focus.conceptText}.` : ''}
          </p>
        </div>
      </aside>
    );
  }

  return (
    <div className="relative w-full" data-testid="audience-presence" data-variant={variant}>
      {/* ── The content PANEL — expands UPWARD over the composer (anchored above the peek band,
            flush so peek + panel read as one surface). No scrim, no drawer; the composer below
            stays the input. ────────────────────────────────────────────────────────────── */}
      {open && (
        <div
          data-testid="audience-panel"
          role="dialog"
          aria-label="Your audience"
          className={
            'absolute bottom-full left-0 right-0 z-[55] flex h-[72vh] max-h-[calc(100dvh-128px)] flex-col overflow-hidden rounded-t-[20px] border border-b-0 border-[var(--color-border)] bg-[var(--color-surface-elevated)] ' +
            (docked ? 'shadow-none ' : 'shadow-[var(--shadow-float)] ') +
            (reducedMotion
              ? ''
              : 'transition-[transform,opacity] duration-300 ease-out ' +
                (risen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'))
          }
          style={reducedMotion ? undefined : { willChange: 'transform' }}
        >
          {/* Grab handle — tap to close (mirrors the v6 room grab). */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Collapse your audience"
            className="flex shrink-0 justify-center pb-1 pt-2.5"
          >
            <span className="h-1 w-9 rounded-full bg-white/[0.18]" />
          </button>
          {/* Close ✕ (top-right). */}
          <button
            type="button"
            aria-label="Collapse your audience"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-[8px] border border-[var(--color-border)] text-[var(--color-foreground-muted)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-foreground)]"
          >
            <span className="text-[12px] leading-none">✕</span>
          </button>

          {asking && (
            <p
              role="status"
              aria-live="polite"
              className="shrink-0 px-5 pb-1 pt-1 text-[12px] font-medium text-[var(--color-foreground-muted)]"
            >
              {LOADING_COPY}
            </p>
          )}

          {focus ? (
            <div className="min-h-0 flex-1">
              <AmbientRoom
                flatPersonas={flatPersonas}
                conceptText={focus.conceptText}
                fraction={focus.fraction}
                reducedMotion={reducedMotion}
                personaNameOverrides={personaNameOverrides}
                focusId={focus.id}
                siblings={focusList}
                onStep={onStep}
                kindLabel={kindLabel}
                canRewrite={canRewrite}
                onRewrite={onRewrite}
                rewriteNonce={rewriteNonce}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 pb-8 text-center">
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

          {/* Switcher popover — opens UPWARD (the dock peek is bottom-pinned); shared with the
              rail (which opens it downward). PORTALED to <body> so it is not clipped by the
              composer surface's overflow-hidden. */}
          {switcherMenu}
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
