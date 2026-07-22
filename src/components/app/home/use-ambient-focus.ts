'use client';

/**
 * useAmbientFocus — the focus-state hook that drives `AmbientPresence`'s `focus` prop
 * (Plan 13-04, Surfaces 1/2/4 — AMBIENT-01, D-02/D-03/D-04).
 *
 * It owns the ONE in-focus concept and resolves it from three inputs, in priority order:
 *   1. A typed thought (type-to-room, D-04) — the ad-hoc subject the creator just tested,
 *      unless superseded by a newer deliberate tap/scroll.
 *   2. An explicit TAP on a card — wins over scroll-spy momentarily and stays sticky until
 *      the next tap OR a deliberate scroll past a threshold (Pitfall 4 — tap-priority, NOT
 *      last-event-wins). A deliberate examination is never yanked away.
 *   3. Scroll-spy (the ambient default) — the card crossing the focus line under the sticky
 *      strip, updated ONLY while no tap is sticky.
 *   …falling back to the LATEST descriptor (the most recent card) when nothing is selected,
 *   and to `null` (the honest idle state) when the thread holds no cards.
 *
 * Honesty + determinism spine (binding): the resolved focus is always exactly ONE real,
 * labeled concept reading that card's ALREADY-EMITTED `{ fraction, scrollQuote }` — never an
 * aggregate, never a fabricated reaction, ZERO new model calls on re-focus (D-02/D-03). The
 * decision core is a PURE function with no nondeterministic source (no wall-clock, no PRNG) so
 * it is SSR-hydration-safe and never trips the engine determinism gate.
 *
 * Open-thread singleton awareness (Pitfall 5): the open thread is a never-closed singleton that
 * "New Simulation" does not reset. This hook simply re-defaults to the latest descriptor when
 * the descriptor set changes — it does NOT reset or assume a fresh thread. Stale focus after a
 * "New Simulation" is acceptable per scope (awareness only; fixing the singleton is NOT in scope).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AmbientFocus,
  AmbientPersonaReaction,
} from '@/components/audience-lens/ambient-presence-types';
import type { PopulationAggregate } from '@/lib/audience/population';

/**
 * A focusable card descriptor derived from a rendered card's already-emitted reaction data.
 * `id` is a stable per-card key; the rest is the honest reaction the spotlight reads.
 */
export interface AmbientCardDescriptor {
  id: string;
  /** The card's kind (`hook` | `idea` | `script` | `remix`) — from the block type, so a mixed
   *  board is legible per-row (the Ambient v2 Overview surfaces it as a kind chip). */
  kind?: string;
  conceptText: string;
  fraction: string;
  scrollQuote: string;
  /** The card's own real per-persona reactions (S3′) — registry-enum archetypes when present.
   *  Threaded onto the focus so the Room's People cast + "Ask them why" list are named/real. */
  personas?: AmbientPersonaReaction[];
  /** The Stage 2 population projection, when a producer computed one (type-to-room does; card
   *  descriptors don't yet). Carried through so the Population·1,000 view shows real numbers. */
  population?: PopulationAggregate;
}

/** The pure inputs the focus decision reads — no DOM, no time, no randomness. */
export interface AmbientFocusInput {
  descriptors: AmbientCardDescriptor[];
  /** The id of the currently sticky tapped card (or null). */
  tapId: string | null;
  /** The id of the last scroll-spy-focused card (or null). */
  scrollId: string | null;
  /** A just-typed type-to-room thought (or null). */
  thought: AmbientFocus;
}

/** A deliberate scroll past this many px releases a sticky tap (returns to the ambient default). */
const TAP_RELEASE_SCROLL_PX = 64;

/** A descriptor → the AmbientFocus shape the presence consumes. Carries the card `id` so the
 *  Room can place the anchored-focus stepper among the batch siblings (PR-2); a typed thought
 *  (built directly, not via a descriptor) has no id → no stepper, which is the honest state. */
function toFocus(d: AmbientCardDescriptor): AmbientFocus {
  return {
    id: d.id,
    conceptText: d.conceptText,
    fraction: d.fraction,
    scrollQuote: d.scrollQuote,
    personas: d.personas,
    population: d.population,
  };
}

/**
 * The FOCUS-DECISION core (pure, deterministic — exercised directly by the test).
 *
 * Precedence: a typed thought wins; else a sticky tap (if still present in the set); else a
 * scroll-spy focus (if still present); else the LAST descriptor (default-latest); else null.
 * A stale tap/scroll id that no longer matches any descriptor is ignored (re-defaults to latest).
 */
export function resolveAmbientFocus(input: AmbientFocusInput): AmbientFocus {
  const { descriptors, tapId, scrollId, thought } = input;

  if (thought) return thought;

  if (descriptors.length === 0) return null;

  if (tapId) {
    const tapped = descriptors.find((d) => d.id === tapId);
    if (tapped) return toFocus(tapped);
  }

  if (scrollId) {
    const scrolled = descriptors.find((d) => d.id === scrollId);
    if (scrolled) return toFocus(scrolled);
  }

  return toFocus(descriptors[descriptors.length - 1]!);
}

export interface UseAmbientFocusResult {
  /** The resolved ONE in-focus concept (or null = idle) — feeds AmbientPresence's `focus` prop. */
  focus: AmbientFocus;
  /** Set focus to a card by explicit tap — wins over scroll-spy momentarily (sticky). */
  focusByTap: (id: string) => void;
  /** Update focus from scroll-spy — a no-op while a tap is sticky (ambient default). */
  focusByScroll: (id: string) => void;
  /** Set the subject to an ad-hoc typed thought (type-to-room, D-04). */
  focusByThought: (focus: AmbientFocus) => void;
  /**
   * Register the thread-region scroll element so the hook can (a) root an IntersectionObserver
   * over the `[data-ambient-card]` wrappers (scroll-spy) and (b) release a sticky tap on a
   * deliberate scroll past the threshold. Pass `null` to tear the wiring down.
   */
  registerThreadRegion: (el: HTMLElement | null) => void;
}

/**
 * The hook: owns the focus state + the scroll-spy observer wiring, exposing the resolved
 * `focus` plus the three focus setters and the thread-region registrar.
 */
export function useAmbientFocus(descriptors: AmbientCardDescriptor[]): UseAmbientFocusResult {
  // A just-typed thought subject (type-to-room). Cleared implicitly by a newer tap/scroll
  // because a tap/scroll sets its own source and the decision core prefers `thought` only
  // while it is set — so we clear it on an explicit tap/scroll to let those take precedence.
  const [thought, setThought] = useState<AmbientFocus>(null);
  // The currently sticky tapped card id (null = no active tap; scroll-spy is free to update).
  const [tapId, setTapId] = useState<string | null>(null);
  // The last scroll-spy-focused card id.
  const [scrollId, setScrollId] = useState<string | null>(null);

  // Refs mirror the latest state for the (long-lived) observer + scroll listeners.
  const tapIdRef = useRef<string | null>(null);
  tapIdRef.current = tapId;
  const regionRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollAnchorRef = useRef<number | null>(null);
  // A stable ref to the active scroll handler so register() can detach it cleanly on re-register.
  const scrollHandlerRef = useRef<((e: Event) => void) | null>(null);

  const focusByTap = useCallback((id: string) => {
    setThought(null); // a deliberate tap supersedes a typed thought
    setTapId(id); // sticky until the next tap or a deliberate scroll
    scrollAnchorRef.current = regionRef.current?.scrollTop ?? null;
  }, []);

  const focusByScroll = useCallback((id: string) => {
    // Tap-priority (Pitfall 4): while a tap is sticky, scroll-spy does NOT move focus.
    if (tapIdRef.current) return;
    setThought(null); // an ambient scroll also clears a stale typed thought
    setScrollId(id);
  }, []);

  const focusByThought = useCallback((next: AmbientFocus) => {
    setThought(next);
  }, []);

  // When the descriptor set changes and no tap is sticky, the resolution already re-defaults
  // to the latest descriptor (the decision core picks the last entry); we additionally drop a
  // scroll focus that no longer matches any descriptor so it cannot linger.
  useEffect(() => {
    if (scrollId && !descriptors.some((d) => d.id === scrollId)) setScrollId(null);
    if (tapId && !descriptors.some((d) => d.id === tapId)) setTapId(null);
  }, [descriptors, scrollId, tapId]);

  // ── Scroll-spy + tap-release wiring ───────────────────────────────────────────
  // The IntersectionObserver roots on the registered thread-region element and observes the
  // `[data-ambient-card]` wrappers; the card nearest the top under the sticky strip becomes the
  // ambient focus (via focusByScroll, which the decision core ignores while a tap is sticky).
  // A separate scroll listener releases a sticky tap once the creator scrolls past a threshold.
  const registerThreadRegion = useCallback(
    (el: HTMLElement | null) => {
      // Tear down any prior wiring.
      observerRef.current?.disconnect();
      observerRef.current = null;
      const prev = regionRef.current;
      if (prev && scrollHandlerRef.current) {
        prev.removeEventListener('scroll', scrollHandlerRef.current);
      }
      regionRef.current = el;
      if (!el || typeof IntersectionObserver === 'undefined') return;

      // Scroll listener — release a sticky tap on a deliberate scroll past the threshold.
      const onScroll = () => {
        if (!tapIdRef.current) return;
        const anchor = scrollAnchorRef.current;
        if (anchor == null) {
          scrollAnchorRef.current = el.scrollTop;
          return;
        }
        if (Math.abs(el.scrollTop - anchor) >= TAP_RELEASE_SCROLL_PX) {
          setTapId(null); // hand control back to the ambient scroll-spy default
          scrollAnchorRef.current = null;
        }
      };
      scrollHandlerRef.current = onScroll;
      el.addEventListener('scroll', onScroll, { passive: true });

      // IntersectionObserver — pick the topmost intersecting card under the sticky strip.
      const io = new IntersectionObserver(
        (entries) => {
          // Among intersecting cards, choose the one nearest the top of the region.
          let best: { id: string; top: number } | null = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const id = (entry.target as HTMLElement).dataset.cardId;
            if (!id) continue;
            const top = entry.boundingClientRect.top;
            if (best === null || top < best.top) best = { id, top };
          }
          if (best) focusByScroll(best.id);
        },
        {
          root: el,
          // The focus line sits just under the ~48px sticky strip; bias the active band to the top.
          rootMargin: '-48px 0px -60% 0px',
          threshold: 0,
        },
      );
      observerRef.current = io;

      // Observe the currently-rendered card wrappers; re-observation on DOM change is driven
      // by the effect below (which re-registers when the descriptor set changes).
      el.querySelectorAll('[data-ambient-card]').forEach((node) => io.observe(node));
    },
    [focusByScroll],
  );

  // Re-observe the card wrappers whenever the descriptor set changes (new cards land/leave) so
  // scroll-spy tracks the current ledger without re-creating the observer root.
  useEffect(() => {
    const el = regionRef.current;
    const io = observerRef.current;
    if (!el || !io) return;
    io.disconnect();
    el.querySelectorAll('[data-ambient-card]').forEach((node) => io.observe(node));
  }, [descriptors]);

  // Tear the observer down on unmount.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      const el = regionRef.current;
      if (el && scrollHandlerRef.current) el.removeEventListener('scroll', scrollHandlerRef.current);
    };
  }, []);

  const focus = useMemo(
    () => resolveAmbientFocus({ descriptors, tapId, scrollId, thought }),
    [descriptors, tapId, scrollId, thought],
  );

  return { focus, focusByTap, focusByScroll, focusByThought, registerThreadRegion };
}
