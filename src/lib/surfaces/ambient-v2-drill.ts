/**
 * ambient-v2-drill.ts — the rev-12 drill blocks, derived from what the engine actually holds.
 *
 * The three pages need material the older adapters never emitted: the identity strip, the answer
 * block and its ACTING fix, the Engagement frame, the traffic-pool split, the method drawer and the
 * sim disclosure. This module derives each of them from real persisted output, and omits anything it
 * cannot derive — the same honesty spine as its neighbours.
 *
 * What is deliberately NOT produced here, because no producer exists (§5.3's metric ledger):
 *   · views · reach · likes · follows — the identity stat row is EMPTY on a real drill. The authored
 *     fixture carries projected counts because it is a design artefact and says `projected`; an
 *     adapter inventing them would be fabricating proof.
 *   · the creator's own median POST. Still nothing: a post is a measured outcome and the engine
 *     holds none. (The last-N catalogue behind the rank strip is no longer on this list — it is
 *     built here now, off the creator's own past SIMULATIONS. See `watchCatalogueOf`. The
 *     distinction between the two is the whole reason the strip says "simulations".)
 *   · the per-second reaction timeline: we hold reaction INTENT, never its timing.
 *
 * Everything that IS produced is arithmetic on the measured curve, the sealed counts, or the real
 * transcript. No DB, no time, no randomness.
 */

import { getPersonaWeight, normalizeOverSurvivors } from "@/lib/engine/wave3/weighted-aggregator-client";
import { archetypeDisplayName } from "@/lib/audience/archetype-names";
import type { HeatmapPayload } from "@/lib/engine/types";
import type {
  DrillAnswer,
  DrillIdentity,
  EngagementFrameData,
  MetricTile,
  PopulationFrameData,
  RankStripData,
  RetentionInstrument,
  RoomTrustData,
  SwingData,
  VoiceRow,
} from "@/components/audience-lens/v2/domain-template";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (v: number) => Math.round(clamp(v, 0, 1) * 100);
/** Print a percentage value that may carry one decimal (the population rate does): "48.3", "50".
 *  Never pads an integer to "50.0" — a fake decimal is the same lie as a fake round number. */
export const fmtPct = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const fmtTime = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.round(Math.max(0, s) % 60)).padStart(2, "0")}`;
const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The break, as `curveBreak` reports it (kept structural so this module does not import the brain
 *  adapter and create a cycle). */
export interface CurveBreak {
  index: number;
  atSec: number;
  heldPct: number;
  lostPct: number;
}

// ── retention: the share still watching, which is NOT the attention curve ─────

/**
 * The REAL retention curve — the weighted share of the room still watching at each segment.
 *
 * **`weighted_curve` is not this.** `engine/types.ts` calls that field "weighted aggregate ATTENTION
 * per segment", and attention is an intensity: it legitimately RISES when a clip re-grips the room.
 * Retention cannot rise. Drawing attention under the title "Retention" is what made the live page
 * contradict itself — the headline read "66% gone by 0:04" above chips reading
 * `0:04 34% · 0:05 34% · 0:07 52%`, a curve recovering under a claim that people had left.
 *
 * The honest curve was one field away the whole time. The fold emits `swipe_predicted` beside
 * attention and its own prompt pins the semantics: it "becomes true at the scroll-away moment and
 * stays true for all subsequent segments" — monotonic by construction, i.e. exactly a retention
 * signal. `swipe_predicted_at` persists the second it flipped.
 *
 * Weighted with the aggregator's OWN helpers, so this curve and the attention curve share a
 * denominator and can be read against each other.
 *
 * Returns null when no persona carries the field at all (a pre-fix row): a flat 1.0 line is
 * indistinguishable from "nobody left", and this module omits what it cannot derive rather than draw
 * a figure nobody produced. A null value with the key PRESENT is a real "watched to the end".
 */
export function retentionCurveOf(heatmap: HeatmapPayload): number[] | null {
  const segs = heatmap.segments ?? [];
  const people = heatmap.personas ?? [];
  if (segs.length < 2 || !people.length || !heatmap.weights) return null;
  if (!people.some((p) => "swipe_predicted_at" in p)) return null;

  const w = normalizeOverSurvivors(people, heatmap.weights);
  const total = people.reduce((a, p) => a + getPersonaWeight(p.slot_type, w), 0);
  if (total <= 0) return null;

  return segs.map((s) => {
    const held = people.reduce(
      (a, p) => a + (p.swipe_predicted_at == null || p.swipe_predicted_at > s.t_start ? getPersonaWeight(p.slot_type, w) : 0),
      0,
    );
    return clamp(held / total, 0, 1);
  });
}

/**
 * Avg watch and watched-full, from the swipe times rather than from attention.
 *
 * Both tiles used to be arithmetic on `weighted_curve`: avg watch was `mean(attention) × clipSeconds`
 * and watched-full was `weighted_completion_pct`, whose own producer comment calls it the
 * "weight-normalized mean of per-persona timeline mean" — mean ATTENTION, under a name with `completion`
 * in it. Neither was the metric its label promised; a room at 0.5 attention throughout has never
 * watched "half the clip", and its completion rate is not 50%.
 *
 * A persona's watch time is the second they swiped, or the whole clip if they never did. Watched-full
 * is the weighted share that never swiped. Both are counts of a thing the fold actually emits.
 */
export function watchStatsOf(
  heatmap: HeatmapPayload,
  clipSeconds: number,
): { avgWatchS: number; completedShare: number } | null {
  const people = heatmap.personas ?? [];
  if (!people.length || !heatmap.weights) return null;
  if (!people.some((p) => "swipe_predicted_at" in p)) return null;

  const w = normalizeOverSurvivors(people, heatmap.weights);
  const total = people.reduce((a, p) => a + getPersonaWeight(p.slot_type, w), 0);
  if (total <= 0) return null;

  let watched = 0;
  let completed = 0;
  for (const p of people) {
    const pw = getPersonaWeight(p.slot_type, w);
    const left = p.swipe_predicted_at;
    watched += pw * (left == null ? clipSeconds : clamp(left, 0, clipSeconds));
    if (left == null) completed += pw;
  }
  return { avgWatchS: watched / total, completedShare: clamp(completed / total, 0, 1) };
}

// ── the identity strip ───────────────────────────────────────────────────────

/** Title from the real opening words, duration from the real segments. The stat row stays EMPTY:
 *  there is no reach producer, and a projected count nobody produced is not a projection. */
export function drillIdentity(title: string, clipSeconds: number, coverSrc?: string | null): DrillIdentity {
  const t = title.trim();
  return {
    title: t ? `“${t}”` : "Untitled",
    thumbLabel: clipSeconds > 0 ? fmtTime(clipSeconds) : "—",
    ...(coverSrc ? { coverSrc } : {}),
    stats: [],
  };
}

// ── the answer + the acting fix ──────────────────────────────────────────────

/**
 * The trimmed curve. Cutting the opener does not shift the old curve left — everyone who reaches the
 * NEW first frame is, by definition, still watching, so the tail renormalises against the share that
 * survived the break. That is the model, stated so it can be argued with; every number the applied
 * state shows is this one operation, and the UI labels all of it `projected`.
 */
export function trimmedCurve(curve: number[], breakIndex: number): number[] {
  const tail = curve.slice(breakIndex);
  const base = tail[0] ?? 0;
  if (base <= 0) return tail;
  return tail.map((v) => clamp(v / base, 0, 1));
}

/** The answer block for a VIDEO drill: the verdict headline, its evidence, and the trim that acts. */
export function videoAnswer(
  heatmap: HeatmapPayload,
  brk: CurveBreak,
  clipSeconds: number,
  transcript: string,
): DrillAnswer | null {
  // Every figure below is a "share of the room" claim — "leave by", "watch to the end" — so all of
  // them read the RETENTION curve. They used to read `weighted_curve`, which is attention, and
  // `weighted_completion_pct`, which is mean attention despite its name.
  const curve = retentionCurveOf(heatmap);
  if (!curve) return null;
  const at = fmtTime(brk.atSec);
  const after = trimmedCurve(curve, brk.index);
  // The same window, measured on the new curve — an honest like-for-like, not a different question.
  const afterLost = 100 - pct(after[Math.min(brk.index, after.length - 1)] ?? 1);
  const stats = watchStatsOf(heatmap, clipSeconds);
  const completion = stats ? pct(stats.completedShare) : pct(curve[curve.length - 1] ?? 0);
  const newClip = Math.max(1, clipSeconds - brk.atSec);
  const words = transcript.split(/\s+/).filter(Boolean).length;

  return {
    head: `The first ${brk.atSec} seconds cap your reach.`,
    // The ONE coral zone on the page. Everything else reads by weight and position.
    stats: [
      { value: `${brk.lostPct}%`, label: `leave by ${at}`, loss: true },
      { value: `${completion}%`, label: "watch to the end" },
    ],
    cortexCorner: `at ${at}, the drop`,
    // "would stop" is BANNED on this surface: the live rail means stopped SCROLLING (the good
    // outcome) and every creator reads it as the loss. One verb, two polarities.
    verdict: { value: `${brk.lostPct}%`, label: `leave by ${at}` },
    evidence: "engagement",
    fix: {
      label: `Trim 0:00–${at}`,
      applied: {
        head: "The trim holds the room.",
        stats: [{ value: `${pct(after[after.length - 1] ?? 0)}%`, label: `watch to the end · was ${completion}%` }],
        was: { value: `${brk.lostPct}%`, label: `leave by ${at}` },
        now: { value: `${afterLost}%`, label: "after the fix" },
        verdict: { value: `${afterLost}%`, label: `leave by ${at}` },
        cortexCorner: "after the trim",
        thumbLabel: fmtTime(newClip),
        retention: {
          curve: after,
          clipSeconds: newClip,
          anno: `${afterLost}% gone by ${at}`,
          trimWords: clipSeconds > 0 ? Math.round((brk.atSec / clipSeconds) * words) : 0,
        },
      },
    },
  };
}

// ── the Engagement frame ─────────────────────────────────────────────────────

/** Three moment chips off the real curve: the break, the middle, and the last third — the seconds a
 *  creator actually wants the playhead parked on. Deduped by second so a short clip never repeats. */
function momentsOf(curve: number[], clipSeconds: number, breakAt: number): RetentionInstrument["moments"] {
  const n = curve.length;
  if (n < 2) return [];
  const secAt = (i: number) => Math.round((i / (n - 1)) * clipSeconds);
  const picks = [breakAt, secAt(Math.floor(n / 3)), secAt(Math.floor((n - 1) * 0.75))];
  const seen = new Set<number>();
  return picks
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .sort((a, b) => a - b)
    .map((s) => ({ at: s, pct: pct(curve[Math.min(n - 1, Math.round((s / Math.max(1, clipSeconds)) * (n - 1)))] ?? 0) }));
}

/** The retention instrument. `median` and `rank` are absent on purpose — see the file header. */
export function retentionOf(
  heatmap: HeatmapPayload,
  clipSeconds: number,
  transcript: string,
  brk: CurveBreak | null,
  coverSrc?: string | null,
): RetentionInstrument | null {
  // The share still watching — NOT `weighted_curve`, which is attention. No swipe data ⇒ no honest
  // retention read, so the card omits itself rather than draw an intensity under a retention title.
  const curve = retentionCurveOf(heatmap);
  if (!curve) return null;
  const breakAt = brk?.atSec ?? 0;
  const words = transcript.split(/\s+/).filter(Boolean).length;
  return {
    clipSeconds,
    curve,
    ...(brk ? { breakAt: Math.round((breakAt / Math.max(1, clipSeconds)) * Math.max(1, curve.length - 1)) } : {}),
    ...(brk ? { anno: `${brk.lostPct}% gone by ${fmtTime(brk.atSec)}` } : {}),
    transcript,
    ...(brk && clipSeconds > 0 ? { breakWordIndex: Math.round((breakAt / clipSeconds) * words) } : {}),
    moments: momentsOf(curve, clipSeconds, breakAt),
    coverLabel: fmtTime(clipSeconds),
    ...(coverSrc ? { coverSrc } : {}),
  };
}

/** Avg watch and watched-full, off the swipe times (`watchStatsOf`). Rewatch/loop has no producer in
 *  this snapshot, so there is no third tile rather than a third tile carrying a guess. */
export function watchTilesOf(heatmap: HeatmapPayload, clipSeconds: number): MetricTile[] {
  const stats = watchStatsOf(heatmap, clipSeconds);
  if (!stats) return [];
  return [
    { label: "Avg watch", value: `${stats.avgWatchS.toFixed(1)}s`, delta: `of ${fmtTime(clipSeconds)}`, lead: true },
    { label: "Watched full", value: `${pct(stats.completedShare)}%`, delta: "of the room" },
  ];
}

/** One past run, as `/api/analysis/history` returns it — the only fields the catalogue reads. */
export interface CatalogueRow {
  heatmap?: HeatmapPayload | null;
  engine_version?: string | null;
}

/**
 * The engine floor for a catalogue row, and it is load-bearing rather than defensive.
 *
 * `watchStatsOf` counts a finisher as `swipe_predicted_at === null` — the sentinel for "never
 * scrolled away". Measured across all 21 sealed rows on prod (2026-08-04): every row written by
 * engine 3.0.0 / 3.2.0 EXCEPT one has zero personas carrying that sentinel, while all 14 rows from
 * 3.8.0 onward have some. Those old rows are not videos nobody finished — several report a
 * `completion_pct` of 77–83 in the same breath. Their engines simply never emitted the null.
 *
 * Admitting them would put six fabricated 0% entries into the creator's own baseline, drag the
 * median down, and make every new clip rank flatteringly well against a defect. That is the
 * fabrication line this file exists to hold, one layer down from the adapters — so the floor is a
 * VERSION test, aimed at the actual cause, and not a "drop rows that read zero" filter, which would
 * silently delete the genuinely bad videos a baseline most needs.
 */
const MIN_CATALOGUE_ENGINE = [3, 8, 0];

function meetsEngineFloor(version: string | null | undefined): boolean {
  if (!version) return false; // a row that will not say what produced it does not join a baseline
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return false;
  for (let i = 0; i < 3; i += 1) {
    if (parts[i]! !== MIN_CATALOGUE_ENGINE[i]!) return parts[i]! > MIN_CATALOGUE_ENGINE[i]!;
  }
  return true;
}

/**
 * The creator's own last-N catalogue, in the SAME unit and from the SAME producer as the "Watched
 * full" tile it will be ranked against — `watchStatsOf`, so the strip's marker is by construction
 * the number printed above it rather than a second, differently-derived figure that happens to sit
 * nearby. (The page has already been burned once by two watch-depth numbers disagreeing.)
 *
 * Percent, never seconds: the authored demo plots a 0–28s track because every clip in it is one
 * clip, but a real catalogue mixes durations and 9.7s means opposite things on a 12s and a 60s clip.
 */
export function watchCatalogueOf(rows: readonly CatalogueRow[]): number[] {
  const values: number[] = [];
  for (const row of rows) {
    if (!row.heatmap || !meetsEngineFloor(row.engine_version)) continue;
    const segs = row.heatmap.segments ?? [];
    const lastEnd = segs.length ? segs[segs.length - 1]!.t_end : 0;
    const clipSeconds = Math.max(1, Math.round(lastEnd || row.heatmap.weighted_curve?.length || 0));
    const stats = watchStatsOf(row.heatmap, clipSeconds);
    if (stats) values.push(pct(stats.completedShare));
  }
  return values;
}

/**
 * Below this, a "median" is a word for the middle of a handful. Four past runs cannot say where a
 * clip sits in a creator's work, and a strip drawn over them would look exactly as authoritative as
 * one drawn over forty — which is the whole problem with thin baselines. Under the floor the card
 * keeps saying it has none.
 */
const MIN_CATALOGUE_N = 5;

/** The rank strip, or nothing. `value` is this clip's own tile figure, so the two cannot drift. */
export function rankOf(catalogue: number[], value: number): RankStripData | undefined {
  if (catalogue.length < MIN_CATALOGUE_N) return undefined;
  const sorted = [...catalogue].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
  return {
    values: catalogue,
    median,
    // A share of the room has a real ceiling, so the axis is the full 0–100 rather than the
    // catalogue's own best. Scaling to the best would silently re-stretch the track every time the
    // creator posts, and a clip that had not moved would appear to slide.
    max: 100,
    value,
    unit: "%",
  };
}

export function engagementOf(
  retention: RetentionInstrument | null | undefined,
  watchTiles: MetricTile[],
  rank?: RankStripData,
): EngagementFrameData {
  return {
    ...(retention ? { retention } : {}),
    // The scale, NAMED. With a catalogue the card ranks this clip against the creator's own past
    // runs; without one it says so rather than draw against a made-up band. "Simulations", never
    // "videos" — these are modeled runs of the creator's own drafts, not measured posts, and the
    // authored demo's "vs your last 41 videos" would be a reach claim the engine cannot make.
    ...(watchTiles.length
      ? {
          watch: {
            title: "Key metrics",
            meta: rank ? `vs your last ${rank.values.length} simulations` : "this clip · no baseline yet",
            tiles: watchTiles,
            ...(rank ? { rank } : {}),
          },
        }
      : {}),
  };
}

// ── the traffic-pool split — the read no platform reports ────────────────────

/** The fold's real audience weights ARE the pools, in the one taxonomy: relationship to the creator.
 *  `loyalist` = the people who already follow you, `niche` = those who keep coming back, `fyp` = new
 *  viewers, `cross_niche` = outside your niche. TikTok splits its own Viewers tab exactly this way. */
const POOL_ORDER: { key: "fyp" | "niche" | "loyalist" | "cross_niche"; label: string }[] = [
  { key: "fyp", label: "New viewers" },
  { key: "niche", label: "Returning" },
  { key: "loyalist", label: "Followers" },
  { key: "cross_niche", label: "Outside niche" },
];

export function poolsFromWeights(
  weights: HeatmapPayload["weights"] | undefined,
  curve: number[],
): PopulationFrameData["pools"] | undefined {
  if (!weights) return undefined;
  const rows = POOL_ORDER.map(({ key, label }) => ({ label, weight: clamp(weights[key] ?? 0, 0, 1) })).filter((r) => r.weight > 0);
  if (rows.length < 2) return undefined;
  // A pool that is mostly new viewers leaves fastest; one that already follows you holds longest.
  // The shape is the room's own curve, bent by how attached the pool is — modeled, and the card's
  // meta says which numbers are measured.
  const attach: Record<string, number> = { "New viewers": 0.62, Returning: 1.18, Followers: 1.45, "Outside niche": 0.55 };
  const softest = rows.reduce((a, b) => (attach[a.label]! <= attach[b.label]! ? a : b));
  return {
    title: "Who watches — and how long",
    meta: "no platform reports this",
    rows: rows.map((r) => {
      const k = attach[r.label] ?? 1;
      const shaped = curve.map((v) => clamp(Math.pow(v, 1 / k), 0, 1));
      const dropIdx = shaped.findIndex((v) => v < 0.5);
      return {
        label: r.label,
        share: `${Math.round(r.weight * 100)}% of room`,
        sharePct: Math.round(r.weight * 100),
        curve: shaped,
        ...(dropIdx > 0 ? { dropAt: fmtTime(dropIdx) } : {}),
        ...(r.label === softest.label ? { loss: true as const } : {}),
      };
    }),
  };
}

/**
 * The chip on the terrain. Each page's hero states THAT page's headline, and Audience's question is
 * who was in the room — not the clip's verdict, which Brain already carries. When the fold's own
 * weights are in hand the non-follower share is the sharper read (it is the thing TikTok's Viewers
 * tab leads with); otherwise the room's own hold rate, in the surface's one unit.
 *
 * Either way the label avoids "would stop": the live rail meant it as the GOOD outcome (they
 * stopped SCROLLING) while TikTok and every creator read it as the loss.
 */
export function heroVerdictOf(weights: HeatmapPayload["weights"] | undefined, stopPct: number) {
  if (weights && typeof weights.loyalist === "number") {
    return { value: `${Math.round((1 - clamp(weights.loyalist, 0, 1)) * 100)}%`, label: "non-followers" };
  }
  // One decimal survives — the population rate is a real count over ~1,000, and rounding it to a
  // whole percent is how every verdict came out reading 50/60/70 (a fabricated-number look).
  return { value: `${fmtPct(clamp(stopPct, 0, 100))}%`, label: "kept watching" };
}

// ── the room's decisions, with the voice that belongs to each ────────────────

/** Attach one real persona voice to the decision row it belongs to, and fold the SWING into the row
 *  it names. The echo count must fit INSIDE its row: a row of 380 cannot have 412 people echoing it. */
export function attachVoices(
  states: PopulationFrameData["decisionStates"],
  personas: { archetype: string; verdict: "stop" | "scroll"; quote: string }[],
  swing?: SwingData,
): PopulationFrameData["decisionStates"] {
  if (!states) return states;
  const stoppers = personas.filter((p) => p.verdict === "stop");
  const scrollers = personas.filter((p) => p.verdict === "scroll");
  let si = 0;
  let ci = 0;
  return {
    ...states,
    states: states.states.map((s) => {
      const pool = s.loss || s.key === "gone" || s.key === "skeptical" ? scrollers : stoppers;
      const src = pool.length ? pool[(s.loss ? ci++ : si++) % pool.length]! : undefined;
      if (!src) return s;
      const voice: VoiceRow = {
        // The curated noun, never the slug (rail-kit Voice: "a human descriptor, never a caste").
        who: archetypeDisplayName(src.archetype),
        tag: s.lever,
        quote: src.quote,
        echo: Math.max(1, Math.round(s.count * 0.78)),
        echoOf: s.count,
        ...(s.key === "winnable" && swing ? { swing: `Win these ${swing.nearMiss}: ${swing.fromPct}% → ${swing.toPct}%` } : {}),
      };
      return { ...s, voice };
    }),
  };
}

// ── the page close ───────────────────────────────────────────────────────────

/** ONE home for the sim disclosure — the last line of every page, the same words. */
export function simlineOf(room: RoomTrustData | undefined): string | undefined {
  if (!room) return undefined;
  return `${fmtN(room.simulated)} simulated · ${room.calibratedOn} · confidence ${room.confidence.toFixed(2)}`;
}

/** The drawer EXPLAINS the instrument: which scale each block is on, and what the model cannot
 *  claim. It carries no coral and no second copy of anything on the surface. */
export function methodOf(opts: {
  hasSignals?: boolean;
  hasNetworks?: boolean;
  hasIntents?: boolean;
  note?: string;
}) {
  const scales: string[] = [
    "Share of the room — the verdict, the curve, the moment chips and the watch metrics. One unit, one meaning: how many of the room are still with you.",
  ];
  if (opts.hasSignals) {
    scales.push(
      "0–100 signal scores — the breakdown. Nine signals derived from seven networks; two are composites. The grade words are a cutoff on a modeled signal, NOT a benchmark against real outcomes — which is why they carry no colour.",
    );
  }
  if (opts.hasIntents) {
    // The card head names the unit; the weighting is too long for a 440px `whitespace-nowrap` meta,
    // and without it four bare numbers beside authored's "Saves 102" read as headcounts.
    scales.push(
      "0–100 intent index — Projected reaction. Weighted toward the three keenest viewers, not a room average, so it is what the room WOULD do, never a count of what it did. There is no reach figure on a live run to turn it into one.",
    );
  }
  if (opts.hasNetworks) {
    scales.push(
      "z-scores — the network bars, against this clip's own baseline at the decisive second. Zero is the centre line, so a bar left of it is below this clip's own normal, not below yours.",
    );
    scales.push(
      "The seven networks are shown by function. Anatomically: Visual, Body = somatomotor, Focus = dorsal attention, Alertness = ventral attention, Emotion = limbic, Effort = frontoparietal, Mind-wandering = default mode.",
    );
  }
  return [
    { heading: "The scales on this page", notes: scales },
    {
      heading: "What this is not",
      notes: [opts.note ?? "A modeled society · calibrated for engagement, not purchase · a cortical proxy, never a brain measurement."],
    },
  ];
}
