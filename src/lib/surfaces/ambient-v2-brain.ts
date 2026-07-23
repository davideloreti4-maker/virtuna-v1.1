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
  return {
    cortexSeedKey: input.stimulusKey,
    clipSeconds: clipSecondsOf(input.heatmap),
    stopRatio: clamp(input.stopPct / 100, 0, 1),
    driver: { kind: "attention-scrubber", data: attentionData(input) },
    signals: signalRows(input.videoSignals),
    whyThisSecond: whyThisSecond(input),
    calibrationNote: "Modeled from a cortical proxy · not measured attention",
  };
}

/** Everything `buildVideoDomainTemplate` needs to assemble the Detail drill for a video sim. */
export interface VideoDomainTemplateInput extends BrainSnapshotInput {
  /** The audience-tab population read when it's available (the same sim's projection); else null so
   *  the drill opens on the (real) Brain tab. Mapped separately by `ambient-v2-population.ts`. */
  population?: PopulationFrameData | null;
}

/**
 * Assemble the `DomainTemplate` the Overview→Detail drill renders for a VIDEO sim. `brain` is REAL
 * (from `buildBrainFrameData`); `population` rides along when its producer supplied it, else null (the
 * brain tab is the payoff for a video). The verdict is the sealed measured would-stop %.
 */
export function buildVideoDomainTemplate(input: VideoDomainTemplateInput): DomainTemplate {
  return {
    id: "creator",
    label: "Creator · content",
    backLabel: "Overview",
    pager: input.conceptLabel ?? "video",
    verdict: { value: `${Math.round(input.stopPct)}%`, label: "would stop" },
    brain: buildBrainFrameData(input),
    population: input.population ?? null,
  };
}
