"use client";

/**
 * HomePageLayout — client wrapper for the /home page.
 *
 *   Empty state (!hasConversation):
 *     Serif welcome hero (logo + greeting) centered above the composer.
 *
 *   Active thread (hasThread):
 *     Welcome hero is removed entirely (Claude-style — not a persistent banner).
 *     Composer fills remaining height; its internal thread-region scrolls while
 *     the form stays pinned at the bottom (homeThreadMode branch in composer.tsx).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HomeGreeting } from "./home-greeting";
import { AMBIENT_V2_ENABLED } from "@/lib/flags/ambient-v2";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { Composer } from "./composer";

/**
 * The audience rail is user-resizable on desktop (owner ask 2026-08-16) — a drag handle on its
 * left hairline, double-click (or Home) to reset. This is a WIDTH dial, not the vetoed collapse
 * (2026-08-12 ruling in AmbientOverview: complete frames that scroll; name+% alone rejected) —
 * the floor keeps every frame legible, it only reflows.
 *
 * 320 floor: the board's gutters (26px × 2) + the terrain/dot-field figures still read; below
 * that the segment frames wrap every other word. 560 ceiling: matches the drill surfaces' own
 * max content width — an aside wider than its content is dead margin dressed as a feature.
 */
const RAIL_MIN = 320;
const RAIL_MAX = 560;
const RAIL_DEFAULT = 400;
const RAIL_WIDTH_KEY = "virtuna:rail-width";
const clampRail = (w: number) => Math.min(RAIL_MAX, Math.max(RAIL_MIN, Math.round(w)));

export function HomePageLayout() {
  const [hasThread, setHasThread] = useState(false);
  // A skill armed from the v2 Start grid. Opens the rail without claiming a thread exists.
  const [engaged, setEngaged] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  // A1: true while the composer rehydrates a switched-to thread. Keeps the thread
  // shell mounted + suppresses the welcome hero across the load gap (so the layout
  // never collapses to the centered serif hero between threads).
  const [rehydrating, setRehydrating] = useState(false);
  // P2 (A2a): the desktop right-rail portal host. A ref-callback into state (not a raw ref) so the
  // Composer re-renders once the aside mounts and can portal its room in. Only rendered ≥xl in
  // thread mode; null otherwise ⇒ the composer keeps the room in its dock.
  const [railHost, setRailHost] = useState<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Rail width (≥xl only). SSR renders the default; the persisted width lands in an effect so the
  // server and client markup agree (a lazy localStorage initializer would hydrate mismatched).
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
  const railDrag = useRef<{ startX: number; startW: number } | null>(null);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(RAIL_WIDTH_KEY));
      if (Number.isFinite(stored) && stored > 0) setRailWidth(clampRail(stored));
    } catch {
      // storage unavailable (private mode) — the default width is fine
    }
  }, []);
  const persistRailWidth = (w: number) => {
    try {
      localStorage.setItem(RAIL_WIDTH_KEY, String(w));
    } catch {
      // storage unavailable — the width still applies for this session
    }
  };
  const resetRailWidth = () => {
    setRailWidth(RAIL_DEFAULT);
    persistRailWidth(RAIL_DEFAULT);
  };

  const handleThreadChange = useCallback((next: boolean) => {
    setHasThread(next);
  }, []);

  const handleEngagedChange = useCallback((next: boolean) => {
    setEngaged(next);
  }, []);

  const handleConversationChange = useCallback((next: boolean) => {
    setHasConversation(next);
  }, []);

  const handleRehydratingChange = useCallback((next: boolean) => {
    setRehydrating(next);
  }, []);

  // Thread mode owns a full-width scroll surface (composer re-centers content at
  // 760px internally) so the conversation scrolls page-wide like a real chat.
  // Empty home stays a centered 760px column (greeting above, composer pinned below).
  const threadMode = hasThread || rehydrating || engaged;
  // True on the fresh empty home (no thread, nothing streamed). Drives the
  // greeting + the vertical-centering of the greeting→actions→composer group.
  const emptyHome = !hasConversation && !rehydrating;
  /**
   * The rail also mounts on the DESKTOP ARRIVAL now (owner ruling 2026-08-11 r3).
   *
   * WHY: the arrival was a greeting, a shelf and a composer — the shape of every chat app. The one
   * fact that makes this product a different thing, that a thousand calibrated people read what you
   * write, was invisible until after the first send; the only thing carrying it was a ~200px chip in
   * the composer foot. The rail states it before you type.
   *
   * It does NOT fire anything to do so — navigation never runs a sim (fire-on-demand, LOCKED). The
   * board simply renders its RESTING state, which names the room's slices off calibration. See
   * `OverviewData.segments`.
   *
   * ≥xl ONLY, and every class below is `xl:`-gated to match: the <aside> already `hidden`s under xl,
   * so the phone arrival must keep its centered column exactly as it is (the owner ruled mobile out
   * of this round). Flag-gated as well — flag-off stays byte-identical.
   */
  const arrivalRail = CONCEPT_V8_ENABLED && emptyHome && !threadMode;
  // The right column, otherwise, exists only in thread mode (the flag-off rail portal). The v8
  // report is an EVENT — sheet or overlay, never docked — so nothing else ever mounts this column
  // (2026-08-09 rail ruling: the pinned report was a rejected third shape).
  const railMounted = threadMode || arrivalRail;

  return (
    // P2 (A2a): the audience is a property of the THREAD, so ≥xl in thread mode it gets its own
    // right rail beside the work column (portaled from the composer — §7 re-host, not a rebuild).
    // The parent switches to a row there so the thread column + rail read as one centered pair;
    // empty home / permalink stay a centered column. Below xl the rail `hidden`s and the composer
    // keeps the dock peek (the mobile header lands in A2b).
    // Composer stays at a STABLE child position (index 1) across every mode — the greeting (index
    // 0) and the rail (index 2) are the only conditional siblings — so it never remounts (which
    // would reset its stream/rehydration state).
    <div
      className={cn(
        "flex w-full",
        // Thread mode owns internal scroll → hard h-full. The centered empty/permalink
        // stack uses min-h-full instead: with a HARD height + justify-center, a hero
        // taller than the viewport (mobile) overflowed out the TOP, unreachably — the
        // greeting rendered under the fixed hamburger (live-caught 2026-07-20).
        // min-h-full grows with content, so centering never clips and the page scrolls.
        // Thread mode: the work column FLEXES to fill (it self-centers its content at 760 via its own
        // mx-auto), so the rail is pushed flush to the page's right edge (owner call — the rail
        // connects to the right side completely). Not justify-center, which left a symmetric gap.
        threadMode ? "h-full flex-row" : "min-h-full flex-col items-center",
        // Arrival rail (≥xl): become the same row the thread uses, and take a DEFINITE height so
        // the full-height <aside> has something to fill. Under xl none of this applies and the
        // arrival keeps `min-h-full flex-col items-center` untouched — a hard height there once
        // pushed a hero taller than the viewport out the TOP, unreachably (see above).
        arrivalRail && "xl:h-full xl:min-h-0 xl:flex-row xl:items-stretch",
        emptyHome && !railMounted && "justify-center",
        // Same centering as the line above, but it has to survive `railMounted` now. Vertical while
        // the arrival is still a column; at xl the axis flips, where `justify-center` would centre
        // the pair HORIZONTALLY and pull the rail off the page's right edge. The work column takes
        // over the vertical centering there.
        arrivalRail && "justify-center xl:justify-start",
      )}
    >
      {emptyHome && !AMBIENT_V2_ENABLED && (
        // Empty home: the hero (greeting · promise · constellation) caps the centered
        // group. shrink-0 (natural height) so it sits directly above the composer with a
        // comfortable gap, and a small top offset guarantees breathing room from the chrome.
        // Suppressed under AMBIENT_V2_ENABLED — the v2 Start surface carries its own greeting.
        <div
          className={cn(
            "flex w-full max-w-[760px] shrink-0 flex-col items-center px-4 pt-6 pb-8",
            !reducedMotion && "transition-[padding] duration-300 ease-out",
          )}
        >
          <HomeGreeting />
        </div>
      )}
      {/* Single, always-mounted composer (never remounted across empty↔thread — that would reset
          its stream/rehydration state). In thread mode it's the left column of the pair: flex-1 so
          it fills the space beside the rail, capped at 760 so it never outgrows the reading column,
          min-w-0 so it can shrink under the rail on a narrow main. Empty/permalink: centered 760. */}
      <div
        className={cn(
          "flex w-full flex-col",
          // Thread mode: fill remaining space (no max-w cap on the WRAPPER — the Composer caps its own
          // content at 760 via mx-auto), so the rail sits flush right. Empty/permalink stay centered.
          // NO horizontal padding in either mode: the Composer's own columns own the page gutter, and
          // a gutter here too DOUBLED it — on the empty Start that was 32px of dead edge per side on a
          // 390px phone (found measuring the owner's tighten-the-margins ask, 2026-07-24).
          // The arrival keeps its centered 760 column under xl; at xl it flexes beside the rail and
          // owns the vertical centering the parent gave up. The Composer caps its own content at
          // 760 with `mx-auto` in this branch too, so it re-centres inside whatever it's given.
          arrivalRail
            ? "max-w-[760px] xl:max-w-none xl:min-w-0 xl:min-h-0 xl:flex-1 xl:justify-center"
            : railMounted
              ? "min-w-0 flex-1 min-h-0"
              : "max-w-[760px]",
        )}
      >
        <Composer
          className={cn(threadMode && "flex-1 min-h-0")}
          onThreadChange={handleThreadChange}
          onEngagedChange={handleEngagedChange}
          onConversationChange={handleConversationChange}
          onRehydratingChange={handleRehydratingChange}
          railHost={railHost}
        />
      </div>
      {railMounted && (
        // The persistent audience rail — desktop (≥xl) only; `hidden` below xl so the composer's
        // dock peek owns it there. The composer portals <AudiencePresence variant='rail'> into this
        // host. shrink-0 fixed width; full height with internal scroll (the rail body scrolls).
        <aside
          aria-label="Your audience"
          // A CONNECTED rail — part of the thread page, full height, flush (no floating gaps). The
          // panel fills the column top-to-bottom; its own left hairline divides it from the thread.
          // Width is the user's dial (drag the left edge; double-click resets) — inline style, not
          // a class, because the value is state. No transition: a drag must track the pointer.
          className="relative hidden h-full min-h-0 shrink-0 flex-col xl:flex"
          style={{ width: railWidth }}
        >
          {/* The resize handle rides the rail's left hairline: an 8px grab strip, invisible until
              hovered (a 1px cream whisper), so the surface stays matte and the hairline stays the
              divider. Pointer capture keeps the drag alive when the cursor outruns the strip. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the audience rail"
            aria-valuemin={RAIL_MIN}
            aria-valuemax={RAIL_MAX}
            aria-valuenow={railWidth}
            tabIndex={0}
            className="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize select-none outline-none"
            onPointerDown={(e) => {
              e.preventDefault(); // stop a text-selection from starting under the drag
              railDrag.current = { startX: e.clientX, startW: railWidth };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = railDrag.current;
              if (!d || e.buttons === 0) return;
              // The rail sits on the page's right edge, so dragging LEFT grows it.
              setRailWidth(clampRail(d.startW + (d.startX - e.clientX)));
            }}
            onPointerUp={(e) => {
              if (!railDrag.current) return;
              railDrag.current = null;
              persistRailWidth(clampRail(railWidth));
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onDoubleClick={resetRailWidth}
            onKeyDown={(e) => {
              // The rail grows leftward: ← widens, → narrows. Home restores the default.
              const next =
                e.key === "ArrowLeft"
                  ? clampRail(railWidth + 16)
                  : e.key === "ArrowRight"
                    ? clampRail(railWidth - 16)
                    : e.key === "Home"
                      ? RAIL_DEFAULT
                      : null;
              if (next === null) return;
              e.preventDefault();
              setRailWidth(next);
              persistRailWidth(next);
            }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-1 w-px bg-transparent transition-colors group-hover:bg-white/20 group-focus-visible:bg-white/20"
            />
          </div>
          <div ref={setRailHost} className="flex min-h-0 w-full flex-1" />
        </aside>
      )}
    </div>
  );
}
