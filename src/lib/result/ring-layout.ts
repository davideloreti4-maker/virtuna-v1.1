import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import type { GroupRow } from "./types";

/**
 * The audience ring (spec §5 "Audience"; the mock's `ringDots`): 1,000 dots in one wedge per
 * group, each wedge as wide as the weight its group carries. Dots sit on concentric rows between
 * an inner and an outer radius at one pitch, chosen so the run's groups take 1,000 dots between
 * them. The first wedge starts at 12 o'clock and they run clockwise in the app's group order.
 *
 * Where it departs from the mock: a wedge's dot count is the largest-remainder share of its
 * weight (the mock rounds each and puts the rest on the first group), and a group that is not in
 * the run keeps a thin wedge of outlines outside the 1,000 (in the mock it has no dots at all).
 */

/** The viewer dots of the ring. */
export const RING_DOTS = 1000;
/** The gap between two wedges, in degrees (the mock's). */
const RING_GAP_DEG = 2.6;
/** The part of the ring's span a group that is not in the run keeps for its outlines, in percent. */
const ABSENT_SHARE = 1;
/** A dot's radius as a part of the pitch (the mock's). */
const DOT_OF_PITCH = 0.31;

export interface WedgeInput {
  group: Archetype;
  /** The group's share of the audience, 0 to 100. */
  weight: number;
  /** False for a group that is not in the run: it is drawn as outlines. */
  present: boolean;
}

export interface RingDot {
  x: number;
  y: number;
  /** Its row, 0 the innermost. */
  row: number;
}

export interface RingWedge {
  group: Archetype;
  present: boolean;
  /** Inner rows first, and in a row from the wedge's middle out: a part of a group lights from the centre. */
  dots: RingDot[];
}

export interface RingLayout {
  /** The square box the ring sits in: twice the outer radius plus the padding, rounded up. */
  size: number;
  /** The distance between two dots. */
  pitch: number;
  /** A dot's radius. */
  dotR: number;
  wedges: RingWedge[];
}

/** One wedge per group, in the rows' order (the app's), sized by weight. */
export function wedgesOf(rows: readonly GroupRow[]): WedgeInput[] {
  return rows.map((row) => ({ group: row.group, weight: row.weight, present: row.present }));
}

/** Whole dot counts that add up to `total`, each within one of its exact share (largest remainder). */
function apportion(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / sum) * total);
  const counts = exact.map(Math.floor);
  let rest = total - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    counts[i]! += 1;
    rest -= 1;
  }
  return counts;
}

const round = (value: number, places: number) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

export function ringDots(
  wedges: readonly WedgeInput[],
  { r1, R, n = RING_DOTS, gapDeg = RING_GAP_DEG, pad = 10 }: { r1: number; R: number; n?: number; gapDeg?: number; pad?: number },
): RingLayout {
  const size = Math.ceil(2 * R + pad);
  const c = size / 2;
  const gap = (gapDeg * Math.PI) / 180;
  const span = 2 * Math.PI - wedges.length * gap;
  const absentTh = (span * ABSENT_SHARE) / 100;
  const presentSpan = span - absentTh * wedges.filter((w) => !w.present).length;
  const presentTotal = wedges.reduce((sum, w) => sum + (w.present ? w.weight : 0), 0);
  const thetaOf = (w: WedgeInput) =>
    w.present ? (presentTotal > 0 ? (presentSpan * w.weight) / presentTotal : 0) : absentTh;

  const counts = apportion(
    wedges.map((w) => (w.present ? w.weight : 0)),
    n,
  );

  const rowsFor = (p: number) => {
    const m = Math.max(2, Math.round((R - r1) / (p * 0.9)));
    return Array.from({ length: m }, (_, j) => r1 + ((j + 0.5) * (R - r1)) / m);
  };
  const perRow = (th: number, rows: readonly number[], p: number) => rows.map((r) => Math.max(1, Math.round((th * r) / p)));
  const count = (p: number) => {
    const rows = rowsFor(p);
    return wedges.reduce((t, w) => (w.present ? t + perRow(thetaOf(w), rows, p).reduce((a, b) => a + b, 0) : t), 0);
  };

  // The pitch at which the groups in the run take `n` dots between them.
  let lo = 1;
  let hi = 40;
  for (let i = 0; i < 44; i++) {
    const p = (lo + hi) / 2;
    if (count(p) > n) lo = p;
    else hi = p;
  }
  const pitch = hi;
  const rows = rowsFor(pitch);

  let a0 = -Math.PI / 2 + gap / 2;
  const out: RingWedge[] = wedges.map((w, g) => {
    const th = thetaOf(w);
    const ns = perRow(th, rows, pitch);
    if (w.present) {
      // Bring the rows to the wedge's count, from the outermost row in.
      let diff = counts[g]! - ns.reduce((a, b) => a + b, 0);
      let j = rows.length - 1;
      while (diff !== 0) {
        const s = Math.sign(diff);
        if (s > 0 || ns[j]! > 0) {
          ns[j]! += s;
          diff -= s;
        }
        j = j > 0 ? j - 1 : rows.length - 1;
      }
    }
    const cells: Array<{ a: number; r: number; j: number; c: number }> = [];
    rows.forEach((r, j) => {
      for (let k = 0; k < ns[j]!; k++) {
        const u = (k + 0.5) / ns[j]!;
        cells.push({ a: a0 + u * th, r, j, c: Math.abs(u - 0.5) });
      }
    });
    cells.sort((A, B) => A.j - B.j || A.c - B.c);
    a0 += th + gap;
    return {
      group: w.group,
      present: w.present,
      dots: cells.map((q) => ({ x: round(c + q.r * Math.cos(q.a), 1), y: round(c + q.r * Math.sin(q.a), 1), row: q.j })),
    };
  });

  return { size, pitch, dotR: round(pitch * DOT_OF_PITCH, 2), wedges: out };
}

/** How a wedge is drawn at the playhead. */
export interface WedgeLook {
  /** Its dots still watching, counted from the inside. The rest are pale, or coral. */
  on: number;
  /** Its group leaves in the scene the sentence names and has gone: the dots that are not on are coral. */
  coral: boolean;
  /** Not in the run: outlines. */
  outline: boolean;
}

/** The look of each wedge for the groups at the playhead (`groupsAt`), in the layout's order. */
export function wedgeLooks(rows: readonly GroupRow[], layout: RingLayout): WedgeLook[] {
  return layout.wedges.map((wedge) => {
    const row = rows.find((r) => r.group === wedge.group);
    if (!row || !row.present) return { on: 0, coral: false, outline: true };
    return {
      on: Math.round(row.lit * wedge.dots.length),
      coral: row.named && row.status === "left",
      outline: false,
    };
  });
}
