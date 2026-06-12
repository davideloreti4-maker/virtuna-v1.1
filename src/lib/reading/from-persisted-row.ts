/**
 * fromPersistedRow — the PURE, DETERMINISTIC reload normalizer (D-11, Phase 2 / 02-03).
 *
 * PURITY CONTRACT (the DATA-02 precondition): this module uses no randomness source,
 * no wall-clock/time source, no network call, and does NO DB I/O. It receives an
 * already-fetched, already-authorized `analysis_results` row and returns the narrow
 * `CanonicalReading` shape. `fromPersistedRow(sameRow)` therefore returns deep-equal
 * output on every call — determinism is what makes the live-vs-replay identical-render
 * contract (02-04 / P04) provable.
 *
 * This module ABSORBS the deterministic shims that used to live inline in
 * `src/app/api/analysis/[id]/route.ts` (numeric coercion, the degradation-tier derive,
 * the defensive `variants.*` reads) and DROPS the non-deterministic ones:
 *   - the synthesized heatmap (randomized persona ids) — GONE. The heatmap column is read
 *     verbatim; null stays null (D-14 / Pitfall 3 — the view-model emits retention-degraded).
 *   - `optimal_post_window` recompute + `creator_profiles` lookup — GONE. Time/DB-dependent
 *     and not a Reading block (D-09 omission rule).
 *
 * Defensive reads: the JSONB `variants` bag (hero / apollo / craft) is written by racing
 * post-`complete` writers and any field may be absent — every read is optional-chained so a
 * partial (or wholly missing) bag degrades the dependent field to null rather than throwing.
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
} from "@/lib/engine/types";
import type { CanonicalReading } from "./block-types";

/**
 * The fields this normalizer reads off the raw `analysis_results` row. Intentionally a
 * loose structural shape (not the generated `Row` type): the JSONB columns persist as
 * `Json` and the `variants` bag carries live-only fields the schema never declared, so a
 * permissive read surface keeps the function tolerant of partial/old rows.
 */
interface PersistedRowShape {
  overall_score?: number | string | null;
  confidence?: number | string | null;
  confidence_label?: string | null;
  anti_virality_gated?: boolean | null;
  signal_availability?: SignalAvailability | null;
  heatmap?: HeatmapPayload | null;
  hook_decomposition?: HookDecomposition | null;
  behavioral_predictions?: BehavioralPredictions | null;
  persona_behavioral_aggregate?: PersonaBehavioralAggregate | null;
  suggestions?: Suggestion[] | null;
  counterfactuals?: CounterfactualResult | null;
  factors?: Factor[] | null;
  variants?: {
    hero?: HeroBlock | null;
    apollo?: {
      rewrites?: ApolloRewrite[] | null;
      ceiling_capper?: string;
    } | null;
    craft?: {
      overall_impression?: string | null;
      content_summary?: string | null;
    } | null;
  } | null;
}

/** Coerce a numeric column that may have been persisted as a string (Pitfall 5). */
function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "string") return Number.parseFloat(value);
  return value ?? 0;
}

/** Engine confidence thresholds — used ONLY to backfill genuinely-null old rows. */
function deriveConfidenceLabel(confidence: number): "HIGH" | "MEDIUM" | "LOW" {
  if (confidence >= 0.7) return "HIGH";
  if (confidence >= 0.4) return "MEDIUM";
  return "LOW";
}

/**
 * Normalize an already-authorized persisted `analysis_results` row into the narrow
 * `CanonicalReading` intersection shape. Pure + deterministic (see file header).
 */
export function fromPersistedRow(input: unknown): CanonicalReading {
  const row = (input ?? {}) as PersistedRowShape;

  const overallScore = toNumber(row.overall_score);
  const confidence = toNumber(row.confidence);

  // Degradation tiers — derived deterministically from the persisted signal_availability
  // JSONB (no dedicated column). Dual-dead → unavailable; single-dead → partial (D-14).
  const sa = row.signal_availability ?? null;
  const analysisUnavailable = sa ? !sa.gemini && !sa.behavioral : false;
  const partialAnalysis = sa ? sa.gemini !== sa.behavioral : false;

  // Prefer the persisted column; derive from engine thresholds ONLY when genuinely null
  // (old rows) — no drift-prone unconditional re-derive.
  const confidenceLabel =
    (row.confidence_label as "HIGH" | "MEDIUM" | "LOW" | null | undefined) ??
    deriveConfidenceLabel(confidence);
  const antiViralityGated = row.anti_virality_gated ?? confidence < 0.4;

  // variants.* — every read optional-chained; absent (raced/failed writer) → null.
  const variants = row.variants ?? null;
  const hero = variants?.hero ?? null;
  const apolloRaw = variants?.apollo ?? null;
  const apolloReasoning =
    apolloRaw && apolloRaw.rewrites
      ? {
          rewrites: apolloRaw.rewrites,
          ...(apolloRaw.ceiling_capper !== undefined
            ? { ceiling_capper: apolloRaw.ceiling_capper }
            : {}),
        }
      : null;
  const craft = variants?.craft ?? null;

  return {
    // Verdict inputs — flattened columns present on both paths.
    overallScore,
    confidence,
    confidenceLabel,
    antiViralityGated,

    // Degradation tiers.
    analysisUnavailable,
    partialAnalysis,
    signalAvailability: sa,

    // Apollo / hero — persisted under variants.hero / variants.apollo.
    hero,
    apolloReasoning,

    // Hook — flattened column.
    hookDecomposition: row.hook_decomposition ?? null,

    // Retention — the persisted heatmap COLUMN value ONLY, never synthesized.
    heatmap: row.heatmap ?? null,

    // Audience + persona — flattened columns.
    behavioralPredictions: row.behavioral_predictions ?? null,
    personaBehavioralAggregate: row.persona_behavioral_aggregate ?? null,

    // Fixes inputs — flattened columns.
    suggestions: row.suggestions ?? [],
    counterfactuals: row.counterfactuals ?? null,

    // Drivers — flattened column.
    factors: row.factors ?? [],

    // Content summary — from variants.craft; defensive nullable reads.
    contentSummary: craft?.content_summary ?? null,
    overallImpression: craft?.overall_impression ?? null,
  };
}
