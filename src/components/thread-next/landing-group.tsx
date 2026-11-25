"use client";

import { useEffect, useState } from "react";

import { LANDING_WINDOW_MS } from "@/lib/thread-next/landing";

/**
 * The landing's one element (thread feel §4.3): an answer's parts and its chips, inside the element
 * the landing's CSS keys on (`[data-thread-landing] .land`, globals.css). `--landed` is how long ago
 * the answer landed, as a negative delay, so a turn drawn in the landing's place a moment later (the
 * persisted copy after the fold) carries on where the landing was instead of starting it again.
 *
 * It keeps the first value it was given: a landing is decided when the answer first shows and never
 * after, so a turn drawn at rest stays at rest. `null` adds no element at all; a number adds one that
 * leaves the layout to its parent (`display: contents`), so the parts stay in the turn's column.
 *
 * A landing lasts its window (`LANDING_WINDOW_MS` from the moment it landed): then the element stays
 * (its parts are not mounted again) and is no longer a landing, so a part mounted inside it later
 * (the chips back after a simulation, a remix page's new step) is drawn at rest, and nothing keeps a
 * finished animation. One timer, cleared on unmount.
 *
 * The attribute is the thread's own (`data-thread-landing`): the result page keys its own landing on
 * `data-landing`, and a thread card drawn there must not rise with it.
 */
export function LandingGroup({ sinceMs, children }: { sinceMs: number | null; children: React.ReactNode }) {
  const [since] = useState(sinceMs);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (since === null) return;
    const timer = setTimeout(() => setOver(true), Math.max(0, LANDING_WINDOW_MS - since));
    return () => clearTimeout(timer);
  }, [since]);
  if (since === null) return <>{children}</>;
  return (
    <div
      data-thread-landing={over ? undefined : ""}
      className="contents"
      style={{ "--landed": `${-since}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
