"use client";

import { useEffect, useState } from "react";
import { OF_VIEWERS, ROLL_MS, VIEWERS, countAt, formatCount, rolledAt } from "@/lib/result/count";
import type { Audience } from "@/lib/result/types";
import { UNDER_FIRST_LINE, UNDER_LINE } from "./first-block";
import { useLanding } from "./landing";
import { usePlayhead } from "./playhead";

/** The count's number: the figure role the Engagement page's average watch had (30, bold, tight). */
const NUMBER = `text-3xl font-bold ${UNDER_FIRST_LINE} tracking-[-0.04em] text-foreground tabular-nums`;

/**
 * The count under the video: how many of 1,000 viewers are still watching at the playhead, or, at
 * rest, watched to the end. The number and its words on one baseline, centred. In a box under 290
 * wide (a 320 phone) one line cannot hold the longer words, so there the words always stand under the
 * number: the box is as tall at rest as while playing, and pressing play moves nothing under it.
 *
 * Plain text for a screen reader, no live region: it changes every frame while the video plays. When
 * the result lands the number rolls from 1,000 to the count; a screen reader reads the count itself
 * from the first frame (an `sr-only` span, out of the flow, so the box is the same while it rolls).
 */
export function ViewerCount({ audience }: { audience: Audience }) {
  const { t, resting } = usePlayhead();
  const { n, words } = countAt(audience, t, resting);
  const rolled = useRoll(n, useLanding());
  return (
    <p data-result="count" className={UNDER_LINE}>
      <span data-part="count-number" aria-hidden={rolled !== null ? true : undefined} className={NUMBER}>
        {formatCount(rolled ?? n)}
      </span>
      {rolled !== null && <span className="sr-only">{formatCount(n)}</span>}{" "}
      <span data-part="count-words" className="text-ui text-foreground-secondary">
        {OF_VIEWERS} {words}
      </span>
    </p>
  );
}

/**
 * The landing's roll: from 1,000 down to `to` in 1.5 s (ease-out), once, from the count's first frame;
 * null when not rolling. Decided when the count mounts, so a count mounted later does not roll. A move
 * of the playhead during the roll ends it for good: the count follows the video at once, and does not
 * pick the roll up again if the video comes back to rest before the 1.5 s are up.
 */
function useRoll(to: number, landing: boolean): number | null {
  // The count the roll lands on, fixed at mount; null for a count that does not roll.
  const [target] = useState(() => (landing ? to : null));
  const [value, setValue] = useState<number | null>(() => (landing ? VIEWERS : null));
  // The video moved off the count the roll lands on: the roll is over.
  if (value !== null && to !== target) setValue(null);
  // Over with the landing too: in a hidden tab no frame runs, and the count must not stand at 1,000.
  const rolling = value !== null && to === target && landing;
  useEffect(() => {
    if (!rolling || target === null) return;
    const start = Date.now();
    let stopped = false;
    let frame = requestAnimationFrame(function tick() {
      if (stopped) return;
      const elapsed = Date.now() - start;
      if (elapsed >= ROLL_MS) {
        setValue(null);
        return;
      }
      setValue(rolledAt(VIEWERS, target, elapsed));
      frame = requestAnimationFrame(tick);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [rolling, target]);
  return rolling ? value : null;
}
