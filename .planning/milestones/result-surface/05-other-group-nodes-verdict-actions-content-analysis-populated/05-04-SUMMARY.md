---
phase: 05-other-group-nodes-verdict-actions-content-analysis-populated
plan: "04"
subsystem: ui, api
tags: [verdict, comparisons-endpoint, recharts-barchart, tanstack-query, supabase-rls]

requires:
  - phase: 05-01
    provides: VerdictNode shell, verdict-types.ts, verdict-constants.ts stubs
  - phase: 05-02
    provides: PercentileChip, AntiViralityHeader wired into VerdictNode
  - phase: 05-03
    provides: WhyVerdictCollapsible wired into VerdictNode collapsibles slot

provides:
  - GET /api/analyze/[id]/comparisons — RLS-gated, returns {history: number[], niche: null}
  - useComparisons TanStack Query hook (5-min staleTime, enabled=!!analysisId)
  - VsHistoryCollapsible — native <details> + 2 vertical Recharts BarCharts + empty state
  - VerdictNode fully wired: PercentileChip + AntiViralityHeader + WhyVerdictCollapsible + VsHistoryCollapsible

affects:
  - phase-08-board-wiring (VerdictNode complete — no further changes needed for R1.3/R1.8)
  - future-niche-aggregate-phase (niche: null placeholder ready in endpoint + UI)

tech-stack:
  added: []
  patterns:
    - "Recharts BarChart layout=vertical for horizontal bars in compact (88px height) frames"
    - "useQuery hook with enabled=!!id pattern for nullable analysis IDs"
    - "Native <details>/<summary> collapsible with group-open Tailwind variant"
    - "logger.info (not logger.event) for telemetry events — logger has no .event method"

key-files:
  created:
    - src/app/api/analyze/[id]/comparisons/route.ts
    - src/components/board/verdict/use-comparisons.ts
    - src/components/board/verdict/VsHistoryCollapsible.tsx
    - src/components/board/verdict/__tests__/use-comparisons.test.ts
    - src/components/board/verdict/__tests__/VsHistoryCollapsible.test.tsx
  modified:
    - src/components/board/verdict/verdict-constants.ts
    - src/components/board/verdict/VerdictNode.tsx
    - src/components/board/verdict/__tests__/VerdictNode.test.tsx

key-decisions:
  - "DB table is analysis_results (not analyses) — query .from('analysis_results') with overall_score column (confirmed migration 20260213000000_content_intelligence.sql:90)"
  - "logger has no .event method — use logger.info for telemetry (not logger.event?.) in component; test mocks logger.info"
  - "niche: null locked in Phase 5 per RESEARCH Open Question 1 — both endpoint and UI have clean placeholder"
  - "VerdictNode.test.tsx wrapped with QueryClientProvider (Rule 1) — VsHistoryCollapsible calls useComparisons which requires TanStack Query context"
  - "Supabase client import path: @/lib/supabase/server (confirmed from override/route.ts analog)"
  - "ChartTooltip is a named export from @/components/competitors/charts/chart-tooltip"

patterns-established:
  - "API route auth pattern: createClient() + auth.getUser() + 401 + Zod UUID validate + RLS query"
  - "Compact BarChart: layout=vertical, height=88, XAxis hide, YAxis category, no CartesianGrid"
  - "Cell fill pattern: coral (var(--color-accent)) for current, rgba(255,255,255,0.30) for history"

requirements-completed: [R1.3, R1.8]

duration: 25min
completed: 2026-05-28
---

# Phase 05 Plan 04: VsHistoryCollapsible + Comparisons Endpoint Summary

**RLS-gated /api/analyze/[id]/comparisons endpoint + VsHistoryCollapsible with 2 vertical Recharts BarCharts wired into VerdictNode, completing R1.3 + R1.8**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-28T06:04:00Z
- **Completed:** 2026-05-28T06:29:52Z
- **Tasks:** 3
- **Files modified:** 8 (3 created + 5 modified/updated)

## Accomplishments
- GET /api/analyze/[id]/comparisons — UUID-validated, RLS-gated, returns top-10 prior scores excluding current analysis
- useComparisons hook with 5-min staleTime, disabled when analysisId null, throws on non-2xx
- VsHistoryCollapsible with empty state (<3 history), history BarChart (11 bars), niche coming-soon caption — wired into VerdictNode
- 62 verdict tests passing with zero regressions

## Task Commits

1. **Task 1: /api/analyze/[id]/comparisons GET route** - `d82fa2e` (feat)
2. **Task 2: useComparisons hook + 3 tests** - `2886927` (feat)
3. **Task 3: VsHistoryCollapsible + VerdictNode wiring + 6 tests + VerdictNode.test fix** - `3ab991f` (feat)

## Files Created/Modified
- `src/app/api/analyze/[id]/comparisons/route.ts` — GET handler, Zod UUID validation, RLS-gated query against analysis_results
- `src/components/board/verdict/use-comparisons.ts` — TanStack Query hook, queryKey=['comparisons', id], staleTime=5min
- `src/components/board/verdict/VsHistoryCollapsible.tsx` — native <details> + 2 Recharts BarCharts (vertical layout) + empty state + niche coming-soon
- `src/components/board/verdict/__tests__/use-comparisons.test.ts` — 3 tests: disabled when null, fetches URL, throws on 5xx
- `src/components/board/verdict/__tests__/VsHistoryCollapsible.test.tsx` — 6 tests: summary text, empty state, last-10 chart, niche-coming-soon, niche chart, telemetry
- `src/components/board/verdict/verdict-constants.ts` — appended HISTORY_* copy + VERDICT_HISTORY_EXPANDED telemetry
- `src/components/board/verdict/VerdictNode.tsx` — import + render VsHistoryCollapsible in collapsibles slot
- `src/components/board/verdict/__tests__/VerdictNode.test.tsx` — added QueryClientProvider wrapper (Rule 1 auto-fix)

## Decisions Made

**DB table name:** Plan specified `.from('analyses')` but the actual schema uses `analysis_results` (confirmed in migration 20260213000000_content_intelligence.sql line 90). Column `overall_score NUMERIC(5,2)` confirmed in same migration. Route queries `analysis_results`.

**Logger API:** `logger` in `@/lib/logger` has `debug/info/warn/error/child` only — no `.event` method. Plan used `logger.event?.()` in component. Used `logger.info()` instead. Test mocks `logger.info` (not `logger.event`).

**Supabase client path:** `@/lib/supabase/server` (confirmed from override/route.ts analog — both candidates from research were `@/lib/supabase/server` and `@/utils/supabase/server`; this codebase uses the former).

**ChartTooltip:** Named export `{ ChartTooltip }` from `@/components/competitors/charts/chart-tooltip` — confirmed exact import/usage.

**R1.3 + R1.8 complete:** VerdictNode now has PercentileChip (05-02) + AntiViralityHeader (05-02) + WhyVerdictCollapsible (05-03) + VsHistoryCollapsible (this plan). Both R1.3 (score display) and R1.8 (historical comparison) are addressed by the combined 05-01 through 05-04 work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DB table name mismatch — analyses vs analysis_results**
- **Found during:** Task 1 (route handler)
- **Issue:** Plan specified `.from('analyses')` but schema uses `analysis_results`; `analyses` table does not exist
- **Fix:** Route queries `.from('analysis_results')` with `.select('overall_score')` — column confirmed present
- **Files modified:** src/app/api/analyze/[id]/comparisons/route.ts
- **Verification:** grep confirms `.from('analysis_results')` in committed route
- **Committed in:** d82fa2e

**2. [Rule 1 - Bug] VerdictNode tests broke after VsHistoryCollapsible wiring**
- **Found during:** Task 3 — regression check of full verdict test suite
- **Issue:** VerdictNode.test.tsx rendered VerdictNode without QueryClientProvider; VsHistoryCollapsible calls useComparisons (TanStack Query hook) which requires QueryClient context — 4 tests failed with "No QueryClient set"
- **Fix:** Wrapped all renders in VerdictNode.test.tsx with QueryClientProvider + QueryClient; added fetch mock for VsHistoryCollapsible requests
- **Files modified:** src/components/board/verdict/__tests__/VerdictNode.test.tsx
- **Verification:** All 62 verdict tests pass post-fix
- **Committed in:** 3ab991f

**3. [Rule 1 - Bug] logger.event does not exist on Logger interface**
- **Found during:** Task 3 (VsHistoryCollapsible implementation)
- **Issue:** Plan used `logger.event?.(...)` but Logger interface only has debug/info/warn/error/child
- **Fix:** Used `logger.info()` for telemetry event in component; test mocks `logger.info` instead of `logger.event`
- **Files modified:** src/components/board/verdict/VsHistoryCollapsible.tsx, VsHistoryCollapsible.test.tsx
- **Verification:** Test for telemetry passes using `logger.info` assertion
- **Committed in:** 3ab991f

---

**Total deviations:** 3 auto-fixed (3x Rule 1 — data correctness bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. Plan objectives fully met.

## Issues Encountered
- verdict-constants.ts was already updated by plan 5.3 (WhyVerdictCollapsible entries) — appended 5.4 entries additively without conflict.

## Known Stubs
- `niche: null` in endpoint response — intentional Phase 5 lock per RESEARCH Open Question 1. The niche BarChart path in VsHistoryCollapsible renders correctly when niche is non-null (tested with `comparisonsFixtures.fullWithNiche`). Future phase to implement niche aggregate.

## User Setup Required
None — no external service configuration required beyond existing Supabase project.

## Next Phase Readiness
- VerdictNode is complete and requires no further changes for Board.tsx wiring (Plan 5.8)
- Niche cohort aggregate has a clean "coming soon" placeholder — no UI debt when niche phase ships
- All verdict suite tests (62) passing, no regressions

---
*Phase: 05-other-group-nodes-verdict-actions-content-analysis-populated*
*Completed: 2026-05-28*
