/**
 * lens-derive — the PURE, deterministic Population/cascade math core for AudienceLens.
 *
 * The 10 calibrated archetypes (`PersonaNode[]`, the same shape `buildPersonaNodes`
 * emits) are the single source of truth. Population·1,000 (W4) and the staggered
 * cascade (W3) both consume this module; neither re-derives the math.
 *
 * Determinism is load-bearing (D-02): the swarm must be byte-identical across two
 * calls with the same seed so SSR hydration matches and the engine-determinism gate
 * holds. Therefore NO `Math.random` and NO `Date.now` anywhere in this file — all
 * variance flows from a seeded `mulberry32` PRNG (copied from PersonaGraph, which is
 * a `'use client'` module and does not export the function).
 *
 * Honesty model (D-02): Population·1,000 is NOT 1,000 model calls. Every dot carries
 * its source archetype's REAL verdict + watch-through, plus bounded seeded jitter; a
 * minority of dots blend toward an affinity neighbour. No dot ever invents a verdict
 * the 10 never emitted.
 */

import type { PersonaNode } from '@/components/board/_kit';

/** A binary scroll-stop verdict derived from a persona's real watch-through. */
export type LensVerdict = 'stop' | 'scroll';

/**
 * One instantiated population dot. Geometry (`x`/`y`) is optional and computed by the
 * swarm component in W4 — the seeded variance + archetype assignment + verdict belong
 * here so the math is fully testable without a DOM.
 */
export interface PopulationDot {
  /** Stable per-dot id (`<archetypeId>:<index>`). */
  id: string;
  /** Source archetype id — always one of the input nodes' ids. */
  archetype: string;
  /** Real verdict of this dot (its archetype's, or a blended affinity-neighbour's). */
  verdict: LensVerdict;
  /** Bounded, seeded watch-through 0..1 (archetype watch-through ± jitter). */
  sentiment: number;
  /** Optional swarm geometry, filled by the W4 renderer. */
  x?: number;
  y?: number;
}

export interface InstantiateOpts {
  /** Total dots to instantiate (default 1,000). */
  total?: number;
  /** Deterministic seed — same seed + nodes ⇒ byte-identical output. */
  seed: number;
}

export interface WeightedRollup {
  /** Weighted count of "stop" verdicts, scaled to `total`. */
  stop: number;
  /** Weighted count of "scroll" verdicts, scaled to `total`. */
  scroll: number;
  /** stop + scroll. */
  total: number;
  /** Per-archetype breakdown (the Population archetype-breakdown source). */
  byArchetype: Array<{ archetype: string; stop: number; weight: number }>;
}

/** Watch-through at or above this fraction reads as a scroll-STOP (kept watching). */
const STOP_THRESHOLD = 0.5;
/** Default population size — the Population·1,000 scale (D-02 / LIVE-05). */
const DEFAULT_TOTAL = 1000;
/** Fraction of a node's dots that may blend toward an affinity neighbour. */
const NEIGHBOUR_BLEND = 0.3;
/** Max +/- jitter applied to a dot's sentiment (bounded variance). */
const JITTER = 0.08;

/**
 * mulberry32 — seeded PRNG. Copied verbatim from
 * `src/components/board/_kit/PersonaGraph.tsx` (a client module that does not export
 * it). Pure: deterministic given the seed, no global state, no `Math.random`.
 */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function effectiveWeight(node: PersonaNode): number {
  return Math.max(0.01, node.weight);
}

function verdictOf(watchThrough: number): LensVerdict {
  return watchThrough >= STOP_THRESHOLD ? 'stop' : 'scroll';
}

/**
 * Distribute `total` dots across the archetypes proportional to `node.weight`, using
 * the largest-remainder method so the per-archetype counts sum EXACTLY to `total`
 * (no rounding drift). Order follows the input node order (deterministic).
 */
function allocateCounts(nodes: PersonaNode[], total: number): number[] {
  const weights = nodes.map(effectiveWeight);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const ideal = weights.map((w) => (w / totalW) * total);
  const floors = ideal.map((v) => Math.floor(v));
  let remaining = total - floors.reduce((a, b) => a + b, 0);

  // Hand the leftover dots to the largest fractional remainders (stable tie-break by
  // index keeps the allocation deterministic).
  const order = ideal
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const counts = floors.slice();
  for (let k = 0; k < order.length && remaining > 0; k++) {
    const entry = order[k];
    if (!entry) break;
    counts[entry.i] = (counts[entry.i] ?? 0) + 1;
    remaining -= 1;
  }
  return counts;
}

/**
 * Instantiate ~`total` (default 1,000) dots from the 10 archetypes. Each dot carries
 * its source archetype's real verdict + watch-through plus bounded seeded jitter; a
 * minority (`NEIGHBOUR_BLEND`) blend toward an adjacent archetype — but the verdict
 * always comes from a REAL node, never invented.
 *
 * Pure + deterministic: identical `nodes` + `seed` ⇒ byte-identical output.
 */
export function instantiatePopulation(
  nodes: PersonaNode[],
  opts: InstantiateOpts,
): PopulationDot[] {
  const total = opts.total ?? DEFAULT_TOTAL;
  if (nodes.length === 0 || total <= 0) return [];

  const counts = allocateCounts(nodes, total);
  const dots: PopulationDot[] = [];

  nodes.forEach((node, i) => {
    const count = counts[i] ?? 0;
    // Per-archetype seed derived from the global seed + a stable archetype index —
    // matches PersonaGraph's `mulberry32(9173 + i*31337)` seeding pattern.
    const rnd = mulberry32(opts.seed + 9173 + i * 31337);
    const neighbour = nodes[(i + 1) % nodes.length] ?? node;

    for (let j = 0; j < count; j++) {
      const blend = rnd() < NEIGHBOUR_BLEND && nodes.length > 1;
      const source = blend ? neighbour : node;
      const jitter = (rnd() - 0.5) * 2 * JITTER;
      const sentiment = clamp01(source.watchThrough + jitter);
      dots.push({
        id: `${node.id}:${j}`,
        archetype: node.id,
        verdict: verdictOf(source.watchThrough),
        sentiment,
      });
    }
  });

  return dots;
}

/**
 * Weighted rollup of the 10's REAL verdicts — the single source of truth consumed by
 * BOTH the Panel·10 aggregate AND the Population·1,000 live counters. Counters are
 * scaled to `DEFAULT_TOTAL` so the two resolutions report the same weighted mix.
 *
 * Pure + deterministic (no PRNG, no re-rolled band math — reuses node verdicts).
 */
export function weightedRollup(nodes: PersonaNode[]): WeightedRollup {
  if (nodes.length === 0) return { stop: 0, scroll: 0, total: 0, byArchetype: [] };

  const totalW = nodes.reduce((a, n) => a + effectiveWeight(n), 0);
  let stop = 0;

  const byArchetype = nodes.map((n) => {
    const w = effectiveWeight(n);
    const isStop = verdictOf(n.watchThrough) === 'stop';
    const contribution = (w / totalW) * DEFAULT_TOTAL;
    if (isStop) stop += contribution;
    return { archetype: n.id, stop: isStop ? Math.round(contribution) : 0, weight: w };
  });

  const stopRounded = Math.round(stop);
  return {
    stop: stopRounded,
    scroll: DEFAULT_TOTAL - stopRounded,
    total: DEFAULT_TOTAL,
    byArchetype,
  };
}

/**
 * Deterministic reveal order for the staggered cascade (D-06 / LIVE-05). Keyed on
 * verdict (stops reveal first) then weight (heaviest first), stable tie-break by id.
 * Pure: no `Math.random`, no `Date.now`.
 */
export function cascadeOrder(nodes: PersonaNode[]): string[] {
  return nodes
    .slice()
    .sort((a, b) => {
      const va = verdictOf(a.watchThrough) === 'stop' ? 0 : 1;
      const vb = verdictOf(b.watchThrough) === 'stop' ? 0 : 1;
      if (va !== vb) return va - vb;
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((n) => n.id);
}
