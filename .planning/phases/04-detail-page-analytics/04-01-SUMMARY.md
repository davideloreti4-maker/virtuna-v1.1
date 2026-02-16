---
phase: 04-detail-page-analytics
plan: 01
subsystem: ui
tags: [recharts, next.js, server-components, area-chart, bar-chart, dynamic-routes, supabase]

# Dependency graph
requires:
  - phase: 03-competitor-dashboard
    provides: CompetitorCard, CompetitorTable, competitor-sparkline, growth-delta, competitors-utils.ts
  - phase: 01-data-foundation
    provides: Database schema (competitor_profiles, competitor_snapshots, competitor_videos, user_competitors), Supabase server client
provides:
  - /competitors/[handle] detail page route with profile header, growth charts, engagement analytics
  - 6 analytics utility functions (computeVideoEngagementRate, computeAverageViews, computePostingCadence, computeHashtagFrequency, computePostingTimeGrid, computeDurationBreakdown)
  - Chart component library (ChartTooltip, FollowerGrowthChart, EngagementBarChart)
  - Dashboard-to-detail navigation (card Link, table row onClick)
  - Loading skeleton for detail page
affects: [04-02 content-analysis, 05-comparison-view, 06-ai-insights]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-component-parallel-queries, client-chart-wrappers, pre-computed-analytics-props, next15-async-params]

key-files:
  created:
    - src/app/(app)/competitors/[handle]/page.tsx
    - src/app/(app)/competitors/[handle]/loading.tsx
    - src/components/competitors/charts/chart-tooltip.tsx
    - src/components/competitors/charts/follower-growth-chart.tsx
    - src/components/competitors/charts/engagement-bar-chart.tsx
    - src/components/competitors/detail/detail-header.tsx
    - src/components/competitors/detail/growth-section.tsx
    - src/components/competitors/detail/engagement-section.tsx
  modified:
    - src/lib/competitors-utils.ts
    - src/components/competitors/competitor-card.tsx
    - src/components/competitors/competitor-table.tsx

key-decisions:
  - "Server-side analytics computation: all engagement rates, averages, and chart data pre-computed in server component to minimize client bundle"
  - "User authorization via junction table check: detail page verifies user_competitors row exists before rendering"
  - "Top 20 videos by views for engagement chart data (top 10 displayed in chart, top 20 in table)"
  - "VideoMetrics interface extracted as shared named export for consistency between computeEngagementRate and computeVideoEngagementRate"

patterns-established:
  - "Chart wrapper pattern: 'use client' component receives pre-computed {label, value}[] props from server component"
  - "Detail page data fetching: parallel Promise.all for snapshots + videos after profile/junction auth check"
  - "Empty data fallback: charts return centered 'Not enough data' message when insufficient data points"
  - "Next.js 15 async params: params: Promise<{ handle: string }> with await destructuring"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 4 Plan 1: Detail Page with Growth and Engagement Analytics Summary

**Competitor detail page at /competitors/[handle] with Recharts AreaChart for follower growth, stacked BarChart for per-video engagement, and 6 pure analytics utility functions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T18:21:39Z
- **Completed:** 2026-02-16T18:26:20Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Full detail page with profile header (avatar, handle, bio, 3 stat cards), growth section (AreaChart + stats), and engagement section (BarChart + table + avg rate)
- 6 analytics utility functions for video-level engagement, average views, posting cadence, hashtag frequency, posting time grid, and duration breakdown
- Dashboard cards and table rows now navigate to /competitors/[handle]
- Loading skeleton with animated shimmer blocks for all detail page sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend competitors-utils.ts with analytics functions and create chart components** - `acf6e01` (feat)
2. **Task 2: Create detail page server component, header, sections, skeleton, and wire dashboard Links** - `a8e14c7` (feat)

## Files Created/Modified
- `src/lib/competitors-utils.ts` - Added VideoMetrics interface + 6 new pure analytics functions
- `src/components/competitors/charts/chart-tooltip.tsx` - Dark theme tooltip for all Recharts charts
- `src/components/competitors/charts/follower-growth-chart.tsx` - AreaChart with coral gradient fill
- `src/components/competitors/charts/engagement-bar-chart.tsx` - Stacked BarChart for per-video engagement
- `src/components/competitors/detail/detail-header.tsx` - Profile header with avatar, handle, bio, stats
- `src/components/competitors/detail/growth-section.tsx` - Growth chart + avg views + weekly growth stats
- `src/components/competitors/detail/engagement-section.tsx` - Engagement chart + avg rate + per-video table
- `src/app/(app)/competitors/[handle]/page.tsx` - Server component with parallel queries and pre-computed analytics
- `src/app/(app)/competitors/[handle]/loading.tsx` - Skeleton loading state
- `src/components/competitors/competitor-card.tsx` - Wrapped with Link to detail page
- `src/components/competitors/competitor-table.tsx` - Added useRouter + onClick for row navigation

## Decisions Made
- Server-side analytics computation: all chart data and engagement rates pre-computed in the server component to minimize RSC payload and client bundle size
- User authorization via junction table: detail page verifies `user_competitors` row exists (user tracks this competitor) before rendering, preventing unauthorized access to competitors not in user's list
- VideoMetrics interface extracted as named export from competitors-utils.ts for shared use between `computeEngagementRate` and `computeVideoEngagementRate`
- Top 20 videos by views selected for engagement chart data, with top 10 shown in chart and all 20 in scrollable table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Detail page renders growth and engagement sections, ready for 04-02 to add content analysis (top videos, hashtag rankings, posting heatmap, duration breakdown)
- 6 utility functions already created for content analysis: computePostingCadence, computeHashtagFrequency, computePostingTimeGrid, computeDurationBreakdown are ready for 04-02 to use
- Chart component pattern (charts/ directory with "use client" wrappers) established for additional charts in 04-02

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (acf6e01, a8e14c7) verified in git log. TypeScript compiles with zero errors.

---
*Phase: 04-detail-page-analytics*
*Completed: 2026-02-16*
