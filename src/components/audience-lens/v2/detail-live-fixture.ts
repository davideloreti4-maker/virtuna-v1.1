/**
 * CREATOR_LIVE_TEMPLATE — the Detail drill built by the REAL adapters, not authored by hand.
 *
 * This is the honest counterpart to `CREATOR_TEMPLATE` (detail-fixture.ts). Where that fixture is
 * hand-authored to the full round-4 design, THIS template is the output of `buildVideoDomainTemplate`
 * (Brain) + `buildPopulationFrameData` (Population) run over a realistic PERSISTED-analysis input — the
 * exact shape `/api/analyze` Max writes. It renders the FULL instrument at parity with the authored
 * page (2026-07-24): a real attention-scrubber (the curve IS the fold's weighted_curve), real craft
 * signals (the four GeminiVideoSignals dims), a measured-dip "why this second", PLUS the modeled-depth
 * sections (signalGrid / networkBars / kpiHeatmap) via `ambient-v2-modeled.ts` — labeled by the single
 * calibration line. buyIntent is omitted (a commerce figure the creator template doesn't carry).
 * The `/ambient-v2` dev page toggles authored / LIVE-video / TEXT-sim so the owner reviews them side by
 * side — the "review LIVE, refine in code" loop.
 *
 * Fixture values only (no DB, no fetch) — the point is to exercise the real mappers, not real IO.
 */

import type { PopulationAggregate } from "@/lib/audience/population";
import { buildDomainTemplate, buildPopulationFrameData } from "@/lib/surfaces/ambient-v2-population";
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
  { archetype: "scroller", verdict: "scroll" as const, quote: "seen this exact arc a hundred times" },
  { archetype: "builder", verdict: "stop" as const, quote: "the honesty hooked me, i wanted the numbers" },
];

/** The Detail template built entirely by the real adapters over the realistic input above. */
export const CREATOR_LIVE_TEMPLATE: DomainTemplate = buildVideoDomainTemplate({
  ...LIVE_BRAIN_INPUT,
  // the raw pStop dominant-reason tally (tokens, as the projection emits) → the unlock's lever + insight
  reasons: [
    { reason: "too-slow", count: 253 },
    { reason: "strong-hook", count: 190 },
    { reason: "interest", count: 121 },
  ],
  population: buildPopulationFrameData({
    aggregate: LIVE_POP,
    personas: LIVE_PERSONAS,
    calibratedFrom: "your 4.2k followers",
    tier: "max",
  }),
});

// ── the TEXT sim (a hooks/concept sim through the real adapters) ───────────────────────────────────
// The exact shape `POST /api/tools/react` returns for a sealed TEXT concept: a binary stop/scroll
// projection (no attention curve, no craft dims) + the pStop dominant-reason TOKEN tally. Built by
// `buildDomainTemplate` — the same producer the rail uses — so this is the honest text-sim Detail.
const TEXT_POP: PopulationAggregate = {
  total: 1000,
  stop: 440,
  scroll: 560,
  stopPct: 44,
  segments: [
    { archetype: "builder", displayName: "builders", share: 0.28, total: 280, stop: 224, stopPct: 80 },
    { archetype: "scroller", displayName: "scrollers", share: 0.4, total: 400, stop: 176, stopPct: 44 },
    { archetype: "skeptic", displayName: "skeptics", share: 0.19, total: 190, stop: 30, stopPct: 16 },
    { archetype: "drop-in", displayName: "drop-ins", share: 0.13, total: 130, stop: 52, stopPct: 40 },
  ],
  reasons: [
    { reason: "strong-hook", count: 224 },
    { reason: "interest", count: 121 },
    { reason: "too-slow", count: 63 },
    { reason: "weak-hook", count: 32 },
  ],
};

const TEXT_PERSONAS = [
  { archetype: "builder", verdict: "stop" as const, quote: "the promise in the first line pulled me straight in" },
  { archetype: "scroller", verdict: "scroll" as const, quote: "took too long to tell me why i should care" },
  { archetype: "skeptic", verdict: "scroll" as const, quote: "sounds like every other hook in my feed" },
  { archetype: "drop-in", verdict: "stop" as const, quote: "curious enough to stick around for the payoff" },
];

/** A sealed TEXT/concept sim's Detail — the reason-breakdown Brain + the full modeled-depth parity. */
export const CREATOR_LIVE_TEXT_TEMPLATE: DomainTemplate = buildDomainTemplate({
  aggregate: TEXT_POP,
  personas: TEXT_PERSONAS,
  calibratedFrom: "your 4.2k followers",
  tier: "max",
  pct: 44,
  conceptLabel: "hook",
  stimulusKey: "text-hook-sim-demo",
});
