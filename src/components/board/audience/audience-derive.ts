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
import type { PersonaNode } from '../_kit';
import { resolveKeyframeUrl, type KeyframeSegmentLike } from '../_kit';
import { ARCHETYPE_DISPLAY_NAME } from './audience-constants';
import { resolvePersonaName } from '@/lib/audience/persona-names';

export type SlotKey = 'fyp' | 'niche' | 'loyalist' | 'cross_niche';

/** Order + display labels for the "Who leaves" table groups. */
export const SLOT_GROUPS: ReadonlyArray<{ key: SlotKey; label: string }> = [
  { key: 'fyp', label: 'New viewers' },
  { key: 'niche', label: 'Your niche' },
  { key: 'loyalist', label: 'Loyal fans' },
  { key: 'cross_niche', label: 'Cross-niche' },
] as const;

/** Short slot label for the persona-graph hover card segment line. */
export const SLOT_LABEL: Record<SlotKey, string> = {
  fyp: 'New viewers',
  niche: 'Your niche',
  loyalist: 'Loyal fans',
  cross_niche: 'Cross-niche',
};

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

/**
 * Convert a normalized *attention* curve (0-1) into a watch-time *retention*
 * (survival) curve — TikTok-analytics style.
 *
 * The engine only predicts per-segment attention; it has no measured retention.
 * A retention curve is a survival function: everyone is present at the hook, so
 * it must open at 100% and can only fall (a viewer who left can't un-leave).
 * We derive it by anchoring attention to the hook and taking the monotonic
 * (running-minimum) envelope:
 *
 *   relative[i]  = clamp01(a[i] / a[0])   // hook = 100% baseline
 *   retention[i] = min(relative[0..i])    // survival envelope, never rises
 *
 * So "attention falls to 40% of the hook by 0:03" reads as "40% retention at
 * 0:03" — and the biggest single step is the biggest viewer drop-off. Pure.
 * Input must already be normalized (0-1) via {@link normalizeCurve}.
 */
export function toRetentionCurve(normalized: number[]): number[] {
  if (normalized.length === 0) return normalized;
  const head = normalized[0] ?? 0;
  // Hook baseline. Degenerate 0-attention hook → fall back to the peak so the
  // curve still opens at 100% rather than dividing by zero.
  const anchor = head > 0 ? head : Math.max(...normalized) || 1;
  let floor = 1;
  return normalized.map((v) => {
    const relative = Math.min(1, Math.max(0, v / anchor));
    floor = Math.min(floor, relative);
    return floor;
  });
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
  const reason = clampReason(seg?.label);

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
    // reason already carries its own terminal punctuation (. or …); when empty we
    // close the sentence after the time. Prevents the ".." the raw label produced.
    tail: reason ? `, where ${reason}` : '.',
    addendum: nicheStays ? " Your niche stays — new viewers don't." : '',
  };
}

/**
 * Tidy a raw segment label into a glanceable insight clause.
 * Real labels are full descriptive sentences (often ending in a period) — we strip
 * trailing punctuation, cap to ≤7 words (ellipsis if cut), and re-add a single
 * period. Empty labels fall back to a neutral phrase.
 */
function clampReason(label: string | undefined): string {
  const raw = (label ?? '').replace(/\s+/g, ' ').trim().replace(/[.,;:…]+$/, '');
  if (raw.length === 0) return 'the pacing dips.';
  const words = raw.split(' ');
  return words.length > 7 ? `${words.slice(0, 7).join(' ')}…` : `${raw}.`;
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
 * Descriptor is derived from each group's OWN watch-through % (retentionDesc) so
 * it can never contradict the number beside it — the previous static labels claimed
 * "Your niche · hold through" even when niche retention was the lowest row.
 */
export function buildSegmentGroups(
  heatmap: HeatmapPayload | null,
  simResults: PersonaSimulationResult[] | undefined,
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

    return { key, label, pct, desc: retentionDesc(pct), count };
  });
}

/** ≤3-word retention characterization from a 0-100 watch-through %. Always honest
 *  relative to the number it sits beside (no "holds through" on a 49% row). */
function retentionDesc(pct: number): string {
  if (pct >= 85) return 'watches, loops';
  if (pct >= 70) return 'holds through';
  if (pct >= 55) return 'fades late';
  if (pct >= 40) return 'drops midway';
  return 'leaves early';
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

// ─────────────────────────────────────────────────────────────────────────────
// Hero persona-graph + stat-tile selectors (board-redesign-v2)
//
// Pure, unit-testable mappings from the engine heatmap/sim payloads into the
// shared `_kit` PersonaGraph / StatTileRow shapes. No React, no presentation —
// the same numbers that already feed the legacy rows, just reshaped.
// ─────────────────────────────────────────────────────────────────────────────

/** First real segment-reason note for a persona (verbatim, never fabricated).
 *  Returns undefined when the persona has no inflection-point notes. */
function firstSegmentReason(reasons: Record<number, string> | undefined): string | undefined {
  if (!reasons) return undefined;
  const keys = Object.keys(reasons)
    .map((k) => Number(k))
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);
  for (const k of keys) {
    const v = reasons[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** Mean of a persona's per-segment attentions on a 0-1 scale. */
function personaAttentionMean(attentions: number[]): number {
  if (attentions.length === 0) return 0;
  const sum = attentions.reduce((a, b) => a + b, 0);
  return sum / attentions.length;
}

/**
 * Per-persona watch-through 0-1.
 *  - Prefer the persona's PersonaSimulationResult.watch_through_pct (0-100 → 0-1),
 *    joined by persona_id (falling back to slot mean when ids don't line up).
 *  - Else the mean of the heatmap persona's own attentions (already 0-1).
 */
function personaWatchThrough(
  p: HeatmapPayload['personas'][number],
  simById: Map<string, PersonaSimulationResult>,
  simSlotMean: Map<SlotKey, number>,
): number {
  const direct = simById.get(p.id);
  if (direct) return Math.min(1, Math.max(0, direct.watch_through_pct / 100));
  const slotMean = simSlotMean.get(normalizeSlot(p.slot_type));
  if (slotMean != null) return Math.min(1, Math.max(0, slotMean / 100));
  return Math.min(1, Math.max(0, personaAttentionMean(p.attentions)));
}

/**
 * Map the (up to 10) heatmap personas into `PersonaNode[]` for the hero graph.
 *
 * - id/label: persona id + archetype display name (slot label when unknown).
 * - weight 0-1: relative attention-mean within the cohort (max-normalized so
 *   the most-watched persona reads largest); falls back to a flat 0.5 when every
 *   persona shares the same mean. Drives node radius — NOT engagement weighting.
 * - watchThrough 0-1: per-persona watch-through (sim-preferred, see above).
 * - segment: human slot label ("Your niche", "New viewers"…).
 * - dropAt: mm:ss of swipe_predicted_at when present.
 * - tone: 'accent' for personas in the single worst-retention slot group
 *   (mirrors the table's `worstBadGroupKey`), so the hero and the "Who leaves"
 *   tab highlight the same cluster.
 */
export function buildPersonaNodes(
  heatmap: HeatmapPayload | null,
  simResults: PersonaSimulationResult[] | undefined,
  badKey: SlotKey | null,
  /**
   * Archetype→creator-label overrides (The Room, Task A). When an archetype is present here its
   * creator-chosen name wins; otherwise the stable default name is used. Absent → default names
   * for every known archetype (still real, still recurring). Additive + default `{}` so the three
   * existing (heatmap, sim, badKey) call sites stay byte-identical apart from the new `.name`.
   */
  nameOverrides: Record<string, string> = {},
): PersonaNode[] {
  const personas = heatmap?.personas ?? [];
  if (personas.length === 0) return [];

  const simById = new Map<string, PersonaSimulationResult>();
  const simSlotAcc = new Map<SlotKey, { sum: number; n: number }>();
  for (const r of simResults ?? []) {
    simById.set(r.persona_id, r);
    const k = normalizeSlot(r.slot_type);
    const acc = simSlotAcc.get(k) ?? { sum: 0, n: 0 };
    acc.sum += r.watch_through_pct;
    acc.n += 1;
    simSlotAcc.set(k, acc);
  }
  const simSlotMean = new Map<SlotKey, number>();
  for (const [k, { sum, n }] of simSlotAcc) simSlotMean.set(k, n > 0 ? sum / n : 0);

  const means = personas.map((p) => personaAttentionMean(p.attentions));
  const maxMean = Math.max(...means, 0);

  return personas.map((p, i) => {
    const slot = normalizeSlot(p.slot_type);
    const label =
      ARCHETYPE_DISPLAY_NAME[p.archetype ?? ''] ?? SLOT_LABEL[slot];
    const weight = maxMean > 0 ? (means[i] ?? 0) / maxMean : 0.5;
    return {
      id: p.id,
      label,
      weight,
      watchThrough: personaWatchThrough(p, simById, simSlotMean),
      segment: SLOT_LABEL[slot],
      dropAt: p.swipe_predicted_at != null ? formatTime(p.swipe_predicted_at) : undefined,
      tone: badKey != null && slot === badKey ? ('accent' as const) : ('default' as const),
      // Verbatim reaction to THIS concept for the Lens drill-down (LIVE-02). On the
      // video surface the only real per-persona reaction text is `segment_reasons`
      // (sparse inflection-point notes) — pick the first one, never fabricated.
      quote: firstSegmentReason(p.segment_reasons),
      // The registry archetype enum (when the heatmap persona carries one) — powers the
      // "Ask them why →" persona chat grounding (P9 / D-03). Undefined when unknown.
      archetype: p.archetype ?? undefined,
      // The persona's real NAME (The Room, Task A) — creator label wins, else the stable
      // archetype default; null (unknown archetype) leaves it undefined so `.label` stays the
      // fallback. Presentation-only; never feeds the engine.
      name: resolvePersonaName(p.archetype, nameOverrides[p.archetype ?? '']) ?? undefined,
    };
  });
}

/**
 * Flat Shape-B reaction (the text-skill / text-Read persona shape, D-06): a binary
 * stop/scroll verdict + a verbatim quote, with NO per-segment attention timeline.
 * Source: PersonasBlock / MultiAudienceReadBlock `{archetype, verdict, quote}`.
 */
export interface FlatPersonaReaction {
  archetype: string;
  verdict: 'stop' | 'scroll';
  quote: string;
}

/**
 * Adapt flat Shape-B reactions into `PersonaNode[]` so the SAME Lens views (cluster,
 * cascade reveal, Population swarm, node drill) that the rich video timeline feeds can
 * also render the text surfaces — degrade-by-feature (D-04/D-06): the only thing flat
 * data CANNOT do is segment-by-segment replay (no timeline). Pure, no React.
 *
 * - watchThrough is BINARY-derived from the real verdict (stop → 1, scroll → 0) — we
 *   never fabricate a continuous attention number the flat shape never emitted.
 * - weight is flat (every flat persona equal) since there is no per-segment attention
 *   mean to size by; radius differences would imply a signal that does not exist.
 * - slot/segment is mapped from the archetype via the registry slot heuristic so the
 *   cluster lens (buildSegmentGroups consumes nodes' real slots on the video path; on
 *   flat surfaces we cluster directly off these nodes — see clusterFlatNodes).
 * - tone is left 'default'; the worst-cluster coral is applied by the flat clusterer,
 *   which mirrors worstBadGroupKey's <40%-stop rule.
 */
export function buildFlatPersonaNodes(
  reactions: FlatPersonaReaction[],
  /** Archetype→creator-label overrides (The Room, Task A). See buildPersonaNodes. Default `{}`. */
  nameOverrides: Record<string, string> = {},
): PersonaNode[] {
  return reactions.map((r, i) => {
    const slot = archetypeToSlot(r.archetype);
    return {
      id: `${r.archetype}:${i}`,
      label: ARCHETYPE_DISPLAY_NAME[r.archetype] ?? r.archetype.replace(/_/g, ' '),
      weight: 0.5,
      watchThrough: r.verdict === 'stop' ? 1 : 0,
      segment: SLOT_LABEL[slot],
      tone: 'default' as const,
      quote: r.quote,
      archetype: r.archetype,
      // The persona's real NAME (The Room, Task A) — creator label wins, else the stable
      // archetype default; undefined leaves `.label` as the fallback.
      name: resolvePersonaName(r.archetype, nameOverrides[r.archetype]) ?? undefined,
    };
  });
}

/** Best-effort archetype → slot mapping for the flat clusterer (prefix heuristic).
 *  Exported so the flat cloud (AudienceLens) can decide coral toning by the SAME slot
 *  identity the cluster table uses, rather than re-running the <40% rule per single node
 *  (which painted a different "worst cluster" member than ClusterView — WR-02). */
export function archetypeToSlot(archetype: string): SlotKey {
  const a = archetype.toLowerCase();
  if (a.includes('loyal')) return 'loyalist';
  if (a.includes('cross')) return 'cross_niche';
  if (a.includes('niche')) return 'niche';
  return 'fyp';
}

/**
 * Cluster flat PersonaNodes into the 4 slot groups by the SAME Temp×Disposition lens
 * the video path uses (buildSegmentGroups), but driven by the binary verdict — pct is
 * the % of the group that STOPPED (kept watching). Mirrors worstBadGroupKey's <40%
 * rule for the single worst (coral) cluster, ≤2 coral marks (UI-SPEC). Pure.
 */
export function clusterFlatNodes(nodes: PersonaNode[]): {
  groups: SegmentGroup[];
  worstKey: SlotKey | null;
} {
  const bySlot = new Map<SlotKey, PersonaNode[]>();
  for (const n of nodes) {
    const slot = n.archetype ? archetypeToSlot(n.archetype) : 'fyp';
    const arr = bySlot.get(slot) ?? [];
    arr.push(n);
    bySlot.set(slot, arr);
  }
  const groups: SegmentGroup[] = SLOT_GROUPS.map(({ key, label }) => {
    const members = bySlot.get(key) ?? [];
    const count = members.length;
    const stopPct =
      count > 0
        ? (members.filter((m) => m.watchThrough >= 0.5).length / count) * 100
        : 0;
    return { key, label, pct: stopPct, desc: retentionDesc(stopPct), count };
  });
  return { groups, worstKey: worstBadGroupKey(groups) };
}

/** Mean watch-through across all persona nodes, as a 0-100 int (null when none). */
export function averageWatchThrough(nodes: PersonaNode[]): number | null {
  if (nodes.length === 0) return null;
  const mean = nodes.reduce((a, n) => a + n.watchThrough, 0) / nodes.length;
  return Math.round(mean * 100);
}

/** How many of the cohort finish (watch-through ≥ 90%). Returns n / total. */
export function personasFinishing(
  nodes: PersonaNode[],
  threshold = 0.9,
): { finishing: number; total: number } {
  return {
    finishing: nodes.filter((n) => n.watchThrough >= threshold).length,
    total: nodes.length,
  };
}

/**
 * One-word hero verdict from a 0-100 watch-through band + a HeroTone for color.
 * Mirrors `statusWord`'s bands but condensed to a single word + tone so the
 * FrameHero status reads as a glanceable badge.
 */
export function heroVerdict(
  pct: number,
): { word: string; tone: 'good' | 'warn' | 'crit' | 'neutral' } {
  if (pct >= 80) return { word: 'Strong', tone: 'good' };
  if (pct >= 60) return { word: 'Solid', tone: 'good' };
  if (pct >= 40) return { word: 'Leaky', tone: 'warn' };
  return { word: 'Drops', tone: 'crit' };
}

export interface RetentionTrendPoint {
  /** Seconds (x). */
  x: number;
  /** Weighted survival 0-100 (the current series). */
  current: number;
  /** Niche-baseline survival 0-100, when available (the dotted comparison). */
  previous?: number;
}

/**
 * Build TrendChart data for the Retention tab: weighted survival (current) vs
 * the niche ghost (previous/comparison), both on a 0-100 scale, x = seconds.
 * Pure — the same curves the legacy SVG RetentionChart drew, reshaped for the
 * kit TrendChart. Returns [] when there's no curve.
 */
export function buildRetentionTrend(
  curve: number[] | null,
  heatmap: HeatmapPayload | null,
  totalDurationSec: number,
  nicheCompletionPct: number | null,
): RetentionTrendPoint[] {
  if (!curve || curve.length === 0) return [];
  const normalized = normalizeCurve(curve);
  const segments = heatmap?.segments ?? [];
  const total = totalDurationSec > 0 ? totalDurationSec : 1;
  const ghost = nicheGhostCurve(heatmap);

  return normalized.map((v, i) => {
    const seg = segments[i];
    const x = seg ? seg.t_start : (i / Math.max(1, normalized.length - 1)) * total;
    const point: RetentionTrendPoint = { x: Math.round(x), current: Math.round(v * 100) };
    if (ghost && ghost[i] != null) {
      point.previous = Math.round((ghost[i] ?? 0) * 100);
    } else if (nicheCompletionPct != null) {
      point.previous = Math.round(Math.min(1, Math.max(0, nicheCompletionPct)) * 100);
    }
    return point;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-keyframe selectors (board-redesign-v2.1)
//
// "Where they drop" strip + "Who leaves" cohort thumbs. Both resolve a real
// signed keyframe per moment from the filmstrip map (segment_idx → URL), keyed
// by POSITION (seg.idx ?? i) to match RetentionChart / ContentAnalysisFrame.
// Pure — the view gates on `Object.keys(filmstrips).length > 0` before rendering.
// ─────────────────────────────────────────────────────────────────────────────

/** A single moment in "where they drop": a frame at a key retention drop. */
export interface DropMoment {
  /** Position index into the curve / segments. */
  index: number;
  /** Signed keyframe URL for this moment (null ⇒ KeyframeImage draws a fallback). */
  url: string | null;
  /** mm:ss timecode of the drop (segment t_start). */
  timecode: string;
  /** Drop magnitude as a 0-100 int (for the worst-cell badge). */
  deltaPct: number;
  /** True for the single biggest drop (gets the coral `marked` outline). */
  worst: boolean;
}

/** Bridge a heatmap's segments to the `KeyframeSegmentLike` shape `resolveKeyframeUrl` wants. */
function asKeyframeSegments(
  segments: HeatmapPayload['segments'] | undefined,
): KeyframeSegmentLike[] {
  return (segments ?? []).map((s, i) => ({
    idx: s.idx ?? i,
    t_start: s.t_start,
    t_end: s.t_end,
    keyframe_uri: s.keyframe_uri,
  }));
}

/**
 * Resolve a real keyframe for a curve/segment position. Prefers the filmstrip
 * map keyed by POSITION (matches RetentionChart's `seg.idx ?? i`), then the
 * segment's own keyframe_uri, then a ms-target `resolveKeyframeUrl` fallback.
 */
function frameForSegmentIndex(
  filmstrips: Record<number, string>,
  segments: HeatmapPayload['segments'] | undefined,
  index: number,
): string | null {
  const segs = segments ?? [];
  const seg = segs[index];
  const segIdx = seg?.idx ?? index;
  if (filmstrips[segIdx]) return filmstrips[segIdx] ?? null;
  if (filmstrips[index]) return filmstrips[index] ?? null;
  if (seg?.keyframe_uri) return seg.keyframe_uri;
  // Last resort: ms-target resolve (handles permalink heatmaps with sparse idxs).
  if (seg) return resolveKeyframeUrl(filmstrips, asKeyframeSegments(segs), seg.t_start * 1000);
  return null;
}

/**
 * Pick the key drop moments for the "Where they drop" strip: the biggest drop
 * (reusing `findBiggestDrop`) plus the next-largest distinct drops, up to `max`,
 * ordered by time. The biggest drop is flagged `worst` (coral mark). Each moment
 * resolves a real frame from the filmstrip map. Returns [] when there's no curve
 * or no segments (the caller also gates on a non-empty filmstrip map).
 */
export function buildDropMoments(
  curve: number[] | null,
  segments: HeatmapPayload['segments'] | undefined,
  filmstrips: Record<number, string>,
  max = 3,
): DropMoment[] {
  const segs = segments ?? [];
  if (!curve || curve.length < 2 || segs.length === 0) return [];
  const normalized = normalizeCurve(curve);

  // All downward steps, largest first.
  const steps: Array<{ index: number; delta: number }> = [];
  for (let i = 1; i < normalized.length; i++) {
    const delta = (normalized[i - 1] ?? 0) - (normalized[i] ?? 0);
    if (delta > 0) steps.push({ index: i, delta });
  }
  if (steps.length === 0) return [];
  steps.sort((a, b) => b.delta - a.delta);

  const worstIndex = steps[0]!.index;
  const picked = steps.slice(0, Math.max(1, max));
  // Present in time order (left → right) so the strip reads as a timeline.
  picked.sort((a, b) => a.index - b.index);

  return picked.map(({ index, delta }) => {
    const seg = segs[index];
    return {
      index,
      url: frameForSegmentIndex(filmstrips, segs, index),
      timecode: formatTime(seg?.t_start ?? 0),
      deltaPct: Math.round(delta * 100),
      worst: index === worstIndex,
    };
  });
}

/**
 * Cohort drop frame for a "Who leaves" row. Picks the time the cohort leaves
 * (mean `swipe_predicted_at` of that slot's personas, else the slot's lowest-
 * attention segment), resolves the real frame at that time, and returns the
 * mm:ss timecode. Returns null when there's no usable time/segment, so the row
 * simply omits the thumb. Keyed off the heatmap personas (the same source the
 * groups fold from), so the join is by normalized slot.
 */
export interface CohortDropFrame {
  url: string | null;
  timecode: string;
  /** Drop time in SECONDS — lets a scrubber sync a "leaving now" highlight to the
   *  playhead (reading-ux S2 2026-06-15). Same value the `timecode` formats. */
  tSec: number;
}

export function cohortDropFrame(
  heatmap: HeatmapPayload | null,
  slot: SlotKey,
  filmstrips: Record<number, string>,
): CohortDropFrame | null {
  const segments = heatmap?.segments ?? [];
  if (segments.length === 0) return null;
  const personas = (heatmap?.personas ?? []).filter(
    (p) => normalizeSlot(p.slot_type) === slot,
  );
  if (personas.length === 0) return null;

  // Preferred: mean predicted swipe time across the cohort.
  const swipes = personas
    .map((p) => p.swipe_predicted_at)
    .filter((t): t is number => t != null);
  let dropSec: number | null =
    swipes.length > 0 ? swipes.reduce((a, b) => a + b, 0) / swipes.length : null;
  let index: number;

  if (dropSec != null) {
    // Map the time to its containing segment (else nearest by midpoint).
    const ds = dropSec;
    const found = segments.findIndex((s) => ds >= s.t_start && ds < s.t_end);
    index =
      found >= 0
        ? found
        : segments
            .map((s, i) => ({ i, d: Math.abs((s.t_start + s.t_end) / 2 - ds) }))
            .sort((a, b) => a.d - b.d)[0]!.i;
  } else {
    // Fallback: the segment where this cohort's mean attention is lowest.
    let lowIdx = 0;
    let lowVal = Infinity;
    for (let j = 0; j < segments.length; j++) {
      let sum = 0;
      for (const p of personas) sum += p.attentions[j] ?? 0;
      const mean = sum / personas.length;
      if (mean < lowVal) {
        lowVal = mean;
        lowIdx = j;
      }
    }
    index = lowIdx;
    dropSec = segments[lowIdx]?.t_start ?? 0;
  }

  return {
    url: frameForSegmentIndex(filmstrips, segments, index),
    timecode: formatTime(dropSec),
    tSec: dropSec,
  };
}
