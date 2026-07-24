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

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HomeGreeting } from "./home-greeting";
import { AMBIENT_V2_ENABLED } from "@/lib/flags/ambient-v2";
import { Composer } from "./composer";

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
        emptyHome && "justify-center",
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
          threadMode ? "min-w-0 flex-1 min-h-0" : "max-w-[760px] px-4",
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
      {threadMode && (
        // The persistent audience rail — desktop (≥xl) only; `hidden` below xl so the composer's
        // dock peek owns it there. The composer portals <AudiencePresence variant='rail'> into this
        // host. shrink-0 fixed width; full height with internal scroll (the rail body scrolls).
        <aside
          aria-label="Your audience"
          // A CONNECTED rail — part of the thread page, full height, flush (no floating gaps). The
          // panel fills the column top-to-bottom; its own left hairline divides it from the thread.
          className="hidden h-full min-h-0 w-[400px] shrink-0 flex-col xl:flex"
        >
          <div ref={setRailHost} className="flex min-h-0 w-full flex-1" />
        </aside>
      )}
    </div>
  );
}
