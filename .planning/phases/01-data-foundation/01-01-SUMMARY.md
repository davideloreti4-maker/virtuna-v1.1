---
phase: 01-data-foundation
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, migration, competitor-tracking, bigint, junction-table]

# Dependency graph
requires: []
provides:
  - "competitor_profiles table with BIGINT metrics and shared deduplication model"
  - "user_competitors junction table linking users to competitor profiles"
  - "competitor_snapshots daily time-series table"
  - "competitor_videos table with per-video engagement metrics"
  - "RLS policies gated through junction table"
  - "Service role client (createServiceClient) for server-side RLS bypass"
affects: [01-02, scraping-ingestion, competitor-api, competitor-ui, cron-jobs]

# Tech tracking
tech-stack:
  added: []
  patterns: [junction-table-deduplication, rls-via-junction-subquery, service-role-bypass, bigint-metrics]

key-files:
  created:
    - "supabase/migrations/20260216100000_competitor_tables.sql"
    - "src/lib/supabase/service.ts"
  modified: []

key-decisions:
  - "BIGINT for all metric counters (follower_count, heart_count, views, etc.) to handle viral-scale numbers"
  - "Shared competitor_profiles with user_competitors junction table for deduplication across users"
  - "TEXT+CHECK for scrape_status (not ENUM) matching existing project convention"
  - "Service role client as factory function for webhook/cron contexts"

patterns-established:
  - "Junction table RLS: gate access through user_competitors subquery with (SELECT auth.uid())"
  - "Service role client pattern: createServiceClient() for server-only operations"
  - "Daily snapshot dedup: UNIQUE(competitor_id, snapshot_date) for one-per-day time-series"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 1 Plan 1: Competitor Schema Summary

**Four-table competitor intelligence schema with junction-table deduplication, BIGINT metrics, RLS gated through user_competitors, and service role client for scraping ingestion**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T16:38:46Z
- **Completed:** 2026-02-16T16:40:22Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created 4 database tables: competitor_profiles (shared), user_competitors (junction), competitor_snapshots (daily time-series), competitor_videos (per-video metrics)
- 7 RLS policies all using `(SELECT auth.uid())` pattern, gating competitor data access through the junction table
- 7 performance indexes including scrape_status for cron batch queries and posted_at DESC for recent video sorting
- Service role client factory for webhook handlers and cron routes that bypass RLS

## Task Commits

Each task was committed atomically:

1. **Task 1: Create competitor tables migration with RLS and indexes** - `8e68dd2` (feat)
2. **Task 2: Create service role client and regenerate database types** - `2bad7cb` (feat)

## Files Created/Modified
- `supabase/migrations/20260216100000_competitor_tables.sql` - Full competitor intelligence schema: 4 tables, 7 indexes, 7 RLS policies, 1 helper function, 2 triggers
- `src/lib/supabase/service.ts` - Service role Supabase client factory for server-side RLS bypass

## Decisions Made
- **BIGINT for metrics:** All counter columns (follower_count, heart_count, views, likes, etc.) use BIGINT instead of INTEGER since viral TikTok creators can exceed MAX_INT (2.1 billion)
- **Junction table deduplication:** Multiple users can track the same competitor profile, with user_competitors linking them. Avoids duplicate scraping.
- **TEXT+CHECK for status:** scrape_status uses TEXT with CHECK constraint, matching existing project convention (not ENUM)
- **Factory function pattern:** createServiceClient() creates a fresh client per call rather than a singleton, matching the existing server.ts pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database type regeneration (`supabase gen types typescript --local`) failed because Docker is not running. Types will need regeneration after `supabase start` and `supabase db push`. The existing `database.types.ts` remains unchanged and will be updated when local Supabase is available.

## User Setup Required

**Environment variable needed for service role client:**
- `SUPABASE_SERVICE_ROLE_KEY` must be set in `.env.local` (available from Supabase dashboard > Settings > API)

**Type regeneration after Docker available:**
```bash
npx supabase start
npx supabase db push
npx supabase gen types typescript --local > src/types/database.types.ts
```

## Next Phase Readiness
- Schema ready for Plan 02 (Apify scraping integration) to write scraped data
- Service role client ready for webhook handlers to ingest scraped data
- Type regeneration blocking: new table types not yet available in TypeScript (requires Docker/local Supabase)
- All RLS policies in place -- authenticated users can only see competitors they track

## Self-Check: PASSED

- FOUND: supabase/migrations/20260216100000_competitor_tables.sql
- FOUND: src/lib/supabase/service.ts
- FOUND: .planning/phases/01-data-foundation/01-01-SUMMARY.md
- FOUND: commit 8e68dd2 (Task 1)
- FOUND: commit 2bad7cb (Task 2)

---
*Phase: 01-data-foundation*
*Completed: 2026-02-16*
