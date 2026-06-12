/**
 * view-model.ts — the PURE Reading view-model (DATA-01/DATA-02/DATA-04, Phase 2 / 02-04).
 *
 * Two exports, one doctrine:
 *
 *   - `canonicalFromLive(result)` — the LIVE-half adapter. It reads the live
 *     `PredictionResult` (`result.hero` / `result.apollo_reasoning` TOP-LEVEL —
 *     PATTERNS Resolved Q2) and produces the SAME narrow `CanonicalReading` shape
 *     that `fromPersistedRow` (02-03) produces from the persisted row. Both halves
 *     converge on `CanonicalReading`; that convergence is what makes the DATA-02
 *     deep-equal (`identical-render.test.ts`) meaningful — a live Reading and its
 *     re-opened resting document yield IDENTICAL blocks.
 *
 *   - `toReadingBlocks(canonical)` — the PURE selector (DATA-01). No React, no
 *     fetch, no I/O. It consumes `CanonicalReading` ONLY (D-09 — never a raw
 *     `PredictionResult`, so live-only fields physically cannot reach a block) and
 *     emits the value-bearing `ReadingBlock[]`, inheriting the board's honest
 *     omit-discipline (verdict-derive.ts L6-8): every value traces to a real field;
 *     a field that isn't present produces no block (never a fabricated one).
 *
 * Degradation is two-tier (D-14):
 *   - an INDIVIDUAL null field → its block is silently omitted;
 *   - WHOLE-analysis degradation (`analysisUnavailable` / `partialAnalysis`) → a
 *     first-class honest `analysis-degraded` block carrying `have: string[]`.
 *
 * The verdict (DATA-04) is band + grounded why + confidence-in-LANGUAGE; the `/100`
 * is demoted to the in-body `score` field, NEVER the headline (D-05/D-06/D-07).
 *
 * No `lib/engine/` edits; ENGINE_VERSION unchanged — this is presentation only.
 */

import type { PredictionResult } from '@/lib/engine/types';
import type { CanonicalReading, Fix, ReadingBlock } from './block-types';
import { bandFor } from './verdict-bands';

// Re-export the block + canonical types so test files + Phase 4 consumers can
// import the contract from the view-model they call.
export type { ReadingBlock, CanonicalReading } from './block-types';

/* ────────────────────────────────────────────────────────────────────────────
 * canonicalFromLive — the live-half adapter into the shared CanonicalReading.
 *
 * MIRRORS fromPersistedRow (02-03) field-for-field so both paths converge:
 *   - flattened columns ← live top-level fields;
 *   - hero / apolloReasoning ← result.hero / result.apollo_reasoning (Resolved Q2:
 *     they live TOP-LEVEL on the live `complete` payload, then the post-complete
 *     writer COPIES them into variants — same object → deep-equal holds);
 *   - apolloReasoning is NARROWED to { rewrites, ceiling_capper? } and is null when
 *     rewrites are absent — byte-identical to the persisted narrowing (D-09);
 *   - it MUST NOT read predicted_engagement / optimal_post_window / audio_fingerprint.
 * ──────────────────────────────────────────────────────────────────────────── */
export function canonicalFromLive(result: PredictionResult): CanonicalReading {
  const r = (result ?? {}) as PredictionResult;

  const overallScore = toNumber(r.overall_score);
  const confidence = toNumber(r.confidence);

  // Degradation tiers — prefer the explicit live flags (the aggregator sets them
  // FROM signal_availability on every run, so on real data they equal the
  // sa-derive used by the persisted half → deep-equal holds). Fall back to the
  // same sa-derive when a flag is absent (synthetic/partial inputs).
  const sa = r.signal_availability ?? null;
  const analysisUnavailable =
    r.analysis_unavailable ?? (sa ? !sa.gemini && !sa.behavioral : false);
  const partialAnalysis =
    r.partial_analysis ?? (sa ? sa.gemini !== sa.behavioral : false);

  const confidenceLabel =
    (r.confidence_label as 'HIGH' | 'MEDIUM' | 'LOW' | null | undefined) ??
    deriveConfidenceLabel(confidence);
  const antiViralityGated = r.anti_virality_gated ?? confidence < 0.4;

  // Apollo / hero — read TOP-LEVEL (Resolved Q2). Narrow apollo_reasoning to the
  // persisted-equivalent { rewrites, ceiling_capper? } shape; null when no rewrites.
  const hero = r.hero ?? null;
  const apolloRaw = r.apollo_reasoning ?? null;
  const apolloReasoning =
    apolloRaw && apolloRaw.rewrites
      ? {
          rewrites: apolloRaw.rewrites,
          ...(apolloRaw.ceiling_capper !== undefined
            ? { ceiling_capper: apolloRaw.ceiling_capper }
            : {}),
        }
      : null;

  return {
    // Verdict inputs.
    overallScore,
    confidence,
    confidenceLabel,
    antiViralityGated,

    // Degradation tiers.
    analysisUnavailable,
    partialAnalysis,
    signalAvailability: sa,

    // Apollo / hero — top-level live, narrowed identically to the persisted half.
    hero,
    apolloReasoning,

    // Hook — flattened.
    hookDecomposition: r.hook_decomposition ?? null,

    // Retention — the heatmap value ONLY, never synthesized; null stays null.
    heatmap: r.heatmap ?? null,

    // Audience + persona.
    behavioralPredictions: r.behavioral_predictions ?? null,
    personaBehavioralAggregate: r.persona_behavioral_aggregate ?? null,

    // Fixes inputs.
    suggestions: r.suggestions ?? [],
    counterfactuals: r.counterfactuals ?? null,

    // Drivers.
    factors: r.factors ?? [],

    // Content summary — live emits these top-level; persisted reads variants.craft.
    contentSummary: r.content_summary ?? null,
    overallImpression: r.overall_impression ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * toReadingBlocks — the pure selector. CanonicalReading → ReadingBlock[].
 * ──────────────────────────────────────────────────────────────────────────── */
export function toReadingBlocks(c: CanonicalReading): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];

  // 1. Verdict — ALWAYS emitted (DATA-04). Band from the score; grounded why; the
  //    confidence rendered in LANGUAGE; the /100 demoted to in-body `score`.
  blocks.push({
    kind: 'verdict',
    band: bandFor(c.overallScore),
    why: deriveWhy(c),
    confidenceLanguage: confidenceLanguage(c),
    score: c.overallScore,
  });

  // 2. Whole-analysis degradation (D-14) — first-class honest block. Surfaced
  //    alongside the verdict so the UI never presents a half/zero basis as whole.
  if (c.analysisUnavailable || c.partialAnalysis) {
    blocks.push({
      kind: 'analysis-degraded',
      tier: c.analysisUnavailable ? 'unavailable' : 'partial',
      have: presentSignals(c),
    });
  }

  // 3. Expert insight — Apollo's read, foregrounded (D-01 #2). Omit when absent.
  if (c.apolloReasoning) {
    blocks.push({
      kind: 'expert-insight',
      ceiling: c.apolloReasoning.ceiling_capper ?? c.hero?.ceiling ?? null,
      theOneFix: c.hero?.the_one_fix ?? null,
      rewrites: c.apolloReasoning.rewrites,
    });
  }

  // 4. Hook decomposition — omit when the flattened column is null.
  if (c.hookDecomposition) {
    blocks.push({ kind: 'hook', decomposition: c.hookDecomposition });
  }

  // 5. Retention — real heatmap → retention beats; null → retention-degraded
  //    (D-14 / Pitfall 3). NEVER a synthesized curve.
  if (c.heatmap) {
    blocks.push({
      kind: 'retention',
      segments: c.heatmap.segments ?? [],
      weightedCurve: c.heatmap.weighted_curve ?? [],
    });
  } else {
    blocks.push({ kind: 'retention-degraded', reason: 'heatmap_unavailable' });
  }

  // 6. Audience — absolute predicted rates + qualitative intent chips. Per-tile
  //    omit when an absolute rate is absent; whole block omitted when no rates at
  //    all (mirrors deriveBehavioralTiles).
  const audience = deriveAudience(c);
  if (audience) blocks.push(audience);

  // 7. Fixes — suggestions + counterfactual rewrites. Omit when empty.
  const fixes = deriveFixes(c);
  if (fixes.length > 0) blocks.push({ kind: 'fixes', items: fixes });

  // 8. Drivers — the graded factors. Omit when empty.
  if (c.factors.length > 0) {
    blocks.push({ kind: 'drivers', factors: c.factors });
  }

  // 9. Persona read — the qualitative aggregate. Omit when absent.
  if (c.personaBehavioralAggregate) {
    blocks.push({ kind: 'persona-read', aggregate: c.personaBehavioralAggregate });
  }

  // 10. Content summary — editorial one-liner from craft. Omit when absent/empty.
  const summary = c.contentSummary ?? c.overallImpression;
  if (summary) blocks.push({ kind: 'content-summary', text: summary });

  return blocks;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Derivation helpers — all pure; every value traces to a real field.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The grounded "why" chain (D-05). ONLY ever surfaces engine-authored text or the
 * empty string (band-only) — NEVER a generic/fabricated sentence:
 *   hero.verdict_line → hero.the_one_fix → top factor.rationale → ''.
 */
function deriveWhy(c: CanonicalReading): string {
  if (c.hero?.verdict_line) return c.hero.verdict_line;
  if (c.hero?.the_one_fix) return c.hero.the_one_fix;
  const top = [...c.factors].sort((a, b) => b.score - a.score)[0];
  if (top?.rationale) return top.rationale;
  return '';
}

/**
 * Confidence expressed in band LANGUAGE (D-06) — words, never a number and never a
 * `/100`. Folds the anti-virality gate (D-07 "Mixed signals") into the wording so
 * the throne shows judgment, not a metric. Phase 3 adds the boundary-buffer firing
 * (the gate already routes here — a clear seam, no new branch needed).
 */
function confidenceLanguage(c: CanonicalReading): string {
  if (c.antiViralityGated) return 'Mixed signals';
  switch (c.confidenceLabel) {
    case 'HIGH':
      return 'Confident read';
    case 'MEDIUM':
      return 'Reasonably confident';
    case 'LOW':
      return 'Tentative read';
    default:
      return 'Tentative read';
  }
}

/** Which signals are present — the honest `have` list for the degraded block. */
function presentSignals(c: CanonicalReading): string[] {
  const have: string[] = [];
  if (c.apolloReasoning) have.push('expert-insight');
  if (c.hookDecomposition) have.push('hook');
  if (c.heatmap) have.push('retention');
  if (c.behavioralPredictions) have.push('audience');
  if (c.personaBehavioralAggregate) have.push('persona-read');
  if (c.factors.length > 0) have.push('drivers');
  if (c.suggestions.length > 0 || c.counterfactuals) have.push('fixes');
  return have;
}

/**
 * The audience block — absolute predicted rates only (the engine's `*_pct`), with
 * qualitative intent labels as chips. Returns null when no absolute rate exists
 * (whole block omitted). Mirrors `deriveBehavioralTiles`' per-field omit-loop.
 */
function deriveAudience(c: CanonicalReading): ReadingBlock | null {
  const bp = c.behavioralPredictions;
  if (!bp) return null;

  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  const share = num(bp.share_pct);
  const completion = num(bp.completion_pct);
  const comment = num(bp.comment_pct);
  const save = num(bp.save_pct);

  // No absolute rate present at all → omit the block (never fabricate zeros).
  if (share === null && completion === null && comment === null && save === null) {
    return null;
  }

  const intents = [
    bp.share_percentile,
    bp.completion_percentile,
    bp.comment_percentile,
    bp.save_percentile,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);

  return {
    kind: 'audience',
    share: share ?? 0,
    completion: completion ?? 0,
    comment: comment ?? 0,
    save: save ?? 0,
    intents,
  };
}

/**
 * The band-adaptive fixes — sourced from `suggestions` and `counterfactuals`. Pure
 * data; no rendering order assumed. Each item's headline traces to a real field.
 */
function deriveFixes(c: CanonicalReading): Fix[] {
  const items: Fix[] = [];

  for (const s of c.suggestions) {
    // Suggestions persist as { text, priority, category } objects, but older/raw
    // rows (and the engine's pre-normalized stream) can carry bare strings — accept
    // both so a real suggestion always becomes a fix (never silently dropped).
    if (typeof s === 'string') {
      if (!s) continue;
      items.push({ headline: s });
      continue;
    }
    if (!s?.text) continue;
    items.push({
      headline: s.text,
      category: s.category ?? null,
      priority: s.priority ?? null,
    });
  }

  for (const cf of c.counterfactuals?.suggestions ?? []) {
    if (!cf?.headline) continue;
    items.push({
      headline: cf.headline,
      detail: cf.detail ?? null,
      category: cf.signal_anchor ?? null,
    });
  }

  return items;
}

/* ── Shared coercions — mirror fromPersistedRow so both paths normalize alike. ── */

/** Coerce a numeric field that may arrive as a string. */
function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'string') return Number.parseFloat(value);
  return value ?? 0;
}

/** Engine confidence thresholds — backfill a genuinely-null label only. */
function deriveConfidenceLabel(confidence: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (confidence >= 0.7) return 'HIGH';
  if (confidence >= 0.4) return 'MEDIUM';
  return 'LOW';
}
