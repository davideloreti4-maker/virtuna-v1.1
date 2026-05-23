---
phase: 09-platform-algo-fit-self-critique-counterfactuals
plan: 04
type: execute
subsystem: aggregator
tags:
  - signal-integration
  - platform-fit
  - weight-bearing
  - selectWeights
dependency_graph:
  requires:
    - "09-01 (types: PlatformFitResult + SignalAvailability.platform_fit)"
    - "09-03 (platform-fit runner producing PlatformFitResult[])"
  provides:
    - "aggregator.ts SCORE_WEIGHTS.platform_fit (0.05)"
    - "aggregator.ts selectWeights platformFitInInput back-compat"
    - "aggregator.ts aggregateScores platform_fit weighted term"
    - "aggregator.ts signal_availability.platform_fit flag"
  affects:
    - "PredictionResult.score_weights.platform_fit"
    - "raw_overall_score computation"
tech-stack:
  added:
    - "SCORE_WEIGHTS.platform_fit: 0.05"
    - "SCORE_WEIGHT_KEYS includes 'platform_fit'"
    - "selectWeights return type platform_fit?: number"
    - "aggregateScores platformFitMeanScore computation"
  patterns:
    - "widenedPipeline cast (same as widenedGemini cta_segment pattern)"
    - "hasOwnProperty back-compat check (same as audio/retrieval)"
key-files:
  created: []
  modified:
    - "src/lib/engine/aggregator.ts"
  deleted: []
metrics:
  duration: ~7m
  completed_date: "2026-05-20"
  tests_passed: 3/3 Wave 0 stubs
---

# Phase 9 Plan 04: Wire platform_fit as weight-bearing signal in aggregator.ts

**One-liner:** Integrate platform_fit into SCORE_WEIGHTS (0.05) with full selectWeights back-compat, aggregateScores weighted term, and signal_availability flag — following Phase 8 retrieval signal precedent exactly.

## Summary

Extended `aggregator.ts` at 4 precise locations to wire `platform_fit` as a weight-bearing signal:

1. **SCORE_WEIGHTS** — added `platform_fit: 0.05` entry (Phase 9 D-07)
2. **SCORE_WEIGHT_KEYS** — added `'platform_fit'` to the weight-bearing tuple
3. **selectWeights** — added `platformFitInInput` hasOwnProperty back-compat check; key is excluded from activeKeys when caller provides a legacy availability object without `platform_fit`; weight is seeded in `initWeights()` for redistribution math
4. **aggregateScores** — computes `platformFitMeanScore` (mean of all scored platform `fit_score` values from `pipelineResult.platformFitResult` array); adds `platformFitMeanScore * (weights.platform_fit ?? 0)` term to `raw_overall_score`; sets `signal_availability.platform_fit` flag (true when array non-null and non-empty); attaches `platform_fit` field to `PredictionResult`

The `score_weights.platform_fit` is automatically included in `PredictionResult.score_weights` because `weights` is the return value of `selectWeights` (which now returns `platform_fit?: number`).

### Deviations from Plan

None — plan executed exactly as written.

### Key Decisions

- **widenedPipeline cast**: `pipelineResult.platformFitResult` is not yet on the `PipelineResult` interface (Plan 09-07 adds it). Followed the existing `widenedGemini` pattern (line 767) to cast `pipelineResult` to include `{ platformFitResult: PlatformFitResult[] | null }`. This is a temporary bridge until Plan 09-07 extends `PipelineResult` with the feeder interface.
- **PredictionResult.platform_fit**: Wired as `widenedPipeline.platformFitResult?.[0] ?? null` (first result) to match the current singular `PlatformFitResult | null` type. Plan 09-07 will align the PredictionResult type to match the pipeline array shape.
- **Raw sum comment**: Updated from "1.12 (7-key)" to "1.17 (8-key) or 1.12 (7-key no platform_fit)" for accuracy.

### Verification

```bash
npx vitest run src/lib/engine/__tests__/aggregator-platform-fit.test.ts
# ✓ returns platform_fit weight when platform_fit signal is available
# ✓ sets platform_fit to 0 when platform_fit signal is unavailable
# ✓ weights sum to ~1.0 when platform_fit is included
# Test Files 1 passed | Tests 3 passed
```

All 3 Wave 0 stubs pass GREEN.

### Known Stubs

None — all platform_fit stubs are now wired and passing.

## Self-Check: PASSED

- [x] SCORE_WEIGHTS contains platform_fit: 0.05 entry
- [x] SCORE_WEIGHT_KEYS tuple includes 'platform_fit'
- [x] selectWeights has platformFitInInput hasOwnProperty back-compat check
- [x] aggregateScores computes mean of platform fit scores and adds weighted term to raw_overall_score
- [x] signal_availability.platform_fit set to true when platformFitResult non-null and non-empty
- [x] score_weights.platform_fit included in returned PredictionResult
- [x] All aggregator-platform-fit Wave 0 stubs pass GREEN
