---
phase: 06-hardening
plan: 03
subsystem: engine
tags: [circuit-breaker, mutex, half-open-probe, thundering-herd, deepseek]

# Dependency graph
requires:
  - phase: 06-hardening
    plan: 01
    provides: Zod-validated calibration loading and circuit breaker in deepseek.ts
provides:
  - probeInFlight mutex preventing concurrent half-open probes in circuit breaker
  - Thundering herd prevention for recovering DeepSeek service (HARD-04)
affects: [pipeline, deepseek]

# Tech tracking
tech-stack:
  added: []
  patterns: [module-level-mutex-flag, probe-in-flight-guard]

key-files:
  created: []
  modified:
    - src/lib/engine/deepseek.ts
    - src/lib/engine/__tests__/deepseek.test.ts

key-decisions:
  - "Per-instance mutex (not distributed lock) — matches serverless-per-instance circuit breaker scope"
  - "probeInFlight cleared in both recordSuccess and recordFailure for all exit paths"
  - "Defensive guard in half-open branch blocks additional requests even if state reached unexpectedly"

patterns-established:
  - "Probe mutex pattern: module-level boolean flag gates concurrent access to half-open probe transition"

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 6 Plan 3: Circuit Breaker Half-Open Probe Mutex Summary

**probeInFlight mutex prevents thundering herd on recovering DeepSeek — only one request probes, others get null**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T13:15:26Z
- **Completed:** 2026-02-18T13:19:31Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Circuit breaker half-open probe protected by `probeInFlight` boolean mutex
- First concurrent request when backoff timer expires probes the service; all others receive null (circuit appears open)
- Mutex cleared on both success (breaker closes) and failure (breaker re-opens with escalated backoff)
- `resetCircuitBreaker()` clears the flag for test isolation
- All 203 existing tests pass, build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Add probe mutex to circuit breaker half-open transition** - `bf9e1ae` (feat)

## Files Created/Modified

- `src/lib/engine/deepseek.ts` - Added `probeInFlight` flag, mutex check in `isCircuitOpen()`, reset in `recordSuccess()`, `recordFailure()`, and `resetCircuitBreaker()`
- `src/lib/engine/__tests__/deepseek.test.ts` - Updated half-open state tests to not consume probe slot before `reasonWithDeepSeek` call

## Decisions Made

- Per-instance mutex (module-level boolean) rather than distributed lock — consistent with the circuit breaker's per-serverless-instance scope (as documented in STATE.md blockers)
- `probeInFlight` cleared in both `recordSuccess` and `recordFailure` to handle all exit paths
- Added defensive guard in the half-open branch of `isCircuitOpen()` that blocks requests if `probeInFlight` is true, even though the probe-in-flight flag normally gates the transition above

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing circuit breaker tests for probe mutex compatibility**
- **Found during:** Task 1 (test verification)
- **Issue:** Two tests ("success in half-open state resets to closed" and "failure in half-open state reopens with increased backoff") called `isCircuitOpen()` directly to assert half-open transition, which consumed the probe slot and blocked the subsequent `reasonWithDeepSeek()` call
- **Fix:** Removed intermediate `isCircuitOpen()` assertion calls between timer advance and `reasonWithDeepSeek()` — the probe transition now happens internally within `reasonWithDeepSeek()`
- **Files modified:** src/lib/engine/__tests__/deepseek.test.ts
- **Verification:** All 203 tests pass
- **Committed in:** bf9e1ae (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test compatibility with new mutex)
**Impact on plan:** Test update was necessary for correctness. No scope creep.

## Issues Encountered

None beyond the test update documented above.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- HARD-04 (circuit breaker probe mutex) is complete
- Circuit breaker is now hardened against concurrent half-open probes within a single serverless instance
- Per-instance limitation is acknowledged and acceptable for the current architecture

## Self-Check: PASSED

- [x] src/lib/engine/deepseek.ts exists and contains probeInFlight (9 occurrences)
- [x] src/lib/engine/__tests__/deepseek.test.ts updated with probe-aware tests
- [x] 06-03-SUMMARY.md exists
- [x] Commit bf9e1ae (Task 1) found in git log
- [x] All 203 tests pass
- [x] Build succeeds

---
*Phase: 06-hardening*
*Completed: 2026-02-18*
