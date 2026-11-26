"use client";

import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { ringDots, type RingLayout } from "@/lib/result/ring-layout";

/**
 * A ring of equal wedges of dots, laid out by the same `ringDots` as the result's audience ring. The
 * audience pages draw their building ring and their card with it.
 */

/** A ring of equal wedges, and the radius of its innermost row of dots. */
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
