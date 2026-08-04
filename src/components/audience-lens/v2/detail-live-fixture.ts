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
 * calibration line, PLUS the fold's action intents via `buildVideoPopulation` (2026-08-04), which is
 * what the real mount passes and this page used to omit. buyIntent stays out (a commerce figure the
 * creator template doesn't carry).
 * The `/ambient-v2` dev page toggles authored / LIVE-video / TEXT-sim so the owner reviews them side by
 * side — the "review LIVE, refine in code" loop.
 *
 * Fixture values only (no DB, no fetch) — the point is to exercise the real mappers, not real IO.
 */

import type { PopulationAggregate } from "@/lib/audience/population";
import type { PersonaBehavioralAggregate, PersonaSimulationResult } from "@/lib/engine/types";
import { buildDomainTemplate, buildPopulationFrameData } from "@/lib/surfaces/ambient-v2-population";
import { buildVideoDomainTemplate, type BrainSnapshotInput } from "@/lib/surfaces/ambient-v2-brain";
import { buildVideoPopulation } from "@/lib/surfaces/ambient-v2-video-population";
import type { DomainTemplate } from "./domain-template";

// A realistic persisted heatmap: 6 segments over a 12s clip, a real attention curve that peaks on the
// $400 stake (seg 0) and bottoms out at the stall (seg 2) — the shape a real fold emits.
export const LIVE_BRAIN_INPUT: BrainSnapshotInput = {
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
    // The cast, with the swipe times a real fold emits. This was `personas: []` — which is not a shape
    // `/api/analyze` can write (the curve is COMPUTED from the personas), and it is why the live
    // Engagement page had to read the ATTENTION curve as retention: with no swipe data there was
    // nothing else to read. Every persona carries the same attentions, so the weighted mean still
    // reproduces `weighted_curve` exactly; the swipe times add the read it was missing.
    // Retention implied: 100% · 85% · 42% · 27% · 27% · 22% — the stall at 0:04 is where the room goes.
    personas: [
      { id: "lp1", slot_type: "fyp", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: 2, segment_reasons: {} },
      { id: "lp2", slot_type: "fyp", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: 4, segment_reasons: {} },
      { id: "lp3", slot_type: "fyp", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: 4, segment_reasons: {} },
      { id: "lp4", slot_type: "fyp", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: 4, segment_reasons: {} },
      { id: "lp5", slot_type: "fyp", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: 6, segment_reasons: {} },
      { id: "lp6", slot_type: "fyp", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: null, segment_reasons: {} },
      { id: "lp7", slot_type: "niche", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: null, segment_reasons: {} },
      { id: "lp8", slot_type: "niche", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: 10, segment_reasons: {} },
      { id: "lp9", slot_type: "loyalist", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: null, segment_reasons: {} },
      { id: "lp10", slot_type: "cross_niche", attentions: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], swipe_predicted_at: null, segment_reasons: {} },
    ],
    weighted_curve: [0.82, 0.9, 0.34, 0.52, 0.61, 0.55], // ATTENTION — it RISES twice, and should
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

// ── the fold reception panel — what production seals beside the heatmap ────────────────────────────
// The dev page was rendering a THINNER instrument than the real mount: `AmbientOverviewRail:485`
// reads `v.intents` off the seal and passes it into `buildPopulationFrameData`, which is what puts
// "Projected reaction" on a real video's Engagement tab. This fixture passed no `actionIntent`, so
// the review surface hid a card production ships. These ten are `analysis_results.personas` — the
// SAME cast as `heatmap.personas` above, one archetype per slot (6 fyp · 2 niche · loyalist ·
// cross-niche, exactly `ARCHETYPE_SLOT`), with each `scroll_past_second` matching that persona's
// `swipe_predicted_at` so the fold cast and the retention curve describe one room, not two.
// `watch_through_pct` is the bail second over the 12s clip (a stayer watched it through).
const foldPersona = (
  persona_id: string,
  archetype: PersonaSimulationResult["archetype"],
  slot_type: PersonaSimulationResult["slot_type"],
  scroll_past_second: number,
  watch_through_pct: number,
  [share_intent, save_intent, comment_intent, rewatch_intent]: [number, number, number, number],
  reasoning: string,
): PersonaSimulationResult => ({
  persona_id,
  archetype,
  slot_type,
  niche: "general",
  scroll_past_second,
  watch_through_pct,
  share_intent,
  save_intent,
  comment_intent,
  rewatch_intent,
  reasoning,
});

export const LIVE_FOLD_CAST: PersonaSimulationResult[] = [
  foldPersona("lp1", "tough_crowd", "fyp", 2, 17, [0, 0, 0, 0], "heard the claim, did not buy it"),
  foldPersona("lp2", "lurker", "fyp", 4, 33, [0, 0, 0, 0], "watches, never acts — and the stall lost it"),
  foldPersona("lp3", "sharer", "fyp", 4, 33, [0, 0, 0, 0], "nothing to pass on once the pace dropped"),
  foldPersona("lp4", "purposeful_viewer", "fyp", 4, 33, [0, 0, 0, 0], "came for the number, left before it landed"),
  foldPersona("lp5", "saver", "fyp", 6, 50, [5, 45, 0, 0], "worth keeping for the month-one breakdown"),
  foldPersona("lp6", "high_engager", "fyp", 0, 100, [55, 60, 50, 35], "stayed for the whole arc, wants the follow-up"),
  foldPersona("lp7", "niche_deep_scout", "niche_deep", 0, 100, [25, 55, 20, 15], "filing this against the other $400 starts"),
  foldPersona("lp8", "niche_deep_buyer", "niche_deep", 10, 83, [15, 40, 10, 0], "left at the close, kept the numbers"),
  foldPersona("lp9", "loyalist", "loyalist", 0, 100, [40, 50, 45, 30], "already follows — this is the honest one"),
  foldPersona("lp10", "cross_niche_curiosity", "cross_niche", 0, 100, [10, 15, 5, 0], "stayed out of curiosity, not intent"),
];

/**
 * `analysis_results.persona_behavioral_aggregate` — persisted ENGINE output, so it is fixture INPUT
 * here exactly like the heatmap is. Every value is what `aggregatePersonaResults` (wave3/aggregator)
 * emits for `LIVE_FOLD_CAST` under its own documented rules, recomputed rather than invented:
 * `completion_pct` is the flat mean of watch_through (64.9); the four intents are top-3-enthusiast
 * weighted (0.6 × mean of the three keenest + 0.4 × mean of the other seven). The aggregator itself
 * is not imported — it pulls `persona-registry` → the whole niche taxonomy → into a client bundle for
 * a dev page. The numbers are asserted against the real producer in the fixture's test instead.
 */
export const LIVE_BEHAVIORAL: PersonaBehavioralAggregate = {
  completion_pct: 64.9,
  share_pct: 25.714285714285715,
  save_pct: 38.714285714285715,
  comment_pct: 23.857142857142858,
  loop_pct: 16,
};

/**
 * The fold reception panel through the SHIPPED adapter — the same call `/api/tools/test/card`
 * makes at seal time. Only `intents` is consumed: those are dimensionless (a 0–100 index plus
 * headcounts off this cast), so they compose with any aggregate. `skimmedPct` is deliberately NOT
 * taken — it is a percentage of the 10-persona fold, while the population below is the 1,000-person
 * Stage-2 projection, and crossing those denominators would push the tri-state's stopped band to
 * zero (`buildPopulationFrameData` clamps the skim band inside `stopPct`, which is 38 here).
 */
const LIVE_FOLD = buildVideoPopulation({
  personas: LIVE_FOLD_CAST,
  heatmap: LIVE_BRAIN_INPUT.heatmap,
  aggregate: LIVE_BEHAVIORAL,
});

const LIVE_PERSONAS = [
  { archetype: "skeptic", verdict: "scroll" as const, quote: "i'd be gone before the point lands" },
  { archetype: "builder", verdict: "stop" as const, quote: "the $400 detail made me stay" },
  { archetype: "scroller", verdict: "scroll" as const, quote: "felt slow right after the opener" },
  { archetype: "scroller", verdict: "scroll" as const, quote: "seen this exact arc a hundred times" },
  { archetype: "builder", verdict: "stop" as const, quote: "the honesty hooked me, i wanted the numbers" },
];

/**
 * The creator's last-N catalogue — fixture INPUT, exactly like `LIVE_BEHAVIORAL` above: this is what
 * `watchCatalogueOf` EMITS after reading `/api/analysis/history`, not something the page derives.
 * Reproducing the producer here would mean authoring fourteen more full heatmaps for a dev page.
 *
 * The shape is measured, not invented. Queried against prod 2026-08-04: one creator holds 23 sealed
 * runs, 21 with a full 10-persona cast, of which 14 clear the engine floor in `watchCatalogueOf`.
 * These are that cohort's watched-full shares. (They are the UNWEIGHTED shares — the real producer
 * applies slot weights, so live values will differ by a few points. The distribution, the count and
 * the spread are the real ones, which is what this page is here to review.)
 *
 * This clip lands at 22% against a median of 40%: it ranks BADLY, and that is the honest reading of
 * a clip that loses 58% of the room by 0:04. A fixture that flattered it would be the exact defect
 * §24.1 caught the last time this page disagreed with the mount.
 */
const LIVE_CATALOGUE = [80, 70, 60, 50, 50, 50, 40, 40, 40, 40, 40, 40, 40, 40];

/** The Detail template built entirely by the real adapters over the realistic input above. */
export const CREATOR_LIVE_TEMPLATE: DomainTemplate = buildVideoDomainTemplate({
  ...LIVE_BRAIN_INPUT,
  catalogue: LIVE_CATALOGUE,
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
    // what the room would DO with it — the seal's own intents, as the real mount passes them
    ...(LIVE_FOLD?.intents ? { actionIntent: LIVE_FOLD.intents } : {}),
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
  // the REAL concept text → the retention scrubber's transcript (same hook as the video tab, for a clean
  // side-by-side; the curve is modeled, the words are real).
  transcript:
    "I quit my nine to five with four hundred dollars in my account and I want to be honest with you here is exactly what month one looked like the numbers surprised even me so here is what I would do differently",
});
