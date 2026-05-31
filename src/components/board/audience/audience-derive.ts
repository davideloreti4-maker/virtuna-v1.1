/**
 * audience-derive.ts — pure data-mapping helpers for the redesigned Audience frame.
 *
 * No React. Every export is a pure function so the mapping logic is unit-testable
 * in isolation from the streaming / weight-override wiring in AudienceNode.
 *
 * Owns:
 * - survival-curve normalization (0-1 vs 0-100 detection)
 * - biggest-drop detection (segment with the largest negative step)
 * - hero status word + insight sentence assembly
 * - 4-slot segment-group folding (with niche_deep → niche slot-drift handling)
 * - mix-footer dominant-slot label
 * - mm:ss formatting + smooth monotone Catmull-Rom → cubic-Bézier path builder
 */
import type { HeatmapPayload, PersonaSimulationResult } from '@/lib/engine/types';
import type { PersonaWeights } from '@/lib/engine/persona-weights';

export type SlotKey = 'fyp' | 'niche' | 'loyalist' | 'cross_niche';

/** Order + display labels for the "Who leaves" table groups. */
export const SLOT_GROUPS: ReadonlyArray<{ key: SlotKey; label: string }> = [
  { key: 'fyp', label: 'New viewers' },
  { key: 'niche', label: 'Your niche' },
  { key: 'loyalist', label: 'Loyal fans' },
  { key: 'cross_niche', label: 'Cross-niche' },
] as const;

/** Normalize a slot_type — PersonaSimulationResult uses `niche_deep`, heatmap uses `niche`. */
export function normalizeSlot(slot: string): SlotKey {
  if (slot === 'niche_deep') return 'niche';
  if (slot === 'fyp' || slot === 'niche' || slot === 'loyalist' || slot === 'cross_niche') {
    return slot;
  }
  return 'fyp';
}

/** mm:ss formatting (e.g. 21 → "0:21", 75 → "1:15"). Floors fractional seconds. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Detect whether a curve is expressed on a 0-1 or 0-100 scale and return it
 * normalized to 0-1. A curve with any value > 1.5 is treated as 0-100.
 */
export function normalizeCurve(curve: number[]): number[] {
  if (curve.length === 0) return curve;
  const max = Math.max(...curve);
  const scale = max > 1.5 ? 100 : 1;
  return curve.map((v) => Math.min(1, Math.max(0, v / scale)));
}

export interface BiggestDrop {
  /** Index of the segment AT which the biggest drop lands (the lower point). */
  index: number;
  /** Magnitude of the drop on a 0-1 scale (always >= 0). */
  delta: number;
  /** Index of the point BEFORE the drop (index - 1, clamped). */
  fromIndex: number;
}

/**
 * Biggest drop = the segment with the largest negative step in the (normalized)
 * survival curve. Returns null when the curve is empty / single-point.
 */
export function findBiggestDrop(normalizedCurve: number[]): BiggestDrop | null {
  if (normalizedCurve.length < 2) return null;
  let maxDrop = -Infinity;
  let dropIndex = 1;
  for (let i = 1; i < normalizedCurve.length; i++) {
    const step = (normalizedCurve[i - 1] ?? 0) - (normalizedCurve[i] ?? 0);
    if (step > maxDrop) {
      maxDrop = step;
      dropIndex = i;
    }
  }
  return { index: dropIndex, delta: Math.max(0, maxDrop), fromIndex: dropIndex - 1 };
}

/** Hero status word from a 0-100 watch-through value (neutral, no colored dot). */
export function statusWord(pct: number): string {
  if (pct >= 80) return 'Holds strong';
  if (pct >= 60) return 'Holds well';
  if (pct >= 40) return 'Leaky';
  return 'Drops fast';
}

/** Total video duration in seconds, derived from the last segment's t_end. */
export function totalDuration(segments: HeatmapPayload['segments'] | undefined, fallback: number): number {
  if (!segments || segments.length === 0) return fallback;
  return segments[segments.length - 1]!.t_end || fallback;
}

export interface InsightParts {
  /** Leading sentence before the coral time mark. */
  lead: string;
  /** The mm:ss time string rendered in coral. Null when no drop. */
  time: string | null;
  /** Sentence tail after the time mark. */
  tail: string;
  /** Optional niche-stays addendum. Empty string when not appended. */
  addendum: string;
}

/**
 * Build the insight sentence parts:
 *   "Most viewers leave at {time}, where {reason}.{addendum}"
 * Only the time is coral. Addendum appended when niche retention >> fyp retention.
 */
export function buildInsight(
  segments: HeatmapPayload['segments'] | undefined,
  drop: BiggestDrop | null,
  groups: SegmentGroup[],
): InsightParts {
  if (!drop || !segments || segments.length === 0) {
    return {
      lead: 'Most viewers watch through',
      time: null,
      tail: ' without a clear drop-off.',
      addendum: '',
    };
  }
  const seg = segments[drop.index];
  const dropTime = seg?.t_start ?? 0;
  const label = seg?.label?.trim();
  const reason = label && label.length > 0 ? label : 'the pacing dips';

  const niche = groups.find((g) => g.key === 'niche');
  const fyp = groups.find((g) => g.key === 'fyp');
  const nicheStays =
    niche != null &&
    fyp != null &&
    niche.count > 0 &&
    fyp.count > 0 &&
    niche.pct - fyp.pct >= 20;

  return {
    lead: 'Most viewers leave at ',
    time: formatTime(dropTime),
    tail: `, where ${reason}.`,
    addendum: nicheStays ? " Your niche stays — new viewers don't." : '',
  };
}

export interface SegmentGroup {
  key: SlotKey;
  label: string;
  /** Watch-through % (0-100), rounded later by the view. */
  pct: number;
  /** ≤3-word descriptor. */
  desc: string;
  /** Number of personas folded into this group (0 ⇒ row hidden). */
  count: number;
}

/**
 * Fold personas into the 4 slot groups.
 *
 * Watch-through % per group:
 *  - Prefer the mean of that group's PersonaSimulationResult.watch_through_pct
 *    (joined by normalized slot_type), already 0-100.
 *  - Fall back to the mean attention of the heatmap personas in that slot
 *    (0-1 → ×100).
 *
 * Descriptors (templated, ≤3 words):
 *  - fyp:         "fade at {dropTime}"
 *  - niche:       "hold through"
 *  - loyalist:    "watch, then loop"
 *  - cross_niche: "bounce at {earliest big drop of that group}"
 */
export function buildSegmentGroups(
  heatmap: HeatmapPayload | null,
  simResults: PersonaSimulationResult[] | undefined,
  dropTimeSec: number | null,
): SegmentGroup[] {
  const personas = heatmap?.personas ?? [];

  // Group heatmap personas by normalized slot.
  const bySlot = new Map<SlotKey, HeatmapPayload['personas']>();
  for (const p of personas) {
    const key = normalizeSlot(p.slot_type);
    const arr = bySlot.get(key) ?? [];
    arr.push(p);
    bySlot.set(key, arr);
  }

  // Group sim results by normalized slot.
  const simBySlot = new Map<SlotKey, PersonaSimulationResult[]>();
  for (const r of simResults ?? []) {
    const key = normalizeSlot(r.slot_type);
    const arr = simBySlot.get(key) ?? [];
    arr.push(r);
    simBySlot.set(key, arr);
  }

  const dropLabel = dropTimeSec != null ? formatTime(dropTimeSec) : null;

  return SLOT_GROUPS.map(({ key, label }) => {
    const hmPersonas = bySlot.get(key) ?? [];
    const sims = simBySlot.get(key) ?? [];
    const count = hmPersonas.length;

    // Watch-through %: sim mean (0-100) preferred, else heatmap attention mean (0-1).
    let pct: number;
    if (sims.length > 0) {
      pct = sims.reduce((a, r) => a + r.watch_through_pct, 0) / sims.length;
    } else if (hmPersonas.length > 0) {
      const personaMeans = hmPersonas.map((p) =>
        p.attentions.length > 0
          ? p.attentions.reduce((a, b) => a + b, 0) / p.attentions.length
          : 0,
      );
      const attMean = personaMeans.reduce((a, b) => a + b, 0) / personaMeans.length;
      pct = attMean * 100;
    } else {
      pct = 0;
    }

    let desc: string;
    switch (key) {
      case 'fyp':
        desc = dropLabel ? `fade at ${dropLabel}` : 'fade early';
        break;
      case 'niche':
        desc = 'hold through';
        break;
      case 'loyalist':
        desc = 'watch, then loop';
        break;
      case 'cross_niche': {
        // Earliest big drop for cross-niche personas: smallest swipe_predicted_at,
        // else the group-level swipe time, else a static descriptor.
        const swipeTimes = hmPersonas
          .map((p) => p.swipe_predicted_at)
          .filter((t): t is number => t != null);
        if (swipeTimes.length > 0) {
          desc = `bounce at ${formatTime(Math.min(...swipeTimes))}`;
        } else {
          desc = 'bounce early';
        }
        break;
      }
    }

    return { key, label, pct, desc, count };
  });
}

/**
 * Which single group should get the coral "bad" treatment.
 * Rule: the single worst group, only if its watch-through % is below ~40.
 * Returns null when no group qualifies (keeps coral marks ≤2 in the frame).
 */
export function worstBadGroupKey(groups: SegmentGroup[]): SlotKey | null {
  const visible = groups.filter((g) => g.count > 0);
  if (visible.length === 0) return null;
  const worst = visible.reduce((a, b) => (b.pct < a.pct ? b : a));
  return worst.pct < 40 ? worst.key : null;
}

/** Mix-footer label from the dominant slot of the current weights. */
export function mixLabel(weights: PersonaWeights): string {
  const entries: Array<[SlotKey, number]> = [
    ['fyp', weights.fyp],
    ['niche', weights.niche],
    ['loyalist', weights.loyalist],
    ['cross_niche', weights.cross_niche],
  ];
  const dominant = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  switch (dominant) {
    case 'fyp':
      return 'FYP-heavy';
    case 'niche':
      return 'Niche-focused';
    case 'loyalist':
      return 'Loyalist-focused';
    case 'cross_niche':
      return 'Cross-niche';
  }
}

/**
 * Mean of the niche-slot personas' attentions per segment, normalized to 0-1.
 * Returns null when there are no niche-slot personas (caller draws a flat ghost
 * line at niche_completion_pct instead).
 */
export function nicheGhostCurve(heatmap: HeatmapPayload | null): number[] | null {
  const personas = heatmap?.personas ?? [];
  const niche = personas.filter((p) => normalizeSlot(p.slot_type) === 'niche');
  const segCount = heatmap?.segments?.length ?? 0;
  if (niche.length === 0 || segCount === 0) return null;
  const out = new Array<number>(segCount).fill(0);
  for (let j = 0; j < segCount; j++) {
    let sum = 0;
    for (const p of niche) sum += p.attentions[j] ?? 0;
    out[j] = sum / niche.length;
  }
  return normalizeCurve(out);
}

/**
 * Build a SMOOTH SVG path (monotone Catmull-Rom → cubic Bézier) for a set of
 * points in viewBox space. Avoids overshoot on monotone segments so a survival
 * curve never bulges above 100% / below 0%.
 *
 * Points must already be mapped to viewBox coordinates.
 */
export function smoothPath(points: Array<{ x: number; y: number }>): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0]!.x},${points[0]!.y}`;

  const d: string[] = [`M${points[0]!.x},${points[0]!.y}`];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;

    // Catmull-Rom → Bézier control points (tension = 1/6).
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d.push(
      `C${round(cp1x)},${round(cp1y)} ${round(cp2x)},${round(cp2y)} ${round(p2.x)},${round(p2.y)}`,
    );
  }
  return d.join(' ');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
