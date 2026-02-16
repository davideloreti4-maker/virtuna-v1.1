---
phase: 01-data-foundation
plan: 02
subsystem: scraping
tags: [apify, zod, tiktok, scraping-provider, validation, coercion, handle-normalization]

# Dependency graph
requires:
  - "01-01: competitor_profiles and competitor_videos tables for scraped data storage"
provides:
  - "Zod validation schemas for Apify profile and video scraper output"
  - "ScrapingProvider abstraction interface (scrapeProfile, scrapeVideos)"
  - "ApifyScrapingProvider implementation with strict/graceful validation"
  - "normalizeHandle utility for TikTok handle normalization"
  - "createScrapingProvider factory for provider swapping"
  - "apify-client dependency installed"
affects: [01-03, scraping-ingestion, webhook-handlers, cron-jobs, competitor-api]

# Tech tracking
tech-stack:
  added: [apify-client@^2.22.1]
  patterns: [provider-abstraction, zod-ingestion-boundary, strict-vs-graceful-validation, handle-normalization-transform, lazy-import-factory]

key-files:
  created:
    - "src/lib/schemas/competitor.ts"
    - "src/lib/scraping/types.ts"
    - "src/lib/scraping/apify-provider.ts"
    - "src/lib/scraping/index.ts"
  modified:
    - "package.json"
    - "package-lock.json"

key-decisions:
  - "z.coerce.number() for all Apify numeric fields — Apify actors sometimes return strings for large numbers"
  - "Strict .parse() for profile scraping (single profile must be valid), graceful .safeParse() for video batches (skip invalid items)"
  - "Lazy require() in factory to avoid pulling apify-client into client bundles"
  - "waitSecs (not waitForFinish) for Apify actor calls — matches apify-client v2 API"

patterns-established:
  - "Provider abstraction: ScrapingProvider interface decouples consumers from Apify implementation"
  - "Zod ingestion boundary: all external data validated/coerced before touching domain types"
  - "Handle normalization via Zod transform: URL extraction + @ stripping + lowercase in schema"
  - "Graceful batch validation: safeParse + filter nulls for bulk operations"

# Metrics
duration: 8min
completed: 2026-02-16
---

# Phase 1 Plan 2: Apify Scraping Integration Summary

**Apify scraping service with Zod validation at ingestion boundary, ScrapingProvider abstraction, handle normalization, and strict/graceful validation patterns**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-16T16:49:05Z
- **Completed:** 2026-02-16T16:56:57Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 2

## Accomplishments
- Installed apify-client and created Zod schemas that validate and normalize all Apify scraper output before database operations
- Built ScrapingProvider interface abstracting data acquisition behind scrapeProfile/scrapeVideos contract
- Implemented ApifyScrapingProvider with dual validation strategy: strict .parse() for profiles, graceful .safeParse() for video batches
- Created barrel exports with lazy factory function enabling provider swapping without consumer changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Install apify-client and create Zod validation schemas** - `375b7c2` (feat)
2. **Task 2: Create ScrapingProvider interface and Apify implementation** - `0ca93a0` (feat)

## Files Created/Modified
- `src/lib/schemas/competitor.ts` - Zod schemas for Apify profile/video output with coercion, defaults, and normalizeHandle transform
- `src/lib/scraping/types.ts` - ScrapingProvider interface and domain types (ProfileData, VideoData)
- `src/lib/scraping/apify-provider.ts` - Apify implementation: Clockworks actors, Zod validation, domain mapping
- `src/lib/scraping/index.ts` - Barrel exports and createScrapingProvider factory with lazy import
- `package.json` - Added apify-client@^2.22.1 dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- **z.coerce.number() everywhere:** All numeric fields from Apify use coercion because actors sometimes return strings for large numbers (follower counts in the millions)
- **Dual validation strategy:** Profile scraping uses strict .parse() (single profile must be valid, fail loudly) while video scraping uses .safeParse() (individual invalid videos are skipped, batch continues)
- **Lazy factory import:** createScrapingProvider uses require() to avoid pulling apify-client into client bundles (tree-shaking)
- **waitSecs over waitForFinish:** Used apify-client v2 API parameter name (waitSecs) instead of the plan's waitForFinish

## Deviations from Plan

None - plan executed exactly as written. The waitSecs vs waitForFinish difference was a plan documentation issue (the code already used the correct API).

## Issues Encountered
- Task 1 was already committed by a previous execution session (commit 375b7c2). Verified the existing work matched plan requirements and continued with Task 2.
- TypeScript compilation shows node_modules-level errors from Zod v4 .cts locale files and apify-client node:http imports, but all source files compile cleanly with skipLibCheck: true (project default).

## User Setup Required

**Environment variable needed for Apify scraping:**
- `APIFY_TOKEN` must be set in `.env.local` (available from Apify dashboard > Settings > Integrations)

## Next Phase Readiness
- Zod schemas ready for ingestion pipeline to validate scraped data before database writes
- ScrapingProvider interface ready for webhook handlers and cron routes
- Service role client (from 01-01) + scraping provider (this plan) = complete ingestion path
- APIFY_TOKEN env var required before any scraping calls work at runtime

## Self-Check: PASSED

- FOUND: src/lib/schemas/competitor.ts
- FOUND: src/lib/scraping/types.ts
- FOUND: src/lib/scraping/apify-provider.ts
- FOUND: src/lib/scraping/index.ts
- FOUND: .planning/phases/01-data-foundation/01-02-SUMMARY.md
- FOUND: commit 375b7c2 (Task 1)
- FOUND: commit 0ca93a0 (Task 2)
- FOUND: apifyProfileSchema, apifyVideoSchema, normalizeHandle exports
- FOUND: ScrapingProvider interface, createScrapingProvider factory
- FOUND: apify-client dependency in package.json

---
*Phase: 01-data-foundation*
*Completed: 2026-02-16*
