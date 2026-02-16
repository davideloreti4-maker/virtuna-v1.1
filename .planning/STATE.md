# Project State -- Virtuna Competitors Tool

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered competitor intelligence that shows TikTok creators exactly what their competitors do, why it works, and how to outperform them.
**Current focus:** Phase 3 -- Competitor Dashboard

## Current Position

Phase: 3 of 7 (Competitor Dashboard)
Plan: 1 of 2 in current phase
Status: Executing Phase 3
Last activity: 2026-02-16 -- Completed 03-01 (Card Grid View)

Progress: [████░░░░░░] 36%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 4 min
- Total execution time: 0.32 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 2 | 10 min | 5 min |
| 02-competitor-management | 2 | 6 min | 3 min |
| 03-competitor-dashboard | 1 | 3 min | 3 min |

**Recent Trend:**
- Last 5 plans: 01-02 (8 min), 02-01 (2 min), 02-02 (2 min), 03-01 (3 min)
- Trend: accelerating

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Zero new npm packages -- reuse existing Apify client, Recharts, Zustand, Zod
- Plain PostgreSQL for time-series (TimescaleDB deprecated on Supabase PG17)
- Apify Clockworks actors for TikTok scraping, abstract behind provider interface
- Webhook-driven async scraping pattern from backend-foundation
- RLS must use `(select auth.uid())` pattern for performance
- Vercel cron for scheduled re-scraping
- AI insights via DeepSeek/Gemini (leverages existing prediction engine infrastructure)
- BIGINT for all metric counters (viral creators exceed MAX_INT)
- Junction table deduplication model for shared competitor profiles
- TEXT+CHECK for scrape_status (not ENUM) matching project convention
- Service role client as factory function for webhook/cron contexts
- z.coerce.number() for all Apify numeric fields (actors sometimes return strings for large numbers)
- Strict .parse() for profile scraping, graceful .safeParse() for video batches
- Lazy require() in scraping factory to avoid pulling apify-client into client bundles
- Service client for profile/snapshot/video writes during addCompetitor (RLS requires existing junction row)
- Non-fatal video scraping: profile tracked even if video scrape fails
- Added competitor table types inline to database.types.ts (no gen-types CLI needed pre-migration)
- Reusable verifyCronAuth utility for all cron endpoints (returns null|NextResponse pattern)
- maxDuration 60s default for cron routes (300s on Pro with confirmation)
- No video scraping in daily cron (expensive, deferred to Phase 7)
- CompetitorCardData interface defined in competitor-card.tsx (exported for reuse)
- Snapshot/video data grouped server-side in page.tsx (maps passed as props)
- CompetitorRow type for Supabase nested join response defined locally in competitors-client.tsx

### Pending Todos

None yet.

### Blockers/Concerns

- Backend-foundation merge timing: apify-client now installed manually; @tanstack/react-query still needs manual addition if not merged
- Apify actor input/output schemas need runtime verification (Clockworks actors may change fields)
- Vercel plan confirmation: cron strategy assumes Pro plan for sub-daily cron

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 03-01-PLAN.md (Card Grid View)
Resume file: None
Next: Execute 03-02-PLAN.md (Table View + View Toggle)

---
*State created: 2026-02-16*
*Last updated: 2026-02-16 -- 03-01 execution complete (card grid view, 2 tasks, 7 files)*
