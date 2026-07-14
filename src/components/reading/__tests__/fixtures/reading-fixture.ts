import type {
  PredictionResult,
  ApolloDimension,
  ApolloRewrite,
  HeatmapPayload,
  CounterfactualSuggestionItem,
} from '@/lib/engine/types';
import { fixtures } from '@/components/board/verdict/__tests__/fixtures/prediction-result';

// ─────────────────────────────────────────────────────────────────────────────
// Shared PredictionResult fixture builder for ALL reading component tests.
//
// Phase 2 (The Reading) recomposes the engine's ~40-field PredictionResult into a
// consolidated vertical thread. Each reading component reads a small whitelist of
// fields (READ-10: never spread the raw result). This builder extends the proven
// board `fixtures.antiVirality` (a full PredictionResult) with the Apollo / heatmap
// / counterfactual shape the Reading actually consumes — the board fixture predates
// the Apollo reasoner (heatmap: null, no apollo_reasoning), so we layer those on.
//
// Pattern mirrors src/components/board/verdict/__tests__/verdict-derive.test.ts L23:
//   the cast `as unknown as PredictionResult` avoids re-wiring the ~40 unrelated
//   fields each test never touches, while the base spread keeps the shape realistic.
// Apply `over` LAST so every test overrides only the fields it asserts on.
// ─────────────────────────────────────────────────────────────────────────────

/** dimensions[] is length-6, fixed order [hook, retention, clarity, share_pull,
 *  substance, credibility] (engine ApolloDimensionSchema). Driver rows read
 *  hook/retention/share_pull; Deeper read reads clarity/substance/credibility.
 *  Scores are 0–100 (NOT 0–10 — that is FactorBars' separate contract). */
const DIMENSIONS: ApolloDimension[] = [
  { name: 'hook', band: 'strong', score: 87, lever: 'Contrast / curiosity gap (§2.1)', evidence: 'Strong cold open — visual stop power high.' },
  { name: 'retention', band: 'mid', score: 55, lever: 'Momentum / pattern interrupt (§2.3)', evidence: 'Attention dips sharply around 0:08.' },
  { name: 'clarity', band: 'strong', score: 72, lever: 'Single clear message (§2.4)', evidence: 'One legible idea, minimal overlay clutter.' },
  { name: 'share_pull', band: 'mid', score: 64, lever: 'Social currency / identity (§2.5)', evidence: 'Relatable but not strongly identity-signalling.' },
  { name: 'substance', band: 'strong', score: 70, lever: 'Payoff / value density (§2.6)', evidence: 'Delivers a concrete takeaway.' },
  { name: 'credibility', band: 'strong', score: 80, lever: 'Trust / authenticity (§2.7)', evidence: 'Natural delivery, no over-production.' },
];

/** 2 directional rewrites; `original` is the verbatim hook line, `lever_fixed`
 *  differs per variant (engine ApolloRewriteSchema, D-08). */
const REWRITES: ApolloRewrite[] = [
  {
    original: 'Here are three things nobody tells you about freelancing',
    variant: "The freelancing advice that doubled my rate (most people get this backwards)",
    lever_fixed: 'Contrast / curiosity gap (§2.1)',
  },
  {
    original: 'Here are three things nobody tells you about freelancing',
    variant: 'I lost $4k before I learned these three freelancing rules',
    lever_fixed: 'Stakes / specificity (§2.2)',
  },
];

/** ≥3 personas, mixed slot_type, attentions decay so the worst slot is identifiable.
 *  attentions[] length matches a small synthetic segment count (5). */
const PERSONAS: HeatmapPayload['personas'] = [
  {
    id: 'p-fyp',
    slot_type: 'fyp',
    archetype: 'scroller',
    attentions: [0.9, 0.7, 0.45, 0.3, 0.22],
    swipe_predicted_at: 8,
    segment_reasons: { 2: 'momentum stalls' },
  },
  {
    id: 'p-niche',
    slot_type: 'niche',
    archetype: 'high_engager',
    attentions: [0.95, 0.85, 0.7, 0.6, 0.55],
    swipe_predicted_at: null,
    segment_reasons: {},
  },
  {
    id: 'p-loyalist',
    slot_type: 'loyalist',
    archetype: 'fan',
    attentions: [0.98, 0.9, 0.82, 0.78, 0.74],
    swipe_predicted_at: null,
    segment_reasons: {},
  },
  {
    id: 'p-cross',
    slot_type: 'cross_niche',
    archetype: 'lurker',
    attentions: [0.8, 0.5, 0.3, 0.18, 0.12],
    swipe_predicted_at: 6,
    segment_reasons: { 3: 'loses the thread' },
  },
];

/** ≥3 `type:'fix'` items. timestamp_ms is MILLISECONDS (≠ weighted_top_dropoff_t
 *  which is seconds) — keep tests honest about the two time units. */
const FIX_SUGGESTIONS: CounterfactualSuggestionItem[] = [
  { type: 'fix', headline: 'Recut the open', detail: 'You lose them at 0:08 — front-load the payoff.', timestamp_ms: 8000, signal_anchor: 'retention' },
  { type: 'fix', headline: 'Tighten the text overlay', detail: 'Move the first card up to 0:01 so it lands with the hook.', timestamp_ms: 1000, signal_anchor: 'hook' },
  { type: 'fix', headline: 'Add an explicit CTA', detail: 'The final 0:02 should ask for the follow.', timestamp_ms: 14000, signal_anchor: 'cta' },
  { type: 'reinforcement', headline: 'Keep the cold open', detail: 'The visual stop power is your asset — do not bury it.', timestamp_ms: 0, signal_anchor: 'hook' },
];

const HEATMAP: HeatmapPayload = {
  segments: [
    { idx: 0, t_start: 0, t_end: 3, label: 'cold open', is_hook_zone: true, keyframe_uri: null },
    { idx: 1, t_start: 3, t_end: 6, label: 'setup', is_hook_zone: false, keyframe_uri: null },
    { idx: 2, t_start: 6, t_end: 9, label: 'stall', is_hook_zone: false, keyframe_uri: null },
    { idx: 3, t_start: 9, t_end: 12, label: 'payoff', is_hook_zone: false, keyframe_uri: null },
    { idx: 4, t_start: 12, t_end: 15, label: 'close', is_hook_zone: false, keyframe_uri: null },
  ],
  personas: PERSONAS,
  weighted_curve: [0.91, 0.74, 0.52, 0.42, 0.36],
  weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  weights_source: 'default',
  weighted_completion_pct: 0.57,
  weighted_top_dropoff_t: 8, // SECONDS — the retention readout (D-06)
} as HeatmapPayload;

/**
 * Healthy-default Reading result. Base = board `fixtures.antiVirality` (full
 * PredictionResult), spread to a non-gated healthy state and augmented with the
 * Apollo reasoner + heatmap personas + counterfactual fixes the Reading consumes.
 *
 * @param over partial overrides applied LAST — each test sets only the fields it asserts on.
 */
export function makeReadingResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return {
    ...(fixtures.antiVirality as unknown as PredictionResult),
    // healthy hero state (board fixture is anti-virality-gated)
    analysis_unavailable: false,
    partial_analysis: false,
    anti_virality_gated: false,
    anti_virality_reason: null,
    overall_score: 71,
    // Apollo §4 reasoning — dimensions (0–100) + 2 rewrites
    apollo_reasoning: {
      rewrites: REWRITES,
      dimensions: DIMENSIONS,
      composite_score: 71,
      ceiling_capper: 'Fix the 0:08 drop and this clears the bar.',
      confidence_scope: 'Audio + on-screen text both observed.',
    },
    // heatmap with ≥3 personas, watch% (0–1), drop time (seconds)
    heatmap: HEATMAP,
    weighted_completion_pct: 0.57,
    // Retention drop point, SECONDS (PredictionResult top-level field, types.ts
    // L483 — the canonical path DriverRows' container reads: `data.weighted_top_dropoff_t`).
    weighted_top_dropoff_t: 8,
    counterfactuals: {
      band: 'mid',
      suggestions: FIX_SUGGESTIONS,
    },
    ...over,
  } as unknown as PredictionResult;
}

/**
 * Both core signals dead → overall_score collapses to a FABRICATED 0. The Reading
 * MUST render a dedicated "couldn't analyze" state and NEVER show this 0 (D-13).
 */
export function makeUnavailableResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    analysis_unavailable: true,
    overall_score: 0,
    apollo_reasoning: null,
    ...over,
  });
}

/** Exactly one core signal dead → half-basis. Hero/rows still resolve; a small
 *  "partial read" annotation is shown (D-13). */
export function makePartialResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    partial_analysis: true,
    ...over,
  });
}

/** DeepSeek circuit-breaker open → no rewrites/dimensions. Deeper read + driver
 *  rows degrade; hero gauge + gate still resolve from overall_score (D-13). */
export function makeApolloNullResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    apollo_reasoning: null,
    ...over,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase-3 (Rich Visuals as Drill-Downs) empty-data helpers — the degradation
// inputs for `reading.panels.test.tsx` (SC-2 / D-13). Every transplanted visual
// must fall to PanelEmpty ("Not available for this read.") on a real null/thin
// shape — NEVER throw, NEVER a grey-cell box, NEVER a fabricated 0. These hit on
// permalink reload and on genuine engine partials.
//
// Each helper composes on TOP of makeReadingResult(over) and overrides ONLY the
// field under test, so unrelated fields stay valid (no hand-built partial result)
// and a schema drift fails at compile (the override stays `Partial<PredictionResult>`).
// makeApolloNullResult (above) is the apollo-null degradation — reuse it, do NOT
// duplicate it here.
// ─────────────────────────────────────────────────────────────────────────────

/** heatmap absent entirely → the retention + personas panels have no curve /
 *  segments / personas to read. Both must degrade to PanelEmpty (the curve SVG and
 *  the persona graph never render an empty shell). Mirrors a permalink row whose
 *  heatmap never persisted / a text read with no audience sim. */
export function makeEmptyHeatmapResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    heatmap: null,
    ...over,
  });
}

/** heatmap present but `personas: []` (and no sim results) → buildPersonaNodes
 *  returns [] → the personas panel degrades to PanelEmpty (mirror PersonaCloud's
 *  null path). Segments/curve are KEPT so ONLY the persona-derived path goes empty. */
export function makeEmptyPersonasResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    heatmap: { ...HEATMAP, personas: [] } as HeatmapPayload,
    persona_simulation_results: undefined,
    ...over,
  });
}

/**
 * The room is FULL and nobody said anything — every persona present, not one verbatim.
 *
 * This is NOT `makeEmptyPersonasResult` (which sets `personas: []` and degrades the whole panel
 * to PanelEmpty — no roster rows at all, so no quote slots, so nothing to look at). It is the
 * state where each persona HAS a row and that row's quote slot is EMPTY — the only state in which
 * the Room renders its "no words recorded" line.
 *
 * It did not exist, which is why the defect it exposes (the absence styled as an italic verbatim)
 * survived: the gallery's "Empty personas" state CLAIMED to reproduce it and could not.
 * `segment_reasons: {}` is the whole trick — the verbatim comes from there (see prediction-to-read).
 */
export function makeSilentPersonasResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    heatmap: {
      ...HEATMAP,
      personas: HEATMAP.personas.map((p) => ({ ...p, segment_reasons: {} })),
    } as HeatmapPayload,
    persona_simulation_results: undefined,
    ...over,
  });
}

/** heatmap present but `segments: []` → no retention curve/table rows to draw →
 *  the retention panel degrades to PanelEmpty instead of an empty SVG. Personas are
 *  KEPT so ONLY the segment-derived paths go empty. */
export function makeEmptySegmentsResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    heatmap: { ...HEATMAP, segments: [] } as HeatmapPayload,
    ...over,
  });
}

/** `behavioral_predictions` absent → deriveBehavioralTiles returns [] (never a
 *  fabricated 0%) → the shareability rate tiles are empty. With no share_pull
 *  evidence either, the shareability panel degrades to PanelEmpty. */
export function makeNoBehavioralResult(over: Partial<PredictionResult> = {}): PredictionResult {
  return makeReadingResult({
    behavioral_predictions: undefined,
    ...over,
  });
}
