# Project State -- Virtuna Competitors Tool

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered competitor intelligence that shows TikTok creators exactly what their competitors do, why it works, and how to outperform them.
**Current focus:** Phase 4 complete -- Detail Page & Analytics done

## Current Position

Phase: 4 of 7 (Detail Page & Analytics) -- COMPLETE
Plan: 2 of 2 in current phase (04-02 complete)
Status: Phase 4 complete, ready for Phase 5
Last activity: 2026-02-16 -- Completed 04-02 (Content Analysis Sections)

Progress: [██████░░░░] 57%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 4 min
- Total execution time: 0.47 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 2 | 10 min | 5 min |
| 02-competitor-management | 2 | 6 min | 3 min |
| 03-competitor-dashboard | 2 | 6 min | 3 min |
| 04-detail-page-analytics | 2 | 6 min | 3 min |

**Recent Trend:**
- Last 5 plans: 03-01 (3 min), 03-02 (3 min), 04-01 (4 min), 04-02 (2 min)
- Trend: stable (fast)

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
- View toggle uses Radix Tabs controlled by Zustand store (value+onValueChange pattern)
- loading.tsx renders card grid skeleton as default first-load view
- Sidebar Competitors uses pathname.startsWith for active detection to support future sub-routes
- Server-side analytics computation: all chart data pre-computed in server component to minimize client bundle
- User authorization via junction table check on detail page (prevents accessing competitors not in user's list)
- VideoMetrics interface extracted as shared named export in competitors-utils.ts
- Chart wrapper pattern: "use client" components receive pre-computed props from server component
- VideoCard as server component (no "use client") since it has no interactivity
- Heatmap uses pure CSS grid with oklch opacity scaling (not Recharts) for lighter client bundle
- Hashtag list uses proportional bar indicators for visual frequency comparison

### Pending Todos

None yet.

### Blockers/Concerns

- Backend-foundation merge timing: apify-client now installed manually; @tanstack/react-query still needs manual addition if not merged
- Apify actor input/output schemas need runtime verification (Clockworks actors may change fields)
- Vercel plan confirmation: cron strategy assumes Pro plan for sub-daily cron

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 04-02-PLAN.md (Content Analysis Sections)
Resume file: None
Next: Phase 5 planning (Comparison View)

---
*State created: 2026-02-16*
*Last updated: 2026-02-16 -- 04-02 execution complete (video cards, content analysis, heatmap, duration chart, 2 tasks, 6 files)*
