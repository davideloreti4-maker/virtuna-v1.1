---
phase: 05-wire-surface
plan: "02"
subsystem: engine
tags: [engine, r11, engagement-range, predicted-engagement, aggregator, tdd]
dependency_graph:
  requires:
    - phase: 05-01
      provides: apollo-dimension-score, deterministic-composite, rubric-sum-contract
  provides: [engagement-range-type, computeEngagementRange, r11-grounded-estimate]
  affects: [results-panel, board-ui, predicted-engagement-consumers]
tech_stack:
  added: []
  patterns: [tdd-london, post-parse-clamp, fat-tail-range, follower-anchor-width]
key_files:
  created: []
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/aggregator.test.ts
key_decisions:
  - "EngagementRange replaces PredictedEngagement point-shape on PredictionResult.predicted_engagement (R11)"
  - "Width anchored to follower_count × uncertainty (not mid_estimate) so low-quality ranges stay wide (fat-tail honesty)"
  - "LIVE-RESULTS-ONLY this phase — no DB column, no buildInsertRow entry, no route.ts change (D-06 deferred)"
  - "computeEngagementRange is pure+exported from aggregator.ts — no new option on AggregateScoresOptions"
requirements-completed: [R11, R5, R6]
duration: ~20 minutes
completed: "2026-06-06"
---

# Phase 5 Plan 02: R11 Grounded Engagement Range Summary

**EngagementRange type + deterministic follower-tier × quality-read range replaces the hard-null predicted_engagement fabrication, with tier-sensitivity and fat-tail honesty proven by 5 R11 TDD tests.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-06T19:43Z
- **Completed:** 2026-06-06T19:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `EngagementRange` interface to types.ts (lo/hi/confidence/basis) — replaces fabricated point-shape
- Changed `PredictionResult.predicted_engagement` from `PredictedEngagement | null` to `EngagementRange | null`
- Implemented pure `computeEngagementRange(creatorContext, overall_score)` in aggregator.ts with follower-anchored uncertainty
- Wired at aggregator.ts assembly site (was hard null); LIVE-RESULTS-ONLY (no DB persist, no route.ts change)
- 5 R11 TDD tests all GREEN: tier-sensitivity, lo<hi, quality-shift, width, null→null

## Task Commits

1. **Task 1: EngagementRange type + Wave 0 RED tests** - `a1802db9` (test)
2. **Task 2: computeEngagementRange + wire at assembly site** - `c744650a` (feat)

## Files Created/Modified

- `src/lib/engine/types.ts` — Added `EngagementRange` interface; changed `predicted_engagement` field type from `PredictedEngagement | null` to `EngagementRange | null`; `@deprecated` jsdoc on old point-shape
- `src/lib/engine/aggregator.ts` — Added `EngagementRange` + `CreatorContext` imports; added pure `computeEngagementRange` function with follower-anchor formula; wired at line 1062 replacing hard null
- `src/lib/engine/__tests__/aggregator.test.ts` — Added `computeEngagementRange` import; added 5 R11 test cases (tier sensitivity, range-not-point, quality shift, width, null honesty)

## Decisions Made

- **Width formula anchors to follower_count (not mid_estimate):** Initial formula used `mid_estimate × relative_multiplier` which produced tiny absolute widths at low quality (score=15 → mid_estimate tiny → narrow range). Fix: `half_width = max(mid_estimate × 0.5, follower_count × uncertainty)` where `uncertainty = (1-quality_ratio)² × 0.25 + 0.02`. This ensures low-quality ranges remain wide in absolute terms (fat-tail honesty).
- **Type replacement (not addition):** `predicted_engagement` field type changed from `PredictedEngagement | null` to `EngagementRange | null` on `PredictionResult`. Old `PredictedEngagement` interface retained with `@deprecated` jsdoc for back-compat. No DB column added.
- **computeEngagementRange exported from aggregator.ts directly:** No new file needed; function is small, pure, and naturally belongs next to the blend math it wraps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Width formula produced narrow range at low quality (fat-tail honesty test failed)**
- **Found during:** Task 2 (first test run)
- **Issue:** First implementation used `half_width = mid_estimate × (1 + (1-quality_ratio) × 3)`. At overall_score=15, `mid_estimate` is tiny (~950 for 100k followers) so absolute width was 3372 — narrower than high-quality width of 21,710. Fat-tail test failed: `expect(lowWidth).toBeGreaterThan(highWidth)`.
- **Fix:** Revised to `half_width = max(mid_estimate × 0.5, follower_count × uncertainty)` where uncertainty = `(1-q)² × 0.25 + 0.02`. At low quality: `follower_count × 0.27 = 27,000` dominates → width 54,000. At high quality: `mid_estimate × 0.5 = 8,350` → width 16,700. Low > high. ✓
- **Files modified:** `src/lib/engine/aggregator.ts`
- **Verification:** All 5 R11 tests GREEN
- **Committed in:** `c744650a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in formula)
**Impact on plan:** Essential for honesty — the fat-tail property is a core R11 requirement (D-06). No scope creep.

## Issues Encountered

None — all acceptance criteria met first run after formula fix.

## Known Stubs

None. `computeEngagementRange` is fully wired: types.ts → aggregator.ts → PredictionResult.predicted_engagement (live result). Permalink persistence is intentionally deferred (D-06) — this is the documented scope boundary, not a stub.

## Threat Flags

No new trust boundaries beyond the plan's threat model. T-05-04 (tampering via numeric output) mitigated: lo/hi clamped ≥ 0, overall_score clamped to 0–100, deterministic formula (no jitter). T-05-05 (prompt injection) satisfied: function reads only numeric `follower_count`, not creator free-text. T-05-06 (info disclosure) accepted: not persisted this phase.

## Self-Check: PASSED

- `src/lib/engine/types.ts` — FOUND (EngagementRange type at line 258)
- `src/lib/engine/aggregator.ts` — FOUND (computeEngagementRange at line 178, wired at line 1062)
- `src/lib/engine/__tests__/aggregator.test.ts` — FOUND (5 R11 tests at end of file)
- Commit `a1802db9` — FOUND in git log
- Commit `c744650a` — FOUND in git log
- 58/58 aggregator tests GREEN
- 950 engine tests GREEN (no regressions)
- route.ts predicted_engagement count = 0 (no persist path added)

## Next Phase Readiness

- R11 grounded range ready for surface in live results-panel (analyzeMutation.data.predicted_engagement)
- `EngagementRange.lo` / `.hi` / `.basis` available for UI rendering
- Permalink reload correctly shows null (live-only; persistence deferred D-06)
- Pre-existing UI test failures in board/app components are unrelated to this plan (Missing @testing-library/jest-dom matchers — pre-existing issue)

---
*Phase: 05-wire-surface*
*Completed: 2026-06-06*
