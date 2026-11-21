"use client";

import { memo } from "react";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { ringDots, type RingLayout } from "@/lib/result/ring-layout";
import { circles } from "./audience-ring";

/**
 * The running screen's ring (the mock's `rn2Ring2`, `look=ring2`): the run's viewer groups as
 * equal pale wedges of dots, laid out by the same `ringDots` as the result's audience ring. The
 * roster names the groups, not their weights, so the wedges are equal; nothing on it is lit and
 * nothing is coral.
 */

/** A ring of equal wedges, and the radius of its innermost row of dots (where the picture stops). */
export interface EqualRing {
  layout: RingLayout;
  innerRow: number;
}

const rings = new Map<string, EqualRing>();

/** `groups` equal wedges of `n` dots between `r1` and `R`; laid out once per size and count. */
export function equalRing(groups: number, r1: number, R: number, n: number): EqualRing {
  const key = `${groups}:${r1}:${R}:${n}`;
  let ring = rings.get(key);
  if (!ring) {
    // The ring only counts the groups; a wedge is named by its place.
    const wedges = Array.from({ length: groups }, (_, i) => ({ group: String(i) as Archetype, weight: 1, present: true }));
    const layout = ringDots(wedges, { r1, R, n });
    const rows = 1 + layout.wedges.reduce((most, wedge) => wedge.dots.reduce((m, dot) => Math.max(m, dot.row), most), 0);
    ring = { layout, innerRow: r1 + (R - r1) / (2 * rows) };
    rings.set(key, ring);
  }
  return ring;
}

/**
 * The order the wedges appear in, farthest first: wedge 0, then again and again the wedge farthest
 * (round the ring) from the nearest one already shown, the lowest place on a tie. For ten:
 * 0, 5, 2, 7, then the rest. Neighbours filling in turn would read as a progress arc.
 */
function arrivalOrder(groups: number): number[] {
  if (groups <= 0) return [];
  const order = [0];
  const nearest = Array.from({ length: groups }, (_, i) => Math.min(i, groups - i));
  while (order.length < groups) {
    let pick = -1;
    for (let i = 0; i < groups; i++) {
      if (nearest[i]! > 0 && (pick === -1 || nearest[i]! > nearest[pick]!)) pick = i;
    }
    order.push(pick);
    for (let i = 0; i < groups; i++) {
      const apart = Math.abs(i - pick);
      nearest[i] = Math.min(nearest[i]!, apart, groups - apart);
    }
  }
  return order;
}

/**
 * `groups` equal pale wedges of `n` dots; the first `shown` of them in the arrival order are drawn,
 * each as one path. The paleness is the mock's `off` (0.20 in light, 0.14 in dark) on the group.
 */
export const RunningRing = memo(function RunningRing({
  groups,
  shown,
  r1,
  R,
  n,
}: {
  groups: number;
  shown: number;
  r1: number;
  R: number;
  n: number;
}) {
  const { layout } = equalRing(groups, r1, R, n);
  const drawn = new Set(arrivalOrder(groups).slice(0, Math.max(0, shown)));
  return (
    <svg
      data-result="running-ring"
      viewBox={`0 0 ${layout.size} ${layout.size}`}
      width={layout.size}
      height={layout.size}
      aria-hidden="true"
      className="block"
    >
      <g fill="var(--color-foreground)" className="opacity-[0.2] dark:opacity-[0.14]">
        {layout.wedges.map((wedge, i) =>
          drawn.has(i) ? <path key={i} data-wedge={i} d={circles(wedge.dots, layout.dotR)} /> : null,
        )}
      </g>
    </svg>
  );
});
