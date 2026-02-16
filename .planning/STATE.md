# Project State -- Virtuna Competitors Tool

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered competitor intelligence that shows TikTok creators exactly what their competitors do, why it works, and how to outperform them.
**Current focus:** Phase 1 -- Data Foundation

## Current Position

Phase: 1 of 7 (Data Foundation)
Plan: 2 of 2 in current phase (PHASE COMPLETE)
Status: Phase 1 Complete
Last activity: 2026-02-16 -- Completed 01-02 (Apify Scraping Integration)

Progress: [██░░░░░░░░] 15%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 5 min
- Total execution time: 0.17 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 2 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (2 min), 01-02 (8 min)
- Trend: --

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

### Pending Todos

None yet.

### Blockers/Concerns

- Backend-foundation merge timing: apify-client now installed manually; @tanstack/react-query still needs manual addition if not merged
- Apify actor input/output schemas need runtime verification (Clockworks actors may change fields)
- Vercel plan confirmation: cron strategy assumes Pro plan for sub-daily cron

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 01-02-PLAN.md (Apify Scraping Integration) -- Phase 1 Complete
Resume file: None
Next: Plan Phase 2 (or execute next phase plans)

---
*State created: 2026-02-16*
*Last updated: 2026-02-16 -- Completed 01-02 Apify Scraping Integration (Phase 1 Complete)*
