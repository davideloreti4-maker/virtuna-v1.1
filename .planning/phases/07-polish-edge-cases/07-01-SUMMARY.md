---
phase: 07-polish-edge-cases
plan: 01
subsystem: ui
tags: [utility, stale-data, error-handling, server-action, tiktok]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "competitor_profiles table with scrape_status and last_scraped_at columns"
  - phase: 02-competitor-management
    provides: "scraping provider interface and addCompetitor server action pattern"
provides:
  - "formatRelativeTime and isStale utility functions for stale data detection"
  - "StaleIndicator server component for rendering data freshness"
  - "retryScrape server action for manual profile re-scraping"
  - "ScrapeErrorBanner client component for error recovery UI"
affects: [07-02-PLAN, 07-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-action-retry, stale-data-detection, useTransition-for-mutations]

key-files:
  created:
    - src/components/competitors/stale-indicator.tsx
    - src/app/actions/competitors/retry-scrape.ts
    - src/components/competitors/scrape-error-banner.tsx
  modified:
    - src/lib/competitors-utils.ts

key-decisions:
  - "Profile-only retry matching cron behavior (no video re-scrape)"
  - "48-hour stale threshold for data freshness"
  - "useTransition over useState+async for retry button (non-blocking UI)"

patterns-established:
  - "Stale threshold: 48 hours for competitor data freshness"
  - "Server action retry pattern: auth check -> verify ownership -> scrape -> update -> revalidate"
  - "useTransition for server action mutations in client components"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 7 Plan 1: Stale/Error Building Blocks Summary

**formatRelativeTime/isStale utilities, StaleIndicator server component, retryScrape server action, and ScrapeErrorBanner client component for stale data detection and error recovery**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T09:07:23Z
- **Completed:** 2026-02-17T09:09:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Pure formatRelativeTime/isStale utility functions added to competitors-utils.ts (no new dependencies)
- StaleIndicator server component with amber/muted color based on 48-hour threshold
- retryScrape server action following identical field mapping pattern as refresh-competitors cron
- ScrapeErrorBanner client component with useTransition-powered retry button

## Task Commits

Each task was committed atomically:

1. **Task 1: Add formatRelativeTime and isStale utilities + StaleIndicator** - `3b485cc` (feat)
2. **Task 2: Create retryScrape server action and ScrapeErrorBanner** - `99f8d06` (feat)

## Files Created/Modified
- `src/lib/competitors-utils.ts` - Added formatRelativeTime and isStale pure functions
- `src/components/competitors/stale-indicator.tsx` - Server component rendering data freshness with color coding
- `src/app/actions/competitors/retry-scrape.ts` - Server action for manual profile re-scraping with auth
- `src/components/competitors/scrape-error-banner.tsx` - Client component with retry button using useTransition

## Decisions Made
- Profile-only retry matching cron behavior (no video re-scrape per research recommendation)
- 48-hour stale threshold consistent with daily cron schedule (misses 2 cycles = stale)
- useTransition over useState+async for retry button (non-blocking, framework-idiomatic)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in engagement-section.tsx (from Phase 4) -- not related to this plan, ignored.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 exports (formatRelativeTime, isStale, StaleIndicator, retryScrape, ScrapeErrorBanner) compile clean and are ready for wiring
- Plan 07-02 will integrate these into competitor views (cards, detail page, table)

## Self-Check: PASSED

- All 5 files exist on disk
- Both task commits (3b485cc, 99f8d06) verified in git log

---
*Phase: 07-polish-edge-cases*
*Completed: 2026-02-17*
