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
import {
  personaNameMap,
  resolvePersonaName,
  ARCHETYPE_PERSONA_NAME,
  ARCHETYPE_TRAIT,
  GENERAL_ROSTER,
} from '@/lib/audience/persona-names';
import type { Archetype } from '@/lib/engine/wave3/persona-registry';
import { cardScrollQuoteReactions } from './flat-card-reactions';
import { AmbientRoom } from './AmbientRoom';
import { PersonaChatDrawer, type PersonaChatTarget } from './PersonaChatDrawer';
import type { AmbientFocus, AmbientFocusSibling, AmbientPersonaReaction } from './ambient-presence-types';
import type { PopulationAggregate } from '@/lib/audience/population';
import { ConstellationMark } from '@/components/brand/constellation-mark';
import {
  Constellation,
  buildDots,
  buildFieldDots,
  DEFAULT_ROSTER_DOTS,
} from '@/components/brand/constellation';
import { stripWrappingQuotes } from '@/lib/utils';
import { HORIZONTAL_ENABLED } from '@/lib/flags/horizontal';

// ── Copy ──────────────────────────────────────────────────────────────────────
const TITLE = 'Your audience';
const LOADING_COPY = 'Reading the room…';
/** Reactions-arrive count-up cadence (Phase 2) — one tick per persona, calm + deterministic. */
const ARRIVAL_STEP_MS = 80;
const MANAGE_LABEL = 'Manage audiences';
const SOCIALS_LABEL = 'Socials';
const GENERAL_LABEL = 'General';
const BUILD_LABEL = 'Build an audience';
/** variant='surface' idle sub-copy — a read-only description of the app-wide presence on a
 *  non-thread page. Deliberately implies NO input here (no "type below" / composer affordance). */
const SURFACE_IDLE_SUB = 'Here on every surface — your room reacts to everything you post.';

/** One in-thread ask + the room's read (the audience-chat turn; host-owned, fetched once). */
export interface AudienceAsk {
  id: string;
  thought: string;
  fraction: string;
  scrollQuote: string;
  /** The react route's real per-persona reactions (registry-enum archetypes) for this ask —
   *  re-focusing on it keeps the named People cast intact. Absent on errored/legacy asks. */
  personas?: AmbientPersonaReaction[];
  /** The Stage 2 population projection for this ask — re-focusing restores the real 1,000-view
   *  numbers. Absent when the audience lacked v2 axes (or on errored/legacy asks). */
  population?: PopulationAggregate;
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
  // ── Reactions-arrive dopamine (Phase 2) ────────────────────────────────────
  /** A room-reaction generation is IN FLIGHT (the composer's ideas/hooks/script/remix stream).
   *  While true the presence reads "Reading the room…" + the lit constellation blinks (anticipation);
   *  on the true→false edge a "N new" badge pops + counts up (the arrival). Motion-gated. */
  reacting?: boolean;
  /** Bumped by the composer on the reactions true→false edge (a generation just finished). Drives
   *  the "N new" arrival count-up from a STABLE parent so the empty→thread remount can't swallow
   *  the edge (the pre-2026-07-07 ref-on-this-component approach missed it entirely). */
  arrivalNonce?: number;
  /** True when the presence was opened by a card's "See the room →" that pre-focused ONE card —
   *  the Room then drills straight into that card's people instead of the ranked overview. */
  drillIntoFocus?: boolean;
  /** 'thread' (default) = the /home making surface (the composer field drives asks). 'surface'
   *  = a READ-ONLY presence for non-thread pages (the app-wide peek, no composer field). Same
   *  presentation EXCEPT the composer-bound affordances are gated off: the Rewrite CTA is forced
   *  off (`canRewrite=false`) and the idle copy drops the "type below" prompt (§3 sign-off delta —
   *  no ask input / Rewrite unless the surface hosts a composer). Currently unmounted (the /start
   *  dock was retired in #208) but kept forward-ready per `docs/SURFACE-SEAM-SPEC.md` §2.
   *
   *  'rail' = the PERSISTENT presentation (P2, ambient-room-v2). The panel BODY is always shown
   *  in-flow inside a fixed-height column — it never blooms, never collapses, has no z-[55] overlay
   *  and no rise animation. The desktop right rail (≥xl) hosts this. The inner <AmbientRoom>/idle
   *  cast is byte-identical to the 'thread' panel; only the CONTAINER changes (an absolute upward
   *  bloom → an in-flow card), so this is a re-host, not a rebuild.
   *
   *  'header' = the <xl mobile/tablet presentation (P2 · A2b). A compact 68px bar that expands
   *  DOWNWARD (a `top-full` sheet over the thread) instead of upward — it sits ABOVE the thread and
   *  survives the keyboard because it is top-anchored, not bottom-pinned. Same body; the bloom flips. */
  variant?: 'thread' | 'surface' | 'rail' | 'header';
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
  // Ask history (A-lite): recent asks render as quiet re-askable rows in the IDLE panel and
  // under a typed-thought read — the two states where the ask conversation actually lives.
  // Card-focused states stay clean (they carry the stepper + ranked chrome already).
  asks = [],
  onReask,
  asking = false,
  docked = false,
  onBuildAudience,
  focusList,
  onStep,
  kindLabel,
  canRewrite,
  onRewrite,
  rewriteNonce,
  reacting = false,
  arrivalNonce = 0,
  drillIntoFocus = false,
  variant = 'thread',
}: AudiencePresenceProps) {
  // variant='surface' (non-thread pages) is READ-ONLY: it reuses the exact dock presentation
  // but gates every composer-bound affordance — the Rewrite CTA (there is no composer to re-run the
  // skill) and the "type below" idle prompt. Everything else (the peek band, the switcher, the
  // constellation, the roster, the on-focus AmbientRoom) is already read-only. Guarded so
  // variant='thread' stays byte-identical (§3 sign-off delta; docs/SURFACE-SEAM-SPEC.md §2.1).
  const isSurface = variant === 'surface';
  // 'rail' = the persistent, in-flow presentation (P2). The panel body renders like the OPEN
  // bloom, but the container is a static full-height card: no `absolute bottom-full z-[55]`, no
  // rise animation, no collapse chevron. It shows regardless of `open` (the rail never dismisses).
  const isRail = variant === 'rail';
  // 'header' = the <xl mobile/tablet presentation (P2 · A2b): a compact 68px bar at rest that
  // expands DOWNWARD (open ⇒ a top-full sheet over the thread) instead of upward. It survives the
  // keyboard because it's TOP-anchored, not bottom-pinned. Same body; only the bloom flips.
  const isHeader = variant === 'header';
  const effectiveCanRewrite = isSurface ? false : canRewrite;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // "Meet your room" persona chat — the idle-cast introduction (meet-mode: no reaction yet).
  const [meetTarget, setMeetTarget] = useState<PersonaChatTarget | null>(null);
  // Panel height clamp. The panel expands UPWARD from the dock anchor (`bottom-full`); its CSS
  // max-h assumes the bottom-pinned THREAD composer (~140px from the viewport bottom). On the
  // CENTERED home composer the anchor sits mid-viewport, so an unclamped 70vh panel overflows
  // the viewport top (measured -271px at 717px height) and the top of the room — including the
  // "Meet your room" cast — becomes unreachable. Clamp to the space actually above the anchor;
  // the panel body already scrolls (overflow-y auto), so clamped content stays reachable.
  const dockRootRef = useRef<HTMLDivElement | null>(null);
  const [panelMaxH, setPanelMaxH] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const top = dockRootRef.current?.getBoundingClientRect().top;
      if (top == null) return;
      // Floor 200px: header + a scrollable strip stays usable even on an unusually high anchor.
      setPanelMaxH(Math.max(200, Math.round(top - 16)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);
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
  // Anchored above (collapsed chip — bottom-pinned) or below (the open panel's top bar). `maxH`
  // clamps the menu to the space actually available on the chosen side — the chip is NOT always
  // bottom-pinned (the centered empty-home layout puts it mid-viewport), and an unclamped upward
  // menu rendered its top rows off-screen there.
  const [menuPos, setMenuPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH?: number } | null>(null);

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

  // Compact IDLE readiness for the mobile DOCK cap, where the switcher chip + expand chevron
  // leave little room — "6 ready" never truncates, unlike the fuller "6 personas ready". The
  // live stop-read keeps its full phrasing (it's the meaningful moment). While a generation is
  // in flight the pulse reads "Reading the room…" (the anticipation beat — the lit constellation
  // blinks alongside); when it finishes it settles back and the arrival badge pops.
  const dockPulse = reacting
    ? LOADING_COPY
    : stopRead
      ? `${stopRead.stop} of ${stopRead.total} would stop`
      : `${rosterCount} ready`;

  // OPEN-panel top bar shows READINESS, never the focus score — the Room right below owns
  // the score (the serif hero in the drill view; per-row meters in the ranked view), and
  // echoing it in the bar read as two competing reads (and as a phantom aggregate over the
  // ranked list). "Reading the room…" still takes over while a generation is in flight.
  const openPulse = reacting
    ? LOADING_COPY
    : isPersonSim
      ? '1 reactor ready'
      : `${rosterCount} ready`;

  // The "N new" arrival badge: on the reacting true→false edge (the room just finished
  // reacting), a terracotta pill pops onto the presence and counts up to the roster size —
  // "N people just weighed in." Deterministic (a known integer count); reduced-motion snaps
  // straight to the final N (no pop, no count). Cleared once the Room opens (acknowledged).
  const [badgeCount, setBadgeCount] = useState<number | null>(null);
  // The arrival count-up is DRIVEN BY `arrivalNonce` (bumped by the composer on the reactions
  // true→false edge), NOT by this component's own `reacting` edge. Why: the presence remounts
  // across the empty→thread layout switch that lands mid-generation, which reset the old
  // mount-seeded ref every time and swallowed the true→false edge (the badge never fired). The
  // composer is a stable instance, so it owns the edge; here we just react to the nonce ticking.
  const prevArrivalNonceRef = useRef(arrivalNonce);
  useEffect(() => {
    const prev = prevArrivalNonceRef.current;
    prevArrivalNonceRef.current = arrivalNonce;
    if (arrivalNonce === prev || arrivalNonce <= 0) return; // only a genuine new arrival
    if (rosterCount <= 0 || open) return; // nothing to count / already acknowledged (Room open)
    if (reducedMotion) {
      setBadgeCount(rosterCount); // reduced-motion: snap straight to the final N (no pop, no count)
      return;
    }
    setBadgeCount(0);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setBadgeCount(n);
      if (n >= rosterCount) clearInterval(t);
    }, ARRIVAL_STEP_MS);
    return () => clearInterval(t);
  }, [arrivalNonce, rosterCount, reducedMotion, open]);
  // A fresh read starting (reacting rises) clears any stale "N new" so the pulse reads
  // "Reading the room…" cleanly until the next arrival pops.
  useEffect(() => {
    if (reacting) setBadgeCount(null);
  }, [reacting]);
  // Clear the badge once the creator opens the Room (the arrival has been seen).
  useEffect(() => {
    if (open) setBadgeCount(null);
  }, [open]);

  // The arrival badge element — "N new — come look": it marks reactions that landed while the
  // Room is closed, and clears when the creator opens it. Dosage: the one sanctioned accent-FILL,
  // for a genuine liveness event (dark glyph on terracotta = the prototype `.pnew`). Ephemeral:
  // it pops, then clears on open.
  const arrivalBadge =
    badgeCount !== null && badgeCount > 0 ? (
      <span
        role="status"
        aria-live="polite"
        aria-label={`${badgeCount} new ${badgeCount === 1 ? 'reaction' : 'reactions'}`}
        className={
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] font-mono text-[10px] font-bold leading-none ' +
          (reducedMotion ? '' : 'animate-badge-pop')
        }
        style={{ background: 'var(--color-accent)', color: '#2a1c14' }}
      >
        <span aria-hidden>✦</span>
        <span className="tabular-nums">{badgeCount}</span>
        <span>new</span>
      </span>
    ) : null;

  const peekDots = useMemo(() => buildDots(personas, flatPersonas, 132, 30), [personas, flatPersonas]);
  const heroDots = useMemo(
    () => buildFieldDots(personas.length > 0 ? personas.length : DEFAULT_ROSTER_DOTS, 260, 96),
    [personas.length],
  );
  // "Meet your room" cast — the actual named people who react. Calibrated audiences use their own
  // personas (creator labels win); General has no persona rows, so it reads the canonical roster.
  // Each member carries a one-line trait so the room is tangible, not an abstract "10 personas".
  const castMembers = useMemo(() => {
    if (personas.length > 0) {
      return personas.map((p, i) => {
        const name = resolvePersonaName(p.archetype, p.label) ?? `Person ${i + 1}`;
        const trait = ARCHETYPE_TRAIT[p.archetype as Archetype] ?? '';
        // Only registry archetypes can be MET — the chat route validates against the enum, and a
        // non-registry row would silently degrade to open chat (wrong voice). No dead affordance.
        const canMeet = p.archetype in ARCHETYPE_TRAIT;
        return {
          key: `${p.archetype}-${i}`,
          archetype: p.archetype,
          name,
          trait,
          canMeet,
        };
      });
    }
    return GENERAL_ROSTER.map((a) => {
      const name = ARCHETYPE_PERSONA_NAME[a];
      return {
        key: a,
        archetype: a as string,
        name,
        trait: ARCHETYPE_TRAIT[a],
        canMeet: true,
      };
    });
  }, [personas]);

  // Ask history (A-lite): the re-askable trail — every non-errored ask except the one currently
  // on screen as the focus (matched by thought text; a focus carries no ask id). Newest first,
  // capped at 3. Rendered in the idle panel + under a typed-thought read; never on a card focus.
  const earlierRows = useMemo(
    () =>
      asks
        .filter((a) => !a.error && a.thought !== focus?.conceptText)
        .slice(-3)
        .reverse(),
    [asks, focus?.conceptText],
  );
  const earlierAsks =
    !isSurface && onReask && earlierRows.length > 0 ? (
      <div className="w-full max-w-[540px]">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">
          Earlier asks
        </p>
        <ul className="flex flex-col">
          {earlierRows.map((a) => {
            const p = parseStop(a.fraction);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onReask(a)}
                  aria-label={`Re-open the room on “${a.thought}”`}
                  className="flex w-full items-baseline gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-foreground-secondary)]">
                    &ldquo;{stripWrappingQuotes(a.thought)}&rdquo;
                  </span>
                  {p && (
                    <span className="shrink-0 text-[12px] tabular-nums text-[var(--color-foreground-muted)]">
                      {p.stop}/{p.total}
                    </span>
                  )}
                  <span aria-hidden className="shrink-0 text-[12px] text-[var(--color-foreground-muted)]">
                    ⤺
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  // Esc closes the meet drawer first, then the switcher, then the panel — innermost out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (meetTarget) setMeetTarget(null);
      else if (switcherOpen) setSwitcherOpen(false);
      else if (open) onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, switcherOpen, meetTarget, onOpenChange]);

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
      const spaceAbove = r.top - 20;
      const spaceBelow = window.innerHeight - r.bottom - 20;
      if (docked && open) {
        // The docked switcher at the TOP of the open panel opens DOWNWARD; clamp so the
        // menu stays on-screen.
        const left = Math.min(r.left, window.innerWidth - width - 12);
        setMenuPos({ left, top: r.bottom + 8, width, maxH: Math.max(160, spaceBelow) });
      } else if (spaceAbove < 220 && spaceBelow > spaceAbove) {
        // The chip sits high (centered empty-home layout) — an upward menu would push its top
        // rows off-screen, so flip DOWNWARD where the room actually is.
        const left = Math.min(r.left, window.innerWidth - width - 12);
        setMenuPos({ left, top: r.bottom + 8, width, maxH: Math.max(160, spaceBelow) });
      } else {
        // Collapsed dock chip is bottom-pinned → open UPWARD (anchored above the trigger),
        // clamped to the space above so the top rows can never leave the viewport.
        setMenuPos({
          left: r.left,
          bottom: window.innerHeight - r.top + 8,
          width,
          maxH: Math.max(160, spaceAbove),
        });
      }
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [switcherOpen, docked, open]);

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
  // Horizontal (mode:'general') audiences are HIDDEN while HORIZONTAL_ENABLED is off — the
  // verbs that run on them (Profile/Simulate/Predict) are gone, so offering the audience
  // would be a dead end. Rows are not deleted, just not listed; flip the flag to restore.
  // NOTE: GENERAL_AUDIENCE is mode:'socials' and stays in `socialsRows` — see THE TRAP in
  // lib/flags/horizontal.ts. Do not "simplify" this to key on is_general.
  const generalRows = HORIZONTAL_ENABLED
    ? [...generalTemplates, ...yours.filter((a) => a.mode === 'general')]
    : [];

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
  // UPWARD from the collapsed chip (bottom-pinned) or DOWNWARD from the open panel's top bar,
  // side-clamped via `menuPos`. Shared by the collapsed chip and the open panel's identity.
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
            // Side-aware clamp from place() — 44vh stays the ceiling, but the menu never
            // exceeds the space on its anchored side (the clip-at-viewport-top fix).
            maxHeight: menuPos?.maxH != null ? Math.min(menuPos.maxH, window.innerHeight * 0.44) : '44vh',
          }}
          className="fixed z-[60] overflow-y-auto rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[var(--shadow-float)]"
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
          {/* + Build an audience — opens the BuildChooser, whose three paths ALL mint a
              mode:'general' SIM (description → /audience/new?mode=general · evidence →
              the Profile runner · template → GENERAL_TEMPLATES). It is the horizontal
              audience factory, so it goes with the horizontal. Creator-audience creation
              is unaffected — the "/audience" link directly below still reaches
              /audience/new, which defaults to mode:'socials'. */}
          {HORIZONTAL_ENABLED && (
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
          )}
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

  // The audience identity switcher (constellation + name + caret) — shared by the collapsed chip
  // and the open panel's top bar. Owns the portaled switcher popover (rendered once, since only
  // one of chip/panel mounts at a time).
  const identity = (
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
        className={
          "flex min-w-0 items-center gap-2 rounded-[8px] py-1 pl-1 pr-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 " +
          (switcherOpen ? "bg-white/[0.05]" : "hover:bg-white/[0.05]")
        }
      >
        <ConstellationMark width={40} reacting={reacting} />
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-foreground)]">
          <span className="max-w-[120px] truncate">{audienceName}</span>
          {!reducedMotion && (
            <span
              aria-hidden
              className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]"
            />
          )}
        </span>
        {/* "General" is a REAL audience — the default socials baseline — so the creator is
            never running on nothing, and this is not an error state. But it is the
            UNCALIBRATED one, and it is named so innocuously that a creator can spend Readings
            against a generic crowd for a week while believing they are testing against their
            own. The tag is the difference between a default and an accident. It is a quiet
            muted tag, not a warning: correct, just not yours yet. */}
        {isGeneral && (
          <span className="shrink-0 rounded-[4px] border border-white/[0.09] bg-white/[0.03] px-[5px] py-px text-[9px] font-semibold uppercase leading-[1.5] tracking-[0.06em] text-[var(--color-foreground-muted)]">
            not calibrated
          </span>
        )}
        <ChevronDown
          className={
            "h-3.5 w-3.5 shrink-0 transition-transform text-[var(--color-foreground-muted)] " +
            (switcherOpen ? "rotate-180" : "")
          }
          aria-hidden
        />
      </button>
      {switcherMenu}
    </div>
  );

  return (
    <div
      ref={dockRootRef}
      className={isRail ? 'flex h-full min-h-0 w-full flex-col' : 'relative w-full'}
      data-testid="audience-presence"
      data-variant={variant}
    >
      {open || isRail ? (
        /* ── OPEN / RAIL: the panel body (switcher bar + Room/idle). In 'thread' it expands UPWARD
              and connects into the composer as ONE surface (absolute bloom, rise animation). In
              'rail' the SAME body renders in-flow inside a fixed-height card — no bloom, no rise,
              no collapse (isRail branches the container, never the body). The audience SWITCHER
              sits at the TOP of this card either way. ── */
        <div
          data-testid={isRail ? 'audience-rail' : 'audience-panel'}
          role={isRail ? undefined : 'dialog'}
          aria-label="Your audience"
          className={
            isRail
              ? // Persistent rail card: static, full-height, matte (12px radius, no shadow, no
                // bloom transform). Fills its host column; the body scrolls internally.
                'relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-none'
              : isHeader
              ? // Header sheet: blooms DOWN from the 68px bar (top-full) over the thread, capped +
                // internally scrolled. Rounded BOTTOM, no top border (flush into the bar); rises
                // from the top edge (-translate-y).
                'absolute top-full left-0 right-0 z-[55] flex max-h-[70dvh] flex-col overflow-hidden rounded-b-[22px] border border-t-0 border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-float)] ' +
                (reducedMotion
                  ? ''
                  : 'transition-[transform,opacity] duration-300 ease-out ' +
                    (risen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'))
              : 'absolute bottom-full left-0 right-0 z-[55] flex max-h-[calc(100dvh-140px)] flex-col overflow-hidden rounded-t-[22px] border border-b-0 border-[var(--color-border)] bg-[var(--color-surface-elevated)] ' +
                (docked ? 'shadow-none ' : 'shadow-[var(--shadow-float)] ') +
                (reducedMotion
                  ? ''
                  : 'transition-[transform,opacity] duration-300 ease-out ' +
                    (risen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'))
          }
          style={
            isRail
              ? undefined
              : isHeader
              ? reducedMotion
                ? undefined
                : { willChange: 'transform' }
              : {
                  ...(reducedMotion ? {} : { willChange: 'transform' }),
                  // Measured clamp — see panelMaxH above (centered-home anchor overflows the CSS max-h).
                  ...(panelMaxH != null ? { maxHeight: panelMaxH } : {}),
                }
          }
        >
          {/* Switcher bar — TOP of the card (identity + readiness + collapse). */}
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
            {identity}
            <span
              data-testid="audience-pulse"
              className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-foreground-secondary)]"
            >
              {openPulse}
            </span>
            {arrivalBadge}
            {/* Collapse — bloom presentations only. The rail never dismisses (§2), so no chevron.
                'thread' blooms up ⇒ collapse points down; 'header' blooms down ⇒ collapse up. */}
            {!isRail && (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Collapse your audience"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--color-foreground-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-foreground)]"
              >
                {isHeader ? (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                )}
              </button>
            )}
          </div>

          {asking && (
            <p
              role="status"
              aria-live="polite"
              className="shrink-0 px-5 pb-1 pt-2 text-[12px] font-medium text-[var(--color-foreground-muted)]"
            >
              {LOADING_COPY}
            </p>
          )}

          {focus ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* flex (not block) so the Room root sizes by flex-stretch — with the panel now
                  content-hugged (auto height up to the clamp) a percentage h-full chain no
                  longer resolves; overflow-hidden keeps a clamped Room from painting over the
                  ask-trail footer below. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <AmbientRoom
                  flatPersonas={flatPersonas}
                  population={focus.population}
                  conceptText={focus.conceptText}
                  fraction={focus.fraction}
                  reducedMotion={reducedMotion}
                  personaNameOverrides={personaNameOverrides}
                  focusId={focus.id}
                  siblings={focusList}
                  onStep={onStep}
                  kindLabel={kindLabel}
                  canRewrite={effectiveCanRewrite}
                  onRewrite={onRewrite}
                  rewriteNonce={rewriteNonce}
                  initialCompareOpen={!drillIntoFocus}
                />
              </div>
              {/* The ask trail under a typed-thought read (no card id) — the conversation state.
                  A card focus keeps its chrome (stepper + ranked) and stays history-free. */}
              {focus.id == null && earlierAsks ? (
                <div className="flex shrink-0 justify-center border-t border-[var(--color-border)] px-5 pb-4 pt-3">
                  {earlierAsks}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8">
              {/* my-auto (not justify-center) centers short content AND keeps the top reachable
                  when the centered-home clamp forces a scroll — justify-center on a scroll
                  container cuts the overflowing top off from scrolling entirely. */}
              <div className="my-auto flex w-full flex-col items-center gap-6">
              {/* A small, living constellation crown — the room breathing; the named cast below
                   grounds those same dots as real people. */}
              <div className="flex flex-col items-center gap-3 text-center">
                <Constellation
                  dots={heroDots}
                  reducedMotion={reducedMotion}
                  width={172}
                  height={52}
                  vbW={260}
                  vbH={96}
                  reacting={reacting}
                  connect
                />
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-foreground)]">
                    {reacting ? LOADING_COPY : `${audienceName} · ${rosterCount} people ready`}
                  </p>
                  {arrivalBadge}
                  <p className="max-w-[400px] text-[13px] leading-relaxed text-[var(--color-foreground-muted)]">
                    {isSurface
                      ? SURFACE_IDLE_SUB
                      : `Type a thought below and watch the whole room react.`}
                  </p>
                </div>
              </div>

              {/* Meet your room — the actual cast, so the simulation reads as a set of real people,
                   not an abstract count. Each registry-backed person is tappable → the meet-them
                   persona chat (meet-mode PersonaChatDrawer: no concept yet, they speak from their
                   own tastes — "say hi →"). Non-registry rows stay plain: no dead affordance. */}
              {!isSurface && castMembers.length > 0 && (
                <ul className="grid w-full max-w-[540px] grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {castMembers.map((m) => {
                    const body = (
                      <>
                        {/* A person = a dot (the constellation's own language) — quiet cream
                            at rest; verdict tones belong to the reacting Room, not the intro. */}
                        <span
                          aria-hidden
                          className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--color-foreground-muted)] opacity-70"
                        />
                        <span className="flex min-w-0 flex-col text-left">
                          <span className="truncate text-[13px] font-medium leading-tight text-[var(--color-foreground)]">
                            {m.name}
                          </span>
                          <span className="truncate text-[12px] leading-tight text-[var(--color-foreground-muted)]">
                            {m.trait}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={m.key}>
                        {m.canMeet ? (
                          <button
                            type="button"
                            aria-label={`Meet ${m.name}`}
                            onClick={() => setMeetTarget({ archetype: m.archetype, name: m.name })}
                            className="flex w-full items-start gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-hover)]"
                          >
                            {body}
                            <span className="ml-auto shrink-0 pl-2 pt-px text-[12px] leading-tight text-[var(--color-foreground-muted)]">
                              say hi →
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-start gap-2.5 px-2 py-1.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {earlierAsks}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── COLLAPSED: at rest. 'thread' → a tab CONNECTED to the composer top (rounded TOP only,
              square bottom flush into the composer). 'header' (A2b) → a standalone rounded bar
              ABOVE the thread that expands DOWNWARD. Same tone as the composer (surface-elevated),
              tap to open. ── */
        <div className={isHeader ? '' : 'px-4'}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Open your audience"
            aria-expanded={false}
            onClick={() => onOpenChange(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenChange(true);
              }
            }}
            /* Hover must TINT, not replace: --color-hover is a 5%-alpha white overlay, so
               using it as the hover background swaps the opaque surface for a translucent
               one and the thread scrolling behind the dock shows straight through. The tab
               floats over that scroll, so its fill stays opaque — lift it with a solid tone. */
            className={
              'flex w-full items-center gap-2 border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 transition-colors hover:bg-[#32312e] ' +
              (isHeader
                ? // Standalone bar, all corners rounded, taller (the 68px header target).
                  'rounded-[12px] py-2.5'
                : // Tab fused to the composer top: rounded top only, square bottom.
                  'rounded-t-[14px] border-b-0 py-1.5')
            }
            style={{ cursor: 'pointer' }}
          >
            {identity}
            <span
              data-testid="audience-pulse"
              className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-foreground-secondary)]"
              title={focus?.conceptText}
            >
              {dockPulse}
              {/* The score's SUBJECT — a live read on the closed tab used to name a number
                  with no concept ("2 of 10 would stop" … of what?), which reads wrong the
                  moment a different card is on screen. Muted, truncates with the band. */}
              {!reacting && stopRead && focus?.conceptText ? (
                <span className="text-[var(--color-foreground-muted)]">
                  {' · '}&ldquo;{stripWrappingQuotes(focus.conceptText)}&rdquo;
                </span>
              ) : null}
            </span>
            {arrivalBadge}
            {/* Direction of expansion: 'thread' blooms UP (chevron up); 'header' expands DOWN. */}
            {isHeader ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-foreground-muted)]" aria-hidden />
            ) : (
              <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-foreground-muted)]" aria-hidden />
            )}
          </div>
        </div>
      )}

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

      {/* Meet-them persona chat (meet-mode: no concept yet). Mounted at the dock ROOT — outside
           the open/collapsed ternary — so a panel close/reopen can never resurrect a stale sheet;
           `meetTarget` alone drives it. The Sheet portals to <body>. */}
      <PersonaChatDrawer target={meetTarget} onClose={() => setMeetTarget(null)} />
    </div>
  );
}
