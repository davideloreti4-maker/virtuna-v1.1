---
phase: 02-ml-model-rehabilitation
plan: 01
subsystem: ml
tags: [logistic-regression, class-weighting, stratified-split, feature-bridge, deepseek]

# Dependency graph
requires:
  - phase: 01-schedule-crons
    provides: "Scraped video data pipeline for ML training data"
provides:
  - "computeClassWeights() inverse-frequency weighting capped at 3x min"
  - "stratifiedSplit() utility for proportional train/test partitioning"
  - "logPerClassMetrics() for per-class precision/recall logging"
  - "trainModel() data-parameter overload for retrain cron"
  - "featureVectorToMLInput() with 4 real DeepSeek signals instead of hardcoded 0.5"
affects: [02-02 (aggregator wiring), 02-03 (retrain cron uses stratifiedSplit + trainModel data param)]

# Tech tracking
tech-stack:
  added: []
  patterns: [inverse-frequency class weighting, stratified splitting, feature bridge mapping]

key-files:
  created: []
  modified:
    - src/lib/engine/ml.ts

key-decisions:
  - "Class weights capped at 3x minimum to prevent overfitting to rare tiers per research Pitfall 1"
  - "Feature bridge maps shareability/commentProvocation/emotionalCharge/saveWorthiness as semantic engagement proxies"
  - "trainModel accepts structured data object directly for retrain cron (avoids write-then-read JSON)"

patterns-established:
  - "Class weighting: computeClassWeights() uses inverse-frequency formula with cap"
  - "Feature bridge convention: DeepSeek 0-10 scores mapped to 0-1 range via clamp01(score/10)"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 2 Plan 01: ML Model Core Rehabilitation Summary

**Inverse-frequency class weighting with 3x cap, stratified split utility, per-class metrics logging, data-param trainModel overload, and 4 real DeepSeek feature bridge signals replacing hardcoded 0.5**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T10:04:29Z
- **Completed:** 2026-02-18T10:06:44Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- trainModel() now applies inverse-frequency class weights (capped at 3x min) so tiers 4 and 5 get proportionally higher gradient signal during training
- Per-class precision/recall logged after training on both train and test sets for model diagnostics
- trainModel() accepts pre-computed structured data (features + labels) for the retrain cron, avoiding filesystem I/O
- featureVectorToMLInput() maps 4 real DeepSeek component scores (shareability, commentProvocation, emotionalCharge, saveWorthiness) instead of hardcoded 0.5
- Exported stratifiedSplit() utility ready for retrain cron (Plan 02-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add class weighting, stratified split, and per-class metrics** - `30eac25` (feat)
2. **Task 2: Replace hardcoded 0.5 features with real DeepSeek signals** - `fdf42fa` (feat)

## Files Created/Modified

- `src/lib/engine/ml.ts` - Added computeClassWeights, stratifiedSplit (exported), logPerClassMetrics; modified trainModel signature and gradient loop; replaced 4 hardcoded 0.5 engagement features with real DeepSeek signals

## Decisions Made

- **Class weight cap at 3x:** Prevents overfitting to rare classes (tier 5 at ~2x already). The cap ensures that even with more imbalanced future data, weights won't diverge excessively.
- **Feature bridge mapping rationale:** DeepSeek component scores (0-10) are semantic proxies for scraped engagement rates. shareability proxies share rate, emotionalCharge proxies like rate. Domain gap exists but is acceptable per research findings.
- **Data-param overload over file-based API:** trainModel() accepts `string | object | undefined` so the retrain cron can pass dynamic Supabase data directly without writing/reading a temp JSON file.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ml.ts is rehabilitated: class weighting, real features, data-param overload all ready
- Plan 02-02 (aggregator wiring) can now wire predictWithML into the score aggregation
- Plan 02-03 (retrain cron) can use stratifiedSplit() and pass data directly to trainModel()

## Self-Check: PASSED

- [x] src/lib/engine/ml.ts exists
- [x] 02-01-SUMMARY.md exists
- [x] Commit 30eac25 found (Task 1)
- [x] Commit fdf42fa found (Task 2)

---
*Phase: 02-ml-model-rehabilitation*
*Completed: 2026-02-18*
