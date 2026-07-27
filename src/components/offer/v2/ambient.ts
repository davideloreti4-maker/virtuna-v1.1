/**
 * The desynchroniser.
 *
 * Attio runs the SAME animation at 3.8s and at 4.15s. That is not sloppiness — it is the
 * craft move. Loops that share a period phase-lock within a few cycles and the whole page
 * starts pulsing in unison, which is the exact texture that reads cheap. Measured on their
 * live site 2026-07-27 (`pipeline-radar-bob`), and it is the one rule that separates their
 * panels from a row of identical CSS pulses.
 *
 * So: no two ambient loops on /go-v2 may share a period. The per-class base periods live in
 * `marketing.css` and are mutually prime-ish by hand; anything REPEATED (constellation nodes,
 * filmstrip beat markers, placeholder slots) takes its period from here instead, indexed.
 *
 * ── WHY A LOW-DISCREPANCY SEQUENCE, NOT `Math.random()` ───────────────────────────────────
 * Two hard constraints:
 *   1. Server and client must render byte-identical style attributes, or React logs a
 *      hydration mismatch on the one page we pay for traffic to. `Math.random()` cannot.
 *   2. The guard test has to be able to assert uniqueness, which requires the values be the
 *      same on every run.
 * The golden-ratio sequence `frac(i * φ⁻¹)` gives both: deterministic, and it fills [0,1)
 * far more evenly than a modulo table (which would repeat every N and re-introduce exactly
 * the phase-lock this file exists to prevent).
 *
 * A SECOND irrational drives the delay, so period and phase never correlate — otherwise the
 * slowest node would always also be the latest, and the field would visibly sweep.
 *
 * Delays are NEGATIVE on purpose: a negative `animation-delay` starts the loop already
 * mid-cycle, so a freshly-loaded page is desynchronised on frame one rather than converging
 * to it a minute later.
 */

import type { CSSProperties } from "react";

/** frac(i · φ⁻¹) — the golden-ratio low-discrepancy sequence. */
const PHI_INV = 0.6180339887498949;
/** frac(i · √2−1) — a second, unrelated irrational for the phase. */
const SQRT2_INV = 0.4142135623730951;

const frac = (n: number) => n - Math.floor(n);

/** Two decimal places is the resolution the CSS actually needs, and keeps the SSR string short. */
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface AmbientLoopOptions {
  /** Shortest period in the family, seconds. */
  base?: number;
  /** Width of the period band, seconds. The family spans `base` → `base + spread`. */
  spread?: number;
}

/**
 * The period + phase for instance `index` of a repeated ambient loop.
 *
 * Spread the style onto the element; the class in `marketing.css` supplies the keyframes and
 * the easing, and these two properties override its base period.
 */
export function ambientLoop(index: number, options: AmbientLoopOptions = {}): CSSProperties {
  const { base = 3.7, spread = 4.6 } = options;
  const duration = round2(base + frac(index * PHI_INV) * spread);
  // Phase is expressed as a FRACTION of this instance's own period, so a slow node and a fast
  // node are both scattered across their whole cycle rather than the fast one being scattered
  // proportionally further.
  const delay = round2(-frac(index * SQRT2_INV) * duration);
  return { animationDuration: `${duration}s`, animationDelay: `${delay}s` };
}

/**
 * A constellation node: `ambientLoop` plus the drift amplitude the keyframes read.
 *
 * Amplitude stays tiny (1.2–3px). The nodes carry district meaning — the ledger's
 * hover-spotlight and the believers/skeptics reading both depend on a node staying inside its
 * cluster — so this is a breathe, never a shuffle.
 */
export function ambientNode(index: number): CSSProperties {
  const amplitude = round2(1.2 + frac(index * PHI_INV) * 1.7);
  return {
    ...ambientLoop(index, { base: 6.4, spread: 5.3 }),
    ["--mk-amp" as string]: `${amplitude}px`,
  };
}

/**
 * How many nodes the constellation draws. ONE number, deliberately — not a breakpoint pair.
 *
 * Two reasons. First, measured 2026-07-27: Linear runs its full 180 infinite animations on a
 * 390x844 phone, identical to desktop, and Cursor runs 37 on both. None of the three
 * references cuts motion on mobile, so the "drop the count on phones to save battery" instinct
 * is not what the quality line actually does — and frame times get measured rather than
 * assumed (`.scratch/motion-probe.js` samples rAF on the mobile pass).
 *
 * Second, a viewport-branched count would have to resolve after mount, which means the server
 * and client would render different node lists on the one page we pay for traffic to. The SVG
 * scales; the density does not need to.
 */
export const CONSTELLATION_NODES = 34;
