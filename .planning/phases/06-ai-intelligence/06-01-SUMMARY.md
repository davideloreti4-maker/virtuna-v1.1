---
phase: 06-ai-intelligence
plan: 01
subsystem: ai, api
tags: [deepseek, gemini, openai, zod, supabase, caching, llm]

# Dependency graph
requires:
  - phase: 04-detail-page-analytics
    provides: "competitor detail page server component pattern, competitors-utils.ts computation functions"
  - phase: 02-competitor-management
    provides: "competitor_profiles/videos/snapshots tables, junction table, service client pattern"
provides:
  - "competitor_intelligence database table with RLS for caching AI responses"
  - "4 Zod schemas for strategy, viral, hashtag_gap, recommendations analysis types"
  - "4 prompt builder functions for DeepSeek and Gemini"
  - "DeepSeek client (strategy + recommendations) with JSON mode and Zod validation"
  - "Gemini client (viral + hashtag gap) with JSON response MIME type and Zod validation"
  - "Intelligence service orchestrator with database caching and staleness detection"
  - "API route GET (cached retrieval) + POST (trigger analysis) with auth"
affects: [06-02-intelligence-ui, detail-page]

# Tech tracking
tech-stack:
  added: [openai, "@google/genai"]
  patterns: [lazy-singleton-ai-client, database-cached-ai-responses, strip-fences-json-parse, dual-model-strategy]

key-files:
  created:
    - supabase/migrations/20260217000000_competitor_intelligence.sql
    - src/lib/ai/types.ts
    - src/lib/ai/prompts.ts
    - src/lib/ai/deepseek.ts
    - src/lib/ai/gemini.ts
    - src/lib/ai/intelligence-service.ts
    - src/app/api/intelligence/[competitorId]/route.ts
  modified:
    - src/types/database.types.ts
    - package.json

key-decisions:
  - "Delete+insert instead of upsert for COALESCE unique constraint (Supabase JS doesn't support COALESCE in onConflict)"
  - "DeepSeek for strategy+recommendations (depth), Gemini flash-lite for viral+hashtag gap (speed)"
  - "7-day TTL + scrape-date staleness check for cache invalidation"
  - "Service client for writes (bypasses RLS), user client for reads"
  - "1 retry on DeepSeek parse failure with stricter JSON instruction"

patterns-established:
  - "Lazy-singleton AI client: initialize on first call, reuse across requests"
  - "Strip fences + Zod safeParse: clean markdown/think wrappers then validate"
  - "Database-cached AI: check cache -> stale check -> AI call -> upsert -> return"
  - "Computation before AI: use pure functions for detection/frequency, AI for insight/explanation"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 6 Plan 1: AI Intelligence Service Layer Summary

**DeepSeek + Gemini AI service layer with Zod-validated structured output, database caching, and REST API for 4 competitor analysis types**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-17T08:29:40Z
- **Completed:** 2026-02-17T08:34:20Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Complete AI service layer compiling with zero type errors across 7 new files
- 4 analysis types end-to-end: prompt builder -> AI client call -> Zod validation -> database cache -> API retrieval
- Database caching with staleness detection prevents redundant AI calls (7-day TTL + scrape-date comparison)
- API route with proper auth (junction table check) handles both GET (cached) and POST (trigger) flows
- All AI code confined to `src/lib/ai/` and `src/app/api/intelligence/` (no client bundle leaks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration, types, Zod schemas, and prompt templates** - `f7593ee` (feat)
2. **Task 2: AI client modules, intelligence service, and API route** - `e09efa3` (feat)

## Files Created/Modified
- `supabase/migrations/20260217000000_competitor_intelligence.sql` - Cache table with RLS, unique constraint, index
- `src/types/database.types.ts` - Added competitor_intelligence Row/Insert/Update/Relationships
- `src/lib/ai/types.ts` - 4 Zod schemas (Strategy, Viral, HashtagGap, Recommendations) + input types
- `src/lib/ai/prompts.ts` - 4 prompt builders with pre-aggregated data, JSON format instructions
- `src/lib/ai/deepseek.ts` - DeepSeek client with JSON mode, strip fences, retry, Zod validation
- `src/lib/ai/gemini.ts` - Gemini client with JSON response MIME type, Zod validation
- `src/lib/ai/intelligence-service.ts` - Orchestrator with cache check, staleness logic, upsert
- `src/app/api/intelligence/[competitorId]/route.ts` - GET/POST API route with auth + CompetitorContext building
- `package.json` - Added openai and @google/genai dependencies

## Decisions Made
- **Delete+insert over upsert:** Supabase JS client doesn't support COALESCE expressions in `onConflict`. Used delete matching row then insert as a safe alternative.
- **Dual-model strategy:** DeepSeek-chat for strategy analysis and recommendations (needs depth), Gemini flash-lite for viral explanation and hashtag gap (needs speed, shorter output).
- **Staleness = TTL OR new data:** Cache is stale if > 7 days old OR if competitor was scraped after the analysis was generated (new data invalidates old insights).
- **Service client for writes:** AI cache writes bypass RLS via service client (same pattern as scraping writes), reads go through user client respecting RLS.
- **Computation before AI:** Viral detection (3x average threshold) and hashtag frequency are pure computation. AI only generates the "why" and recommendations.

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.**

Environment variables needed:
- `DEEPSEEK_API_KEY` - Get from https://platform.deepseek.com/api_keys
- `GEMINI_API_KEY` - Get from https://aistudio.google.com/apikey

Add to `.env.local` and Vercel project settings.

## Next Phase Readiness
- AI service layer complete and ready for UI consumption in 06-02
- `getAllIntelligence()` returns cached insights map for detail page server component
- Individual analysis functions available for on-demand triggering via API route
- Migration file ready for Supabase deployment

## Self-Check: PASSED

All 8 created files verified present. Both task commits (f7593ee, e09efa3) confirmed in git log. TypeScript compiles with zero errors. No AI library leaks to client bundle.

---
*Phase: 06-ai-intelligence*
*Completed: 2026-02-17*
