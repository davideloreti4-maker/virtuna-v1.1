import { ARCHETYPES, type Archetype } from "@/lib/engine/wave3/persona-registry";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { groupName } from "./format";
import type { RingDot, RingLayout, WedgeInput, WedgeLook } from "./ring-layout";

/**
 * The result page of a text simulation (thread answers step 2, spec §4; drawing P7, `axResult`): the
 * number, the ring of 1,000 lit by group, the ten groups. Pure: no React.
 *
 * - The number is `Math.round(population.stopPct)` (`stopNumberOf`) and nothing else.
 * - Groups by their display names (`groupName`), never the stored `displayName`; highest percent first.
 * - Wedges in the video ring's order (`ARCHETYPES`), each as wide as its share; each lit to its
 *   group's percent from its leading edge (`sweepOrdered`, the drawing's "slice across all rows").
 */

export type TextResultAs = "hook" | "idea" | "opening";

export const TEXT_RESULT_TITLE: Record<TextResultAs, string> = { hook: "Hook", idea: "Idea", opening: "Opening line" };

export function textResultAsOf(value: string | null | undefined): TextResultAs {
  return value === "idea" || value === "opening" ? value : "hook";
}

/** `/simulation/hook/[threadId]/[key]`, with `?as=` for an idea or an opening line. */
export function textResultHref(threadId: string, key: string, as: TextResultAs = "hook"): string {
  const base = `/simulation/hook/${encodeURIComponent(threadId)}/${encodeURIComponent(key)}`;
  return as === "hook" ? base : `${base}?as=${as}`;
}

/** The drawing's ring (`axRing(62, 138)`): 286 square with the default padding. */
export const TEXT_RING = { r1: 62, R: 138 } as const;

export interface TextGroup {
  group: Archetype;
  name: string;
  /** Whole percent of the audience. */
  share: number;
  /** Whole percent that would stop. */
  percent: number;
  /** The stored rate, 0..100, for the ring. */
  stopPct: number;
}

export interface TextResultModel {
  value: number;
  groups: TextGroup[];
  wedges: WedgeInput[];
}

const KNOWN: ReadonlySet<string> = new Set(ARCHETYPES);
const ORDER = new Map<Archetype, number>(ARCHETYPES.map((g, i) => [g, i]));

export function textResultOf(population: unknown): TextResultModel | null {
  const value = stopNumberOf({ population });
  if (value === null) return null;
  const raw = (population as { segments?: unknown }).segments;
  const byGroup = new Map<Archetype, { share: number; stopPct: number }>();
  for (const s of Array.isArray(raw) ? raw : []) {
    if (!s || typeof s !== "object") continue;
    const { archetype, share, stopPct } = s as { archetype?: unknown; share?: unknown; stopPct?: unknown };
    if (typeof archetype !== "string" || !KNOWN.has(archetype) || byGroup.has(archetype as Archetype)) continue;
    if (typeof share !== "number" || !Number.isFinite(share) || share < 0) continue;
    if (typeof stopPct !== "number" || !Number.isFinite(stopPct)) continue;
    byGroup.set(archetype as Archetype, { share, stopPct: Math.max(0, Math.min(100, stopPct)) });
  }
  const groups: TextGroup[] = [...byGroup]
    .map(([group, s]) => ({
      group,
      name: groupName(group),
      share: Math.round(s.share * 100),
      percent: Math.round(s.stopPct),
      stopPct: s.stopPct,
    }))
    .sort((a, b) => b.percent - a.percent || b.share - a.share || ORDER.get(a.group)! - ORDER.get(b.group)!);
  const wedges: WedgeInput[] = ARCHETYPES.map((group) => {
    const s = byGroup.get(group);
    return { group, weight: s ? s.share * 100 : 0, present: !!s };
  });
  return { value, groups, wedges };
}

/** Each wedge lit to its group's percent, ink only; a group with no segment is outlines. */
export function textRingLooks(model: TextResultModel, layout: RingLayout): WedgeLook[] {
  const lit = new Map(model.groups.map((g) => [g.group, g.stopPct / 100] as const));
  return layout.wedges.map((wedge) => {
    const share = lit.get(wedge.group);
    if (!wedge.present || share === undefined) return { on: 0, coral: false, outline: true };
    return { on: Math.round(share * wedge.dots.length), coral: false, outline: false };
  });
}

/** A dot's angle about the centre `c`, in radians clockwise from 12 o'clock, 0..2π. */
const clockwise = (d: RingDot, c: number) => (Math.atan2(d.y - c, d.x - c) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);

/** A copy of the layout with each wedge's dots clockwise from its leading edge, then by row. */
export function sweepOrdered(layout: RingLayout): RingLayout {
  const c = layout.size / 2;
  return {
    ...layout,
    wedges: layout.wedges.map((w) => ({ ...w, dots: [...w.dots].sort((a, b) => clockwise(a, c) - clockwise(b, c) || a.row - b.row) })),
  };
}

/**
 * A wedge's own area on the ring, for a pointer: the part of the annulus its dots fill. `a0` and `a1`
 * are its edges in radians, clockwise from 12 o'clock.
 */
export interface WedgeArea {
  group: Archetype;
  a0: number;
  a1: number;
  /** The annular sector as an SVG path in the layout's box. */
  d: string;
}

/** Room a wedge's area keeps beyond its outermost dots, in px (radially) and at most this angle. */
const AREA_RADIAL_PAD = 3;
const AREA_ANGLE_PAD = 0.012;

/**
 * The area of each wedge that is in the run and has dots, in the layout's order (the review of
 * 2026-11-23: the ring had no key; a tap on a wedge names its group). Read off the dots themselves,
 * so it holds for any ordering of them (`sweepOrdered` or not). No wedge crosses 12 o'clock
 * (`ringDots` starts half a gap after it), so a wedge's angles never wrap.
 */
export function wedgeAreas(layout: RingLayout, ring: { r1: number; R: number }): WedgeArea[] {
  const c = layout.size / 2;
  const rIn = Math.max(0, ring.r1 - AREA_RADIAL_PAD);
  const rOut = ring.R + AREA_RADIAL_PAD;
  const at = (a: number, r: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  const areas: WedgeArea[] = [];
  for (const wedge of layout.wedges) {
    if (!wedge.present || wedge.dots.length === 0) continue;
    let lo = Infinity;
    let hi = -Infinity;
    for (const dot of wedge.dots) {
      const a = clockwise(dot, c);
      if (a < lo) lo = a;
      if (a > hi) hi = a;
    }
    const a0 = lo - AREA_ANGLE_PAD;
    const a1 = hi + AREA_ANGLE_PAD;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    areas.push({
      group: wedge.group,
      a0,
      a1,
      d: `M${at(a0, rOut)}A${rOut} ${rOut} 0 ${large} 1 ${at(a1, rOut)}L${at(a1, rIn)}A${rIn} ${rIn} 0 ${large} 0 ${at(a0, rIn)}Z`,
    });
  }
  return areas;
}
