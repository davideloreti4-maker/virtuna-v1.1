---
phase: 05-benchmarking-comparison
plan: 01
subsystem: ui
tags: [recharts, comparison, searchParams, server-components, self-benchmarking]

# Dependency graph
requires:
  - phase: 04-detail-page-analytics
    provides: "competitors-utils.ts analytics functions, chart patterns, ChartTooltip"
  - phase: 01-data-foundation
    provides: "competitor_profiles, competitor_snapshots, competitor_videos tables"
  - phase: 02-competitor-management
    provides: "addCompetitor server action, user_competitors junction table"
provides:
  - "Side-by-side comparison page at /competitors/compare"
  - "ComparisonData type for pre-computed competitor metrics"
  - "Self-benchmarking flow (user's own handle tracked as competitor)"
  - "ComparisonSelector reusable dropdown component"
  - "ComparisonMetricCard, ComparisonBarChart, ComparisonGrowthChart components"
affects: [06-ai-insights, 07-polish-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "searchParams-driven server-side data fetching for comparison routes"
    - "URL-push navigation pattern for client-side selector changes"
    - "Date-based time series merging for multi-line chart overlays"

key-files:
  created:
    - src/app/(app)/competitors/compare/page.tsx
    - src/app/(app)/competitors/compare/loading.tsx
    - src/app/(app)/competitors/compare/comparison-client.tsx
    - src/components/competitors/comparison/comparison-selector.tsx
    - src/components/competitors/comparison/comparison-metric-card.tsx
    - src/components/competitors/comparison/comparison-bar-chart.tsx
    - src/components/competitors/comparison/comparison-growth-chart.tsx
  modified: []

key-decisions:
  - "ComparisonData type exported from page.tsx and imported by client (co-located types)"
  - "Self-benchmarking auto-tracks user handle via addCompetitor action if not yet in competitor_profiles"
  - "Bar chart uses only absolute count metrics (followers, likes, videos, avg views) to avoid scale mixing with percentages"
  - "Growth chart merges time series by date with Map, using connectNulls for gaps"

patterns-established:
  - "URL searchParams pattern: selector change -> router.push -> server re-render with fresh data"
  - "Winner highlighting: compare raw values, apply text-accent to higher side"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 5 Plan 01: Comparison View Summary

**Side-by-side competitor comparison page with searchParams-driven selection, 7 metric cards with winner highlighting, grouped bar chart, and dual-line growth overlay**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T08:00:25Z
- **Completed:** 2026-02-17T08:02:46Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Comparison page at /competitors/compare with server-side parallel data fetching for two competitors
- Self-benchmarking option: "Compare with me" auto-tracks user's own TikTok handle as a competitor profile
- 7 metric cards (followers, likes, videos, engagement rate, growth rate, posting frequency, avg views) with accent color winner highlighting
- Grouped bar chart for absolute metrics and dual-line area chart overlaying follower growth trends
- URL-driven state: selecting competitors updates searchParams, enabling shareable comparison URLs

## Task Commits

Each task was committed atomically:

1. **Task 1: Comparison page server component and client shell** - `9f74511` (feat)
2. **Task 2: Comparison metric cards and chart components** - `55ce38d` (feat)

## Files Created/Modified
- `src/app/(app)/competitors/compare/page.tsx` - Server component with parallel data fetch, self-benchmarking, ComparisonData type
- `src/app/(app)/competitors/compare/loading.tsx` - Skeleton loading state with selector and card placeholders
- `src/app/(app)/competitors/compare/comparison-client.tsx` - Client shell with selector dropdowns, metric cards grid, and chart layout
- `src/components/competitors/comparison/comparison-selector.tsx` - Raycast-styled dropdown with self-option ("You (@handle)")
- `src/components/competitors/comparison/comparison-metric-card.tsx` - Side-by-side metric card with winner accent highlighting
- `src/components/competitors/comparison/comparison-bar-chart.tsx` - Grouped Recharts BarChart (coral vs green, no stacking)
- `src/components/competitors/comparison/comparison-growth-chart.tsx` - Dual-line AreaChart with date-merged time series

## Decisions Made
- ComparisonData type co-located in page.tsx and imported by client component (keeps server/client contract explicit)
- Self-benchmarking creates junction row with authenticated client (RLS-compliant), falls back to addCompetitor action for full scrape
- Bar chart excludes percentage-based metrics (engagement rate, growth rate) to avoid scale mixing -- only absolute counts shown
- Growth chart merges two time series by date using Map, with connectNulls to handle gaps where one series lacks data points

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Comparison view complete, ready for Phase 5 Plan 2 (if any additional benchmarking features planned)
- All chart components follow established patterns from Phase 4, reusing ChartTooltip and formatCount
- ComparisonData type available for extension in future phases (e.g., AI insights comparison)

## Self-Check: PASSED

- All 7 files: FOUND
- Commit 9f74511: FOUND
- Commit 55ce38d: FOUND
- TypeScript compilation: PASSED (zero errors)

---
*Phase: 05-benchmarking-comparison*
*Completed: 2026-02-17*
