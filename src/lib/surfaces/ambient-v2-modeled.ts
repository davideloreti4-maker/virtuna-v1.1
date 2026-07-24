/**
 * ambient-v2-modeled.ts — Ambient Audience v2: the MODELED-depth producers (the Phase-C ② zone).
 *
 * Pure, deterministic proxies for the fuller Brain + Population sections whose real producers don't
 * exist yet (the nine-signal decomposition · the z-scored neuro networks · the per-second KPI heatmap ·
 * the buy-intent lens · the targeting/amplification/swing reads · the cheat-code unlock). Each is
 * derived from the REAL data a sim already has — the sealed stop rate, the fold's attention curve, the
 * craft dims, the real segment stop rates, the real coded reasons — and NEVER invented from nothing.
 *
 * HONESTY SPINE. These figures are MODELED, not measured. There is one consolidated calibration line at
 * the bottom of each tab (owner call 2026-07-24: single line, no per-section chips) that states plainly
 * "modeled proxy · not measured". This module's job is to make video AND text render the SAME complete
 * instrument; the honesty is carried by that one line, not by omission. No DB, no time, no `Math.random`
 * (a string-seeded LCG keeps every proxy byte-identical on server & client) → fully unit-testable.
 */

import type { GeminiVideoSignals } from "@/lib/engine/types";
import type { PopulationAggregate } from "@/lib/audience/population";
import type { AttentionData, NetworkRow } from "@/components/audience-lens/v2/AmbientDetail";
import type {
  AmplificationData,
  AudienceFitData,
  BuyIntentData,
  DecisionStatesData,
  DomainTemplate,
  KpiHeatmapData,
  NetworkBar,
  SignalCell,
  SwingData,
} from "@/components/audience-lens/v2/domain-template";

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** FNV-1a string hash → a stable 32-bit seed (so the same stimulus always yields the same proxies). */
function hashSeed(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A seeded LCG — deterministic pseudo-randomness (no `Math.random`, safe for SSR hydration parity). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Whole-second `M:SS` (matches the scrubber's moment tokens). */
function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── shared inputs ──────────────────────────────────────────────────────────────

/** A reason the model already classified (real label + real count + whether it's a friction/loss). */
export interface ModeledReason {
  label: string;
  count: number;
  loss?: boolean;
}

/** The canonical polarity map for the population math's dominant-reason tokens (pStop's `why`). Two pull
 *  reasons stay cream; the four friction reasons ride `loss` (coral). Single source of truth — both the
 *  text reason-breakdown and the unlock classify through this, so they never drift. */
export const REASON_POLARITY: Record<string, { label: string; loss?: boolean }> = {
  interest: { label: "On-topic interest" },
  "strong-hook": { label: "Strong hook" },
  "weak-hook": { label: "Weak hook", loss: true },
  "novelty-mismatch": { label: "Novelty mismatch", loss: true },
  "hype-vs-skeptic": { label: "Hype vs skepticism", loss: true },
  "too-slow": { label: "Too slow", loss: true },
};

/** Humanize a single dominant-reason token (unknown → title-cased). */
export function humanizeReason(token: string): { label: string; loss?: boolean } {
  return (
    REASON_POLARITY[token] ?? {
      label: token.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    }
  );
}

/** Classify the projection's raw dominant-reason tally (tokens + counts) → labelled, polarity-tagged
 *  reasons. This is the honest loss classifier — friction reasons ride `loss` by SEMANTICS, never by the
 *  cosmetic exemplar-persona verdict the voices cast uses. */
export function classifyReasons(raw: { reason: string; count: number }[] | null | undefined): ModeledReason[] {
  return (raw ?? []).map((r) => {
    const h = humanizeReason(r.reason.trim().toLowerCase().replace(/\s+/g, "-"));
    return { label: h.label, count: r.count, ...(h.loss ? { loss: true as const } : {}) };
  });
}

/** Everything the modeled BRAIN producers read — all REAL, some optional (text has fewer substrates). */
export interface ModeledBrainInput {
  /** The sealed would-stop % (0..100) — the answer they paid for; the spine every proxy couples to. */
  stopPct: number;
  /** A stable per-stimulus key — seeds every deterministic proxy. */
  stimulusKey: string;
  /** The clip length in whole seconds (video) / a nominal proxy duration (text). */
  clipSeconds: number;
  /** The fold's real attention curve (0..1), when a video produced one — else the proxy self-seeds. */
  curve?: number[] | null;
  /** The four real craft dims (0..10), when a video scored them — anchors the Visual/Grip signals. */
  craft?: GeminiVideoSignals | null;
  /** The real coded reasons (label + count + loss), when the population produced them. */
  reasons?: ModeledReason[] | null;
  /** A TEXT sim has no video substrate → the visual-only reads (Visual/Audio/Face KPI rows, the Visual
   *  Pull signal cell) are greyed rather than presented as measured. Video leaves this false. */
  mutedSensory?: boolean;
}

// ── ① the nine-signal decomposition ─────────────────────────────────────────────

type Band = "weak" | "okay" | "strong";
const bandOf = (v: number): Band => (v >= 67 ? "strong" : v >= 45 ? "okay" : "weak");
const WORD: Record<Band, string> = { weak: "Weakness", okay: "Okay", strong: "Strong" };

const GRID_DIMS: {
  key: string;
  label: string;
  couple: number; // how the dim tracks the stop rate (signed); risk/effort invert
  craft?: (c: GeminiVideoSignals) => number; // a real craft dim to anchor on (0..10), when present
  invert?: boolean; // score semantics inverted (low = good): hesitation/risk
  frag: string; // the honest "why this score" body (modeled from the stop rate)
}[] = [
  { key: "visual", label: "Visual Pull", couple: 0.3, craft: (c) => c.hook_visual_impact, frag: "the opening frame's pull" },
  { key: "voice", label: "Voice Impact", couple: 0.4, frag: "how the delivery lands" },
  { key: "grip", label: "Cognitive Grip", couple: 0.5, craft: (c) => c.pacing_score, frag: "how tightly focus holds" },
  { key: "emotion", label: "Emotional Hit", couple: 0.8, frag: "the felt stake" },
  { key: "memory", label: "Memorability", couple: 0.4, frag: "what sticks after" },
  { key: "attention", label: "Attention", couple: 0.9, frag: "how long the room stays" },
  { key: "buy", label: "Buy Signal", couple: 0.7, frag: "the pull toward acting" },
  { key: "risk", label: "Hesitation / Risk", couple: -0.8, invert: true, frag: "how much resistance fires" },
  { key: "effort", label: "Mental Effort", couple: -0.3, invert: true, frag: "how hard it is to follow" },
];

/** Nine modeled breakdown signals, coupled to the real stop rate (+ real craft dims / reason mix where
 *  present). Deterministic per stimulus. The scores are MODELED — the tab's one calibration line says so. */
export function modeledSignalGrid(input: ModeledBrainInput): SignalCell[] {
  const rnd = lcg(hashSeed(`grid:${input.stimulusKey}`));
  const dev = clamp(input.stopPct / 100, 0, 1) - 0.5;
  const reasons = input.reasons ?? [];
  const total = Math.max(1, reasons.reduce((a, r) => a + r.count, 0));
  const lossShare = reasons.filter((r) => r.loss).reduce((a, r) => a + r.count, 0) / total;
  const pullShare = reasons.filter((r) => !r.loss).reduce((a, r) => a + r.count, 0) / total;

  return GRID_DIMS.map((d) => {
    // a stable per-dim CHARACTER (±22) spreads the nine into a real weak/okay/strong story instead of
    // clustering flat at ~50 when the stop rate sits near the middle; the stop rate sets the DIRECTION.
    const character = (rnd() - 0.5) * 44;
    let score = 52 + d.couple * dev * 90 + character;
    if (d.craft && input.craft) score = score * 0.35 + clamp(d.craft(input.craft), 0, 10) * 10 * 0.65;
    if (d.key === "attention" || d.key === "visual") score -= lossShare * 18;
    if (d.key === "emotion" || d.key === "memory") score += pullShare * 12;
    score = clamp(Math.round(score), 6, 96);
    const good = d.invert ? 100 - score : score;
    const tone = bandOf(good);
    const delta = Math.round((rnd() - 0.4) * 30);
    const toneLead = tone === "strong" ? "A strength" : tone === "weak" ? "A weak point" : "Middling";
    const anchor = d.craft && input.craft ? " (anchored on the measured craft read)" : "";
    // a text sim has no video → the Visual Pull read is greyed (nothing to see)
    const muted = input.mutedSensory && d.key === "visual";
    return {
      key: d.key,
      label: d.label,
      score,
      word: WORD[tone],
      tone,
      delta,
      whyScore: muted
        ? "No visual substrate — a text concept has no opening frame to read."
        : `${toneLead} — modeled from ${d.frag} at a ${Math.round(input.stopPct)}% stop rate${anchor}.`,
      ...(muted ? { muted: true as const } : {}),
    };
  });
}

// ── ② the z-scored neuro networks ───────────────────────────────────────────────

const YEO7 = ["Visual", "Somatomotor", "Dorsal Attention", "Ventral Attention", "Limbic", "Frontoparietal", "Default Mode"];

function zBand(z: number): string {
  if (z >= 1) return "clearly above";
  if (z >= 0.35) return "slightly above";
  if (z <= -1) return "clearly below";
  if (z <= -0.35) return "slightly below";
  return "about normal";
}

/** Seven modeled network z-scores at the decisive moment. Attention networks ride the stop rate (a
 *  thin room = attention below baseline); Limbic tracks the felt stake. Deterministic, modeled. */
export function modeledNetworkBars(input: ModeledBrainInput): NetworkBar[] {
  const rnd = lcg(hashSeed(`net:${input.stimulusKey}`));
  const dev = clamp(input.stopPct / 100, 0, 1) - 0.5;
  const bias: Record<string, number> = {
    "Dorsal Attention": dev * 2.2,
    "Ventral Attention": dev * 1.8,
    Limbic: dev * 1.0,
    "Default Mode": -dev * 0.8, // mind-wandering rises as the room thins
  };
  const rows: NetworkBar[] = YEO7.map((label) => {
    const z = Math.round(((rnd() - 0.5) * 1.4 + (bias[label] ?? 0)) * 100) / 100;
    return { label, z, band: zBand(z) };
  });
  // the loudest loss = the most-below attention network, only when the room is under-holding
  if (dev < 0.05) {
    const attn = rows.filter((r) => r.label.includes("Attention")).sort((a, b) => a.z - b.z)[0];
    if (attn) attn.loss = true;
  }
  return rows;
}

const NET_READ: { label: string; from: string }[] = [
  { label: "Focus", from: "Dorsal Attention" },
  { label: "Memory", from: "Default Mode" },
  { label: "Emotion", from: "Limbic" },
  { label: "Visual", from: "Visual" },
];

function plainRead(label: string, z: number): string {
  if (z <= -0.8) return label === "Focus" ? "scattered — won't lock on" : "flat, nothing to grab";
  if (z <= -0.35) return "running slightly below";
  if (z >= 0.8) return label === "Emotion" ? "a real lift" : "holding strong";
  if (z >= 0.35) return "a mild lift";
  return "about normal";
}

/** Four plain-word network rows (the σ receipts, translated) — derived from the same modeled z-scores. */
export function modeledNetworks(bars: NetworkBar[]): NetworkRow[] {
  const byLabel = new Map(bars.map((b) => [b.label, b]));
  return NET_READ.map(({ label, from }) => {
    const z = byLabel.get(from)?.z ?? 0;
    return { label, z, read: plainRead(label, z), ...(z <= -0.8 ? { loss: true as const } : {}) };
  });
}

// ── ③ the per-second KPI heatmap ─────────────────────────────────────────────────

const KPI_LABELS = ["Visual", "Audio", "Face", "Text", "Language", "Effort", "Reward", "Affect", "Story", "Surprise"];
/** The sensory-input systems — measurable only from a video's frames/audio. On a text sim they're greyed. */
const KPI_SENSORY = new Set(["Visual", "Audio", "Face"]);

/** Interpolate the real curve (0..1, n points) onto second `i` of `seconds`. */
function curveAt(curve: number[], i: number, seconds: number): number {
  const n = curve.length;
  if (n === 0) return 0.5;
  if (n === 1) return curve[0]!;
  const idx = clamp(Math.round((i / Math.max(1, seconds - 1)) * (n - 1)), 0, n - 1);
  return curve[idx]!;
}

/** Ten decoded systems × one intensity per second. When a real curve exists the grid tracks it (video);
 *  otherwise it self-seeds into a structured wave (text). Modeled per-second activation. */
export function modeledKpiHeatmap(input: ModeledBrainInput): KpiHeatmapData {
  const seconds = clamp(Math.round(input.clipSeconds), 3, 24);
  const curve = input.curve ?? null;
  const rows = KPI_LABELS.map((label, r) => {
    const rnd = lcg(hashSeed(`kpi:${input.stimulusKey}:${r}`));
    const values = Array.from({ length: seconds }, (_, i) => {
      const base = curve ? clamp(curveAt(curve, i, seconds) * 100, 6, 100) : 55;
      const wave = 52 + 26 * Math.sin(i * 0.7 + r * 0.9);
      const v = base * 0.55 + wave * 0.45 + (rnd() - 0.5) * 18;
      return clamp(Math.round(v), 6, 100);
    });
    const muted = input.mutedSensory && KPI_SENSORY.has(label);
    return { label, values, ...(muted ? { muted: true as const } : {}) };
  });
  return { seconds, rows };
}

// ── the text retention driver (a MODELED reading-attention curve) ──────────────────

const ATT_MAX = 80; // the scrubber's own 0..80 attention axis (AmbientDetail's `points`)

/** A MODELED reading-retention curve for a TEXT sim — the same attention-scrubber the video draws, but
 *  the curve is a deterministic proxy (text has no measured attention timeline), seeded from the stop
 *  rate + friction mix. The transcript is the REAL concept text; `peakWordIndex` underlines the word at
 *  the retention peak. Honesty rides on the tab's single calibration line (owner call 2026-07-24). */
export function modeledAttentionData(input: ModeledBrainInput, transcript: string): AttentionData {
  const rnd = lcg(hashSeed(`att:${input.stimulusKey}`));
  const seconds = clamp(Math.round(input.clipSeconds), 4, 12);
  const anchor = clamp(input.stopPct / 100, 0, 1);
  const reasons = input.reasons ?? [];
  const total = Math.max(1, reasons.reduce((a, r) => a + r.count, 0));
  const lossShare = reasons.filter((r) => r.loss).reduce((a, r) => a + r.count, 0) / total;

  // a retention shape: a strong open, a mid-clip trough (deepened by the friction share), a partial
  // recover toward the payoff — all modeled, no measured attention behind it.
  const points = Array.from({ length: seconds }, (_, i) => {
    const p = seconds > 1 ? i / (seconds - 1) : 0;
    const decay = 1 - 0.32 * p;
    const trough = -0.34 * Math.exp(-Math.pow((p - 0.44) / 0.18, 2)) * (0.6 + lossShare);
    const base = clamp(0.42 + anchor * 0.42 + (decay - 1) * 0.5 + trough, 0.12, 0.98);
    return clamp(Math.round((base + (rnd() - 0.5) * 0.08) * ATT_MAX), 6, ATT_MAX);
  });

  const peakI = points.indexOf(Math.max(...points));
  const dipI = points.indexOf(Math.min(...points));
  const words = transcript ? transcript.split(/\s+/).filter(Boolean) : [];
  const wc = words.length;
  const peakWordIndex = wc > 0 && seconds > 1 ? Math.min(wc - 1, Math.round((peakI / (seconds - 1)) * (wc - 1))) : 0;
  const segAt = (i: number) => fmtTime(seconds > 1 ? (i / (seconds - 1)) * input.clipSeconds : 0);

  const moments: AttentionData["moments"] = [{ t: segAt(peakI), v: points[peakI]! }];
  if (dipI !== peakI && segAt(dipI) !== segAt(peakI)) {
    moments.push({ t: segAt(dipI), v: points[dipI]!, dip: true });
  }
  moments.sort((a, b) => {
    const s = (t: string) => t.split(":").reduce((acc, x) => acc * 60 + (Number(x) || 0), 0);
    return s(a.t) - s(b.t);
  });

  return { hold: Math.round(anchor * 100), transcript, peakWordIndex, clipSeconds: input.clipSeconds, points, moments };
}

// ── ④ the buy-intent lens ────────────────────────────────────────────────────────

/** A modeled buy-intent curve over the clip — tracks attention (lagged) when a curve exists, else
 *  self-seeds around the stop rate. The caption states plainly it is a modeled lens, not a purchase. */
export function modeledBuyIntent(input: ModeledBrainInput): BuyIntentData {
  const seconds = clamp(Math.round(input.clipSeconds), 3, 24);
  const rnd = lcg(hashSeed(`buy:${input.stimulusKey}`));
  const curve = input.curve ?? null;
  const anchor = clamp(input.stopPct / 100, 0, 1);
  const points = Array.from({ length: seconds }, (_, i) => {
    const base = curve ? curveAt(curve, i, seconds) : anchor;
    return clamp(Math.round(base * 80 + anchor * 15 + (rnd() - 0.5) * 20), 4, 100);
  });
  const threshold = Math.round(points.reduce((a, b) => a + b, 0) / points.length);
  const abovePct = Math.round((points.filter((p) => p > threshold).length / points.length) * 100);
  const peaks = points
    .map((v, i) => ({ t: fmtTime(i), v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .sort((a, b) => a.t.localeCompare(b.t));
  return {
    points,
    threshold,
    abovePct,
    peaks,
    caption: "A modeled buy-intent lens · not a measured purchase signal.",
  };
}

// ── the cheat-code unlock (real reason labels → a lever) ──────────────────────────

/** The unlock — a specific lever (the top friction reason), a modeled gain (the swing move), and the
 *  counterintuitive read (the top pull already works; it's the friction that leaks). Real reason labels;
 *  emitted only when both a pull and a loss reason exist. */
export function modeledUnlock(
  reasons: ModeledReason[] | null | undefined,
  swing?: SwingData | null,
): DomainTemplate["unlock"] | undefined {
  const rs = reasons ?? [];
  const loss = rs.filter((r) => r.loss).sort((a, b) => b.count - a.count)[0];
  const pull = rs.filter((r) => !r.loss).sort((a, b) => b.count - a.count)[0];
  if (!loss || !pull) return undefined;
  return {
    lever: `Fix ${loss.label.toLowerCase()}`,
    gain: swing?.gainLabel,
    insight: `${pull.label} already works — ${pull.count} stayed for it. It's ${loss.label.toLowerCase()} that loses the ${loss.count}, not the idea itself.`,
  };
}

// ── population depth: targeting · amplification · swing ────────────────────────────

/** Who this is for — each real segment's stop rate recast as an over/under-index vs the room mean.
 *  The baseline is the sim's OWN average (honest: no per-creator last-N history exists yet). */
export function modeledAudienceFit(agg: PopulationAggregate): AudienceFitData | undefined {
  const segs = agg.segments;
  if (segs.length < 2) return undefined;
  const mean = Math.max(1, agg.stopPct);
  const rows: AudienceFitData["rows"] = segs
    .map((s) => ({ label: s.displayName, index: Math.round(((s.stopPct - mean) / mean) * 100) }))
    .sort((a, b) => b.index - a.index);
  const low = rows[rows.length - 1]!;
  if (low.index < 0) low.loss = true as const;
  const top = rows[0]!;
  return {
    baseline: "vs the room average",
    rows,
    read: `This over-indexes with ${top.label} and cools on ${low.label} — a narrower, higher-intent cut than a broad reach.`,
  };
}

/** Modeled reshare propensity per archetype (×) — the priors the cascade rides. */
const RESHARE_PRIOR: Record<string, number> = { builder: 3.2, "drop-in": 1.4, scroller: 0.7, skeptic: 0.3 };
const priorOf = (archetype: string): number => RESHARE_PRIOR[archetype] ?? 1.0;

/** Who spreads it · how far — real segment sizes × modeled reshare priors → a cascade + carrier list. */
export function modeledAmplification(agg: PopulationAggregate): AmplificationData | undefined {
  const segs = agg.segments;
  if (segs.length === 0) return undefined;
  const carriers: AmplificationData["carriers"] = segs
    .map((s) => ({ label: s.displayName, factor: priorOf(s.archetype) }))
    .sort((a, b) => b.factor - a.factor);
  const lead = carriers[0]!;
  lead.lead = true as const;
  const weighted = segs.reduce((a, s) => a + s.share * priorOf(s.archetype), 0);
  const reachMultiplier = Math.round(clamp(1 + weighted * 3, 1.2, 12) * 10) / 10;
  const reached = Math.round(agg.total * reachMultiplier);
  const reshared = Math.round(agg.total * clamp(weighted * 0.14, 0.03, 0.4));
  return {
    reachMultiplier,
    reached,
    cascade: [
      { label: "saw it", count: agg.total },
      { label: "reshared", count: reshared },
      { label: "their networks", count: reached },
    ],
    carriers,
    read: `Reach rides on ${lead.label} resharing — win one more ${lead.label} cohort and the second ring widens.`,
  };
}

/** The room, by behaviour — an HONEST partition of the whole society by what each viewer DID with the
 *  content on the feed. `Stopped` = the stoppers (the hook caught them). The scrollers split by how
 *  close they came: the fence segment's non-stoppers `Almost` stopped (the swing), the lowest-stop
 *  segment `Not for them` (wrong fit), the rest `Scrolled past` (never caught — the definitive loss,
 *  coral). The four counts sum to the room. Levers ride the real reason mix (kept for a future read).
 *  Content + human-behaviour framing, not a sales funnel. */
export function modeledDecisionStates(
  agg: PopulationAggregate,
  reasons?: ModeledReason[] | null,
): DecisionStatesData | undefined {
  const segs = agg.segments;
  if (segs.length < 2) return undefined;
  const total = agg.total;
  const stopped = agg.stop;
  // the lowest-stop segment → its non-stoppers are the wrong-fit "not for them"; the non-loss segment
  // closest to the 50% line → its non-stoppers "almost" stopped (distinct segments by construction).
  const loss = segs.slice().sort((a, b) => a.stopPct - b.stopPct)[0]!;
  const fence =
    segs
      .slice()
      .sort((a, b) => Math.abs(a.stopPct - 50) - Math.abs(b.stopPct - 50))
      .find((s) => s.displayName !== loss.displayName) ?? loss;
  const almost = Math.max(0, fence.total - fence.stop);
  const wrongFit = fence.displayName === loss.displayName ? 0 : Math.max(0, loss.total - loss.stop);
  const scrolled = Math.max(0, agg.scroll - almost - wrongFit);

  const rs = reasons ?? [];
  const pull = rs.filter((r) => !r.loss).sort((a, b) => b.count - a.count)[0];
  const friction = rs.filter((r) => r.loss).sort((a, b) => b.count - a.count)[0];

  const raw: Omit<DecisionStatesData["states"][number], "share">[] = [
    { key: "sold", label: "Stopped", count: stopped, lever: pull ? `the hook landed — lead with ${pull.label.toLowerCase()}` : "the hook caught them" },
    { key: "winnable", label: "Almost", count: almost, lever: friction ? `nearly stopped — fix ${friction.label.toLowerCase()}` : "nearly stopped — tighten the open" },
    { key: "skeptical", label: "Not for them", count: wrongFit, lever: "wrong fit — not their content" },
    { key: "gone", label: "Scrolled past", count: scrolled, lever: "never caught — kept scrolling", loss: true },
  ];
  const states = raw.map((s) => ({ ...s, share: total ? Math.round((s.count / total) * 100) : 0 }));
  const read = almost > 0 ? `${fmtCount(almost)} almost stopped — the closest thing to a stop you didn't get.` : undefined;
  return { states, total, read };
}

/** Fixed en-US thousands grouping (mirrors ambient-v2-population's fmtCount — locale-proof). */
function fmtCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The swing · your upside — the near-line segment's non-stoppers as fence-sitters, and the modeled
 *  verdict move if they turn. */
export function modeledSwing(agg: PopulationAggregate): SwingData | undefined {
  const segs = agg.segments;
  if (segs.length === 0) return undefined;
  // the district sitting closest to the 50% line = the most persuadable fence-sitters
  const fence = segs.slice().sort((a, b) => Math.abs(a.stopPct - 50) - Math.abs(b.stopPct - 50))[0]!;
  const nearMiss = Math.max(0, fence.total - fence.stop);
  const fromPct = Math.round(agg.stopPct);
  const gain = clamp(Math.round((nearMiss / Math.max(1, agg.total)) * 100 * 0.45), 3, 15);
  const toPct = clamp(fromPct + gain, 0, 100);
  return {
    nearMiss,
    fromPct,
    toPct,
    gainLabel: `+${gain}% would stop`,
    read: `${nearMiss} viewers stalled right at the line in ${fence.displayName} — not gone, just unconvinced. Win them and the room moves from ${fromPct}% to ${toPct}%.`,
  };
}
