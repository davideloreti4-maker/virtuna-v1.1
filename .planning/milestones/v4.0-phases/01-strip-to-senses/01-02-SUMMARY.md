---
phase: 01-strip-to-senses
plan: 02
subsystem: engine/scoring
tags: [aggregator, analyze-route, predicted-engagement, stage11, ml, call-site-removal, R9, R12]

# Dependency graph
requires: [01-01]
provides:
  - "aggregator.ts free of stage11/ml/engagement call sites; predicted-engagement.ts deleted"
  - "analyze/route.ts deferred stage11 re-run removed; remix branch preserved"
  - "PredictionResult.predicted_engagement nullable (D1.3); field null in all aggregateScores runs"
  - "Stage10 critique path intact (Plan 04 scope unchanged)"
  - "No aggregator test imports ../ml — safe for Plan 05 ml.ts dormant move"
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call-site-before-move ordering: remove callers in aggregator+route before dormanting modules in Plan 05"
    - "Nullable type widening (PredictionResult.predicted_engagement: PredictedEngagement | null) with UI shell retained per D1.3"
    - "ml contribution replaced with const null (mlScore: number | null = null) — blend still compiles; Plan 04 cuts the key"

key-files:
  modified:
    - src/lib/engine/aggregator.ts
    - src/lib/engine/types.ts
    - src/app/api/analyze/route.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/aggregator-audio.test.ts
    - src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx
  deleted:
    - src/lib/engine/predicted-engagement.ts

key-decisions:
  - "maybeAppendLikelyFlopWarning retained as partial import from stage11-counterfactuals — pure-TS helper, needed until Plan 05 moves the module"
  - "ml contribution replaced with const null = 0 path rather than deleting SCORE_WEIGHT_KEYS ml key (Plan 04 owns the blend cut)"
  - "PredictionResult.predicted_engagement widened to nullable at types.ts (avoids cast; Plan 05 regrounding keeps the field)"
  - "deferCounterfactuals option retained in AggregateScoresOptions for back-compat (no-op after stage11 removal)"
  - "results-panel null test updated: delete cast replaced with null assignment (nullable type now correct)"

# Metrics
duration: 15min
completed: 2026-06-04
---

# Phase 01 Plan 02: Strip-to-Senses — Stage11/ML/Engagement Call-Site Removal Summary

**Removed stage11 counterfactuals call, ml.ts call, and fabricated engagement jitter from aggregator.ts + analyze/route.ts. Hard-deleted predicted-engagement.ts. Stage10 + behavioral/gemini score derivation untouched. Touched tests assert post-strip behavior. Build and 3 named test files green.**

## Status

**COMPLETE** — All 3 tasks done, each committed individually.

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-04
- **Completed:** 2026-06-04
- **Tasks:** 3/3
- **Files modified:** 6 modified, 1 deleted

## Accomplishments

### Task 1: aggregator.ts + predicted-engagement.ts

- Removed `predictWithML` + `featureVectorToMLInput` import + call (line 791-798); replaced awaited result with `const mlScore: number | null = null` — blend still compiles; Plan 04 deletes the SCORE_WEIGHT_KEYS entry
- Removed `runStage11Counterfactuals` from the import (kept `maybeAppendLikelyFlopWarning` as partial import — pure-TS helper still called at line 1291)
- Removed stage11 slot from Promise.all; stage10 critique runs alone (deterministic TS, sub-ms, owns final confidence/gate)
- Deleted `computePredictedEngagement` + `rescalePersonaIntentToViewRate` functions (D1.1 sine-jitter fabrication gone)
- Set `predicted_engagement: null` in result assembly
- Widened `PredictionResult.predicted_engagement` to `PredictedEngagement | null` in types.ts (D1.3 — UI shell retained)
- Hard-deleted `src/lib/engine/predicted-engagement.ts` (no live importers confirmed before deletion)
- Fixed Plan 01 test: replaced `delete (result as Record<string, unknown>).predicted_engagement` with `null` assignment (correct for nullable type)

### Task 2: analyze/route.ts

- Removed `runStage11Counterfactuals` import (line 9) and `after` import (line 2)
- Deleted `scheduleDeferredCounterfactuals` function (~60 lines) + both call sites (JSON path + SSE path)
- Removed `deferCounterfactuals: true` from both `aggregateScores` calls
- Cleaned up stage11-defer comments referencing the removed after() pattern
- Remix branch (`if (validated.mode === "remix")`) byte-identical to before, grep-confirmed present

### Task 3: Test updates

- `aggregator.test.ts`: removed `vi.mock("../ml")`, removed `import { predictWithML }`, removed all `vi.mocked(predictWithML).mockResolvedValue()` calls, updated ml_score assertion to 0, added `predicted_engagement: null` assertion, updated PIPE-09 to assert stage11 event absent, replaced deferCounterfactuals test with counterfactuals-always-null test
- `aggregator-audio.test.ts`: same ml mock + import removal; updated stage11 mock to drop runStage11Counterfactuals entry (module still present until Plan 05)
- `derive-and-drop.test.ts`: no changes needed (no stage11/ml references confirmed)
- `stage11-counterfactuals.test.ts`: left as-is (module still on disk, 15 tests green)

## Task Commits

1. **Task 1: Remove stage11/ml/engagement call sites from aggregator.ts; delete predicted-engagement.ts** — `a52f1372`
2. **Task 2: Remove deferred stage11 re-run from analyze/route.ts (remix branch untouched)** — `d242a2c4`
3. **Task 3: Update aggregator/stage11/analyze tests to assert post-strip behavior** — `aa79172a`

## Verification Results

- `grep -c "runStage11Counterfactuals|predictWithML|computePredictedEngagement|from \"./predicted-engagement\"" src/lib/engine/aggregator.ts` → **0**
- `grep -c "runStage11Counterfactuals|stage11_deferred" src/app/api/analyze/route.ts` → **0**
- `grep -q 'mode === "remix"' src/app/api/analyze/route.ts` → **PRESENT**
- `test ! -f src/lib/engine/predicted-engagement.ts` → **CONFIRMED DELETED**
- `npx tsc --noEmit -p tsconfig.json` → **No errors found**
- `npx vitest run aggregator.test.ts aggregator-audio.test.ts derive-and-drop.test.ts` → **PASS (80) FAIL (0)**
- Stage10 critique path (`runStage10Critique`, `applyCritiqueAdjustment`) → **INTACT**
- Behavioral + gemini score assertions retained in tests → **YES**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] PredictionResult.predicted_engagement type widened to nullable**
- **Found during:** Task 1 — TypeScript error TS2322 when assigning null
- **Issue:** `PredictionResult.predicted_engagement` was `PredictedEngagement` (non-nullable) in types.ts, conflicting with the plan's requirement to set the field null (D1.3)
- **Fix:** Changed types.ts line 250 to `PredictedEngagement | null`; this is consistent with D1.3 ("KEEP field/type, board card shell") — the type is kept, just made nullable
- **Files modified:** `src/lib/engine/types.ts`
- **Commit:** `a52f1372`

**2. [Rule 1 - Bug] Plan 01 test cast replaced after type widening**
- **Found during:** Task 1 TypeScript check — TS2352 in results-panel test from Plan 01
- **Issue:** Test used `delete (result as Record<string, unknown>).predicted_engagement` to simulate absent field; after making the field nullable, `null` is the correct way to express absence
- **Fix:** Changed the test assertion to pass `predicted_engagement: null` directly
- **Files modified:** `src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx`
- **Commit:** `a52f1372`

**3. [Rule 2 - Correctness] maybeAppendLikelyFlopWarning retained as partial import**
- **Found during:** Task 1 — plan says "remove the runStage11Counterfactuals + maybeAppendLikelyFlopWarning import" but `maybeAppendLikelyFlopWarning` is still called at aggregator line 1291 (pure-TS LIKELY_FLOP check)
- **Decision:** Changed the import to import only `maybeAppendLikelyFlopWarning` (dropped `runStage11Counterfactuals`). Acceptance criteria grep only tests for `runStage11Counterfactuals` — criteria satisfied. The partial import is removed when stage11-counterfactuals.ts moves to `_dormant/` in Plan 05.
- **Files modified:** `src/lib/engine/aggregator.ts`

## Known Stubs

None — no UI stubs added in this plan. The `predicted_engagement: null` is documented behavior (D1.1, Plan 05 will reground it), not a UI stub.

## Threat Flags

T-02-01 verified: `scheduleDeferredCounterfactuals` contained no input-validation or rate-limit guard. It was advice generation only (counterfactuals backfill). Removal is clean.

No new network endpoint, auth path, file access, or schema change.

## Self-Check

- [x] `grep -c "runStage11Counterfactuals|predictWithML|computePredictedEngagement" aggregator.ts` = 0 — confirmed
- [x] `grep -c "runStage11Counterfactuals|stage11_deferred" route.ts` = 0 — confirmed
- [x] `grep -q 'mode === "remix"' route.ts` = present — confirmed
- [x] `test ! -f predicted-engagement.ts` — confirmed deleted
- [x] stage10 import + call sites still in aggregator.ts — confirmed
- [x] `npx tsc --noEmit` — no errors
- [x] 3 named test files pass (80 tests total)
- [x] Commits a52f1372, d242a2c4, aa79172a recorded

## Self-Check: PASSED
