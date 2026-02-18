# Roadmap: Backend Reliability

## Overview

The prediction engine pipeline is structurally complete but significantly disconnected: 6 cron jobs are orphaned (never scheduled), the ML classifier sits at 31% accuracy and isn't wired into the aggregator, Platt calibration is idle, there is zero test coverage, and no error monitoring exists. This milestone works bottom-up — fix the data pipeline first, then rehabilitate ML (which needs fresh scraped data), wire calibration and observability in parallel, build test coverage, and close all remaining failure-mode fragility.

## Phases

**Phase Numbering:** Integer phases (1–6), milestone-scoped.

- [x] **Phase 1: Schedule Crons & Fix Data Pipeline Wiring** — Schedule all 7 crons in vercel.json and repair the end-to-end scrape → aggregate pipeline *(completed 2026-02-17)*
- [x] **Phase 2: ML Model Rehabilitation** — Fix class imbalance, real feature bridge, stratified training, achieve >75% accuracy and wire ML into the aggregator *(completed 2026-02-18)*
- [ ] **Phase 3: Calibration Wiring** — Conditionally apply Platt scaling in the aggregator and verify calibration-audit cron runs cleanly
- [ ] **Phase 4: Observability** — Install Sentry, add structured JSON logging, replace all console.* calls, expose admin cost endpoint
- [ ] **Phase 5: Test Coverage** — Configure Vitest, write unit + integration tests for all engine modules, reach >80% coverage
- [ ] **Phase 6: Hardening** — Wrap edge cases: calibration parsing, LLM double-failure, circuit breaker mutex, creator profile trigger

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
**File Ownership**: `src/lib/engine/aggregator.ts`, `src/lib/engine/calibration.ts`, `src/app/api/crons/calibration-audit/`, `src/app/api/outcomes/`, `src/types/engine.ts`
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04
**Success Criteria** (what must be TRUE):
  1. Aggregator calls `getPlattParameters()` on every prediction and conditionally applies scaling when parameters are available
  2. Every `PredictionResult` includes an `is_calibrated: boolean` field visible in the API response
  3. calibration-audit cron completes without throwing and logs an ECE value to stdout/logger
  4. POST `/api/outcomes` accepts a payload and persists it without error (verified via curl or test)
**Plans**: TBD

Plans:
- [ ] 03-01: Wire getPlattParameters() into aggregator with conditional Platt scaling
- [ ] 03-02: Add is_calibrated boolean to PredictionResult type and propagate through pipeline
- [ ] 03-03: Verify calibration-audit cron and outcomes endpoint work end-to-end

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
**Plans**: TBD

Plans:
- [ ] 04-01: Install and configure @sentry/nextjs (client, server, edge, instrumentation hook)
- [ ] 04-02: Build structured logger utility (JSON in prod, pretty in dev, requestId/stage/duration_ms/cost_cents)
- [ ] 04-03: Replace all console.* in engine modules with structured logger; add Sentry breadcrumbs and exception captures
- [ ] 04-04: Build /api/admin/costs aggregation endpoint

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
**Plans**: TBD

Plans:
- [ ] 05-01: Configure Vitest with coverage, add pnpm test script, build mock factories
- [ ] 05-02: Unit tests — aggregator (weight selection, confidence, feature vector, score clamping)
- [ ] 05-03: Unit tests — normalize (hashtag extraction, duration hints, 3 input modes)
- [ ] 05-04: Unit tests — ml (feature vector bridge null handling, prediction output range)
- [ ] 05-05: Unit tests — calibration (ECE calculation, Platt scaling math)
- [ ] 05-06: Unit tests — fuzzy (Jaro-Winkler exact/no match, threshold filtering) + rules (13 regex positive/negative)
- [ ] 05-07: Unit tests — deepseek (circuit breaker state transitions, Zod response parsing)
- [ ] 05-08: Integration tests — pipeline (happy path, DeepSeek failure, Gemini failure, weight redistribution) + coverage gate

### Phase 6: Hardening

**Goal**: Every remaining failure mode degrades gracefully — no unhandled throws, no race conditions, and creator profile scraping triggers correctly.
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5 (cleanup pass after all core work is done)
**File Ownership**: `src/lib/engine/gemini.ts`, `src/lib/engine/deepseek.ts`, `src/lib/engine/calibration.ts`, `src/lib/engine/circuit-breaker.ts`, `src/app/api/` (creator profile trigger)
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05
**Success Criteria** (what must be TRUE):
  1. Passing a malformed calibration JSON file causes neither gemini.ts nor deepseek.ts to throw — both fall back to uncalibrated defaults
  2. Simulating simultaneous DeepSeek + Gemini failure returns a partial result with `confidence: "LOW"` rather than a 500 error
  3. Concurrent half-open circuit breaker probes result in exactly one probe request (mutex prevents race)
  4. Setting `creator_handle` on a user profile triggers an optional creator profile scrape without blocking the response
**Plans**: TBD

Plans:
- [ ] 06-01: Wrap calibration file JSON.parse in try-catch in gemini.ts and deepseek.ts; add Zod schema for calibration shape
- [ ] 06-02: Implement graceful dual-LLM-failure path returning partial result with LOW confidence
- [ ] 06-03: Add promise-based mutex to circuit breaker half-open probe
- [ ] 06-04: Wire optional creator profile scrape trigger on creator_handle set

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

## Progress

**Execution Order:** 1 → 2/3/4 (parallel) → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schedule Crons & Fix Data Pipeline Wiring | 2/2 | ✓ Complete | 2026-02-17 |
| 2. ML Model Rehabilitation | 3/3 | ✓ Complete | 2026-02-18 |
| 3. Calibration Wiring | 0/3 | Not started | - |
| 4. Observability | 0/4 | Not started | - |
| 5. Test Coverage | 0/8 | Not started | - |
| 6. Hardening | 0/4 | Not started | - |
