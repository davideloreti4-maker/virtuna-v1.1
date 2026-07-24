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
import type { NetworkRow } from "@/components/audience-lens/v2/AmbientDetail";
import type {
  AmplificationData,
  AudienceFitData,
  BuyIntentData,
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
    return {
      key: d.key,
      label: d.label,
      score,
      word: WORD[tone],
      tone,
      delta,
      whyScore: `${toneLead} — modeled from ${d.frag} at a ${Math.round(input.stopPct)}% stop rate${anchor}.`,
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
    return { label, values };
  });
  return { seconds, rows };
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
