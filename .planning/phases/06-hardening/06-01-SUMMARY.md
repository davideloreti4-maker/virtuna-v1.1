---
phase: 06-hardening
plan: 01
subsystem: engine
tags: [zod, calibration, error-handling, graceful-degradation]

# Dependency graph
requires:
  - phase: 03-calibration-wiring
    provides: calibration-baseline.json and loadCalibrationData functions
provides:
  - Zod-validated calibration loading in gemini.ts and deepseek.ts
  - Graceful fallback to hardcoded calibration defaults on parse failure
  - Exported CalibrationBaselineSchema for potential reuse
affects: [pipeline, gemini, deepseek]

# Tech tracking
tech-stack:
  added: []
  patterns: [zod-parse-with-try-catch-fallback, null-coalescing-calibration]

key-files:
  created: []
  modified:
    - src/lib/engine/gemini.ts
    - src/lib/engine/deepseek.ts

key-decisions:
  - "Zod schemas validate only the fields each module actually uses (not the full JSON)"
  - "Fallback calibration uses conservative hardcoded values (p90 thresholds)"
  - "loadCalibrationData returns null (not throws) on failure -- callers use ?? pattern"

patterns-established:
  - "Zod-validate-then-fallback: parse external data with Zod, catch to null, coalesce with hardcoded defaults"

# Metrics
duration: 10min
completed: 2026-02-18
---

# Phase 6 Plan 1: Calibration Hardening Summary

**Zod schema validation + try-catch fallback for calibration-baseline.json in both gemini.ts and deepseek.ts**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-18T13:02:41Z
- **Completed:** 2026-02-18T13:12:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Gemini calibration loading now validates JSON shape with CalibrationBaselineSchema before use
- DeepSeek calibration loading validates with DeepSeekCalibrationBaselineSchema
- Both modules gracefully degrade to sensible hardcoded defaults if calibration file is missing, corrupt, or malformed
- All 203 existing tests pass, build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Zod schema and harden loadCalibrationData in gemini.ts** - `958bfe8` (feat)
2. **Task 2: Harden loadCalibrationData in deepseek.ts with Zod validation** - `8d0df5c` (feat)

## Files Created/Modified

- `src/lib/engine/gemini.ts` - Added CalibrationBaselineSchema, FALLBACK_CALIBRATION, try-catch in loadCalibrationData, null-coalescing in analyzeWithGemini and analyzeVideoWithGemini
- `src/lib/engine/deepseek.ts` - Added DeepSeekCalibrationBaselineSchema, FALLBACK_DEEPSEEK_CALIBRATION, try-catch in loadCalibrationData, null-coalescing in reasonWithDeepSeek and reasonWithGeminiFallback

## Decisions Made

- Zod schemas validate only the fields each module actually uses (gemini uses viral_threshold, deepseek uses percentiles) -- not the entire JSON
- Fallback calibration uses conservative hardcoded defaults matching approximate p90 thresholds
- loadCalibrationData returns null (not throws) on failure -- callers use `?? FALLBACK` pattern for clean ergonomics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing DEFAULT_GEMINI_RESULT in pipeline.ts**
- **Found during:** Task 1 (test verification)
- **Issue:** Pre-existing uncommitted HARD-03 changes in pipeline.ts referenced `DEFAULT_GEMINI_RESULT` constant that was not defined, causing ReferenceError
- **Fix:** Added the missing constant with zero-score fallback factors matching the PipelineResult type
- **Files modified:** src/lib/engine/pipeline.ts, src/lib/engine/__tests__/pipeline.test.ts
- **Verification:** All 203 tests pass after fix
- **Committed in:** 53c77c1 (pre-existing changes committed before Task 1)

---

**Total deviations:** 1 auto-fixed (1 blocking -- pre-existing uncommitted changes)
**Impact on plan:** Fix was necessary to unblock test verification. No scope creep.

## Issues Encountered

- Pre-existing uncommitted changes from HARD-03 (graceful Gemini degradation) were in the working tree. These modified pipeline.ts and pipeline.test.ts but had a missing constant. Committed separately before proceeding with plan tasks.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- HARD-01 and HARD-02 (calibration hardening) are complete
- Pipeline is now fully resilient to calibration file corruption
- Ready for remaining hardening plans (HARD-03, HARD-04)

## Self-Check: PASSED

- [x] gemini.ts exists and contains CalibrationBaselineSchema
- [x] deepseek.ts exists and contains DeepSeekCalibrationBaselineSchema
- [x] 06-01-SUMMARY.md exists
- [x] Commit 958bfe8 (Task 1) found in git log
- [x] Commit 8d0df5c (Task 2) found in git log
- [x] All 203 tests pass
- [x] Build succeeds

---
*Phase: 06-hardening*
*Completed: 2026-02-18*
