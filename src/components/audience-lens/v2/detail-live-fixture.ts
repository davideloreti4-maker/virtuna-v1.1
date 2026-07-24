/**
 * CREATOR_LIVE_TEMPLATE — the Detail drill built by the REAL adapters, not authored by hand.
 *
 * This is the honest counterpart to `CREATOR_TEMPLATE` (detail-fixture.ts). Where that fixture is
 * hand-authored to the full round-4 design (including the four MODELED Sapient-depth sections —
 * signalGrid / networkBars / kpiHeatmap — whose producers don't exist yet), THIS template is the
 * output of `buildVideoDomainTemplate` (Brain) + `buildPopulationFrameData` (Population) run over a
 * realistic PERSISTED-analysis input — the exact shape `/api/analyze` Max writes. It shows what the
 * Detail actually looks like on real data today: a real attention-scrubber (the curve IS the fold's
 * weighted_curve), real craft signals (the four GeminiVideoSignals dims), a "why this second" that
 * reads the measured dip only, and the modeled sections HONESTLY ABSENT (BrainFrame falls back to the
 * lean read). The `/ambient-v2` dev page toggles between the two so the owner reviews honest-vs-authored
 * side by side — the "review LIVE, refine in code" loop.
 *
 * Fixture values only (no DB, no fetch) — the point is to exercise the real mappers, not real IO.
 */

import type { PopulationAggregate } from "@/lib/audience/population";
import { buildPopulationFrameData } from "@/lib/surfaces/ambient-v2-population";
import { buildVideoDomainTemplate, type BrainSnapshotInput } from "@/lib/surfaces/ambient-v2-brain";
import type { DomainTemplate } from "./domain-template";

// A realistic persisted heatmap: 6 segments over a 12s clip, a real attention curve that peaks on the
// $400 stake (seg 0) and bottoms out at the stall (seg 2) — the shape a real fold emits.
const LIVE_BRAIN_INPUT: BrainSnapshotInput = {
  stopPct: 38,
  stimulusKey: "live-analysis-demo",
  conceptLabel: "hook",
  heatmap: {
    segments: [
      { idx: 0, t_start: 0, t_end: 2, label: "cold open", is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 2, t_end: 4, label: "the claim", is_hook_zone: true, keyframe_uri: null },
      { idx: 2, t_start: 4, t_end: 6, label: "the stall", is_hook_zone: false, keyframe_uri: null },
      { idx: 3, t_start: 6, t_end: 8, label: "the turn", is_hook_zone: false, keyframe_uri: null },
      { idx: 4, t_start: 8, t_end: 10, label: "the proof", is_hook_zone: false, keyframe_uri: null },
      { idx: 5, t_start: 10, t_end: 12, label: "the close", is_hook_zone: false, keyframe_uri: null },
    ],
    personas: [],
    weighted_curve: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55],
    weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    weights_source: "default",
    weighted_completion_pct: 0.58,
  },
  videoSignals: {
    hook_visual_impact: 8.4,
    visual_production_quality: 6.9,
    pacing_score: 4.2,
    transition_quality: 3.5,
  },
  verbatim: {
    hook: { spoken_words: "I quit my 9-5 with $400", on_screen_text: null },
    segments: [
      { idx: 0, spoken_text: "I quit my nine to five", on_screen_text: null },
      { idx: 1, spoken_text: "with four hundred dollars in my account", on_screen_text: null },
      { idx: 2, spoken_text: "and I want to be honest with you", on_screen_text: null },
      { idx: 3, spoken_text: "here is exactly what month one looked like", on_screen_text: null },
      { idx: 4, spoken_text: "the numbers surprised even me", on_screen_text: null },
      { idx: 5, spoken_text: "so here is what I would do differently", on_screen_text: null },
    ],
  },
};

// A realistic Stage-2 projection so the Population tab is real too (same shape react returns).
const LIVE_POP: PopulationAggregate = {
  total: 1000,
  stop: 380,
  scroll: 620,
  stopPct: 38,
  segments: [
    { archetype: "builder", displayName: "builders", share: 0.27, total: 270, stop: 221, stopPct: 82 },
    { archetype: "scroller", displayName: "scrollers", share: 0.41, total: 410, stop: 209, stopPct: 51 },
    { archetype: "skeptic", displayName: "skeptics", share: 0.2, total: 200, stop: 24, stopPct: 12 },
    { archetype: "drop-in", displayName: "drop-ins", share: 0.12, total: 120, stop: 48, stopPct: 40 },
  ],
  reasons: [
    { reason: "The payoff comes too late", count: 253 },
    { reason: "The $400 stake feels real", count: 190 },
    { reason: "Heard this story before", count: 121 },
  ],
};

const LIVE_PERSONAS = [
  { archetype: "skeptic", verdict: "scroll" as const, quote: "i'd be gone before the point lands" },
  { archetype: "builder", verdict: "stop" as const, quote: "the $400 detail made me stay" },
  { archetype: "scroller", verdict: "scroll" as const, quote: "felt slow right after the opener" },
];

/** The Detail template built entirely by the real adapters over the realistic input above. */
export const CREATOR_LIVE_TEMPLATE: DomainTemplate = buildVideoDomainTemplate({
  ...LIVE_BRAIN_INPUT,
  population: buildPopulationFrameData({
    aggregate: LIVE_POP,
    personas: LIVE_PERSONAS,
    calibratedFrom: "your 4.2k followers",
    tier: "max",
  }),
});
