---
phase: 06-hardening
plan: 02
subsystem: engine
tags: [pipeline, aggregator, graceful-degradation, dual-llm-failure, confidence]

# Dependency graph
requires:
  - phase: 05-test-coverage
    provides: "203 tests with >80% coverage for pipeline and aggregator"
provides:
  - "Gemini failure non-fatal — pipeline returns fallback result with zero scores"
  - "Dual-LLM-failure explicit LOW confidence override in aggregator"
  - "Both LLM providers failed warning in aggregator output"
affects: [06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["DEFAULT_GEMINI_RESULT fallback constant for zero-score degradation", "Explicit confidence override bypassing calculateConfidence for known-bad states"]

key-files:
  created: []
  modified:
    - src/lib/engine/pipeline.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/pipeline.test.ts

key-decisions:
  - "Gemini availability detected by checking if any factor score > 0 (false only for fallback)"
  - "Explicit confidence override to LOW (0.2) rather than patching calculateConfidence algorithm"
  - "DeepSeek can still succeed when Gemini fails — it calls OpenAI directly"

patterns-established:
  - "HARD-03: No pipeline stage is fatal — every stage degrades to a fallback"
  - "Explicit confidence override for known-bad states rather than modifying general algorithm"

# Metrics
duration: 8min
completed: 2026-02-18
---

# Phase 6 Plan 2: Dual-LLM Failure Graceful Degradation Summary

**Gemini failure now non-fatal with zero-score fallback; aggregator forces LOW confidence when both LLMs fail via explicit override**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-18T13:02:43Z
- **Completed:** 2026-02-18T13:11:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Pipeline no longer crashes when Gemini fails — returns DEFAULT_GEMINI_RESULT with zero scores and "unavailable" text
- Aggregator detects fallback Gemini data via `factors.some(f => f.score > 0)` and marks gemini availability false
- Explicit confidence override forces LOW (0.2) when both LLMs fail, bypassing calculateConfidence's incorrect MEDIUM
- Dual-failure warning added: "Both LLM providers failed — result based on rules and trends only"
- All 203 existing tests pass, build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Make Gemini failure non-fatal in pipeline.ts** - `53c77c1` (fix)
2. **Task 2: Handle dual-failure aggregation with explicit LOW confidence override** - `9f0e273` (feat)

## Files Created/Modified
- `src/lib/engine/pipeline.ts` - Added DEFAULT_GEMINI_RESULT constant; changed Stage 3 from throwing to graceful degradation with fallback
- `src/lib/engine/aggregator.ts` - Gemini availability detection via factor score check; explicit dual-LLM-failure LOW confidence override; dual-failure warning
- `src/lib/engine/__tests__/pipeline.test.ts` - Updated Scenario 3 test from "throws" to "degrades gracefully with fallback"

## Decisions Made
- **Gemini availability detection:** Check `factors.some(f => f.score > 0)` rather than adding a boolean flag to PipelineResult. This is false only when ALL factors are 0 (our fallback), true when any real analysis exists.
- **Explicit confidence override:** Rather than modifying calculateConfidence() (which would affect all confidence calculations), added a post-calculation override specifically for the dual-failure case. This is cleaner because the "two zeros agree" edge case is specific to failure mode, not a general algorithm issue.
- **DeepSeek independence:** DeepSeek calls OpenAI directly and can succeed even when Gemini fails. The test was updated to reflect this — DeepSeek is not null when Gemini fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated pipeline test Scenario 3 to match new Gemini behavior**
- **Found during:** Task 1 (Make Gemini failure non-fatal)
- **Issue:** Existing test expected Gemini failure to throw (`.rejects.toThrow(/Gemini/i)`). After making Gemini non-fatal, this test fails.
- **Fix:** Updated test to verify fallback result: zero scores, cost_cents=0, "unavailable" impression, Gemini failure warning present. Also verified DeepSeek still succeeds independently.
- **Files modified:** `src/lib/engine/__tests__/pipeline.test.ts`
- **Verification:** All 203 tests pass
- **Committed in:** `53c77c1` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test reflected old behavior)
**Impact on plan:** Essential update to maintain test correctness. No scope creep.

## Issues Encountered
- Linter auto-removed `DEFAULT_GEMINI_RESULT` constant when it was temporarily unused (before the stage 3 changes were applied in the same save). Required re-adding the constant after the stage 3 changes were committed.
- Stale `.next/lock` from concurrent build required manual cleanup.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HARD-03 (dual-LLM failure graceful degradation) is complete
- Pipeline never crashes regardless of which LLM providers are down
- Ready for remaining hardening plans (06-03, 06-04)

## Self-Check: PASSED

- All key files exist (pipeline.ts, aggregator.ts, pipeline.test.ts, 06-02-SUMMARY.md)
- All commits verified (53c77c1, 9f0e273)
- Must-have artifacts present: DEFAULT_GEMINI_RESULT in pipeline.ts, dual-failure check in aggregator.ts
- 203 tests passing, build succeeds

---
*Phase: 06-hardening*
*Completed: 2026-02-18*
