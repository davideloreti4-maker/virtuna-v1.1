---
phase: 02-competitor-management
plan: 02
subsystem: infra
tags: [cron, vercel, scraping, batch-processing, snapshots]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "Supabase schema (competitor_profiles, competitor_snapshots), service client, scraping provider"
provides:
  - "Cron auth utility (verifyCronAuth) for all cron endpoints"
  - "Daily batch re-scraping cron route with per-handle error isolation"
  - "Daily snapshot upsert for time-series data"
  - "Vercel cron configuration (6:00 AM UTC)"
affects: [04-time-series-charts, 07-advanced-features]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Cron auth utility pattern (verifyCronAuth returns null|NextResponse)", "Per-handle error isolation in batch processing", "Snapshot upsert with onConflict deduplication"]

key-files:
  created:
    - src/lib/cron-auth.ts
    - src/app/api/cron/refresh-competitors/route.ts
    - vercel.json
  modified: []

key-decisions:
  - "Reusable verifyCronAuth utility extracted for all cron endpoints"
  - "maxDuration 60s default with comment about Pro plan 300s option"
  - "No video scraping in cron (expensive, deferred to Phase 7)"

patterns-established:
  - "Cron auth: verifyCronAuth() returns null on success, 401 NextResponse on failure"
  - "Batch error isolation: individual try/catch per item, failed items logged and skipped"
  - "Snapshot dedup: upsert with onConflict on composite unique constraint"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 2 Plan 02: Cron Infrastructure Summary

**Daily batch re-scraping cron with CRON_SECRET auth, per-handle error isolation, and snapshot upsert deduplication via Vercel cron at 6:00 AM UTC**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T17:18:13Z
- **Completed:** 2026-02-16T17:19:55Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Reusable cron auth utility (`verifyCronAuth`) for CRON_SECRET Bearer token validation
- Batch re-scraping route that updates all competitor profiles and upserts daily snapshots
- Per-handle error isolation -- individual failures logged and skipped without blocking the batch
- Vercel cron schedule configured for daily 6:00 AM UTC execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cron auth utility and batch re-scraping route** - `e75e859` (feat)
2. **Task 2: Create vercel.json with daily cron schedule** - `59581f9` (chore)

## Files Created/Modified
- `src/lib/cron-auth.ts` - Reusable CRON_SECRET Bearer token auth utility
- `src/app/api/cron/refresh-competitors/route.ts` - Batch re-scraping cron route with profile update + snapshot upsert
- `vercel.json` - Vercel cron schedule configuration (daily at 6:00 AM UTC)

## Decisions Made
- Extracted `verifyCronAuth` as reusable utility (existing sync-whop route has inline auth -- can be refactored later)
- Set `maxDuration = 60` as safe default; documented Pro plan 300s option in comment
- No video scraping in cron route (expensive operation deferred to Phase 7 per plan)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Environment variable required for production:**
- `CRON_SECRET` must be set in Vercel project settings (Vercel auto-generates this for cron endpoints)

## Next Phase Readiness
- Cron infrastructure complete -- competitor data will be refreshed daily
- `verifyCronAuth` utility ready for any future cron endpoints
- Daily snapshots enable time-series growth charts (Phase 4)

## Self-Check: PASSED

All files verified present:
- `src/lib/cron-auth.ts` -- FOUND
- `src/app/api/cron/refresh-competitors/route.ts` -- FOUND
- `vercel.json` -- FOUND

All commits verified:
- `e75e859` -- FOUND (feat: cron auth + route)
- `59581f9` -- FOUND (chore: vercel.json)

---
*Phase: 02-competitor-management*
*Completed: 2026-02-16*
