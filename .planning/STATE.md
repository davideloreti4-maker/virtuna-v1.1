# Project State -- Virtuna Competitors Tool

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered competitor intelligence that shows TikTok creators exactly what their competitors do, why it works, and how to outperform them.
**Current focus:** Phase 1 -- Data Foundation

## Current Position

Phase: 1 of 7 (Data Foundation)
Plan: 1 of 2 in current phase
Status: Executing
Last activity: 2026-02-16 -- Completed 01-01 (Competitor Schema)

Progress: [█░░░░░░░░░] 8%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 2 min
- Total execution time: 0.03 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 1 | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: --
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

### Pending Todos

None yet.

### Blockers/Concerns

- Backend-foundation merge timing: if not merged, apify-client and @tanstack/react-query need manual addition
- Apify actor input/output schemas need runtime verification (Clockworks actors may change fields)
- Vercel plan confirmation: cron strategy assumes Pro plan for sub-daily cron

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 01-01-PLAN.md (Competitor Schema)
Resume file: None
Next: Execute 01-02-PLAN.md (Apify scraping integration)

---
*State created: 2026-02-16*
*Last updated: 2026-02-16 -- Completed 01-01 Competitor Schema*
