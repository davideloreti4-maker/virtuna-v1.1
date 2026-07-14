/**
 * room-readout — the brain card's INSTRUMENT, derived from the room's REAL votes.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT BUILT ON THE CORTEX ────────────────────────────────────
 * The obvious way to make the brain card "useful" was to score its cortical networks the way
 * Sapient (a productised TRIBE) scores theirs — Visual Pull 40, Cognitive Grip 50, a threshold
 * saying what good is. We measured before building, and it does not hold:
 *
 *   In the card's non-video mode, `cortex-sim`'s per-network drive is a SEEDED function of
 *   (stopRatio, hash(seedKey)). Two different hooks with the same stop-count get a different
 *   "Visual Pull" purely from the card's id hash. Scoring that would fabricate the metric, and
 *   putting a ">70 STRONG" bar under it would fabricate the benchmark too.
 *
 * And the benchmark could not be grounded anyway: `outlier_teardowns` (532 rows) has no
 * per-second retention, only 19 stored Reads carry a real curve, and engine_training_videos is
 * empty. There is no distribution to take a percentile from.
 *
 * So the readout is built on the one thing that IS real on every skill: the ten personas actually
 * voted. Each returns a verdict (stop/scroll), an archetype, and a VERBATIM reason. The denominator
 * is a real room of ten people, which is why none of this needs a benchmark — "6 of your 10 stopped"
 * explains itself, and "3 of 3 core fans stopped but 0 of 3 new viewers did" is a finding no
 * cortical map could give you.
 *
 * BINDING: every number here is a count of real votes. Nothing is modeled, nothing is seeded, and
 * a field with no data is ABSENT (null) — never a fabricated zero (D-13).
 *
 * Pure: no React, no clock, no PRNG. `buildRoomReadout` is a function of its nodes.
 */

import type { PersonaNode } from '@/components/board/_kit';

/** A persona counts as having STOPPED on the same rule the Room's own views use. */
const STOPPED = (n: PersonaNode) => n.watchThrough >= 0.5;

/** The smallest segment allowed to carry a claim. One persona's vote is a coin, not a finding. */
const MIN_SEGMENT = 2;

/** One receipt — a verbatim, attributed. Never a paraphrase, never a summary. */
export interface Receipt {
  quote: string;
  who: string;
}

export interface SegmentSplit {
  label: string;
  stopped: number;
  total: number;
}

export interface RoomReadout {
  /** The one headline: how much of the room stopped. A count, not a score. */
  hold: { stopped: number; total: number; pct: number };
  /**
   * WHO stopped, by segment — the readout's most useful line, and the one thing neither a cortex
   * map nor a single percentage can say. A concept that holds the core and loses everyone new is a
   * different problem from one that loses everybody equally, and the fix is different too.
   * Sorted worst-first: the segment you are losing leads.
   */
  segments: SegmentSplit[];
  /** A real objection from someone who scrolled — the receipt behind the number. */
  objection: Receipt | null;
  /** A real endorsement from someone who stopped. */
  endorsement: Receipt | null;
  /** The sharpest divergence: a segment that held vs one that walked. Null when the room agrees. */
  divergence: { held: SegmentSplit; lost: SegmentSplit } | null;
}

const nameOf = (n: PersonaNode): string => n.name ?? n.label;

/**
 * Build the readout from the room's persona nodes.
 *
 * `stopCount`/`total` come from the focus's own parsed "N/T stop" aggregate and WIN over the nodes
 * when supplied — they are the same number the rest of the Room's header and views are showing, and
 * the card must never disagree with the surface it sits on.
 */
export function buildRoomReadout(
  nodes: PersonaNode[],
  aggregate?: { stopCount: number; total: number },
): RoomReadout | null {
  if (nodes.length === 0) return null;

  const stopped = nodes.filter(STOPPED);
  const scrolled = nodes.filter((n) => !STOPPED(n));

  const total = aggregate?.total ?? nodes.length;
  const stopCount = aggregate?.stopCount ?? stopped.length;
  const pct = total > 0 ? Math.round((stopCount / total) * 100) : 0;

  // ── Who stopped, by segment. Only segments the nodes actually carry (never a fabricated row).
  const bySegment = new Map<string, SegmentSplit>();
  for (const n of nodes) {
    const label = n.segment;
    if (!label) continue;
    const row = bySegment.get(label) ?? { label, stopped: 0, total: 0 };
    row.total += 1;
    if (STOPPED(n)) row.stopped += 1;
    bySegment.set(label, row);
  }
  const segments = [...bySegment.values()].sort(
    // Worst-first: the segment you are losing is the one you need to see.
    (a, b) => a.stopped / a.total - b.stopped / b.total || b.total - a.total,
  );

  // ── The divergence. Only claimed when a segment genuinely HELD and another genuinely WALKED —
  //    a room that is uniformly lukewarm has no divergence and must not be given one.
  //
  //    ⚠️ AND ONLY OFF A SEGMENT OF AT LEAST TWO. Rendered at 1:1, the first build proudly announced
  //    a divergence against "Cross-niche 0/1" — ONE persona, whose single vote is indistinguishable
  //    from noise. A 0/1 segment is not a finding, it is a coin. Same failure as every other one this
  //    card has made: a confident story told over a signal too thin to carry it.
  const CARRIES_A_FINDING = (s: SegmentSplit) => s.total >= MIN_SEGMENT;
  const held = segments.find((s) => CARRIES_A_FINDING(s) && s.stopped / s.total >= 0.66) ?? null;
  const lost =
    [...segments].reverse().find((s) => CARRIES_A_FINDING(s) && s.stopped / s.total <= 0.34) ?? null;
  const divergence = held && lost && held.label !== lost.label ? { held, lost } : null;

  const receipt = (n: PersonaNode | undefined): Receipt | null =>
    n?.quote ? { quote: n.quote, who: nameOf(n) } : null;

  // The objection comes from the weakest watcher who actually said something — the room's own
  // 'accent' (worst-cluster) node wins when it has a quote, since that is the node the rest of the
  // Room already paints as the problem.
  const objectionNode =
    scrolled.find((n) => n.tone === 'accent' && n.quote) ??
    [...scrolled].sort((a, b) => a.watchThrough - b.watchThrough).find((n) => n.quote);
  const endorsementNode = [...stopped].sort((a, b) => b.watchThrough - a.watchThrough).find((n) => n.quote);

  return {
    hold: { stopped: stopCount, total, pct },
    segments,
    objection: receipt(objectionNode),
    endorsement: receipt(endorsementNode),
    divergence,
  };
}
