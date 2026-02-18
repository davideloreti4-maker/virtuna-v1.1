# Roadmap: Backend Reliability

## Overview

The prediction engine pipeline is structurally complete but significantly disconnected: 6 cron jobs are orphaned (never scheduled), the ML classifier sits at 31% accuracy and isn't wired into the aggregator, Platt calibration is idle, there is zero test coverage, and no error monitoring exists. This milestone works bottom-up — fix the data pipeline first, then rehabilitate ML (which needs fresh scraped data), wire calibration and observability in parallel, build test coverage, and close all remaining failure-mode fragility.

## Phases

**Phase Numbering:** Integer phases (1–7), milestone-scoped.

- [x] **Phase 1: Schedule Crons & Fix Data Pipeline Wiring** — Schedule all 7 crons in vercel.json and repair the end-to-end scrape → aggregate pipeline *(completed 2026-02-17)*
- [x] **Phase 2: ML Model Rehabilitation** — Fix class imbalance, real feature bridge, stratified training, achieve >75% accuracy and wire ML into the aggregator *(completed 2026-02-18)*
- [x] **Phase 3: Calibration Wiring** — Conditionally apply Platt scaling in the aggregator and verify calibration-audit cron runs cleanly *(completed 2026-02-18)*
- [x] **Phase 4: Observability** — Install Sentry, add structured JSON logging, replace all console.* calls, expose admin cost endpoint *(completed 2026-02-18)*
- [x] **Phase 5: Test Coverage** — Configure Vitest, write unit + integration tests for all engine modules, reach >80% coverage *(completed 2026-02-18)*
- [x] **Phase 6: Hardening** — Wrap edge cases: calibration parsing, LLM double-failure, circuit breaker mutex, creator profile trigger *(completed 2026-02-18)*
- [x] **Phase 7: Observability Completion** — Close OBS-04, complete structured logging migration across engine modules, cron routes, and webhooks *(completed 2026-02-18)*

## Phase Details

### Phase 1: Schedule Crons & Fix Data Pipeline Wiring

**Goal**: The full data pipeline runs on schedule — scraped videos flow from Apify through the webhook into scraped_videos, trigger calculate-trends, and populate trending_sounds.
**Depends on**: Nothing (first phase)
**File Ownership**: `vercel.json`, `src/app/api/` (cron route handlers), `supabase/migrations/` (rule_library column), `.env.example` / env var docs
**Requirements**: CRON-01, CRON-02, CRON-03, CRON-04
**Success Criteria** (what must be TRUE):
  1. `vercel.json` lists all 7 cron schedules and `pnpm build` succeeds with no errors
  2. Apify webhook handler receives a scrape payload and rows appear in `scraped_videos` (verifiable via Supabase table inspector or integration test)
  3. `calculate-trends` cron reads from `scraped_videos` and writes to `trending_sounds` without throwing
  4. `rule_library` table has an `evaluation_tier` column (schema migration applied, semantic rules no longer blocked)
  5. All required env vars are listed in `.env.example` with descriptions (APIFY_TOKEN, APIFY_WEBHOOK_SECRET, APIFY_ACTOR_ID, SCRAPER_HASHTAGS)
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Schedule all 7 crons in vercel.json + verify evaluation_tier migration and regen TypeScript types
- [ ] 01-02-PLAN.md — Trace and verify end-to-end scrape pipeline chain + document all env vars in .env.example

### Phase 2: ML Model Rehabilitation

**Goal**: The ML classifier predicts all 5 tiers with >75% test accuracy and its score flows into every prediction via the aggregator with correct weight distribution.
**Depends on**: Phase 1 (scraped_videos populated by live crons provides real training data)
**File Ownership**: `src/lib/engine/ml.ts`, `src/lib/engine/aggregator.ts`, `src/app/api/crons/retrain-ml/`, `training-data.json` (or replacement generation logic), `src/types/engine.ts`
**Requirements**: ML-01, ML-02, ML-03, ML-04, ML-05, ML-06, ML-07, ML-08
**Success Criteria** (what must be TRUE):
  1. Class distribution diagnostic (tier 1–5 counts, feature correlations) is logged and documented
  2. `trainModel()` logs per-class precision/recall after training and achieves >75% overall test accuracy with all 5 tiers at >50% recall
  3. `featureVectorToMLInput()` uses real signals (no hardcoded 0.5 placeholders remain)
  4. A prediction result's aggregator breakdown shows `ml` at 15% weight alongside behavioral 35%, gemini 25%, rules 15%, trends 10%
  5. `ml_score` appears in every `analysis_results` DB insert row
  6. retrain-ml cron generates fresh training data from `scraped_videos` and skips model replacement when accuracy < 60%
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Add class weighting, stratified split, per-class metrics, real feature bridge, and data-param overload to ml.ts
- [ ] 02-02-PLAN.md — Wire ML signal into 5-signal async aggregator, update types, persist ml_score in DB
- [ ] 02-03-PLAN.md — Rewrite retrain-ml cron with scraped_videos ingestion, percentile tiers, and accuracy gate

### Phase 3: Calibration Wiring

**Goal**: Every prediction result reports whether Platt scaling was applied, and the calibration-audit cron runs cleanly and logs ECE.
**Depends on**: Phase 1 (crons running, data flowing — calibration audit depends on scraped pipeline)
**File Ownership**: `src/lib/engine/aggregator.ts`, `src/lib/engine/calibration.ts`, `src/app/api/cron/calibration-audit/`, `src/app/api/outcomes/`, `src/lib/engine/types.ts`
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04
**Success Criteria** (what must be TRUE):
  1. Aggregator calls `getPlattParameters()` on every prediction and conditionally applies scaling when parameters are available
  2. Every `PredictionResult` includes an `is_calibrated: boolean` field visible in the API response
  3. calibration-audit cron completes without throwing and logs an ECE value to stdout/logger
  4. POST `/api/outcomes` accepts a payload and persists it without error (verified via curl or test)
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Wire Platt scaling into aggregator, add is_calibrated to types + DB + analyze route (CAL-01, CAL-02)
- [ ] 03-02-PLAN.md — Verify calibration-audit cron and outcomes endpoint compile and work (CAL-03, CAL-04)

### Phase 4: Observability

**Goal**: Every pipeline failure is captured in Sentry, every stage emits structured JSON logs with duration and cost, and an admin endpoint exposes daily cost aggregates.
**Depends on**: Phase 1 (pipeline must be wired before we instrument it; can overlap with Phase 2/3)
**File Ownership**: `src/lib/logger.ts` (new), `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`, `src/app/api/admin/costs/route.ts`, all engine modules under `src/lib/engine/`
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06
**Success Criteria** (what must be TRUE):
  1. A thrown exception in any engine stage appears as an issue in the Sentry project dashboard
  2. Pipeline stage logs in production are valid JSON with `requestId`, `stage`, `duration_ms`, and `cost_cents` fields
  3. No `console.log`, `console.error`, or `console.warn` calls remain in any `src/lib/engine/` file
  4. GET `/api/admin/costs` returns a JSON array of `{ date, model, total_cost_cents }` rows grouped by day
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — Install and configure @sentry/nextjs (client, server, edge, instrumentation hook, withSentryConfig)
- [ ] 04-02-PLAN.md — Build structured logger utility (JSON in prod, pretty in dev, child loggers with bindings)
- [ ] 04-03-PLAN.md — Replace all console.* in engine modules with structured logger; add Sentry breadcrumbs and exception captures; thread requestId
- [ ] 04-04-PLAN.md — Build /api/admin/costs aggregation endpoint (client-side aggregation, CRON_SECRET auth)

### Phase 5: Test Coverage

**Goal**: Every engine module has unit tests, the full pipeline is integration-tested with failure scenarios, and coverage exceeds 80%.
**Depends on**: Phase 1 (pipeline wired to test against); Phase 4 logger helps but not blocking
**File Ownership**: `vitest.config.ts`, `src/lib/engine/__tests__/` (new), `package.json` (test script), test fixture/mock factories
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, TEST-10, TEST-11
**Success Criteria** (what must be TRUE):
  1. `pnpm test` runs and exits 0 with a coverage summary in the terminal
  2. Unit tests exist for: aggregator, normalize, ml, calibration, fuzzy, rules, deepseek (7 modules)
  3. Integration tests cover: all-mocked-stages happy path, DeepSeek failure → Gemini fallback, Gemini failure, ML weight redistribution
  4. Coverage report shows >80% for all files under `src/lib/engine/`
**Plans**: 8 plans

Plans:
- [ ] 05-01-PLAN.md — Configure Vitest with v8 coverage, add test scripts, build mock factories, add resetCircuitBreaker export
- [ ] 05-02-PLAN.md — Unit tests for aggregator (selectWeights redistribution, aggregateScores confidence/clamping/calibration/feature vector)
- [ ] 05-03-PLAN.md — Unit tests for normalize (hashtag extraction, duration hints, all 3 input modes)
- [ ] 05-04-PLAN.md — Unit tests for ml (featureVectorToMLInput null handling/clamping, predictWithML output range, stratifiedSplit)
- [ ] 05-05-PLAN.md — Unit tests for calibration (computeECE binning, fitPlattScaling min samples, applyPlattScaling sigmoid)
- [ ] 05-06-PLAN.md — Unit tests for fuzzy (Jaro-Winkler similarity, bestFuzzyMatch thresholds) + rules (13 regex positive/negative, scoreContentAgainstRules)
- [ ] 05-07-PLAN.md — Unit tests for deepseek (circuit breaker state transitions, Zod response parsing)
- [ ] 05-08-PLAN.md — Integration tests for pipeline (happy path, DeepSeek failure, Gemini failure, non-critical degradation) + coverage gate >80%

### Phase 6: Hardening

**Goal**: Every remaining failure mode degrades gracefully — no unhandled throws, no race conditions, and creator profile scraping triggers correctly.
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5 (cleanup pass after all core work is done)
**File Ownership**: `src/lib/engine/gemini.ts`, `src/lib/engine/deepseek.ts`, `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts`, `src/app/api/profile/route.ts`
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05
**Success Criteria** (what must be TRUE):
  1. Passing a malformed calibration JSON file causes neither gemini.ts nor deepseek.ts to throw — both fall back to uncalibrated defaults
  2. Simulating simultaneous DeepSeek + Gemini failure returns a partial result with `confidence: "LOW"` rather than a 500 error
  3. Concurrent half-open circuit breaker probes result in exactly one probe request (mutex prevents race)
  4. Setting `creator_handle` on a user profile triggers an optional creator profile scrape without blocking the response
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — Harden calibration-baseline.json parsing with Zod schemas + try-catch in gemini.ts and deepseek.ts (HARD-01, HARD-02)
- [ ] 06-02-PLAN.md — Implement graceful dual-LLM-failure path returning partial result with LOW confidence (HARD-03)
- [ ] 06-03-PLAN.md — Add probe mutex to circuit breaker half-open state in deepseek.ts (HARD-04)
- [ ] 06-04-PLAN.md — Wire optional creator profile scrape trigger on tiktok_handle set in profile route (HARD-05)

### Phase 7: Observability Completion

**Goal**: Every pipeline stage emits a unified structured log entry with all 4 required fields (requestId, stage, duration_ms, cost_cents), and all application code uses the structured logger — no console.* remains anywhere.
**Depends on**: Phase 4, Phase 6 (completes observability work after all engine changes are done)
**File Ownership**: `src/lib/engine/gemini.ts`, `src/lib/engine/deepseek.ts`, `src/lib/engine/pipeline.ts`, `src/lib/engine/trends.ts`, `src/lib/engine/creator.ts`, `src/app/api/admin/costs/route.ts`, `src/app/api/cron/*/route.ts`, `src/app/api/webhooks/*/route.ts`
**Requirements**: OBS-04 (closes partial)
**Gap Closure**: Closes tech debt from milestone audit
**Success Criteria** (what must be TRUE):
  1. Each cost-bearing pipeline stage (gemini, deepseek) emits a `log.info("Stage complete", { stage, duration_ms, cost_cents })` entry on its happy path
  2. The "Pipeline complete" log in pipeline.ts includes `cost_cents` alongside existing `stage` and `duration_ms`
  3. `trends.ts` and `creator.ts` use `createLogger` with module binding and structured log calls
  4. `admin/costs/route.ts` catch block uses structured logger instead of `console.error`
  5. All 6 cron route handlers and 2 webhook handlers use `createLogger` instead of `console.*`
  6. `pnpm test` still passes (203+ tests, >80% coverage)
  7. `pnpm build` succeeds with no TypeScript errors
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md — Add cost_cents to stage completion logs in gemini.ts, deepseek.ts, pipeline.ts (closes OBS-04)
- [ ] 07-02-PLAN.md — Add structured logger to trends.ts, creator.ts, and admin/costs catch block
- [ ] 07-03-PLAN.md — Migrate all cron route handlers and webhook handlers from console.* to createLogger

## Execution Waves

Wave groupings for parallel dispatch. Phases within a wave have no inter-dependencies.

### Wave 1 (no dependencies)
- Phase 1: Schedule Crons & Fix Data Pipeline Wiring

### Wave 2 (depends on Wave 1 — Phase 1 complete)
- Phase 2: ML Model Rehabilitation (needs scraped_videos flowing)
- Phase 3: Calibration Wiring (needs cron infrastructure)
- Phase 4: Observability (needs pipeline wired to instrument)

### Wave 3 (depends on Wave 2)
- Phase 5: Test Coverage (benefits from wired pipeline + logger from Phase 4)

### Wave 4 (final pass — all prior phases complete)
- Phase 6: Hardening (cleanup across all engine files after substantive work is done)

### Wave 5 (gap closure — audit findings)
- Phase 7: Observability Completion (closes OBS-04 + tech debt from audit)

## Progress

**Execution Order:** 1 → 2/3/4 (parallel) → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schedule Crons & Fix Data Pipeline Wiring | 2/2 | ✓ Complete | 2026-02-17 |
| 2. ML Model Rehabilitation | 3/3 | ✓ Complete | 2026-02-18 |
| 3. Calibration Wiring | 2/2 | ✓ Complete | 2026-02-18 |
| 4. Observability | 4/4 | ✓ Complete | 2026-02-18 |
| 5. Test Coverage | 8/8 | ✓ Complete | 2026-02-18 |
| 6. Hardening | 4/4 | ✓ Complete | 2026-02-18 |
| 7. Observability Completion | 3/3 | ✓ Complete | 2026-02-18 |
