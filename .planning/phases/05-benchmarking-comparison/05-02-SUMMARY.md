---
phase: 05-benchmarking-comparison
plan: 02
subsystem: ui
tags: [sorting, leaderboard, useMemo, lucide-react, next-link]

# Dependency graph
requires:
  - phase: 03-competitor-dashboard
    provides: "CompetitorTable component, CompetitorCardData type, competitors-utils"
provides:
  - "Sortable leaderboard table with 6 metric columns"
  - "Cadence column (posts/week) in table view"
  - "Compare navigation link in dashboard header"
  - "posted_at field in video data pipeline"
affects: [05-benchmarking-comparison, 06-ai-insights]

# Tech tracking
tech-stack:
  added: []
  patterns: ["useMemo pre-computation for sort-independent derived metrics", "SortableHeader inline component with closure over sort state"]

key-files:
  created: []
  modified:
    - "src/components/competitors/competitor-table.tsx"
    - "src/app/(app)/competitors/competitors-client.tsx"
    - "src/app/(app)/competitors/page.tsx"
    - "src/components/competitors/competitor-card.tsx"

key-decisions:
  - "Pre-compute derived metrics in separate useMemo from sort to avoid recomputation on sort toggle"
  - "Use lucide-react for sort icons (consistent with table/chart area conventions)"
  - "Show Compare link only when 2+ competitors tracked"

patterns-established:
  - "SortableHeader pattern: inline component reading sort state from closure, toggles direction on same-key click, defaults to desc on new key"
  - "Enriched array pattern: raw data -> enriched with pre-computed fields -> sorted copy"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 5 Plan 2: Sortable Leaderboard & Compare Link Summary

**Sortable leaderboard table with 6 metric columns (followers, likes, videos, engagement, growth, cadence), pre-computed derived metrics via useMemo, and Compare navigation link in dashboard header**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T08:00:19Z
- **Completed:** 2026-02-17T08:02:56Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Extended video data pipeline with `posted_at` field so `computePostingCadence` receives dated videos
- Replaced static table headers with interactive SortableHeader components supporting click-to-sort with directional arrow icons
- Added new Cadence column displaying posts/week for each competitor
- Added Compare link in dashboard header (visible with 2+ competitors) navigating to /competitors/compare

## Task Commits

Each task was committed atomically:

1. **Task 1: Add posted_at to video data flow** - `575d031` (feat)
2. **Task 2: Sortable column headers for CompetitorTable** - `36cc67f` (feat)
3. **Task 3: Add Compare link to dashboard header** - `6949550` (feat)

## Files Created/Modified
- `src/app/(app)/competitors/page.tsx` - Extended video query with posted_at, updated videosMap type
- `src/components/competitors/competitor-card.tsx` - Extended CompetitorCardData.videos type with posted_at
- `src/components/competitors/competitor-table.tsx` - Full sortable table with SortableHeader, pre-computed metrics, cadence column
- `src/app/(app)/competitors/competitors-client.tsx` - Added Compare link, updated videosMap prop type

## Decisions Made
- Pre-compute derived metrics in a separate `useMemo` from sorting (sort-independent enrichment avoids recomputation on every toggle)
- Used lucide-react for ChevronDown/ChevronUp/ArrowUpDown icons (consistent with table area, matching existing lucide chart icon usage)
- Compare link conditionally rendered only when `cards.length >= 2` (minimum for comparison)
- Used type assertion with Record<string, unknown> for dynamic key access in sort comparator (clean, type-safe enough with controlled keyMap)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated videosMap type in competitors-client.tsx**
- **Found during:** Task 1 (posted_at data flow)
- **Issue:** Plan specified changes to page.tsx and competitor-card.tsx but the intermediate `CompetitorsClientProps.videosMap` type in competitors-client.tsx also needed `posted_at` added, otherwise TypeScript compilation would fail at the prop boundary
- **Fix:** Added `posted_at: string | null` to the videosMap type in CompetitorsClientProps
- **Files modified:** src/app/(app)/competitors/competitors-client.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 575d031 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for type correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sortable leaderboard complete, ready for comparison view components (05-01)
- Compare link wired to /competitors/compare route
- posted_at data now flows through the pipeline, enabling cadence computation everywhere

## Self-Check: PASSED

All 4 modified files verified present. All 3 task commits verified in git log.

---
*Phase: 05-benchmarking-comparison*
*Completed: 2026-02-17*
