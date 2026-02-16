---
phase: 03-competitor-dashboard
plan: 02
subsystem: ui
tags: [radix-tabs, zustand, skeleton, empty-state, table-view, sidebar-nav, next-loading]

# Dependency graph
requires:
  - phase: 03-competitor-dashboard
    plan: 01
    provides: "CompetitorCard, CompetitorSparkline, GrowthDelta, competitors-utils, useCompetitorsStore, CompetitorsClient"
provides:
  - "CompetitorTable leaderboard view with all metric columns"
  - "CompetitorEmptyState centered CTA with UsersThree icon"
  - "CompetitorCardSkeleton/Grid and CompetitorTableSkeleton loading placeholders"
  - "Grid/table view toggle via Radix Tabs + Zustand persist"
  - "Next.js loading.tsx for streaming skeleton on navigation"
  - "Sidebar Competitors nav item with startsWith active detection"
affects: [04-competitor-detail, 05-insights]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Radix Tabs controlled by Zustand store for view toggle", "Next.js loading.tsx convention for route-level skeleton states", "Skeleton components mirroring real component layouts"]

key-files:
  created:
    - src/components/competitors/competitor-table.tsx
    - src/components/competitors/competitor-empty-state.tsx
    - src/components/competitors/competitor-card-skeleton.tsx
    - src/components/competitors/competitor-table-skeleton.tsx
    - src/app/(app)/competitors/loading.tsx
  modified:
    - src/app/(app)/competitors/competitors-client.tsx
    - src/components/app/sidebar.tsx

key-decisions:
  - "View toggle uses Radix Tabs controlled component pattern (value+onValueChange) rather than uncontrolled defaultValue"
  - "loading.tsx renders card grid skeleton as default (most common first-load view)"
  - "Sidebar Competitors uses pathname.startsWith for active detection to support future sub-routes"

patterns-established:
  - "Skeleton mirror pattern: skeleton components replicate real component DOM structure for seamless loading transitions"
  - "View toggle pattern: Radix Tabs + Zustand persist for layout switching with localStorage memory"
  - "Sidebar active detection: startsWith for routes with sub-pages, exact match for leaf routes"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 3 Plan 2: Competitor Dashboard Table View + View Toggle Summary

**Grid/table view toggle via Radix Tabs, polished empty state with CTA, shimmer skeleton loading, and sidebar Competitors nav entry**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T17:54:50Z
- **Completed:** 2026-02-16T17:57:21Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- CompetitorTable: full leaderboard with Creator (avatar+handle), Followers, Likes, Videos, Eng. Rate, Growth delta, and Sparkline trend columns
- CompetitorEmptyState: centered empty state with UsersThree icon, descriptive text, and primary "Add Competitor" CTA button
- Skeleton loading: CompetitorCardSkeleton/Grid (6-card shimmer grid) and CompetitorTableSkeleton (5-row shimmer table) matching real layouts
- View toggle: Radix Tabs (Grid/Table) controlled by Zustand store, persisted to localStorage
- loading.tsx: Next.js App Router streaming skeleton with page header + card grid placeholders
- Sidebar: Competitors nav item with UsersThree icon added between Trending and TikTok Account Selector

## Task Commits

Each task was committed atomically:

1. **Task 1: Create table view, empty state, and skeleton loading components** - `a87299c` (feat)
2. **Task 2: Wire view toggle, empty state, skeletons into client component + add sidebar nav entry** - `11b8991` (feat)

## Files Created/Modified
- `src/components/competitors/competitor-table.tsx` - Table/leaderboard view with all metric columns
- `src/components/competitors/competitor-empty-state.tsx` - Centered empty state with UsersThree icon and CTA
- `src/components/competitors/competitor-card-skeleton.tsx` - Shimmer card skeleton + 6-card grid variant
- `src/components/competitors/competitor-table-skeleton.tsx` - Shimmer table skeleton with real headers
- `src/app/(app)/competitors/loading.tsx` - Next.js streaming skeleton for route transitions
- `src/app/(app)/competitors/competitors-client.tsx` - Added view toggle, empty state, table conditional rendering
- `src/components/app/sidebar.tsx` - Added Competitors nav item with UsersThree icon

## Decisions Made
- View toggle uses Radix Tabs controlled component pattern (value+onValueChange wired to Zustand) for single source of truth
- loading.tsx renders card grid skeleton by default since grid is the initial viewMode
- Sidebar Competitors item uses pathname.startsWith("/competitors") for active detection to support future detail sub-routes (e.g., /competitors/[id])

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation passed with zero errors on both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 fully complete: card grid, table view, view toggle, empty state, skeleton loading, sidebar nav
- All Phase 3 success criteria met: view toggle, empty state UX, loading states, navigation discoverability
- CompetitorTable ready for future sort-by-column enhancement
- Sidebar Competitors nav active detection supports future /competitors/[id] detail routes
- CompetitorEmptyState CTA button ready to wire to add-competitor flow

## Self-Check: PASSED

- All 7 files verified on disk (5 created, 2 modified)
- Both task commits (a87299c, 11b8991) verified in git log
- TypeScript compilation: zero errors

---
*Phase: 03-competitor-dashboard*
*Completed: 2026-02-16*
