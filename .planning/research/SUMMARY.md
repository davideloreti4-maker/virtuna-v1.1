# Research Summary: Virtuna Backend Foundation

**Domain:** Social media content intelligence platform -- backend infrastructure
**Researched:** 2026-02-13
**Overall confidence:** HIGH

## Executive Summary

The Virtuna Backend Foundation milestone adds complete backend infrastructure to an existing frontend-only Next.js 16 application. The core challenge is building a dual-model AI prediction engine (Gemini for visual analysis + DeepSeek R1 for reasoning/scoring), integrating Apify for real trending video data, replacing all mock data with database-backed API endpoints, and establishing background job infrastructure -- all on Vercel's serverless platform with Supabase as the database.

The stack additions are minimal and well-validated: 4 production dependencies (`@google/genai`, `openai`, `apify-client`, `@tanstack/react-query`) and 1 dev dependency (`@tanstack/react-query-devtools`). The key architectural decision is to use Next.js API routes for all backend logic (no Supabase Edge Functions), keeping deployment unified on Vercel. This matches the existing codebase patterns (Whop cron sync, webhooks, checkout routes all use API routes).

The most significant risk is LLM output reliability -- both Gemini and DeepSeek must return structured JSON that parses consistently, and 5-10% failure rate is typical without proper validation. Zod schema validation at every API boundary, structured output modes (Gemini's `responseMimeType`, DeepSeek's `response_format`), and retry logic are non-negotiable. The second critical risk is Gemini 2.0 Flash deprecation on March 31, 2026 -- the pipeline must use `gemini-2.5-flash-lite` from day one.

Cost estimates are favorable: ~$0.006 per analysis (down from the original $0.013 estimate due to Flash-Lite pricing), with Apify scraping at ~$3-4/day for 6-hour intervals. The architecture supports the existing "expert rules first, trends second, ML third" progression strategy, with the ML training pipeline scaffolded as types and cron stubs but no actual model training in this milestone.

## Key Findings

**Stack:** 4 new npm dependencies -- `@google/genai` (Gemini), `openai` (DeepSeek via OpenAI-compatible API), `apify-client` (scraper integration), `@tanstack/react-query` (server state management). No job queue library needed -- Vercel Cron handles all scheduling.

**Architecture:** All backend logic in Next.js API routes on Vercel. SSE streaming for analysis progress. Fire-and-forget + webhook pattern for Apify scraping. TanStack Query for all server state, Zustand stays for client-only UI state. Cursor-based pagination for infinite scroll.

**Critical pitfall:** LLM output parsing failures. Without Zod validation and retry logic, 5-10% of analyses will crash. Also: `gemini-2.0-flash` is deprecated March 31, 2026 -- must use `gemini-2.5-flash-lite` from the start.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Database Foundation** - Schema, migrations, types, admin client extraction
   - Addresses: All tables (scraped_videos, trending_sounds, analysis_results, outcomes, rule_library), RLS policies, type generation
   - Avoids: Type drift pitfall by establishing regeneration workflow early
   - Rationale: Every other feature depends on the database. Must be first.

2. **AI Engine Core** - Gemini + DeepSeek client wrappers, pipeline orchestration, rule engine
   - Addresses: Content analysis API, expert rule engine, Zod validation, structured prompts
   - Avoids: LLM parsing failures by building validation from the start
   - Rationale: Core value prop. Can develop independently from database work (uses types/interfaces, not live DB initially).

3. **Data Pipeline** - Apify integration, cron jobs, trending data flow
   - Addresses: Apify scraper cron, webhook handler, trending data, trend calculator
   - Avoids: Scraper reliability issues by testing actor manually first
   - Rationale: Depends on database schema (phase 1). Populates data for phase 4.

4. **TanStack Query + API Routes** - Server state management, all API endpoints, mock data replacement
   - Addresses: TanStack Query provider, query hooks, trending API, deals API, analysis API route with SSE
   - Avoids: Half-mock/half-real inconsistency by migrating one page at a time
   - Rationale: Depends on database (phase 1) and engine (phase 2). Replaces all mock data.

5. **Client Integration + Polish** - Wire real data to existing UI components, simulation theater
   - Addresses: Simulation theater with real pipeline phases, results card, analysis history, outcome tracking scaffolding
   - Avoids: UI regression by changing data source without changing component interfaces
   - Rationale: Last phase because it depends on all backend infrastructure being in place.

**Phase ordering rationale:**
- Phase 1 (DB) is a hard dependency for all other phases
- Phases 2 (Engine) and 3 (Pipeline) could run in parallel since they're independent backend domains
- Phase 4 (API + Query) ties engine and pipeline to the client
- Phase 5 (Integration) is the final wiring -- changes existing components to use real data

**Research flags for phases:**
- Phase 2: Likely needs deeper research on Gemini 2.5 Flash-Lite structured output capabilities and DeepSeek R1 prompt engineering for consistent JSON
- Phase 3: May need manual testing of the specific Apify TikTok Trends Scraper actor to validate data shape before building transforms
- Phase 4: Standard patterns, unlikely to need additional research
- Phase 5: Standard wiring, unlikely to need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified against npm, official docs, and compatibility confirmed with existing project versions |
| Features | HIGH | Derived from PROJECT.md requirements and validated architecture reference |
| Architecture | HIGH | Patterns verified against existing codebase (cron routes, Supabase client, webhook handlers) and official Vercel/Supabase docs |
| Pitfalls | HIGH for LLM parsing, model deprecation; MEDIUM for DeepSeek availability, Apify reliability | LLM failure modes well-documented. DeepSeek uptime and Apify actor reliability are third-party risks. |
| Cost estimates | LOW | Based on published pricing but actual costs depend on prompt verbosity, response length, retry rates |

## Gaps to Address

- **Apify actor data shape**: The exact output format of `clockworks/tiktok-trends-scraper` needs to be validated by running the actor manually. Transform code depends on this.
- **DeepSeek R1 prompt optimization**: The optimal prompt template for consistent JSON scoring output needs iterative testing. Budget 2-3 iterations during phase 2.
- **Gemini structured output reliability**: `gemini-2.5-flash-lite` supports `responseMimeType: 'application/json'` but accuracy of schema adherence with complex nested objects needs testing.
- **Vercel function cold start latency**: The analysis pipeline budget is 3-5s but cold start adds 1-2s. Need to measure actual end-to-end latency on Pro plan with Fluid Compute.
- **DeepSeek reasoning token budget**: R1 can generate up to 32K reasoning tokens (CoT) before the final answer. Need to set `max_tokens` appropriately to control cost and latency without truncating useful reasoning.
- **Hobby vs Pro plan decision**: Vercel Hobby limits crons to daily-only. The architecture requires hourly (trend calculation) and every-6-hour (scraping) crons. Pro plan is required for this milestone.
