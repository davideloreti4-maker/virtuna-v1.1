---
phase: 08-ux-gap-closure
plan: 01
subsystem: ui, api
tags: [sse, streaming, theater-duration, routing, next.js, suspense, useSearchParams]

# Dependency graph
requires:
  - phase: 05.1-tanstack-wiring
    provides: useAnalyze hook, LoadingPhases component, test-store flow state
provides:
  - SSE phase events interleaved with actual pipeline work
  - 4.5s minimum theater duration enforcement
  - Analyze button routing from trending to dashboard
  - URL pre-fill for dashboard content form
  - phaseMessage rendering in LoadingPhases
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline pipeline stages in SSE handler for real-time phase events"
    - "Minimum theater duration via async onSuccess with cancel safety ref"
    - "URL search param pre-fill via useSearchParams + initialContent prop"

key-files:
  created: []
  modified:
    - src/app/api/analyze/route.ts
    - src/components/app/simulation/loading-phases.tsx
    - src/app/(app)/dashboard/dashboard-client.tsx
    - src/app/(app)/dashboard/page.tsx
    - src/components/app/test-creation-flow.tsx
    - src/components/trending/video-detail-modal.tsx
    - src/components/app/content-form.tsx

key-decisions:
  - "Removed runPredictionPipeline wrapper in favor of inlining stages for SSE interleaving"
  - "4500ms minimum theater duration with useRef cancel guard to prevent stale transitions"
  - "Suspense fallback={null} for dashboard page to avoid layout flash"

patterns-established:
  - "Theater duration pattern: theatreStart + async onSuccess + isCancelledRef for min-wait UX"
  - "initialContent prop pattern for cross-page content pre-fill"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 8 Plan 1: UX Gap Closure Summary

**SSE phase events interleaved with pipeline stages, 4.5s minimum theater duration, and trending-to-dashboard analyze routing with URL pre-fill**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T13:36:14Z
- **Completed:** 2026-02-13T13:40:53Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- SSE phase events now fire between actual pipeline work (analyzing -> Gemini+rules+trends parallel, matching -> rule scoring, simulating -> DeepSeek, generating -> aggregation)
- Simulation theater enforces 4.5s minimum duration with cancel-safe ref guard in both DashboardClient and TestCreationFlow
- Analyze button in trending video modal correctly navigates to /dashboard?url= (was /viral-predictor)
- Dashboard reads URL param, auto-selects tiktok-script type, and pre-fills ContentForm
- LoadingPhases renders phaseMessage text from SSE events (was silently discarded via underscore alias)

## Task Commits

Each task was committed atomically:

1. **Task 1: Spread SSE phase events across pipeline stages and wire phaseMessage** - `ba1ab36` (feat)
2. **Task 2: Enforce 4.5s minimum theater duration with cancel safety** - `6b62ceb` (feat)
3. **Task 3: Fix analyze button routing and add URL pre-fill to dashboard** - `91cc8f3` (feat)

## Files Created/Modified

- `src/app/api/analyze/route.ts` - Inlined pipeline stages with SSE events interleaved between actual work
- `src/components/app/simulation/loading-phases.tsx` - Wire phaseMessage prop, render phase text above skeletons
- `src/app/(app)/dashboard/dashboard-client.tsx` - MINIMUM_THEATER_MS, isCancelledRef, useSearchParams, initialContent
- `src/app/(app)/dashboard/page.tsx` - Suspense boundary for useSearchParams
- `src/components/app/test-creation-flow.tsx` - MINIMUM_THEATER_MS, isCancelledRef for theater duration
- `src/components/trending/video-detail-modal.tsx` - Route from /viral-predictor to /dashboard
- `src/components/app/content-form.tsx` - initialContent prop with useEffect pre-fill

## Decisions Made

- Removed `runPredictionPipeline` wrapper entirely -- inlining pipeline stages in route.ts gives natural SSE interleaving points. The pipeline.ts module still exists for non-SSE callers.
- Used 4500ms (4.5s) minimum theater duration with `Date.now()` comparison, not a fixed timeout, to account for actual pipeline latency.
- `isCancelledRef` chosen over state variable because the cancel check runs inside an async callback after `await`, where stale closure state would cause bugs.
- `Suspense fallback={null}` instead of a loading spinner to avoid layout flash since the dashboard renders the same shell either way.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All UX gap closure requirements from the milestone audit are now satisfied
- No remaining /viral-predictor references in the codebase
- Ready for milestone completion

## Self-Check: PASSED

- All 7 modified files verified present on disk
- All 3 task commits verified in git log (ba1ab36, 6b62ceb, 91cc8f3)

---
*Phase: 08-ux-gap-closure*
*Completed: 2026-02-13*
