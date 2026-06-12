/**
 * The Phase 2 type contract: the `ReadingBlock` discriminated union (D-13) and the
 * deliberately-narrow `CanonicalReading` shape (D-09). This is what the whole phase
 * funnels through — downstream plans implement against these contracts directly
 * (normalizer in 02-03, view-model in 02-04; Phase 4 renders `ReadingBlock[]`).
 *
 * D-13 — `ReadingBlock` is PURE DATA. No `className` / `order` / `layout` /
 * presentation hints of any kind. The view-model owns *what is true*; Phase 4 UI
 * owns rendering. Consumers `switch (block.kind)` with a `never`-typed default for
 * exhaustiveness.
 *
 * D-09 — `CanonicalReading` is the live∩persisted INTERSECTION enforcer. It is how
 * the "the contract consumes only the field intersection of live ∩ persisted shapes"
 * rule becomes a COMPILE-TIME guarantee instead of a code-review hope: a live-only
 * field that is not on `CanonicalReading` physically cannot enter `toReadingBlocks`.
 *
 * OMISSION RULE (D-02 / D-03 / D-09) — the following live-only / dead fields are
 * deliberately EXCLUDED from `CanonicalReading` and have NO block in the union:
 *   - the predicted-engagement range (the live top-level field; persisted under a
 *     DIFFERENT `variants.*` key) — live-only by decision, excluded both ways (D-09).
 *     Its snake_case identifiers are intentionally kept OUT of this file so the
 *     intersection rule is grep-assertable.
 *   - `optimal_post_window` — time + DB-dependent recompute on replay (non-deterministic).
 *   - `audio_fingerprint` — live-only (zero matches across `src/app/api/` persist surface,
 *     PATTERNS Resolved Q1), so an `audio` block would break the intersection → DROPPED,
 *     not conditional-render.
 *   - `emotion_arc`, `retrieval_evidence`/`retrieval_score`, `platform_fit`, `critique`,
 *     `reasoning`, `rule_score`/`trend_score`/`gemini_score`/`ml_score`, raw component
 *     scores, `matched_trends`, `feature_vector`, telemetry/meta — D-02/D-03 dead set.
 */

import type {
  ApolloRewrite,
  BehavioralPredictions,
  CounterfactualResult,
  Factor,
  HeatmapPayload,
  HeroBlock,
  HookDecomposition,
  PersonaBehavioralAggregate,
  SignalAvailability,
  Suggestion,
} from '@/lib/engine/types';
import type { VerdictBand } from './verdict-bands';

// Re-export so block + canonical consumers can import the band type from one place.
export type { VerdictBand } from './verdict-bands';

/** A retention beat — one weighted-attention segment of the heatmap timeline. */
export type RetentionSegment = HeatmapPayload['segments'][number];

/**
 * The discriminated Reading-block union (D-13). Each member is `{ kind; ...data }`
 * — pure data, no presentation hints. NOTE: there is intentionally NO `audio`
 * member (audio_fingerprint is live-only — D-09 / Resolved Q1).
 */
export type ReadingBlock =
  // The throne — band + grounded one-line why + confidence-in-language (D-04…D-07).
  // `score` is the demoted /100 supporting evidence, never the headline.
  | { kind: 'verdict'; band: VerdictBand; why: string; confidenceLanguage: string; score: number }
  // The moat: Apollo's expert read, foregrounded (D-01 #2).
  | { kind: 'expert-insight'; ceiling: string | null; theOneFix: string | null; rewrites: ApolloRewrite[] }
  // Hook decomposition — weakest modality + per-segment breakdown.
  | { kind: 'hook'; decomposition: HookDecomposition }
  // Retention beats — heatmap segments + weighted attention curve.
  | { kind: 'retention'; segments: RetentionSegment[]; weightedCurve: number[] }
  // D-14 retention degrade — heatmap column null; never a fabricated curve.
  | { kind: 'retention-degraded'; reason: 'heatmap_unavailable' }
  // Audience behavior — absolute predicted rates + qualitative intent chips.
  | {
      kind: 'audience';
      share: number;
      completion: number;
      comment: number;
      save: number;
      intents: string[];
    }
  // Band-adaptive fixes — suggestions + counterfactual rewrites.
  | { kind: 'fixes'; items: Fix[] }
  // The 5 graded drivers with rationale.
  | { kind: 'drivers'; factors: Factor[] }
  // The qualitative persona archetype aggregate.
  | { kind: 'persona-read'; aggregate: PersonaBehavioralAggregate }
  // Editorial one-liner from craft.
  | { kind: 'content-summary'; text: string }
  // D-14 whole-analysis degradation — first-class honest block.
  | { kind: 'analysis-degraded'; tier: 'unavailable' | 'partial'; have: string[] };

/**
 * A single actionable fix shown in the `fixes` block. Sourced from `suggestions` and
 * `counterfactuals.suggestions`; pure data (no rendering order). `headline` is the
 * lead line; `detail`/`category`/`priority` are optional supporting fields.
 */
export interface Fix {
  headline: string;
  detail?: string | null;
  category?: string | null;
  priority?: 'high' | 'medium' | 'low' | null;
}

/**
 * The deliberately-narrow intersection shape (D-09). BOTH `fromPersistedRow`
 * (02-03) and `canonicalFromLive` (02-04) produce this, and `toReadingBlocks`
 * exclusively consumes it — so live-only fields physically cannot reach the blocks.
 *
 * Carries ONLY live∩persisted fields. See the OMISSION RULE in this file's header
 * for what is excluded and why. Every field that can be absent on a raced/failed
 * `variants.*` write is nullable here so the view-model degrades rather than throws.
 */
export interface CanonicalReading {
  // Verdict inputs — flattened columns, present on both paths.
  overallScore: number;
  confidence: number;
  confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW';
  antiViralityGated: boolean;

  // Degradation tiers — derived deterministically from signal_availability (D-14).
  analysisUnavailable: boolean;
  partialAnalysis: boolean;
  signalAvailability: SignalAvailability | null;

  // Apollo / hero — live top-level; persisted under variants.hero / variants.apollo.
  // Nullable: absent when Apollo raced/failed → dependent blocks degrade/omit.
  hero: HeroBlock | null;
  apolloReasoning: {
    rewrites: ApolloRewrite[];
    ceiling_capper?: string;
  } | null;

  // Hook — flattened column; null when absent → hook block omitted.
  hookDecomposition: HookDecomposition | null;

  // Retention — the persisted heatmap COLUMN value ONLY, never synthesized.
  // null → retention-degraded block (D-14 / Pitfall 3).
  heatmap: HeatmapPayload | null;

  // Audience + persona — flattened columns.
  behavioralPredictions: BehavioralPredictions | null;
  personaBehavioralAggregate: PersonaBehavioralAggregate | null;

  // Fixes inputs — flattened columns.
  suggestions: Suggestion[];
  counterfactuals: CounterfactualResult | null;

  // Drivers — flattened column.
  factors: Factor[];

  // Content summary — from variants.craft; nullable defensive read.
  contentSummary: string | null;
  overallImpression: string | null;
}
