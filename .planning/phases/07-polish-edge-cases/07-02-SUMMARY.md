---
phase: 07-polish-edge-cases
plan: 02
subsystem: ui
tags: [stale-data, error-states, competitor-views, data-freshness, tiktok]

# Dependency graph
requires:
  - phase: 07-polish-edge-cases
    plan: 01
    provides: "StaleIndicator, ScrapeErrorBanner, formatRelativeTime, isStale, retryScrape building blocks"
  - phase: 03-competitor-dashboard
    provides: "CompetitorCard, CompetitorTable, CompetitorsClient components"
  - phase: 04-detail-page-analytics
    provides: "DetailHeader component and detail page layout"
  - phase: 05-benchmarking-comparison
    provides: "ComparisonClient, ComparisonData type, comparison page"
provides:
  - "Stale data indicators visible on all competitor views (cards, table, detail, comparison)"
  - "Error badges on dashboard cards and table when scrape_status is failed"
  - "ScrapeErrorBanner with retry on detail page for failed scrapes"
  - "Status column in competitor leaderboard table"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [stale-indicator-wiring, error-state-threading, data-field-threading]

key-files:
  created: []
  modified:
    - src/components/competitors/competitor-card.tsx
    - src/app/(app)/competitors/competitors-client.tsx
    - src/components/competitors/competitor-table.tsx
    - src/components/competitors/detail/detail-header.tsx
    - src/app/(app)/competitors/compare/page.tsx
    - src/app/(app)/competitors/compare/comparison-client.tsx

key-decisions:
  - "No interface changes needed in competitors-client.tsx -- CompetitorRow already had last_scraped_at and scrape_status from Supabase join"
  - "Status column placed after Trend in table for natural visual flow"
  - "StaleIndicator rendered inside client components safely (serializable props, plain span output)"

patterns-established:
  - "Thread database fields through component interfaces: add to type -> map in data builder -> render in view"
  - "Server component (StaleIndicator) rendered inside client wrapper is safe when props are serializable"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 7 Plan 2: Stale/Error Indicator Wiring Summary

**Stale data indicators and error state badges wired into all competitor views: dashboard cards, leaderboard table, detail header with retry banner, and comparison page selectors**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T09:12:26Z
- **Completed:** 2026-02-17T09:14:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Dashboard cards show "Updated X ago" stale indicator below handle with amber/muted color coding
- Dashboard cards show "Scrape failed" inline badge when scrape_status is failed
- Leaderboard table has new Status column showing stale indicator or "Failed" badge per row
- Detail page header shows stale indicator below bio and ScrapeErrorBanner with retry button when scrape failed
- Comparison page shows stale indicators under each competitor selector

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend CompetitorCardData, thread data in client, update card and table views** - `093958a` (feat)
2. **Task 2: Add stale indicator and error banner to detail header and comparison page** - `f33af74` (feat)

## Files Created/Modified
- `src/components/competitors/competitor-card.tsx` - Extended CompetitorCardData with last_scraped_at/scrape_status, added StaleIndicator and error badge
- `src/app/(app)/competitors/competitors-client.tsx` - Threaded last_scraped_at and scrape_status from profile to card data
- `src/components/competitors/competitor-table.tsx` - Added Status column with StaleIndicator or Failed badge
- `src/components/competitors/detail/detail-header.tsx` - Added StaleIndicator below bio and ScrapeErrorBanner for failed scrapes
- `src/app/(app)/competitors/compare/page.tsx` - Added lastScrapedAt to ComparisonData type and threaded from profile
- `src/app/(app)/competitors/compare/comparison-client.tsx` - Added StaleIndicator under each competitor selector

## Decisions Made
- No interface changes needed in competitors-client.tsx -- CompetitorRow already had both fields from the Supabase join
- Status column placed after Trend column for natural visual flow in leaderboard table
- StaleIndicator (server component) renders safely inside client wrappers since it only uses serializable props and outputs plain span elements

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All competitor views now satisfy UI-03 (stale data indicators) and UI-04 (error states with retry)
- Phase 7 is now complete (07-01 building blocks, 07-02 wiring, 07-03 mobile responsiveness all done)
- Project ready for production deployment

## Self-Check: PASSED

- All 6 modified files exist on disk
- Both task commits (093958a, f33af74) verified in git log
- StaleIndicator imported in all 4 target files (card, table, detail-header, comparison-client)
- ScrapeErrorBanner imported in detail-header.tsx
- lastScrapedAt field present in ComparisonData type and threaded through

---
*Phase: 07-polish-edge-cases*
*Completed: 2026-02-17*
