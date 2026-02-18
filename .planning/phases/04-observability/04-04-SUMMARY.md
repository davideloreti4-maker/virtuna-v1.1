---
phase: 04-observability
plan: 04
subsystem: api
tags: [supabase, admin, cost-tracking, observability, aggregation]

# Dependency graph
requires:
  - phase: 01-schedule-crons
    provides: "analysis_results table with cost_cents column, cron-auth pattern"
provides:
  - "GET /api/admin/costs — daily cost aggregation endpoint by model"
affects: [05-testing, 06-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: ["client-side aggregation via Map for Supabase data without RPC"]

key-files:
  created:
    - src/app/api/admin/costs/route.ts
  modified: []

key-decisions:
  - "Client-side JS aggregation instead of SQL RPC to avoid migration"
  - "Group by gemini_model (always present) not deepseek_model (may be null)"
  - "COALESCE null cost_cents to 0 for pre-v2 rows"
  - "365-day max to prevent OOM from unbounded queries"

patterns-established:
  - "Admin aggregation endpoints: fetch raw + aggregate in JS for low-volume data"

# Metrics
duration: 1min
completed: 2026-02-18
---

# Phase 4 Plan 4: Admin Cost Aggregation Summary

**GET /api/admin/costs endpoint with daily spend aggregation by gemini_model, CRON_SECRET auth, and client-side Map-based grouping**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-18T11:03:31Z
- **Completed:** 2026-02-18T11:04:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created admin cost aggregation endpoint at /api/admin/costs
- Client-side aggregation groups analysis_results by date + gemini_model
- CRON_SECRET Bearer token auth protects endpoint (same pattern as calibration-report)
- Supports ?days=N query param (default 30, max 365)
- NULL cost_cents handled via COALESCE to 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/admin/costs aggregation endpoint** - `af0776f` (feat)

## Files Created/Modified
- `src/app/api/admin/costs/route.ts` - Admin cost aggregation endpoint returning daily spend by model

## Decisions Made
- Client-side JS aggregation via Map instead of SQL RPC — avoids needing a Supabase migration for low-volume data (<10k rows/month)
- Grouped by gemini_model since it's always present; deepseek_model may be null in Gemini-fallback mode
- COALESCE null cost_cents to 0 handles pre-v2 rows where cost tracking wasn't implemented
- 365-day max on ?days param prevents abuse/OOM from requesting years of data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added console.error logging in catch block**
- **Found during:** Task 1
- **Issue:** Plan template omitted error logging in the catch block
- **Fix:** Added `console.error("[admin/costs] Failed to aggregate costs:", error)` matching calibration-report pattern
- **Files modified:** src/app/api/admin/costs/route.ts
- **Verification:** Build passes, pattern matches calibration-report/route.ts
- **Committed in:** af0776f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for debugging production issues. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OBS-06 complete: admin cost aggregation endpoint ready
- All Phase 4 observability endpoints should now be complete
- Ready for Phase 5 (Testing) integration tests against admin endpoints

## Self-Check: PASSED

- [x] `src/app/api/admin/costs/route.ts` exists (92 lines, >= 30 min)
- [x] Commit `af0776f` exists in git log
- [x] `pnpm build` exits 0

---
*Phase: 04-observability*
*Completed: 2026-02-18*
