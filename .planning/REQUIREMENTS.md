# Requirements: Backend Foundation

**Defined:** 2026-02-13
**Core Value:** AI-powered content intelligence that tells creators whether their content will resonate — and exactly why — before they post.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Database Foundation

- [ ] **DB-01**: Supabase migration creates `scraped_videos` table (id, platform, video_url, author, description, views, likes, shares, comments, sound_name, sound_url, hashtags, category, scraped_at, metadata JSONB)
- [ ] **DB-02**: Supabase migration creates `trending_sounds` table (id, sound_name, sound_url, video_count, total_views, growth_rate, first_seen, last_seen, metadata JSONB)
- [ ] **DB-03**: Supabase migration creates `analysis_results` table (id, user_id, content_text, content_type, society_id, overall_score, confidence, factors JSONB, suggestions JSONB, personas JSONB, variants JSONB, insights, conversation_themes JSONB, gemini_model, deepseek_model, engine_version, latency_ms, cost_cents, rule_score, trend_score, ml_score, score_weights JSONB, created_at)
- [ ] **DB-04**: Supabase migration creates `outcomes` table (id, analysis_id, user_id, actual_views, actual_likes, actual_shares, actual_engagement_rate, predicted_score, actual_score, delta, reported_at, platform, platform_post_url)
- [ ] **DB-05**: Supabase migration creates `rule_library` table (id, name, description, category, weight, max_score, evaluation_prompt, accuracy_rate, sample_count, is_active, created_at, updated_at)
- [ ] **DB-06**: RLS policies: public read for scraped_videos and trending_sounds; user-scoped for analysis_results and outcomes; public read active rules for rule_library
- [ ] **DB-07**: All RLS policies use `(SELECT auth.uid())` pattern for performance
- [ ] **DB-08**: Database types regenerated via `supabase gen types typescript` after migration
- [ ] **DB-09**: Supabase service client extracted to `src/lib/supabase/service.ts` (shared by cron routes and webhooks)
- [ ] **DB-10**: Rule library seeded with initial expert rules (minimum 15 rules across hook, audio, text, timing, creator categories)

### Content Intelligence Engine

- [ ] **ENGINE-01**: Gemini Flash-Lite client wrapper at `src/lib/engine/gemini.ts` using `@google/genai` with `gemini-2.5-flash-lite` model
- [ ] **ENGINE-02**: DeepSeek R1 client wrapper at `src/lib/engine/deepseek.ts` using `openai` package with OpenAI-compatible API
- [ ] **ENGINE-03**: Pipeline orchestrator at `src/lib/engine/pipeline.ts` that runs input normalization → parallel signal extraction (Gemini + DB lookups) → DeepSeek reasoning → score aggregation
- [ ] **ENGINE-04**: Expert rule engine at `src/lib/engine/rules.ts` that loads active rules from `rule_library` and scores content against them
- [ ] **ENGINE-05**: Trend data enrichment at `src/lib/engine/trends.ts` that cross-references content against trending sounds/hashtags/topics
- [ ] **ENGINE-06**: Score aggregator at `src/lib/engine/aggregator.ts` with weighted combination (rule_score * 0.5 + trend_score * 0.3 + ml_score * 0.2, with ml_score defaulting to rule_score until ML is active)
- [ ] **ENGINE-07**: All LLM outputs validated through Zod schemas with `.safeParse()` — never raw `JSON.parse()`
- [ ] **ENGINE-08**: Gemini uses `responseMimeType: 'application/json'` and `responseSchema` for structured output
- [ ] **ENGINE-09**: DeepSeek uses `response_format: { type: "json_object" }` for structured output
- [ ] **ENGINE-10**: Retry logic: strip markdown fences, re-prompt on parse failure, max 2 retries (3 total attempts)
- [ ] **ENGINE-11**: Engine returns `PredictionResult` type with: overall_score (0-100), confidence (HIGH/MEDIUM/LOW), factors (5 scored factors with explanations), suggestions (3-5 actionable items), persona_reactions (5 society personas with quotes), variants (2-3 AI-rewritten alternatives with predicted scores), conversation_themes, latency_ms, cost_cents
- [ ] **ENGINE-12**: Shared engine types at `src/lib/engine/types.ts` — PredictionResult, AnalysisInput, Factor, Suggestion, PersonaReaction, Variant
- [ ] **ENGINE-13**: Model IDs stored as environment variables (GEMINI_MODEL, DEEPSEEK_MODEL) — not hardcoded
- [ ] **ENGINE-14**: Circuit breaker: if 3 consecutive DeepSeek calls fail, fall back to Gemini-only scoring for 10 minutes
- [ ] **ENGINE-15**: Image/thumbnail analysis via Gemini Flash vision API when user uploads images

### Trending Data Pipeline

- [ ] **TREND-01**: Apify scraper cron route at `/api/cron/scrape-trending` (fires every 6 hours) that triggers TikTok scraper actor via `apify-client`
- [ ] **TREND-02**: Apify webhook handler at `/api/webhooks/apify` that receives completed scrape results and upserts to `scraped_videos` table
- [ ] **TREND-03**: Trend calculator cron at `/api/cron/calculate-trends` (hourly) that aggregates trending sounds, hashtags, and topics from scraped data
- [ ] **TREND-04**: Rule validator cron at `/api/cron/validate-rules` (daily) that checks rule accuracy against outcome data and adjusts weights
- [ ] **TREND-05**: All cron routes verify `CRON_SECRET` Bearer token via shared auth utility at `src/lib/cron-auth.ts`
- [ ] **TREND-06**: `vercel.json` configured with all cron schedules (scrape-trending 6h, calculate-trends 1h, validate-rules daily, retrain-ml weekly)
- [ ] **TREND-07**: Apify webhook verifies secret token to prevent spoofed requests
- [ ] **TREND-08**: Scraper tracks `last_successful_scrape_at` — stale data (>24h) logged as warning

### API Routes

- [ ] **API-01**: POST `/api/analyze` — accepts content + type + society, runs prediction engine, streams progress via SSE, returns PredictionResult
- [ ] **API-02**: GET `/api/trending` — paginated trending videos with cursor-based pagination and category filter
- [ ] **API-03**: GET `/api/trending/stats` — aggregate stats per category (video count, avg views, top sounds)
- [ ] **API-04**: GET `/api/trending/[videoId]` — single video detail
- [ ] **API-05**: GET `/api/deals` — filtered deal listings from database
- [ ] **API-06**: GET `/api/deals/[id]` — single deal detail
- [ ] **API-07**: POST `/api/deals/[id]/apply` — apply to a deal (authenticated)
- [ ] **API-08**: GET `/api/deals/enrollments` — user's deal enrollments (authenticated)
- [ ] **API-09**: POST `/api/outcomes` — submit outcome report (authenticated), GET `/api/outcomes` — user's outcome history
- [ ] **API-10**: Analysis API route sets `maxDuration: 120` for Vercel Pro plan
- [ ] **API-11**: All API keys (Gemini, DeepSeek, Apify) are server-side only — NO `NEXT_PUBLIC_` prefix
- [ ] **API-12**: Cursor-based pagination (base64url-encoded `created_at|id`) for all list endpoints

### Client Integration

- [ ] **QUERY-01**: TanStack React Query v5 installed and configured with `QueryClientProvider` in `src/app/(app)/providers.tsx`
- [ ] **QUERY-02**: Query key factory at `src/lib/queries/query-keys.ts` with namespaced keys for trending, deals, analysis
- [ ] **QUERY-03**: `useTrendingVideos(category)` infinite query hook replacing mock data on trending page
- [ ] **QUERY-04**: `useTrendingStats()` query hook for category stats
- [ ] **QUERY-05**: `useDeals(filters)` query hook replacing mock data on brand deals page
- [ ] **QUERY-06**: `useAnalysisHistory()` query hook replacing localStorage test history
- [ ] **QUERY-07**: `useAnalyze()` mutation hook that submits to `/api/analyze` and handles SSE streaming
- [ ] **QUERY-08**: `useOutcome()` mutation hook for submitting outcome reports
- [ ] **QUERY-09**: Zustand stores unchanged for client-only state (bookmarks, sidebar, society, settings)
- [ ] **QUERY-10**: Query cache invalidation on mutations (analysis history after new analysis, outcomes after report)

### Intelligence UX

- [ ] **UX-01**: Simulation theater receives real SSE progress events from analysis API and maps them to animation phases (analyzing → matching → simulating → generating)
- [ ] **UX-02**: Minimum 4.5s theater duration — extends if backend is slower, but never shows results before 4.5s
- [ ] **UX-03**: Phase-specific messaging during simulation ("Analyzing visual composition...", "Simulating Gen-Z reactions...", etc.)
- [ ] **UX-04**: Results card displays real prediction data: overall score with confidence indicator, factor breakdown (5 factors with scores + explanations), persona reactions (5 personas with quotes), actionable suggestions (3-5 specific items), content variants (2-3 with predicted scores)
- [ ] **UX-05**: Factor breakdown color-coded: green (strong, >70), yellow (neutral, 40-70), red (weak, <40)
- [ ] **UX-06**: Smooth crossfade transition from skeleton to real results
- [ ] **UX-07**: Analysis history persisted to Supabase (replaces localStorage) — accessible across devices
- [ ] **UX-08**: Analyze button on all pages routes to Content Intelligence tool with proper state

### Outcome Tracking

- [ ] **TRACK-01**: Outcome submission form: actual views, likes, shares, platform, optional post URL
- [ ] **TRACK-02**: Predicted vs actual comparison displayed per analysis result
- [ ] **TRACK-03**: Delta calculation (actual_score - predicted_score) stored and displayed
- [ ] **TRACK-04**: Outcomes feed into rule validator cron for accuracy tracking

### ML Scaffolding

- [ ] **ML-01**: ML retrainer cron route at `/api/cron/retrain-ml` (weekly) — stub implementation that logs "Not enough data" until 1000+ outcomes exist
- [ ] **ML-02**: `score_weights` JSONB field in analysis_results supports future adaptive weights
- [ ] **ML-03**: `ml_score` field in analysis_results defaults to `rule_score` until ML model is active

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Intelligence

- **INTEL-01**: "Help Me Craft" AI assistant — rewrites content before analysis via LLM
- **INTEL-02**: Batch analysis — analyze multiple content pieces at once
- **INTEL-03**: Share results with OG image generation for social sharing
- **INTEL-04**: Progressive accuracy display — show prediction accuracy improving over time

### Advanced ML

- **ADVML-01**: Real ML model training activated after 1000+ outcomes
- **ADVML-02**: Per-platform accuracy tracking and model specialization
- **ADVML-03**: Confidence calibration ("When we say HIGH, we're right X% of the time")

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time social API connections (posting) | Hootsuite/Sprout Social territory — massive OAuth/compliance burden |
| Full SEO keyword research | VidIQ/TubeBuddy own this space with years of data |
| Multi-user collaboration / teams | Auth complexity before product validation |
| Custom ML model per user | Too sparse — global model needs 1000+ outcomes first |
| Automated A/B testing with real audiences | Requires platform integrations and ad spend management |
| Scheduling / content calendar | Feature creep into Later.com/Buffer territory |
| Chat-based AI interface | Wrong UX — structured input/output is better for content intelligence |
| Social listening / brand monitoring | Different product category (Sprout Social, Meltwater) |
| Light mode | Dark-mode first, deferred |
| Admin dashboard for deals | Seed via SQL/migration — admin UI is a future milestone |
| TikTok OAuth account connection | Fragile, rate-limited, ToS risk — use Apify scraping instead |
| Real-time WebSocket notifications | Overkill for async analysis and 6h scrape cycles |
| Gamification (streaks, badges) | Distracts from core value proposition |

## Traceability

(Populated during roadmap creation)

| Requirement | Phase | Status |
|-------------|-------|--------|
| — | — | — |

**Coverage:**
- v1 requirements: 68 total
- Mapped to phases: 0
- Unmapped: 68

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after initial definition*
