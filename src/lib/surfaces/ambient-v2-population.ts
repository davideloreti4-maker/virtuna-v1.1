/**
 * ambient-v2-population.ts — Ambient Audience v2 Phase C: the Population-depth adapter.
 *
 * Pure function: the REAL `PopulationAggregate` a fired sim returns (`POST /api/tools/react` Stage 2 —
 * an O(N) projection over ~1,000 individuals sampled off the calibrated signature's 10 segments) →
 * the `PopulationFrameData` the `AmbientDetail` audience tab consumes.
 *
 * HONESTY SPINE. Every field here is REAL (a count / rate / coded reason the projection produced) or a
 * deterministic LAYOUT of that real data (the terrain's cx/cy are cosmetic placement; the sizes `n`
 * and lit-share `lit` are the projection's real segment totals + stop rates). The three fabrication-
 * risk sections — `audienceFit` (needs a per-creator last-N baseline), `amplification` (needs a SHARE
 * lens), `swing` (needs a probability band a binary text verdict can't give) — are OPTIONAL and
 * DELIBERATELY OMITTED here; they land with their own producers, never invented. Text has no "skim"
 * band (the verdict is binary stop/scroll) so the tri-state's middle is honestly 0.
 *
 * No DB, no time, no randomness → unit-testable. The mount layer supplies `PopulationSnapshotInput`
 * from the react response (persisted in `threads.sim_seals`, so it survives reload).
 */

import type { PopulationAggregate } from "@/lib/audience/population";
import type {
  CodedReason,
  TerrainCluster,
  TriState,
} from "@/components/audience-lens/v2/AmbientDetail";
import type {
  BrainFrameData,
  DomainTemplate,
  PopulationFrameData,
  ReasonBreakdownData,
  RoomTrustData,
  WhyThisSecond,
} from "@/components/audience-lens/v2/domain-template";
import {
  classifyReasons,
  humanizeReason,
  modeledAmplification,
  modeledAttentionData,
  modeledAudienceFit,
  modeledDecisionStates,
  modeledKpiHeatmap,
  modeledNetworkBars,
  modeledNetworks,
  modeledSignalGrid,
  modeledSwing,
  modeledUnlock,
  type ModeledBrainInput,
  type ModeledReason,
} from "./ambient-v2-modeled";

/** One real per-persona reaction (the exact `FlashPersona` shape react returns) — the exemplar cast. */
export interface PopulationPersona {
  archetype: string;
  verdict: "stop" | "scroll";
  quote: string;
}

/** Everything `buildPopulationFrameData` needs — all REAL, from a fired react sim + its audience. */
export interface PopulationSnapshotInput {
  /** The Stage-2 N-individual projection (react's `population`). */
  aggregate: PopulationAggregate;
  /** The 10 per-persona reactions (react's `personas`) — exemplar voices for the coded reasons. */
  personas: PopulationPersona[];
  /** What the audience was calibrated FROM (drives the trust strip's `calibratedOn`). */
  calibratedFrom: string;
  /** Sim fidelity → the trust strip's modeled confidence (never a measured number). */
  tier?: "flash" | "max";
}

// ── terrain layout (cosmetic placement of the real districts in the 380×210 viewBox) ──────────────

const TVW = 380;
const TVH = 210;
const GCX = 188; // the terrain's gravity centre (AudienceTerrain.tsx)
const GCY = 118;
const GOLDEN = 2.399963229728653; // rad — the golden angle, deterministic scatter (no randomness)
const DISPLAY_NODES = 90; // total nodes drawn across all clusters (downsample from ~1,000 for the SVG)

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Fixed en-US thousands grouping — `toLocaleString()` without a locale honors the machine's locale,
 *  which rendered "1.000" (European) instead of "1,000" on this box. Deterministic + locale-proof. */
function fmtCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Deterministically place `k` real districts around the gravity centre on a golden-angle spiral, so
 *  the same segments always land in the same spots (stable across renders) without any RNG. */
function terrainClusters(agg: PopulationAggregate): {
  clusters: TerrainCluster[];
  lossClusterIndex: number;
} {
  const segs = agg.segments;
  const k = segs.length;
  const clusters: TerrainCluster[] = segs.map((s, i) => {
    const angle = i * GOLDEN;
    const radius = 78 * Math.sqrt((i + 0.5) / Math.max(1, k));
    const cx = clamp(GCX + Math.cos(angle) * radius * 1.5, 46, TVW - 46);
    const cy = clamp(GCY + Math.sin(angle) * radius, 34, TVH - 34);
    const spread = clamp(20 + s.share * 60, 18, 54);
    const n = Math.max(1, Math.round(s.share * DISPLAY_NODES));
    return { name: s.displayName, cx, cy, spread, n, lit: clamp(s.stopPct / 100, 0, 1) };
  });
  // The loudest-no district (coral) = the lowest stop rate among the real segments.
  let lossClusterIndex = 0;
  segs.forEach((s, i) => {
    if (s.stopPct < segs[lossClusterIndex]!.stopPct) lossClusterIndex = i;
  });
  return { clusters, lossClusterIndex };
}

// ── voices (real coded reasons, each illustrated by a real persona voice) ─────────────────────────

const VOICE_LIMIT = 4;

/** Pair each top coded reason (real label + count from the projection) with a real persona quote as
 *  its exemplar — exactly `CodedReason`'s contract ("the reason speaks for N; the persona is its
 *  exemplar voice"). We do NOT claim the persona uttered that coded label; the quote illustrates the
 *  theme in a real viewer's words. `loss` rides the exemplar's own verdict (a scroller = an objection). */
function codedReasons(agg: PopulationAggregate, personas: PopulationPersona[]): CodedReason[] {
  const scrollers = personas.filter((p) => p.verdict === "scroll");
  const stoppers = personas.filter((p) => p.verdict === "stop");
  return agg.reasons.slice(0, VOICE_LIMIT).map((r, i) => {
    // Alternate the exemplar polarity toward the pool that exists, so a quote is always real.
    const preferScroll = i % 2 === 0;
    const pool = preferScroll
      ? scrollers.length
        ? scrollers
        : stoppers
      : stoppers.length
        ? stoppers
        : scrollers;
    const voice = pool.length ? pool[i % pool.length]! : personas[i % Math.max(1, personas.length)];
    return {
      // humanize the pStop token ("weak-hook" → "Weak hook"); real sentence reasons pass through
      label: humanizeReason(r.reason).label,
      count: r.count,
      quote: voice?.quote ?? "",
      who: voice?.archetype ?? "a viewer",
      ...(voice?.verdict === "scroll" ? { loss: true as const } : {}),
    };
  });
}

// ── the trust strip (real sample + calibration; confidence is modeled, never measured) ────────────

function roomTrust(agg: PopulationAggregate, calibratedFrom: string, tier?: "flash" | "max"): RoomTrustData {
  const confidence = tier === "max" ? 0.82 : 0.72;
  return {
    simulated: agg.total,
    calibratedOn: calibratedFrom,
    confidence,
    confidenceLabel: confidence >= 0.8 ? "High" : "Medium",
    note: "A modeled society · calibrated for engagement, not purchase.",
  };
}

// ── the one-line read (real: the strongest vs the weakest real district) ──────────────────────────

function heroRead(agg: PopulationAggregate): string {
  const segs = agg.segments;
  if (segs.length === 0) return `${agg.stop} of ${agg.total} kept watching.`;
  const top = segs.reduce((a, b) => (b.stopPct > a.stopPct ? b : a));
  const low = segs.reduce((a, b) => (b.stopPct < a.stopPct ? b : a));
  if (top.displayName === low.displayName) {
    return `${top.displayName} stop at ${Math.round(top.stopPct)}%.`;
  }
  return `${top.displayName} stop most (${Math.round(top.stopPct)}%); ${low.displayName} are the ceiling (${Math.round(low.stopPct)}%).`;
}

/**
 * Map a fired sim's REAL population projection → the `PopulationFrameData` the audience-depth tab
 * reads. Text-sim honest: tri-state's skim band is 0 (binary verdict); the three modeled-depth
 * sections are omitted (their producers aren't built). Deterministic — safe to call on every render.
 */
export function buildPopulationFrameData(input: PopulationSnapshotInput): PopulationFrameData {
  const { aggregate: agg, personas, calibratedFrom, tier } = input;
  const stopped = Math.round(agg.stopPct);
  const tri: TriState = { stopped, skimmed: 0, scrolled: Math.max(0, 100 - stopped) };
  const { clusters, lossClusterIndex } = terrainClusters(agg);

  return {
    main: {
      kind: "tri-state",
      data: tri,
      percentileLine: `${fmtCount(agg.total)} simulated · engagement-calibrated`,
    },
    terrain: { clusters, lossClusterIndex },
    voices: {
      kicker: `Why · coded from ${fmtCount(agg.total)}`,
      total: agg.total,
      reasons: codedReasons(agg, personas),
    },
    heroRead: heroRead(agg),
    // the room recategorized into four decision-states (the conversion funnel) — replaces the archetype
    // ledger with a playbook; every count is a real partition of the projection, levers from real reasons
    decisionStates: modeledDecisionStates(agg, classifyReasons(agg.reasons)),
    // ── modeled-depth parity (Phase-C ②) — the fuller society read; carried by the one calibration line ──
    audienceFit: modeledAudienceFit(agg),
    amplification: modeledAmplification(agg),
    swing: modeledSwing(agg),
    room: roomTrust(agg, calibratedFrom, tier),
  };
}

// ── the text brain (real reason-drivers — the cognitive "why they stopped") ───────────────────────

/** Build the REAL reason-breakdown driver from the projection's per-stopper dominant-reason tally.
 *  Counts are the aggregate's own `reasons` (deterministic pStop output); the denominator is the real
 *  stopper count. Weightiest first. */
function reasonBreakdown(agg: PopulationAggregate): ReasonBreakdownData {
  const total = Math.max(1, agg.stop);
  const rows = agg.reasons
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((r) => {
      const h = humanizeReason(r.reason);
      return { label: h.label, count: r.count, share: r.count / total, ...(h.loss ? { loss: true as const } : {}) };
    });
  const top = rows[0];
  const read = top
    ? `Most who stopped did so on ${top.label.toLowerCase()} — ${top.count} of ${agg.stop}.`
    : undefined;
  return { question: "What carried the stop", total: agg.stop, rows, read };
}

/** The text "why they stopped" synthesis that heads the retention scrubber — the SAME slot the video's
 *  measured-dip read fills. Built from the REAL top reason (the top friction reason when one exists, so
 *  the coral clause names the actual leak; else the strongest pull). `dipTime` ties it to the modeled
 *  curve's trough so the moment token matches a scrubber chip, exactly like the video path. */
function reasonSynthesis(breakdown: ReasonBreakdownData, stoppers: number, dipTime?: string): WhyThisSecond | undefined {
  const lead = breakdown.rows.find((r) => r.loss) ?? breakdown.rows[0];
  if (!lead) return undefined;
  const moment = dipTime ? `${dipTime} · the drop` : "the drop";
  if (lead.loss) {
    return {
      moment,
      segments: [
        { text: `Most who stalled did so on ` },
        { text: lead.label.toLowerCase(), loss: true },
        { text: ` — ${lead.count} of ${stoppers}.` },
      ],
    };
  }
  return { moment, segments: [{ text: `${lead.label} carried the stop — ${lead.count} of ${stoppers} stayed for it.` }] };
}

/**
 * Map a fired text sim's REAL projection → the `BrainFrameData` the brain tab reads — now at FULL video
 * parity (owner call 2026-07-24): the SAME attention-scrubber the video draws (retention curve + the
 * real concept transcript), the SAME depth sections. The retention curve is a MODELED reading-attention
 * proxy (text has no measured timeline); the transcript is REAL; the visual-only reads (Visual Pull, the
 * Visual/Audio/Face KPI rows) are GREYED — a text concept has no video substrate to measure. The "why"
 * that heads the scrubber is the REAL top reason. Honesty rides on the single calibration line.
 */
export function buildReasonBrainFrameData(input: {
  aggregate: PopulationAggregate;
  stopPct: number;
  stimulusKey: string;
  /** The REAL concept text — the scrubber's transcript. Absent → the scrubber reads the coded reasons. */
  transcript?: string;
}): BrainFrameData {
  const breakdown = reasonBreakdown(input.aggregate);
  const reasons: ModeledReason[] = breakdown.rows.map((r) => ({
    label: r.label,
    count: r.count,
    ...(r.loss ? { loss: true as const } : {}),
  }));
  const modeledInput: ModeledBrainInput = {
    stopPct: input.stopPct,
    stimulusKey: input.stimulusKey,
    clipSeconds: 6, // nominal proxy duration (a text concept has no clip)
    curve: null, // text has no attention curve → the proxies self-seed from the stop rate + reason mix
    craft: null,
    reasons,
    mutedSensory: true, // grey the visual-only reads (no video/audio to measure on a text concept)
  };
  const transcript =
    input.transcript?.trim() ||
    breakdown.rows.map((r) => r.label).join(" · "); // fallback: the coded reasons, never empty
  const attention = modeledAttentionData(modeledInput, transcript);
  const dipTime = attention.moments.find((m) => m.dip)?.t;
  const networkBars = modeledNetworkBars(modeledInput);
  return {
    cortexSeedKey: input.stimulusKey,
    // A text concept has no clip; the cortex loops on a nominal proxy duration (animation only, never
    // presented as a measured length). Kept short so the parcellation reads as a brief pulse.
    clipSeconds: 6,
    stopRatio: clamp(input.stopPct / 100, 0, 1),
    // The retention scrubber — the SAME driver the video uses; the curve is modeled, the words are real.
    driver: { kind: "attention-scrubber", data: attention },
    signals: [], // the lean row list is superseded by the modeled signalGrid below
    // the "why they stopped" read heads the scrubber (the video's measured-dip slot) — the REAL top reason
    whyThisSecond: reasonSynthesis(breakdown, input.aggregate.stop, dipTime),
    // ── modeled-depth parity (Phase-C ②) — text renders the SAME fuller read as video; MODELED ──
    signalGrid: modeledSignalGrid(modeledInput),
    networkBars,
    networks: modeledNetworks(networkBars),
    kpiHeatmap: modeledKpiHeatmap(modeledInput),
    // buyIntent omitted — a commerce figure, not a text/creator one (matches the authored template)
    calibrationNote: "Modeled cognitive proxy from a text sim · the reasons are real, the retention curve + depth read are modeled — not measured attention",
  };
}

/** Everything `buildDomainTemplate` needs to assemble the depth drill from a fired sim's seal. */
export interface DomainTemplateInput extends PopulationSnapshotInput {
  /** The sealed measured would-stop % (the Overview verdict) — the answer they paid for. */
  pct: number;
  /** A short concept label for the pager ("hook" · "idea" · "concept"). */
  conceptLabel?: string;
  /** A stable per-stimulus key (the row id / trimmed concept) — seeds the cortex parcellation. */
  stimulusKey: string;
  /** The REAL concept text — the retention scrubber's transcript. Absent → the scrubber reads the reasons. */
  transcript?: string;
}

/**
 * Assemble the `DomainTemplate` the Overview→Detail drill renders for a SEALED text/concept sim.
 * BOTH tabs are REAL now: `population` from `buildPopulationFrameData`, and `brain` from
 * `buildReasonBrainFrameData` — the cortex proxy + the real reason-driver breakdown (owner call
 * 2026-07-24: the brain fires on all text content). The verdict is the sealed measured %.
 */
export function buildDomainTemplate(input: DomainTemplateInput): DomainTemplate {
  const { pct, conceptLabel, stimulusKey, aggregate, transcript } = input;
  const population = buildPopulationFrameData(input);
  // unlock classifies by reason SEMANTICS (the token map), not the voices' cosmetic exemplar verdict
  const reasons: ModeledReason[] = classifyReasons(aggregate.reasons);
  return {
    id: "creator",
    label: "Creator · content",
    backLabel: "Overview",
    pager: conceptLabel ?? "concept",
    verdict: { value: `${Math.round(pct)}%`, label: "would stop" },
    unlock: modeledUnlock(reasons, population.swing),
    brain: buildReasonBrainFrameData({ aggregate, stopPct: pct, stimulusKey, transcript }),
    population,
  };
}
