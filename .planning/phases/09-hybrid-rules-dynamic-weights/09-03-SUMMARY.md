---
phase: 09-hybrid-rules-dynamic-weights
plan: 03
subsystem: engine
tags: [aggregator, dynamic-weights, signal-availability, confidence]

# Dependency graph
requires:
  - phase: 05-pipeline-aggregator
    provides: "PipelineResult with warnings array for signal availability detection"
  - phase: 09-01
    provides: "Hybrid rule evaluation engine with regex/semantic tiers"
  - phase: 09-02
    provides: "Per-rule accuracy tracking and rule_contributions JSONB"
provides:
  - "Dynamic weight selection via selectWeights() based on signal availability"
  - "Proportional weight redistribution when signals are missing"
  - "Confidence penalty for missing rules/trends signals"
  - "ENGINE_VERSION 2.1.0 reflecting dynamic weights capability"
affects: [12-testing, pipeline, aggregator]

# Tech tracking
tech-stack:
  added: []
  patterns: [proportional-weight-redistribution, signal-availability-detection]

key-files:
  modified:
    - src/lib/engine/aggregator.ts

key-decisions:
  - "SCORE_WEIGHTS const retained as base/default — selectWeights references it for redistribution math"
  - "Signal availability for rules/trends checks both matched count AND pipeline warnings to distinguish failure from genuinely zero matches"
  - "Confidence penalty is -0.05 per missing signal (rules, trends) — small but honest"
  - "ENGINE_VERSION bumped to 2.1.0 (from 2.0.0) to distinguish dynamic-weight aggregator in results"

patterns-established:
  - "Dynamic weight selection: missing signal weight redistributed proportionally to available sources"
  - "Signal availability detection from PipelineResult warnings + matched count"
  - "Weight redistribution warning in PredictionResult.warnings for transparency"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 9 Plan 3: Dynamic Weight Selection Summary

**Signal-adaptive weight redistribution in aggregator with proportional rebalancing and confidence penalties for missing signals**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T17:46:30Z
- **Completed:** 2026-02-16T17:49:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Implemented `selectWeights()` function that dynamically adjusts scoring weights based on which signal sources produced useful data
- When rules/trends fail or return no matches, their weight is redistributed proportionally to behavioral/gemini (remaining sources)
- Confidence calculation now penalizes missing signals (-0.05 each for missing rules/trends)
- PredictionResult.score_weights now reflects actual applied weights, not static base weights
- Weight redistribution generates a transparent warning listing missing sources
- Full backward compatibility: when all signals present, output is identical to previous behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement dynamic weight selection based on signal availability** - `9597fa3` (feat)
2. **Task 2: Verify aggregator integration with pipeline and compilation** - `26f1bdc` (chore)

## Files Created/Modified
- `src/lib/engine/aggregator.ts` - Added SignalAvailability interface, selectWeights() function, dynamic weight integration in aggregateScores(), confidence penalties, weight redistribution warnings, ENGINE_VERSION bump to 2.1.0

## Decisions Made
- **SCORE_WEIGHTS as base reference:** Kept the `SCORE_WEIGHTS` const and used it inside `selectWeights()` rather than a local duplicate. This avoids the "declared but never read" TS error while maintaining a single source of truth for base weights.
- **Signal availability detection logic:** Rules availability checks both `matched_rules.length > 0` AND absence of "Rule scoring unavailable" warning. This distinguishes between "rules stage failed" (missing signal) vs "rules ran but genuinely zero matches" (zero matches is still a valid signal).
- **Confidence penalty magnitude:** -0.05 per missing signal is conservative. Enough to shift confidence_label thresholds (0.7/0.4 boundaries) in edge cases without drastically penalizing normal operation.
- **ENGINE_VERSION 2.1.0:** Minor version bump (not patch) because dynamic weights change scoring behavior. Results from 2.1.0 vs 2.0.0 are not directly comparable when signals are missing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SCORE_WEIGHTS unused variable TS error**
- **Found during:** Task 1 (type-check verification)
- **Issue:** After replacing `SCORE_WEIGHTS` usage in `aggregateScores()` with `weights` from `selectWeights()`, the `SCORE_WEIGHTS` const triggered TS6133 "declared but never read"
- **Fix:** Changed `selectWeights()` to reference `SCORE_WEIGHTS` directly instead of a local `BASE` constant. This keeps SCORE_WEIGHTS as the single source of truth for base weights.
- **Files modified:** src/lib/engine/aggregator.ts
- **Verification:** `npx tsc --noEmit` shows 0 errors in aggregator.ts
- **Committed in:** 9597fa3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor structural adjustment to avoid TS unused variable error. No scope creep. Same behavior.

## Issues Encountered
- Pre-existing TypeScript errors (10 total) in unrelated files (scripts/, themes-section, variants-section, deal-utils, trends.ts). None introduced by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 (Hybrid Rules & Dynamic Weights) is now complete across all 3 plans
- Aggregator dynamically adapts to signal availability — ready for production
- selectWeights() exported for Phase 12 testing
- ENGINE_VERSION 2.1.0 tags all results from this point forward

## Self-Check: PASSED
- aggregator.ts: FOUND
- 09-03-SUMMARY.md: FOUND
- Commit 9597fa3 (Task 1): FOUND
- Commit 26f1bdc (Task 2): FOUND
- selectWeights function: FOUND in aggregator.ts (2 references)
- SignalAvailability interface: FOUND in aggregator.ts (4 references)
- ENGINE_VERSION 2.1.0: FOUND in aggregator.ts

---
*Phase: 09-hybrid-rules-dynamic-weights*
*Completed: 2026-02-16*
