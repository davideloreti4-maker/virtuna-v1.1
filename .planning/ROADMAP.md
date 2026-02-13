# Roadmap: Backend Foundation

## Overview

Build the complete backend infrastructure for Virtuna's content intelligence platform: database schema, dual-model AI prediction engine, real-time trending data pipeline, API routes replacing all mock data, TanStack Query client integration, and the simulation theater UX wired to real prediction results. This transforms Virtuna from a frontend prototype into a functional AI-powered product.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Database Foundation** - Schema, migrations, RLS, types, service client, and rule library seed
- [ ] **Phase 2: Content Intelligence Engine** - Gemini + DeepSeek client wrappers, pipeline orchestrator, rule engine, trend enrichment, score aggregation
- [ ] **Phase 3: Trending Data Pipeline** - Apify scraper cron, webhook handler, trend calculator, rule validator, cron infrastructure
- [ ] **Phase 4: API Routes** - All REST endpoints for analyze, trending, deals, outcomes with SSE streaming and cursor pagination
- [ ] **Phase 5: Client Integration** - TanStack Query setup, query hooks for all pages, mutation hooks, cache invalidation
- [ ] **Phase 6: Intelligence UX** - Simulation theater with real SSE events, results card with real data, analysis history migration, outcome tracking UI
- [ ] **Phase 7: ML Scaffolding and Hardening** - ML retrain stub, adaptive weight fields, circuit breaker, vercel.json cron config, environment guardrails

## Phase Details

### Phase 1: Database Foundation
**Goal**: All persistent data structures exist with type-safe access and security policies, enabling every subsequent phase to read/write data immediately
**Depends on**: Nothing (first phase)
**File Ownership**: `supabase/migrations/`, `src/types/database.types.ts`, `src/lib/supabase/service.ts`
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09, DB-10
**Success Criteria** (what must be TRUE):
  1. Running `supabase db push` succeeds and all 5 tables (scraped_videos, trending_sounds, analysis_results, outcomes, rule_library) exist in the database
  2. `supabase gen types typescript` produces a `database.types.ts` that compiles with zero TypeScript errors
  3. RLS policies enforce: anonymous users can SELECT scraped_videos, trending_sounds, and active rules; authenticated users can only SELECT/INSERT their own analysis_results and outcomes; service role can write to all tables
  4. `createServiceClient()` at `src/lib/supabase/service.ts` successfully connects using service role key (verified by inserting and reading a test row)
  5. Rule library contains at least 15 seeded rules across hook, audio, text, timing, and creator categories
**Plans**: 2 plans

Plans:
- [ ] 01-01: Schema migrations, RLS policies, indexes, and type generation
- [ ] 01-02: Service client extraction, rule library seed data, and RLS verification

### Phase 2: Content Intelligence Engine
**Goal**: The AI prediction pipeline can accept content input and produce a complete PredictionResult with scores, factors, suggestions, persona reactions, and variants
**Depends on**: Phase 1 (needs database types, rule_library table, trending_sounds table)
**File Ownership**: `src/lib/engine/`
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04, ENGINE-05, ENGINE-06, ENGINE-07, ENGINE-08, ENGINE-09, ENGINE-10, ENGINE-11, ENGINE-12, ENGINE-13, ENGINE-14, ENGINE-15
**Success Criteria** (what must be TRUE):
  1. Calling the pipeline orchestrator with sample content returns a valid PredictionResult (overall_score 0-100, confidence, 5 factors, 3-5 suggestions, 5 persona reactions, 2-3 variants) that passes Zod schema validation
  2. Gemini client uses `responseMimeType: 'application/json'` and model ID from environment variable -- never hardcoded
  3. DeepSeek client uses `response_format: { type: "json_object" }` and model ID from environment variable
  4. When an LLM returns malformed JSON (markdown fences, truncated output), retry logic strips fences and re-prompts, succeeding within 3 total attempts
  5. When DeepSeek fails 3 consecutive times, the circuit breaker activates and the pipeline falls back to Gemini-only scoring for 10 minutes
**Plans**: 3 plans

Plans:
- [ ] 02-01: Shared types (PredictionResult, AnalysisInput, Factor, etc.) and Zod validation schemas
- [ ] 02-02: Gemini and DeepSeek client wrappers with structured output, retry logic, and circuit breaker
- [ ] 02-03: Pipeline orchestrator, rule engine, trend enrichment, and score aggregator

### Phase 3: Trending Data Pipeline
**Goal**: Real TikTok trending data flows automatically into the database on a schedule, with trend metrics calculated hourly and rule accuracy validated daily
**Depends on**: Phase 1 (needs scraped_videos, trending_sounds, rule_library, outcomes tables)
**File Ownership**: `src/app/api/cron/`, `src/app/api/webhooks/apify/`, `src/lib/cron-auth.ts`
**Requirements**: TREND-01, TREND-02, TREND-03, TREND-04, TREND-05, TREND-06, TREND-07, TREND-08
**Success Criteria** (what must be TRUE):
  1. Calling `GET /api/cron/scrape-trending` with valid CRON_SECRET triggers an Apify actor run and returns a run ID (verified via curl)
  2. When Apify completes a scrape, `POST /api/webhooks/apify` receives the webhook, fetches the dataset, and upserts videos into scraped_videos (verified by checking row count before/after)
  3. Calling `GET /api/cron/calculate-trends` aggregates scraped_videos into trending_sounds with velocity scores and trend phases
  4. Calling `GET /api/cron/validate-rules` checks rule accuracy against outcome data and updates rule weights
  5. All cron routes reject requests without valid `Bearer CRON_SECRET` (returns 401)
  6. `vercel.json` contains cron schedules for all 4 background jobs (scrape 6h, trends 1h, validate daily, retrain weekly)
**Plans**: 2 plans

Plans:
- [ ] 03-01: Cron auth utility, Apify scraper cron route, and Apify webhook handler
- [ ] 03-02: Trend calculator cron, rule validator cron, vercel.json cron config, and stale data monitoring

### Phase 4: API Routes
**Goal**: All pages have real API endpoints serving database-backed data with authentication, pagination, and proper error handling
**Depends on**: Phase 1 (needs all tables), Phase 2 (needs engine pipeline for /api/analyze)
**File Ownership**: `src/app/api/analyze/`, `src/app/api/trending/`, `src/app/api/deals/`, `src/app/api/outcomes/`
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, API-09, API-10, API-11, API-12
**Success Criteria** (what must be TRUE):
  1. `POST /api/analyze` with content + type + society returns an SSE stream with phase events (analyzing, matching, simulating, generating, complete) and a valid PredictionResult on completion
  2. `GET /api/trending?category=trending-now&limit=12` returns paginated videos with a cursor for the next page; following the cursor returns the next page with no duplicates
  3. `GET /api/trending/stats` returns aggregate stats per category (video count, avg views, top sounds)
  4. `GET /api/deals` returns filtered deal listings; `POST /api/deals/:id/apply` creates an enrollment for the authenticated user
  5. `POST /api/outcomes` saves an outcome report; `GET /api/outcomes` returns the authenticated user's outcome history
  6. All API keys (Gemini, DeepSeek, Apify) are accessed via `process.env` without `NEXT_PUBLIC_` prefix -- verified by grep
**Plans**: 3 plans

Plans:
- [ ] 04-01: Analysis API route with SSE streaming, maxDuration config, and engine integration
- [ ] 04-02: Trending API routes (list with cursor pagination, stats, video detail)
- [ ] 04-03: Deals API routes (list, detail, apply, enrollments) and Outcomes API routes

### Phase 5: Client Integration
**Goal**: All pages fetch data from real API endpoints via TanStack Query, replacing every mock data import with live server state
**Depends on**: Phase 4 (needs all API routes serving data)
**File Ownership**: `src/lib/queries/`, `src/hooks/queries/`, `src/app/(app)/providers.tsx`
**Requirements**: QUERY-01, QUERY-02, QUERY-03, QUERY-04, QUERY-05, QUERY-06, QUERY-07, QUERY-08, QUERY-09, QUERY-10
**Success Criteria** (what must be TRUE):
  1. `QueryClientProvider` wraps the app layout and React Query DevTools are visible in development
  2. Trending page loads real videos from the API via `useTrendingVideos(category)` infinite query -- infinite scroll loads more pages via cursor pagination
  3. Brand deals page loads real deals from the API via `useDeals(filters)` -- no imports from mock data files remain
  4. `useAnalyze()` mutation submits to `/api/analyze`, handles SSE streaming, and the analysis result appears in `useAnalysisHistory()` after completion (cache invalidation works)
  5. `useOutcome()` mutation submits outcome reports and invalidates the outcomes query cache
  6. Zustand stores (bookmarks, sidebar, society, settings) remain unchanged and functional alongside TanStack Query
**Plans**: 2 plans

Plans:
- [ ] 05-01: TanStack Query setup (provider, query client, key factory) and trending + deals query hooks
- [ ] 05-02: Analysis mutation hook with SSE, outcome mutation hook, analysis history hook, and cache invalidation

### Phase 05.1: Wire TanStack Query hooks into page components and fix integration gaps (INSERTED)

**Goal:** Wire existing TanStack Query hooks into page components, replacing mock data imports and Zustand server-state duplication with real API data. Create type mapper functions for DB-to-UI shape conversion. Fix useAnalysisHistory bug (wrong endpoint).
**Depends on:** Phase 5
**File Ownership:** `src/lib/mappers/`, `src/app/(app)/trending/`, `src/components/trending/video-grid.tsx`, `src/components/app/brand-deals/`, `src/app/(app)/dashboard/dashboard-client.tsx`, `src/stores/test-store.ts`, `src/components/app/simulation/loading-phases.tsx`, `src/components/app/test-history-list.tsx`
**Requirements:** QUERY-03, QUERY-05, QUERY-06, QUERY-07, QUERY-08, QUERY-09, QUERY-10, UX-01, UX-04
**Plans:** 4 plans

Plans:
- [x] 05.1-01-PLAN.md -- Type mappers (trending + deals) and /api/analysis/history route + useAnalysisHistory bug fix
- [x] 05.1-02-PLAN.md -- Wire trending page to useTrendingVideos and useTrendingStats
- [x] 05.1-03-PLAN.md -- Wire deals tab to useDeals, deal apply modal to useApplyToDeal, applied state to useDealEnrollments
- [x] 05.1-04-PLAN.md -- Wire dashboard to useAnalyze mutation, thin test-store, prop-driven LoadingPhases, history from API

### Phase 6: Intelligence UX
**Goal**: Users experience the full content intelligence flow -- submit content, watch the simulation theater with real progress events, and receive results with real AI-generated scores, factors, persona reactions, suggestions, and variants
**Depends on**: Phase 5 (needs TanStack Query hooks wired to API)
**File Ownership**: `src/components/app/simulation/`, `src/components/viral-results/`, `src/stores/test-store.ts`, `src/app/(app)/`
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, TRACK-01, TRACK-02, TRACK-03, TRACK-04
**Success Criteria** (what must be TRUE):
  1. Submitting content from ContentForm triggers the simulation theater which receives real SSE progress events and maps them to animation phases (analyzing, matching, simulating, generating) with phase-specific messaging
  2. The simulation theater enforces a minimum 4.5s duration -- if the backend responds faster, the theater still completes its animation before revealing results
  3. Results card displays real prediction data: overall score with confidence indicator, 5 color-coded factors (green >70, yellow 40-70, red <40), 5 persona reactions with quotes, 3-5 suggestions, and 2-3 content variants with predicted scores
  4. Smooth crossfade transition from skeleton loading state to real results (no hard content swap)
  5. Analysis history is persisted to Supabase and accessible across devices (no longer in localStorage)
  6. Outcome submission form allows reporting actual views, likes, shares, platform, and optional post URL; predicted vs actual comparison displays per analysis result with delta
**Plans**: 3 plans

Plans:
- [ ] 06-01: Simulation theater wired to real SSE events with phase mapping, minimum duration, and phase-specific messaging
- [ ] 06-02: Results card displaying real prediction data (score, factors, personas, suggestions, variants) with color coding and crossfade
- [ ] 06-03: Analysis history Supabase migration, outcome tracking form, predicted vs actual comparison, and analyze button routing

### Phase 7: ML Scaffolding and Hardening
**Goal**: The ML training pipeline is scaffolded for future activation, all cron schedules are deployed, and production environment is hardened with proper guardrails
**Depends on**: Phase 3 (needs cron infrastructure), Phase 4 (needs API routes)
**File Ownership**: `src/app/api/cron/retrain-ml/`, `vercel.json`, `.env.local.example`
**Requirements**: ML-01, ML-02, ML-03, API-10, API-11
**Success Criteria** (what must be TRUE):
  1. `GET /api/cron/retrain-ml` returns "Not enough data" when fewer than 1000 outcomes exist (verified via curl)
  2. `score_weights` JSONB field in analysis_results stores the weight breakdown used for each analysis and `ml_score` defaults to `rule_score` value
  3. No environment variable containing an API key or secret uses the `NEXT_PUBLIC_` prefix (verified by grep across the entire codebase)
  4. Analysis API route has `maxDuration: 120` configured for Vercel Pro plan
**Plans**: 1 plan

Plans:
- [ ] 07-01: ML retrain cron stub, score_weights/ml_score field validation, environment variable audit, and maxDuration configuration

## Execution Waves

Wave groupings for parallel team dispatch. Phases within a wave have no inter-dependencies.

### Wave 1 (no dependencies)
- Phase 1: Database Foundation

### Wave 2 (depends on Wave 1)
- Phase 2: Content Intelligence Engine (needs Phase 1)
- Phase 3: Trending Data Pipeline (needs Phase 1)

### Wave 3 (depends on Wave 2)
- Phase 4: API Routes (needs Phase 1, Phase 2)
- Phase 7: ML Scaffolding and Hardening (needs Phase 3, Phase 4 -- but API-10/API-11 are lightweight checks, can start after Phase 3 completes and run 04-01 in parallel)

### Wave 4 (depends on Wave 3)
- Phase 5: Client Integration (needs Phase 4)

### Wave 5 (depends on Wave 4)
- Phase 6: Intelligence UX (needs Phase 5)

**Parallelization notes:**
- Wave 2 is the key parallel opportunity: Engine and Pipeline are independent domains working against the same database
- Wave 3: Phase 7 is small (1 plan) and can overlap with Phase 4's later plans
- Waves 4-5 are sequential -- client integration must complete before UX wiring

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6 > 7
Wave-parallel execution: 1 > [2, 3] > [4, 7] > 5 > 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Foundation | 2/2 | ✓ Complete | 2026-02-13 |
| 2. Content Intelligence Engine | 3/3 | ✓ Complete | 2026-02-13 |
| 3. Trending Data Pipeline | 2/2 | ✓ Complete | 2026-02-13 |
| 4. API Routes | 3/3 | ✓ Complete | 2026-02-13 |
| 5. Client Integration | 2/2 | ✓ Complete | 2026-02-13 |
| 5.1 Wire TanStack Query Hooks | 4/4 | ✓ Complete | 2026-02-13 |
| 6. Intelligence UX | 3/3 | ✓ Complete | 2026-02-13 |
| 7. ML Scaffolding and Hardening | 1/1 | ✓ Complete | 2026-02-13 |

**Total plans: 20 (16 original + 4 inserted)**
