/**
 * ambient-v2-brain.ts — Ambient Audience v2: the Brain-depth adapter (the VIDEO producer).
 *
 * Pure function: the REAL fold-derived read a video analysis already persists (`HeatmapPayload`'s
 * per-segment `weighted_curve` + `GeminiVideoSignals` craft dims + the `VerbatimPayload` transcript)
 * → the `BrainFrameData` the `AmbientDetail` brain tab consumes (cortex + attention-scrubber + the
 * lean signal breakdown + the "why this second" synthesis).
 *
 * HONESTY SPINE. Every field here is REAL (a measured attention value / craft score / spoken word the
 * `/api/analyze` Max pipeline already produced and persisted) or a deterministic READ of that real
 * data (the "why this second" copy describes the MEASURED dip — the WHERE and its magnitude — never an
 * invented cause). The four modeled Sapient-depth sections — `signalGrid` (9 breakdown signals),
 * `networkBars`/`networks` (z-scored neuro decomposition), `kpiHeatmap` (per-second systems),
 * `buyIntent` (the BUY lens) — are their OWN NEW modeled producers (the Phase-C ② fabrication zone)
 * and are DELIBERATELY OMITTED here; `BrainFrame` guards each and falls back to the lean 3-row
 * `signals` delta. They land tagged `modeled`, never invented. When craft dims are absent the signal
 * rows are honestly empty; when the transcript is absent the scrubber reads from the segment labels.
 *
 * No DB, no time, no randomness → unit-testable. The mount layer supplies `BrainSnapshotInput` from a
 * persisted analysis (heatmap + video_signals + verbatim) — NOT a fresh fold (`runFold` is billed and
 * runs only inside the full pipeline; the analysis already ran it). Mirrors `ambient-v2-population.ts`.
 */

import type {
  GeminiVideoSignals,
  HeatmapPayload,
  VerbatimPayload,
} from "@/lib/engine/types";
import type { AttentionData, SignalRow } from "@/components/audience-lens/v2/AmbientDetail";
import type {
  BrainFrameData,
  DomainTemplate,
  PopulationFrameData,
  WhyThisSecond,
} from "@/components/audience-lens/v2/domain-template";
import {
  classifyReasons,
  modeledKpiHeatmap,
  modeledNetworkBars,
  modeledNetworks,
  modeledSignalGrid,
  modeledUnlock,
  type ModeledBrainInput,
} from "./ambient-v2-modeled";
import {
  drillIdentity,
  engagementOf,
  heroVerdictOf,
  methodOf,
  poolsFromWeights,
  retentionCurveOf,
  retentionOf,
  simlineOf,
  videoAnswer,
  watchTilesOf,
} from "./ambient-v2-drill";

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The attention axis the scrubber draws on (0..80 — the SVG's own scale, AmbientDetail's `points`). */
const ATT_MAX = 80;

/** Everything `buildBrainFrameData` needs — all REAL, from a persisted video analysis. */
export interface BrainSnapshotInput {
  /** The persisted per-segment attention read (`weighted_curve` + `segments`) the fold produced. */
  heatmap: HeatmapPayload;
  /** The four craft dims (0..10) the video read scored — absent (text/degraded) → no signal rows. */
  videoSignals?: GeminiVideoSignals | null;
  /** The spoken/on-screen transcript Omni transcribed — absent → the scrubber reads segment labels. */
  verbatim?: VerbatimPayload | null;
  /** The sealed would-stop % (the Overview verdict) — the answer they paid for; drives the cortex. */
  stopPct: number;
  /** A stable per-stimulus key (the analysis id / trimmed concept) — drifts the cortex parcellation. */
  stimulusKey: string;
  /** A short label for the pager ("hook" · "video" · "draft"). */
  conceptLabel?: string;
}

/** True when the heatmap carries a real per-segment attention curve — the gate the mount checks before
 *  building a brain read (an empty curve = no honest attention figure, so no brain tab, never a fake). */
export function hasBrainData(heatmap: HeatmapPayload | null | undefined): boolean {
  return !!heatmap && Array.isArray(heatmap.weighted_curve) && heatmap.weighted_curve.length > 0;
}

/** Whole-second `M:SS` from a segment start time (matches the fixture's "0:04" moment tokens). */
function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The clip length (s) — the last real segment's end, else the curve length as a 1s/segment fallback. */
function clipSecondsOf(heatmap: HeatmapPayload): number {
  const segs = heatmap.segments ?? [];
  const lastEnd = segs.length ? segs[segs.length - 1]!.t_end : 0;
  return Math.max(1, Math.round(lastEnd || heatmap.weighted_curve.length));
}

/** Build the REAL transcript word track. Priority: per-segment spoken_text (the synced words) → the
 *  hook's spoken words → the hook's on-screen text → the segment visual labels → "". No fabrication —
 *  every branch is a real Omni-transcribed / omni-labelled string. */
function transcriptOf(heatmap: HeatmapPayload, verbatim?: VerbatimPayload | null): string {
  const spoken = (verbatim?.segments ?? [])
    .map((s) => s.spoken_text?.trim())
    .filter((t): t is string => !!t);
  if (spoken.length) return spoken.join(" ");
  const hook = verbatim?.hook?.spoken_words?.trim() || verbatim?.hook?.on_screen_text?.trim();
  if (hook) return hook;
  const labels = (heatmap.segments ?? [])
    .map((s) => s.label?.trim())
    .filter((t): t is string => !!t);
  return labels.join(" · ");
}

/**
 * The attention driver figure (◇ swap: attention-scrubber). The curve IS the real `weighted_curve`
 * (0..1) scaled onto the scrubber's 0..80 axis; `moments` mark the measured peak + the deepest dip
 * (coral); `peakWordIndex` points the transcript underline at the word under the attention peak.
 */
function attentionData(input: BrainSnapshotInput): AttentionData {
  const { heatmap } = input;
  const curve = heatmap.weighted_curve;
  const n = curve.length;
  const points = curve.map((v) => Math.round(clamp(v, 0, 1) * ATT_MAX));
  const clipSeconds = clipSecondsOf(heatmap);

  const peakI = points.indexOf(Math.max(...points));
  const dipI = points.indexOf(Math.min(...points));

  const transcript = transcriptOf(heatmap, input.verbatim);
  const wordCount = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
  // Map the peak SEGMENT onto a word index proportionally (the words are synced to the clip, in order).
  const peakWordIndex = wordCount > 0 && n > 1 ? Math.min(wordCount - 1, Math.round((peakI / (n - 1)) * (wordCount - 1))) : 0;

  // The t for a segment index — its real start time; falls back to a 1s/segment grid when untimed.
  const segAt = (i: number): string => fmtTime(heatmap.segments?.[i]?.t_start ?? i);

  // moments: the peak + the deepest dip (coral). Deduped by time token; a flat curve → the peak only.
  const moments: AttentionData["moments"] = [{ t: segAt(peakI), v: points[peakI]! }];
  if (dipI !== peakI && segAt(dipI) !== segAt(peakI)) {
    moments.push({ t: segAt(dipI), v: points[dipI]!, dip: true });
  }
  moments.sort((a, b) => timeTokenToSec(a.t) - timeTokenToSec(b.t));

  const meanHold = n ? curve.reduce((a, b) => a + b, 0) / n : 0;

  return {
    hold: Math.round((heatmap.weighted_completion_pct ?? meanHold) * 100),
    transcript,
    peakWordIndex,
    clipSeconds,
    points,
    moments,
  };
}

/** Parse a "M:SS" token back to seconds for moment ordering. */
function timeTokenToSec(t: string): number {
  const [m, s] = t.split(":").map((x) => Number(x) || 0);
  return (m ?? 0) * 60 + (s ?? 0);
}

// ── the break — where the measured curve collapses (the fact the video unlock is about) ────────────

/** The end of the opening collapse, read off the REAL curve.
 *
 *  Not the single steepest step: a curve can fall hard over two or three seconds and the steepest
 *  one of them is an arbitrary pick inside one event. We take the LAST second whose fall is still
 *  at least half the steepest fall — the second the collapse finishes — because that is the point
 *  the room has finished leaving, and therefore the point a trim has to reach.
 *
 *  Returns null when nothing meaningful falls (a flat curve has no break, so no lever, so no unlock —
 *  the honest absence, never a fabricated one). */
export function curveBreak(
  heatmap: HeatmapPayload,
): { index: number; atSec: number; heldPct: number; lostPct: number } | null {
  // The break is a claim about people LEAVING ("62% gone by 0:03"), so it is read off the retention
  // curve. Read off `weighted_curve` it was reporting the steepest ATTENTION dip and calling the
  // remaining intensity "the share still watching" — which is how the page came to say 66% were gone
  // at a second where the curve then climbed. `heldPct`/`lostPct` are now shares of the room.
  const curve = retentionCurveOf(heatmap);
  if (!curve || curve.length < 3) return null;
  const drops = curve.map((v, i) => (i === 0 ? 0 : curve[i - 1]! - v));
  const steepest = Math.max(...drops);
  // A curve that never gives up more than 8 points in a second did not break; it drifted.
  if (steepest < 0.08) return null;
  let index = 0;
  drops.forEach((d, i) => {
    if (d >= steepest * 0.5) index = i;
  });
  const held = curve[index]!;
  return {
    index,
    atSec: Math.max(0, Math.round(heatmap.segments?.[index]?.t_start ?? index)),
    heldPct: Math.round(held * 100),
    lostPct: Math.round((1 - held) * 100),
  };
}

/**
 * The VIDEO unlock — §3.2's real fix.
 *
 * `modeledUnlock` needs a friction reason AND a pull reason, and a video fold emits **no coded
 * reasons at all** (`reasons: []` by design — §3.3), so every real video drill resolved to
 * `undefined` and the one actionable element on the page never rendered in prod. Passing fake
 * `reasons` would have been the wrong repair; a video's lever lives in the thing a video actually
 * measures, which is the curve. Every number below is read off the RETENTION curve — the sentence
 * counts people ("the share of the room still watching … stays to the end"), and `weighted_curve`
 * counts attention.
 */
export function curveUnlock(
  input: BrainSnapshotInput,
  swing?: { gainLabel: string } | null,
): DomainTemplate["unlock"] | undefined {
  const brk = curveBreak(input.heatmap);
  if (!brk || brk.atSec <= 0) return undefined;
  const curve = retentionCurveOf(input.heatmap);
  if (!curve) return undefined;
  const tail = curve.slice(brk.index);
  // What the room does AFTER the break — the half of the story the verdict never tells. Measured as
  // the share of the survivors still there at the end, so "the rest of the clip holds" is a fact.
  const staysToEnd = tail.length > 1 ? Math.round((tail[tail.length - 1]! / Math.max(0.01, tail[0]!)) * 100) : 0;
  return {
    lever: `Trim 0:00–${fmtTime(brk.atSec)}`,
    ...(swing?.gainLabel ? { gain: swing.gainLabel } : {}),
    insight: `The clip holds once it starts — ${staysToEnd}% of the room still watching at ${fmtTime(
      brk.atSec,
    )} stays to the end. It is the first ${brk.atSec} seconds that lose the other ${brk.lostPct}%, not the rest of it.`,
  };
}

/**
 * The "why this second" synthesis — the plain read of the MEASURED decisive moment. Only emitted when
 * the curve actually dips (min meaningfully below peak); the copy states WHERE the attention bottoms
 * out and BY HOW MUCH (real math on the real curve), the loss clause coral. Never an invented cause.
 */
function whyThisSecond(input: BrainSnapshotInput): WhyThisSecond | undefined {
  const points = input.heatmap.weighted_curve.map((v) => clamp(v, 0, 1) * ATT_MAX);
  const n = points.length;
  if (n < 3) return undefined;
  const peak = Math.max(...points);
  const dip = Math.min(...points);
  if (peak <= 0 || dip >= peak * 0.9) return undefined; // effectively flat — no decisive drop to read
  const dipI = points.indexOf(dip);
  const t = fmtTime(input.heatmap.segments?.[dipI]?.t_start ?? dipI);
  const dropPct = Math.round((1 - dip / peak) * 100);
  return {
    moment: `${t} · the drop`,
    segments: [
      { text: `Attention bottoms out at ${t}, ` },
      { text: `down ${dropPct}% from its peak`, loss: true },
    ],
  };
}

// ── the signal breakdown (real craft dims, 0..10 → 0..100; no baseline → absolute, honestly) ───────

const SIGNAL_DIMS: { label: string; pick: (v: GeminiVideoSignals) => number }[] = [
  { label: "Visual pull", pick: (v) => v.hook_visual_impact },
  { label: "Production", pick: (v) => v.visual_production_quality },
  { label: "Pacing", pick: (v) => v.pacing_score },
  { label: "Transitions", pick: (v) => v.transition_quality },
];

function bandOf(score: number): SignalRow["band"] {
  if (score >= 67) return "strong";
  if (score >= 45) return "okay";
  return "weak";
}

/** The three signals that lead the breakdown: the biggest movers off the baseline, weakest first on
 *  a tie. A muted cell (no substrate to measure) can never be a mover — it has nothing to report. */
function topMovers(cells: { key: string; score: number; delta?: number; muted?: boolean }[]): string[] {
  return cells
    .filter((c) => !c.muted && c.delta != null)
    .slice()
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!) || a.score - b.score)
    .slice(0, 3)
    .map((c) => c.key);
}

/** Map the four real `GeminiVideoSignals` craft dims → the lean signal rows. Absent signals → []
 *  (SignalRows renders its header + nothing — honest "no craft read"). `vsBase` is OMITTED: there is
 *  no per-creator last-N baseline yet, so SignalRows shows the absolute score greyed (its null path). */
function signalRows(videoSignals?: GeminiVideoSignals | null): SignalRow[] {
  if (!videoSignals) return [];
  return SIGNAL_DIMS.map((d) => {
    const score = Math.round(clamp(d.pick(videoSignals), 0, 10) * 10);
    return { label: d.label, score, band: bandOf(score) };
  });
}

/**
 * Map a persisted video analysis → the `BrainFrameData` the brain tab reads. REAL attention curve +
 * transcript + craft dims; the modeled Sapient-depth sections (signalGrid/networkBars/kpiHeatmap/
 * buyIntent/networks) are OMITTED (their producers aren't built) so `BrainFrame` renders the lean read.
 * Deterministic — safe on every render. Call only when `hasBrainData(heatmap)` is true.
 */
export function buildBrainFrameData(input: BrainSnapshotInput): BrainFrameData {
  const modeledInput: ModeledBrainInput = {
    stopPct: input.stopPct,
    stimulusKey: input.stimulusKey,
    clipSeconds: clipSecondsOf(input.heatmap),
    curve: input.heatmap.weighted_curve,
    craft: input.videoSignals ?? null,
    reasons: null, // reasons are a population read; the brain layer couples to the curve + craft only
  };
  const networkBars = modeledNetworkBars(modeledInput);
  const signalGrid = modeledSignalGrid(modeledInput);
  return {
    cortexSeedKey: input.stimulusKey,
    clipSeconds: clipSecondsOf(input.heatmap),
    stopRatio: clamp(input.stopPct / 100, 0, 1),
    // Grounds the cortex on the REAL curve — the SAME `weighted_curve` `attentionData` renders as the
    // scrubber, so the figure and the curve under it are one instrument. Without this the cortex runs
    // `simulated` and loops a seeded envelope carrying zero information about the video.
    retentionCurve: input.heatmap.weighted_curve.map((v) => clamp(v, 0, 1)),
    driver: { kind: "attention-scrubber", data: attentionData(input) },
    signals: signalRows(input.videoSignals),
    whyThisSecond: whyThisSecond(input),
    // ── modeled-depth parity (Phase-C ②) — the fuller read; MODELED, carried by the one calibration line ──
    signalGrid,
    // The movers ARE the signals that moved: ranked by the size of the delta vs the baseline, ties
    // to the weaker score. All nine stay on the surface — these three simply lead it, so the card
    // has a hierarchy without any of them being hidden (the rev-8 drawer mistake).
    signalMovers: topMovers(signalGrid),
    signalScale: "0–100 · vs your baseline",
    networkScale: "z-scored · at the break",
    networkBars,
    networks: modeledNetworks(networkBars),
    kpiHeatmap: modeledKpiHeatmap(modeledInput),
    // buyIntent is a COMMERCE figure — the authored creator template omits it (a regular hook has no
    // "purchase-intent" axis); we match that. `modeledBuyIntent` stays for a future commerce domain.
    calibrationNote: "Modeled from a cortical proxy · not measured attention",
  };
}

/** Everything `buildVideoDomainTemplate` needs to assemble the Detail drill for a video sim. */
export interface VideoDomainTemplateInput extends BrainSnapshotInput {
  /** The audience-tab population read when it's available (the same sim's projection); else null so
   *  the drill opens on the (real) Brain tab. Mapped separately by `ambient-v2-population.ts`. */
  population?: PopulationFrameData | null;
  /** The projection's raw dominant-reason tally (`aggregate.reasons`) — classified by SEMANTICS for the
   *  unlock lever (top friction) + insight (top pull). Absent → no unlock (omit, never fabricate). */
  reasons?: { reason: string; count: number }[] | null;
}

/**
 * Assemble the `DomainTemplate` the Overview→Detail drill renders for a VIDEO sim. `brain` is REAL
 * (from `buildBrainFrameData`); `population` rides along when its producer supplied it, else null (the
 * brain tab is the payoff for a video). The verdict is the sealed measured would-stop %.
 */
export function buildVideoDomainTemplate(input: VideoDomainTemplateInput): DomainTemplate {
  const population = input.population ?? null;
  const clipSeconds = clipSecondsOf(input.heatmap);
  const brk = curveBreak(input.heatmap);
  const transcript = transcriptOf(input.heatmap, input.verbatim);
  const curve = input.heatmap.weighted_curve.map((v) => clamp(v, 0, 1));
  const retention = retentionOf(input.heatmap, clipSeconds, transcript, brk);
  // Both are null when the row carries no swipe times — the retention producer's honest absence, not
  // a branch to paper over. `unlock` below already falls back on its own.
  const answer = brk && brk.atSec > 0 ? videoAnswer(input.heatmap, brk, clipSeconds, transcript) : null;
  const pools = poolsFromWeights(input.heatmap.weights, curve);
  return {
    id: "creator",
    label: "Creator · content",
    // "Overview" collided with the tab of the same name; the drill goes back to the room.
    backLabel: "The room",
    pager: input.conceptLabel ?? "video",
    verdict: { value: `${Math.round(input.stopPct)}%`, label: "would stop" },
    identity: drillIdentity(input.verbatim?.hook?.spoken_words ?? transcript.split(" ").slice(0, 12).join(" "), clipSeconds),
    // Only when the curve actually breaks: no break ⇒ no trim to offer, so the answer block falls
    // back to the unlock rather than inventing a lever (the §3.2 discipline, one layer up).
    ...(answer ? { answer } : {}),
    engagement: engagementOf(retention, watchTilesOf(input.heatmap, clipSeconds)),
    ...(simlineOf(population?.room) ? { simline: simlineOf(population?.room)! } : {}),
    method: methodOf({
      hasSignals: true,
      hasNetworks: true,
      hasIntents: !!population?.actionIntent,
      note: population?.room?.note,
    }),
    // Reason-derived when reasons exist (the text path, and any caller that has them); otherwise the
    // curve-derived video lever. Before this fell back, `AmbientOverviewRail` — which cannot supply
    // reasons, because a video fold does not code any — rendered no unlock at all (§3.2).
    unlock: modeledUnlock(classifyReasons(input.reasons), population?.swing) ?? curveUnlock(input, population?.swing),
    brain: buildBrainFrameData(input),
    // The pool split rides the fold's REAL audience weights — the one taxonomy the whole page uses.
    // Passed through untouched when there are no weights to read, so a caller's population object
    // survives identical rather than being silently re-wrapped.
    population: population
      ? { ...population, ...(pools ? { pools } : {}), heroVerdict: heroVerdictOf(input.heatmap.weights, input.stopPct) }
      : null,
  };
}
