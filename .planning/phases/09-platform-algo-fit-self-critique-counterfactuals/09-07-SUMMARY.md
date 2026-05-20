---
phase: 09
plan: 07
title: Wire all Phase 9 stages into pipeline.ts
subsystem: engine
tags:
  - pipeline
  - platform-fit
  - critique
  - counterfactuals
  - integration
requires:
  - 09-03 (Platform Fit V3 Orchestrator)
  - 09-05 (Stage 10: Self-Critique)
  - 09-06 (Stage 11: Counterfactuals)
provides:
  - Phase 9 stage wiring
  - BENCH-05 regression gate
affects:
  - pipeline.ts (orchestration)
  - aggregator.ts (post-aggregation stages)
tech-stack:
  added: []
  patterns:
    - "Post-aggregation stage wiring in aggregator.ts"
key-files:
  created: []
  modified:
    - src/lib/engine/pipeline.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/pipeline.test.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/aggregator-audio.test.ts
    - src/lib/engine/__tests__/aggregator-cta-penalty.test.ts
decisions:
  - "Platform-fit runs in pipeline.ts (after Wave 3, before aggregateScores)"
  - "Stage 10/11 critique/counterfactuals run inside aggregator.ts after aggregateScores returns"
  - "Pre-existing aggregator test files mock isCircuitOpen=true to short-circuit without OpenAI client"
metrics:
  duration: ~20 min
  completed_date: 2026-05-20
  test_count: 1170 passed
  test_files: 84 passed
---

# Phase 9 Plan 07: Wire all Phase 9 stages into pipeline.ts

Wire platform-fit (Plan 03), self-critique (Plan 05), and counterfactuals (Plan 06) into the engine's execution flow. Ensures correct ordering invariants (Pitfall 7) and populates `PredictionResult.platform_fit`, `.critique`, `.counterfactuals`.

## Files Changed

### src/lib/engine/pipeline.ts
- Import `runPlatformFit` from `./wave4/platform-fit`
- Added `platformFitResult: PlatformFitResult[] | null` to `PipelineResult` interface
- Called `runPlatformFit(payload, creatorContext, deepseekResult, watermarkDetected, onStageEvent)` AFTER Wave 3 completes, BEFORE the return
- The call is wrapped in `.catch()` for graceful null-on-failure
- `watermarkDetected` extracted from `geminiResult.analysis.hook_decomposition?.watermark_detected`
- `platformFitResult` included in the return object

### src/lib/engine/aggregator.ts
- Imported `applyCritiqueAdjustment` from `./stage10-critique`
- Imported `maybeAppendLikelyFlopWarning` from `./stage11-counterfactuals`
- Stage 10: Captured `runStage10Critique(result)` return → applied `applyCritiqueAdjustment(result.confidence, critiqueResult)` → set `result.critique = critiqueResult`
- Stage 11: Captured `runStage11Counterfactuals(result)` return → set `result.counterfactuals = counterfactualResult`
- Called `maybeAppendLikelyFlopWarning(result)` as final step (POST-critique confidence per Pitfall 7)

### src/lib/engine/__tests__/pipeline.test.ts
- Added `vi.hoisted` mock for `@/lib/engine/wave4/platform-fit`
- Added `describe("Phase 9 — Platform-fit V3 result in PipelineResult")` with 3 tests:
  - `PipelineResult includes platformFitResult with per-platform scores`
  - `runPlatformFit invoked once after Wave 3 (ordering invariant)`
  - `platform-fit stage events fire (delegated to runPlatformFit self-emission)`
  - `platform-fit null on failure produces null platformFitResult (graceful degradation)`

### Fixed pre-existing bugs
- `aggregator.test.ts`, `aggregator-audio.test.ts`, `aggregator-cta-penalty.test.ts`: Added `isCircuitOpen: vi.fn(() => true)` to `../deepseek` mock (commit e40a45b made `stage10-critique.ts` real, which calls `isCircuitOpen()`, but these test mocks didn't export it → timeout/hang)

## Deviations from Plan

### Rule 3 — Pre-existing test failures fixed
- **Found during:** Full suite run (BENCH-05 gate)
- **Issue:** Commit e40a45b made `stage10-critique.ts` real (calling `isCircuitOpen()`), but 3 aggregator test files mocked `../deepseek` without exporting `isCircuitOpen` → `vi.mock` threw "No isCircuitOpen export" error. These failures were pre-existing (not caused by this plan).
- **Fix:** Added `isCircuitOpen: vi.fn(() => true)` to the deepseek mock in all 3 files. Set to `true` so Stage 10/11 short-circuit at circuit breaker (no OpenAI mock needed).
- **Files modified:** `aggregator.test.ts`, `aggregator-audio.test.ts`, `aggregator-cta-penalty.test.ts`

## Verification

- Pipeline tests: 26/26 pass (4 new + 22 existing)
- Full suite: 84 test files, 1170 tests pass (BENCH-05 gate)
- Commit: `ed548fb`

## Self-Check: PASSED ✅

| Check | Status |
|-------|--------|
| pipeline.ts imports runPlatformFit | ✅ |
| pipeline.ts calls runPlatformFit after Wave 3 | ✅ |
| PipelineResult.platformFitResult typed and returned | ✅ |
| aggregator.ts captures critique return + applies adjustment | ✅ |
| aggregator.ts captures counterfactuals return + calls flop check | ✅ |
| PredictionResult.critique populated | ✅ |
| PredictionResult.counterfactuals populated | ✅ |
| Integration tests for platform-fit ordering | ✅ |
| Full suite exits 0 (BENCH-05) | ✅ |
