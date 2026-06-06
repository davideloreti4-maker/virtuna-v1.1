---
phase: 01-strip-to-senses
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/app/api/analyze/route.ts
  - src/components/app/simulation/insights-section.tsx
  - src/components/board/input/input-derive.ts
  - src/components/board/InputResultCard.tsx
  - src/lib/engine/aggregator.ts
  - src/lib/engine/deepseek.ts
  - src/lib/engine/flop-warning.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/stage10-critique.ts
  - src/lib/engine/types.ts
  - src/lib/engine/version.ts
  - vercel.json
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 01 successfully removed the dead scoring machinery (ml, trends, audio-fingerprint, rules, stage11 counterfactuals, platform_fit, sine-jitter engagement) and extracted `maybeAppendLikelyFlopWarning` to its own module. The CTA penalty and Stage 10 confidence adjustment are intact and correct. `*_percentile` fields are properly optional in `types.ts`.

Two blockers found: a storage-race condition in `pipeline.ts` that deletes the rehosed TikTok video _before_ Omni finishes streaming it (and before the filmstrip trigger fires), and a hero UI that renders `"Top %"` (blank number) on the normal post-strip path when the persona aggregate is null. Six warnings cover a permanently-active confidence penalty from removed signals, a misleading "rules and trends" fallback warning, a FALLBACK_BEHAVIORAL `"N/A"` sentinel that reaches the tile renderer, stale API comments, and minor type-safety gaps.

---

## Critical Issues

### CR-01: `rehostPath` deleted before Omni analysis completes (tiktok_url mode)

**File:** `src/lib/engine/pipeline.ts:562-576`
**Issue:** The fire-and-forget `.remove([pathToDelete])` that deletes the re-hosted mp4 from Supabase Storage is dispatched at line 562 — before `analyzeVideoWithOmni(signedVideoUrl)` runs at line 588 and before `triggerFilmstripGeneration(analysisId, segments, signedVideoUrl)` fires at line 613. The delete call is `void`-dispatched (unawaited) but still races with Omni's multi-second streaming read. For a private bucket without CDN edge caching, deleting the Storage object invalidates the signed URL immediately. Omni will receive a mid-stream 404 or 403 error partway through the 35 s analysis window, causing the entire tiktok_url analysis to fail. The filmstrip trigger is worse — it fires _after_ the delete and will always get a dead URL for tiktok_url mode, silently producing no filmstrip for every remix request.

**Fix:** Move the `rehostPath` cleanup to a `finally` block that runs _after_ both Omni and the filmstrip trigger have completed. The `runDecodeStream` path in `route.ts` already uses this pattern (its `cleanup()` is called in `finally`). The `pipeline.ts` path should mirror it:

```typescript
// After analyzeVideoWithOmni and triggerFilmstripGeneration have completed:
try {
  if (signedVideoUrl) {
    const omniOut = await analyzeVideoWithOmni(signedVideoUrl, { ... });
    // ... handle omniOut ...
    if (omniOut.segments?.length > 0 && opts?.analysisId) {
      triggerFilmstripGeneration(opts.analysisId, omniOut.segments, signedVideoUrl);
    }
  }
} finally {
  if (rehostPath !== null) {
    void supabase.storage.from("videos").remove([rehostPath])
      .catch((err: unknown) => log.warn("remix_rehost_cleanup_failed", { ... }));
  }
}
```

---

### CR-02: Hero renders `"Top %"` (blank number) when persona aggregate is null

**File:** `src/components/board/InputResultCard.tsx:174-181`
**Issue:** After Plan 01's strip, DeepSeek's `behavioral_predictions` no longer includes `*_percentile` fields (they were removed from the system prompt). `BehavioralPredictionsSchema` marks them `.optional()` — correct. But `InputResultCard` renders the hero value as `{leadRank ?? lead?.pct}`. When `lead?.pct` is `undefined` (no percentile field) and `leadRank` is `null` (parsed from `undefined`), React renders nothing. The `unit='%'` prop is still passed to `FrameHero`, so the user sees `"PREDICTED RANK: Top %"` with a blank number. This occurs on every analysis where `personaBehavioralAggregate` is null (Wave 3 under threshold, circuit-breaker fast-fail, or text mode).

The `FALLBACK_BEHAVIORAL` in `aggregator.ts:835-844` uses `"N/A"` strings for the percentile fields. This is a separate sub-case: on complete DeepSeek failure, `lead?.pct = "N/A"` (truthy) so `m.pct ? titleCasePct(m.pct) : '—'` in tile rendering outputs `"N/A"` rather than the `'—'` sentinel. The tile should guard against the `"N/A"` value explicitly.

**Fix:**

```tsx
// InputResultCard.tsx — hero value: guard undefined/N/A pct
const heroValue = gated ? (
  'Hold'
) : leadRank != null ? (
  <>
    <span className="text-[16px] font-medium text-white/55">Top </span>
    {leadRank}
  </>
) : (
  <span className="text-[14px] text-white/38">Predicted</span>  // graceful fallback
);

// For tiles in aggregator.ts — change FALLBACK_BEHAVIORAL to omit percentile fields:
const FALLBACK_BEHAVIORAL = {
  completion_pct: 0,
  share_pct: 0,
  comment_pct: 0,
  save_pct: 0,
} as const;
// (percentile fields omitted → undefined → tile renders '—' correctly)
```

---

## Warnings

### WR-01: Permanent -0.10 confidence penalty from always-false `rules` + `trends` signals

**File:** `src/lib/engine/aggregator.ts:210-212` and `src/lib/engine/aggregator.ts:629-631`
**Issue:** `calculateConfidence()` contains RULE-04 penalties: `if (!availability.rules) signal -= 0.05; if (!availability.trends) signal -= 0.05;`. After the Plan 03 strip, `availability.rules` and `availability.trends` are hardcoded `false` (lines 630-631). This means **every prediction in production now carries a permanent -0.10 confidence penalty** derived from signals that were intentionally removed. A model with `HIGH` deepseek confidence, video, agreement, and full Omni data starts at `signal=0.30` instead of the intended `0.40`, pushing many analyses from MEDIUM to LOW confidence and inflating the anti-virality gate rate.

**Fix:** Either remove the two penalty lines from `calculateConfidence` (since the signals are gone and the penalty is meaningless), or gate them on `SCORE_WEIGHT_KEYS.includes(key)` symmetry:

```typescript
// Remove or comment out — rules/trends no longer contribute:
// if (!availability.rules) signal -= 0.05;   // removed in Plan 03
// if (!availability.trends) signal -= 0.05;  // removed in Plan 03
```

---

### WR-02: Misleading "rules and trends" text in HARD-03 dual-failure warning

**File:** `src/lib/engine/aggregator.ts:783-785`
**Issue:** The HARD-03 dual-failure warning reads `"Both LLM providers failed — result based on rules and trends only"`. After Plan 03, there are no rules or trends — the actual fallback is hardcoded zeros. This message is displayed in the board warnings panel and misleads users/operators into thinking there is a functioning fallback when there is none.

**Fix:**
```typescript
warnings.push(
  "Both LLM providers failed — score is based on zero-signal defaults and may not be reliable"
);
```

---

### WR-03: Stale `aggregateScores` JSDoc and inline comments after blend reduction

**File:** `src/lib/engine/aggregator.ts:361` and `:657`, `:674`
**Issue:**
- Line 361: JSDoc still says `"v2 formula: behavioral 35% + gemini 25% + ml 15% + rules 15% + trends 10%"`. Actual post-Plan-04 formula: `behavioral 53.3% + gemini 46.7%` (normalized from 0.40/0.35).
- Line 657 comment: `"// Behavioral score (35% base weight)"` — actual is 40% pre-normalization, 53.3% effective.
- Line 674 comment: `"// Gemini score (25% base weight)"` — actual is 35% pre-normalization, 46.7% effective.

These comments are read by contributors and will cause incorrect assumptions about the score blend.

**Fix:** Update the JSDoc and inline comments to reflect the actual post-Plan-04 weights.

---

### WR-04: Stale `score_weights` field comments in `PredictionResult` type

**File:** `src/lib/engine/types.ts:300-312`
**Issue:** The `score_weights` interface comments still show Phase 8 redistributed values (`behavioral: 0.33`, `gemini: 0.24`, `ml: 0.14`, `rules: 0.14`, `trends: 0.10`). The actual persisted values are `behavioral ≈ 0.533`, `gemini ≈ 0.467`, `ml: 0`, `rules: 0`, `trends: 0`. Any downstream analytics reading `score_weights` from the DB and comparing against these comments will draw wrong conclusions.

**Fix:** Update the comments on the `score_weights` fields to reflect actual Plan-04 values. Consider adding a versioned migration note.

---

### WR-05: `durationSweet[1]` is unchecked — undefined if calibration JSON has < 2 elements

**File:** `src/lib/engine/deepseek.ts:431`
**Issue:** `durationSweet[0]-${durationSweet[1]}` where `durationSweet = calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds`. The Zod schema at line 207 is `z.array(z.number())` with no `.length(2)` constraint. If `calibration-baseline.json` is ever updated with a different shape (or the Zod-fallback path fires for an edge-case), `durationSweet[1]` is `undefined` and the prompt renders `"Duration sweet spot: 15-undefined seconds"` — corrupting the LLM prompt context.

**Fix:**
```typescript
// Either add length constraint to schema:
optimal_range_seconds: z.array(z.number()).length(2),

// Or guard the access:
const sweetLow = durationSweet[0] ?? 15;
const sweetHigh = durationSweet[1] ?? 60;
// `Duration sweet spot: ${sweetLow}-${sweetHigh} seconds`
```

---

### WR-06: `DeepSeekInput` interface retains required `rule_result` and `trend_enrichment` fields that are always stub values

**File:** `src/lib/engine/deepseek.ts:436-441`
**Issue:** `DeepSeekInput.rule_result: RuleScoreResult` and `trend_enrichment: TrendEnrichment` are non-optional required fields. Every caller (pipeline.ts:728-735) now passes hardcoded stub values (`rule_score: 50, matched_rules: []` and `trend_context: "Trend analysis running in parallel..."`) because the real stages were stripped. The stub `trend_context` string is injected verbatim into every Qwen reasoning prompt — a confusing artefact sentence. The interface contract implies real data but receives permanent stubs.

**Fix:** Mark both fields `optional` in `DeepSeekInput` and make `buildDeepSeekUserMessage` omit those sections when empty:
```typescript
export interface DeepSeekInput {
  input: AnalysisInput;
  gemini_analysis: GeminiAnalysis;
  rule_result?: RuleScoreResult;       // optional — always empty post-Plan-03
  trend_enrichment?: TrendEnrichment;  // optional — always empty post-Plan-03
  creator_context?: string;
}
```

---

## Info

### IN-01: `void wantsSSE` suppression comment is dead code

**File:** `src/app/api/analyze/route.ts:439`
**Issue:** `void wantsSSE;` — `wantsSSE` is computed but never read anywhere except this suppression. The variable serves no runtime purpose; only `wantsJSON` is used as a branch condition. The comment `"referenced for traceability"` does not justify a runtime expression that TypeScript would otherwise flag as unused.

**Fix:** Remove the variable and the `void` suppression, or convert it to a pure type-level assertion comment.

---

### IN-02: Array index `key={i}` in `SuggestionsSection` items

**File:** `src/components/app/simulation/insights-section.tsx:74`
**Issue:** The `items.map((item, i) => ... key={i})` uses array index as React key. If suggestions are reordered or filtered between renders, React will reconcile incorrectly. For a static once-rendered list this is low risk, but `CounterfactualSuggestionItem` has a unique `headline` field that would make a more stable key.

**Fix:**
```tsx
key={`${item.type}-${item.headline.slice(0, 20)}`}
```

---

### IN-03: `SCORE_WEIGHT_KEYS` union of dead keys retained in `FeatureVector` / `assembleFeatureVector`

**File:** `src/lib/engine/aggregator.ts:261-330`
**Issue:** `assembleFeatureVector` still populates `ruleScore` and `trendScore` on the returned `FeatureVector` from the stub `ruleResult.rule_score = 50` and `trendEnrichment.trend_score = 0`. These fields feed a `FeatureVector` type that documents them as "Rules engine (0-100)" and "Trend signals (0-100)". The feature vector is persisted to `analysis_results.feature_vector`. Downstream ML training that reads these columns will see `ruleScore: 50` for every row — a constant that adds no signal and will corrupt any future model fit. The stubs should be `0` (neutral) rather than `50` (midpoint of the rules scale).

**Fix:** Change the stub from `rule_score: 50` to `rule_score: 0` in both `assembleFeatureVector` (line 261) and `aggregateScores` (line 381), and update `FeatureVector.ruleScore` initialization accordingly.

---

### IN-04: `v2 formula` comment on `aggregateScores` also contradicts `selectWeights` normalization

**File:** `src/lib/engine/aggregator.ts:363-365`
**Issue:** The function comment describes a static `35%/25%` split, but `selectWeights` applies dynamic normalization so the actual weights are `53.3%/46.7%` when both signals are available and `100%/0%` or `0%/100%` on fallback. The static percentages in the comment will mislead anyone tuning the score formula.

(Partially overlaps WR-03 — treat as a combined update.)

---

### IN-05: `ENGINE_VERSION` bump comment references a superseded validation report

**File:** `src/lib/engine/version.ts:7-8`
**Issue:** The comment says `"3.0.0-dev → 3.0.0 ... Qwen-migration deviation sign-off; see 13-FINAL-VALIDATION-REPORT.md"` but the current value is `"3.1.0"`. The version was advanced to 3.1.0 without updating the rationale comment, making the commit history rationale stale. Minor but worth updating before the next version bump.

**Fix:** Update the comment to reference the Phase 01 Strip-to-Senses validation artefact.

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
