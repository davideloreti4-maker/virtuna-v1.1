# Project State -- Virtuna Competitors Tool

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered competitor intelligence that shows TikTok creators exactly what their competitors do, why it works, and how to outperform them.
**Current focus:** Phase 8 -- Gap Closure

## Current Position

Phase: 8 of 8 (Gap Closure)
Plan: 1 of 2 in current phase (08-01 complete)
Status: Phase 8 in progress
Last activity: 2026-02-17 -- Completed 08-01 (Code Fixes: self-benchmarking, error handling, skeleton import)

Progress: [████████░░] 94%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 3 min
- Total execution time: 0.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 2 | 10 min | 5 min |
| 02-competitor-management | 2 | 6 min | 3 min |
| 03-competitor-dashboard | 2 | 6 min | 3 min |
| 04-detail-page-analytics | 2 | 6 min | 3 min |
| 05-benchmarking-comparison | 2 | 5 min | 3 min |
| 06-ai-intelligence | 2 | 9 min | 5 min |
| 07-polish-edge-cases | 3 | 6 min | 2 min |
| 08-gap-closure | 1 | 3 min | 3 min |

**Recent Trend:**
- Last 5 plans: 06-02 (4 min), 07-01 (2 min), 07-03 (2 min), 07-02 (2 min), 08-01 (3 min)
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
- ComparisonData type co-located in page.tsx and imported by client (server/client contract)
- Self-benchmarking auto-tracks user handle via addCompetitor if not yet in competitor_profiles
- Bar chart excludes percentage metrics to avoid scale mixing -- only absolute counts
- Growth chart merges time series by date with Map, connectNulls for gaps
- URL searchParams pattern for comparison: selector change -> router.push -> server re-render
- Pre-compute derived metrics in separate useMemo from sort (sort-independent enrichment avoids recomputation)
- SortableHeader inline component pattern with closure over sort state
- Compare link conditionally rendered only with 2+ competitors
- Delete+insert instead of upsert for COALESCE unique constraint (Supabase JS limitation)
- DeepSeek-chat for strategy+recommendations, Gemini flash-lite for viral+hashtag gap
- 7-day TTL + scrape-date staleness check for AI cache invalidation
- Service client for AI cache writes (bypasses RLS), user client for reads
- Computation before AI: pure functions for detection/frequency, AI only for insight generation
- 1 retry on DeepSeek parse failure with stricter JSON instruction
- Server-compatible card components inside client wrapper (no "use client" on cards, serializable props only)
- GenerateCTA inline component pattern for empty state with loading spinner
- Hashtag gap shows self-tracking CTA when user has no videos instead of generate button
- Profile-only retry matching cron behavior (no video re-scrape)
- 48-hour stale threshold for data freshness
- useTransition over useState+async for retry button (non-blocking UI)
- min-w-[640px] for engagement table, min-w-[800px] for leaderboard (column count proportional)
- Scroll gradient hint: absolute overlay with var(--color-background) for theme-safe fade
- text-base sm:text-lg on comparison metric values to prevent mobile overflow
- Server component (StaleIndicator) safe inside client wrappers when props are serializable
- Thread database fields through component interfaces: type -> map -> render
- Console.error for addCompetitor failures in server component (no toast available)
- Re-export CompetitorTableSkeleton from loading.tsx for client-side view transitions
- Implicit verification: foundational phases validated by successful downstream execution

### Pending Todos

None yet.

### Blockers/Concerns

- Backend-foundation merge timing: apify-client now installed manually; @tanstack/react-query still needs manual addition if not merged
- Apify actor input/output schemas need runtime verification (Clockworks actors may change fields)
- Vercel plan confirmation: cron strategy assumes Pro plan for sub-daily cron

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 08-01-PLAN.md (Code Fixes: self-benchmarking, error handling, skeleton import)
Resume file: None
Next: 08-02-PLAN.md (Add/Remove Competitor UI)

---
*State created: 2026-02-16*
*Last updated: 2026-02-17 -- 08-01 execution complete (Code Fixes, 2 tasks, 3 files)*
