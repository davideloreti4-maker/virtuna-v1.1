---
phase: 01-strip-to-senses
plan: 04
subsystem: engine/scoring
tags: [aggregator, blend-cut, stage10, deepseek, test-reconciliation, R9, R5]
dependency_graph:
  requires: [01-02, 01-03]
  provides:
    - "behavioral+gemini-only blend; dead keys (ml,rules,trends,audio,retrieval,platform_fit) removed"
    - "stage10 flags vestigial strings deleted; confidence_adjustment + Checks #1/#2 preserved"
    - "deepseek percentile-framing instruction removed; calibration JSON kept for differentiators+duration"
    - "ALL active-tree aggregator tests reconciled to 2-key blend; no ../ml or ../stage11 mock strands"
  affects: [01-05, 01-06]
tech_stack:
  added: []
  patterns:
    - "2-key blend: selectWeights returns {behavioral, gemini} only; dead keys drop from return type"
    - "score_weights on PredictionResult spreads {behavioral,gemini} + ml:0/rules:0/trends:0 for back-compat"
    - "CTA penalty preserved on live gemini term (applyCtaPenalty, Pitfall 7)"
    - "stage10 checks fire via confidence_adjustment; flags[] always [] after flag-string deletion"
key_files:
  modified:
    - src/lib/engine/aggregator.ts
    - src/lib/engine/stage10-critique.ts
    - src/lib/engine/deepseek.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/aggregator-anti-virality.test.ts
    - src/lib/engine/__tests__/aggregator-audio.test.ts
    - src/lib/engine/__tests__/aggregator-cta-penalty.test.ts
    - src/lib/engine/__tests__/aggregator-optimal-post.test.ts
    - src/lib/engine/__tests__/aggregator-phase10.test.ts
    - src/lib/engine/__tests__/stage10-critique.test.ts
  deleted:
    - src/lib/engine/__tests__/aggregator-platform-fit.test.ts
key_decisions:
  - "aggregator-phase10.test.ts UPDATED (not deleted) — 2-key behavioral+gemini assertions with platform_fit/audio ABSENT; 5 meaningful tests retained (both-available, behavioral-off, gemini-off, both-off, provenance-only flags)"
  - "aggregator-platform-fit.test.ts DELETED — Phase 9 Wave 0 stub asserting a now-removed signal key; no longer referenced by Plan 05 travels list"
  - "applyCtaPenalty KEPT — modifies live gemini term; removing it shifts the live score (not an honesty correction, RESEARCH Pitfall 7 / Open Q1)"
  - "stage10 flags-only scope confirmed — delete flag strings (vestigial), KEEP confidence_adjustment (D1.4/R5)"
  - "calibration-baseline.json KEPT — still feeds viral differentiators + duration sweet-spot into buildDeepSeekUserMessage (RESEARCH Pitfall 4 / Claim 5)"
  - "Check #4 thin-signal gate: sa.audio/sa.retrieval sub-conditions removed; now fires on gemini_hook=false + personas=false (2 unavailable post-blend-cut)"
metrics:
  duration: ~60min
  completed: 2026-06-04T09:53:20Z
  tasks: 3
  files_modified: 10
  files_deleted: 1
---

# Phase 01 Plan 04: Dead Blend Keys + Deepseek Labels + Test Reconciliation Summary

**Behavioral+gemini-only blend active; deepseek top-X% percentile framing removed; stage10 flags deleted; all aggregator tests reconciled to the 2-key shape with no ../ml or ../stage11 mock strands.**

## Status

**COMPLETE** — All 3 tasks done, each committed individually.

## Performance

- **Duration:** ~60 min
- **Started:** 2026-06-04
- **Completed:** 2026-06-04T09:53:20Z
- **Tasks:** 3/3
- **Files modified:** 10 modified, 1 deleted

## Accomplishments

### Task 1: Cut dead blend keys (aggregator.ts)

- `SCORE_WEIGHT_KEYS` reduced to `["behavioral", "gemini"]`
- `SCORE_WEIGHTS` trimmed to 2 keys (0.40/0.35)
- `selectWeights` simplified to 2-key redistribution: both-on → normalize; one-off → full weight to remaining; both-off → zeros
- Scoring sum = `behavioral_score * w.behavioral + ctaPenaltyApplied_gemini * w.gemini`
- `applyCtaPenalty` KEPT (modifies live gemini term, not a dead-key artifact)
- Dead `SignalAvailability` blend flags (ml/rules/trends) set `false` and labeled "provenance only" — retained for JSONB persistence; NOT removed from the struct (type requires them)
- `platform_fit` removed from blend; set `false` in availability; `platform_fit` field set `null` in result; `PlatformFitResult` import removed
- `score_weights` on result spreads 2-key weights + `ml:0, rules:0, trends:0` for back-compat with `PredictionResult.score_weights` type
- `audio_score` removed from scoring sum; `audio_perceptual_score` still surfaced on result (D-G3)

### Task 2: Stage10 vestigial flags (stage10-critique.ts)

- All `flags.push(...)` calls removed from `deriveCritique` (was 4 per check)
- `flags: []` returned (back-compat — CritiqueResult type retains the field)
- `confidence_adjustment` + `[-0.20, 0]` clamp KEPT (live input to `result.confidence` via `applyCritiqueAdjustment`, D1.4/R5)
- Check #1 (gemini vs behavioral gap) + Check #2 (score vs factors) KEPT
- Check #4: `sa.audio !== true` and `sa.retrieval !== true` sub-conditions removed; now counts `gemini_hook=false` + `personas=false` as the 2-unavailable thin-signal indicators
- `stage10-critique.test.ts` updated: all flag-content assertions replaced with `confidence_adjustment` value assertions

### Task 3: Deepseek label removal + test reconciliation

**deepseek.ts:**
- Step 5 "top X%" framing instruction removed; replaced with qualitative relative-label instruction
- Four `*_percentile` schema field declarations removed from output format template (renamed to `*_relative` in the prompt schema description)
- Percentile benchmark block removed from `buildDeepSeekUserMessage` (the 3 p50/p75/p90 rate lines)
- `loadCalibrationData` + calibration-baseline.json KEPT — still feeds viral differentiators + duration sweet-spot
- temp0+seed, cache split, 5-step reasoning UNCHANGED

**Aggregator test reconciliation (complete):**
- `aggregator-platform-fit.test.ts`: DELETED (Phase 9 Wave 0 stub; plan states this in key_decisions)
- `aggregator-phase10.test.ts`: UPDATED — 5 tests asserting 2-key behavioral+gemini shape; platform_fit/audio ABSENT; superseded per-signal redistribution cases removed
- `aggregator-cta-penalty.test.ts`: removed `vi.mock("../ml")` + simplified stage11 mock (only `maybeAppendLikelyFlopWarning`)
- `aggregator-optimal-post.test.ts`: removed `vi.mock("../ml")` + simplified stage11 mock
- `aggregator-audio.test.ts`: removed SCORE_WEIGHTS.audio/SCORE_WEIGHT_KEYS-audio assertions; replaced with 2-key shape assertions; `vi.mock("../stage11-counterfactuals")` already had no `runStage11Counterfactuals` — left as-is
- `aggregator-anti-virality.test.ts`: removed `vi.mock("../ml")` + removed `runStage11Counterfactuals` from stage11 mock
- `aggregator.test.ts`: all `selectWeights` tests updated to 2-key; retrieval integration test updated; Phase 4 Wave 0 test updated to assert 2-key shape

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Cut dead blend keys to behavioral+gemini; remove PlatformFitResult import | `6bc020a5` |
| 2 | Remove stage10 vestigial flags; keep confidence_adjustment | `743bdfdd` |
| 3 | Remove deepseek top-X% labels + full aggregator test reconciliation | `43d1cf3f` |

Note: auto-commit `235f3503` ("test: changes") was triggered by the post-commit hook mid-execution and captured some Task 3 file changes. The formal plan commits above represent the complete, authoritative record.

## Verification Results

- `grep -A1 "SCORE_WEIGHT_KEYS =" aggregator.ts` → `["behavioral", "gemini"]`
- `grep -q "applyCtaPenalty" aggregator.ts` → PRESENT
- `grep -c "flags.push" stage10-critique.ts` → 0
- `grep -q "confidence_adjustment" stage10-critique.ts` → PRESENT
- `grep -c "_percentile" deepseek.ts` → 0
- `grep -q "calibration" deepseek.ts` → PRESENT
- `test ! -f aggregator-platform-fit.test.ts` → CONFIRMED DELETED
- `npx tsc --noEmit` → No errors
- `npx vitest run [8 named test files]` → PASS (134) FAIL (0)

## Expected Score Delta (Plan 06)

Per RESEARCH Pitfall 6 and Claim 4: removing the `trends` key (0.10 nominal weight) redistributes weight to behavioral+gemini, producing a **small upward nudge** in overall_score. This is the expected "honesty correction" — trends always had `trend_score=0` (Plan 03 removed the call site), so its 0.10 weight multiplied 0 but still diluted the normalized weights of behavioral+gemini. With trends gone, behavioral+gemini receive their full normalized shares.

**Expected direction:** scores shift upward by ~1-3 points (estimate based on weight redistribution math: trends 0.10 / total 0.75 ≈ 13% weight freed; gemini normalizes from 0.35/0.85≈0.412 to 0.35/0.75≈0.467, behavioral from 0.40/0.85≈0.471 to 0.40/0.75≈0.533). Plan 06 measures + confirms this on the fixed test video against the 78-79 baseline.

## aggregator-phase10.test.ts Decision

**UPDATED** (not deleted). The 2-key shape leaves 5 meaningful assertions:
1. Both available → only behavioral+gemini keys returned; platform_fit/audio ABSENT; sum ~1.0
2. behavioral=false → gemini=1, behavioral=0
3. gemini=false → behavioral=1, gemini=0
4. Both unavailable → zeros; no throw
5. Provenance-only flags (audio, platform_fit) do NOT affect behavioral/gemini distribution

These are genuine behavioral assertions not already covered in the main aggregator.test.ts `selectWeights` block (which focuses more on the all-signals-present normalized value). The file was worth keeping.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] score_weights back-compat spread**
- **Found during:** Task 1 — TypeScript error TS2739: `selectWeights` return type `{behavioral,gemini}` doesn't satisfy `PredictionResult.score_weights` type which requires `ml`, `rules`, `trends`
- **Fix:** `score_weights: { ...weights, ml: 0, rules: 0, trends: 0 }` — spreads the 2-key weights and adds the required dead keys as 0 for type compatibility. types.ts score_weights type cleanup is a future P3/P5 task (file is >500 lines, plan deferred)
- **Files modified:** `src/lib/engine/aggregator.ts`
- **Commit:** `6bc020a5`

**2. [Rule 2 - Correctness] SignalAvailability ml/rules/trends required fields**
- **Found during:** Task 1 — TypeScript error TS2739: `availability` object missing required `ml`, `rules`, `trends` fields from `SignalAvailability` interface in types.ts
- **Fix:** Added `ml: false`, `rules: false`, `trends: false` labeled as "provenance only" to the availability object. These keys remain in the SignalAvailability type for JSONB persistence back-compat
- **Files modified:** `src/lib/engine/aggregator.ts`
- **Commit:** `6bc020a5`

**3. [Rule 1 - Bug] stage10-critique.test.ts Check #4 threshold**
- **Found during:** Task 2 — after removing sa.audio/sa.retrieval from Check #4, the existing test used `audio:false + retrieval:false` as the two unavailable signals; with those removed, only `gemini_hook:false + personas:false` count. The test now correctly exercises the 2-signal path with the new indicators
- **Fix:** Updated Check #4 test to use `gemini_hook:false + personas:false` as the 2-unavailable combination; added a test verifying only 1 unavailable (personas=false only) does NOT fire
- **Files modified:** `src/lib/engine/__tests__/stage10-critique.test.ts`
- **Commit:** `743bdfdd`

**4. [Rule 1 - Bug] aggregator-audio.test.ts require() in ESM context**
- **Found during:** Task 3 test run — `require("../aggregator")` inside a test body fails in Vitest's ESM environment
- **Fix:** Changed to static import of `SCORE_WEIGHT_KEYS` at the top of the file (alongside the existing `selectWeights` import)
- **Files modified:** `src/lib/engine/__tests__/aggregator-audio.test.ts`
- **Commit:** `43d1cf3f`

**5. [Rule 1 - Bug] aggregator.test.ts Phase 8 retrieval integration test**
- **Found during:** Task 3 test run — "score_weights.retrieval is included in PredictionResult" asserted `toHaveProperty("retrieval")` but `score_weights` now only spreads `{...weights, ml:0, rules:0, trends:0}` — retrieval is not included
- **Fix:** Updated test to assert `score_weights` has behavioral+gemini > 0 and ml/rules/trends = 0; still asserts `result.retrieval_score = 0.5` (provenance field, not blend key)
- **Files modified:** `src/lib/engine/__tests__/aggregator.test.ts`
- **Commit:** `43d1cf3f`

## Known Stubs

None — no UI components involved. The `score_weights` dead-key zeroes and `platform_fit: null` on PredictionResult are intentional documented behavior (types.ts cleanup deferred to P3/P5).

## Threat Flags

T-04-01 mitigated: blend simplification introduces a documented honesty correction (small upward score nudge from trends 0.10 redistribution). Plan 06 measures + records the pre/post delta. No silent score change will ship — the measurement gate is in the next plan.

T-04-02 mitigated: "top X%" fabricated corpus-rank framing removed from deepseek output instructions. The model will now produce qualitative relative labels instead of false-precision percentile strings.

No new network endpoints, auth paths, file access, or schema changes.

## Self-Check

- [x] aggregator.ts: FOUND
- [x] stage10-critique.ts: FOUND
- [x] deepseek.ts: FOUND
- [x] SUMMARY.md: FOUND
- [x] Commit 6bc020a5 (Task 1): FOUND
- [x] Commit 743bdfdd (Task 2): FOUND
- [x] Commit 43d1cf3f (Task 3): FOUND
- [x] SCORE_WEIGHT_KEYS == ["behavioral","gemini"]
- [x] applyCtaPenalty: PRESENT in aggregator.ts
- [x] confidence_adjustment: PRESENT in stage10-critique.ts
- [x] flags.push count = 0 in stage10-critique.ts
- [x] _percentile count = 0 in deepseek.ts
- [x] calibration: PRESENT in deepseek.ts
- [x] aggregator-platform-fit.test.ts: DELETED
- [x] npx tsc --noEmit: No errors
- [x] 134 named tests PASS, 0 FAIL

## Self-Check: PASSED
