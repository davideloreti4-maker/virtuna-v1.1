# Requirements Archive: backend-reliability Backend Reliability

**Archived:** 2026-02-18
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: Virtuna — Backend Reliability

**Defined:** 2026-02-17
**Core Value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate

## v1 Requirements

### Cron & Data Pipeline Wiring

- [ ] **CRON-01**: All 7 cron jobs are scheduled in vercel.json (6 orphaned + 1 existing)
- [ ] **CRON-02**: `evaluation_tier` column exists in `rule_library` (unblocks semantic rules)
- [ ] **CRON-03**: Apify scraper chain works end-to-end (scrape-trending → webhook → scraped_videos → calculate-trends → trending_sounds)
- [ ] **CRON-04**: All required env vars are documented (APIFY_TOKEN, APIFY_WEBHOOK_SECRET, APIFY_ACTOR_ID, SCRAPER_HASHTAGS)

### ML Model Rehabilitation

- [ ] **ML-01**: Class imbalance diagnosed and documented (tier 1-5 distribution, feature correlation)
- [ ] **ML-02**: Training pipeline uses class weighting (inverse-frequency weights for minority tiers)
- [ ] **ML-03**: Feature bridge `featureVectorToMLInput()` uses real signals instead of hardcoded 0.5 placeholders
- [ ] **ML-04**: Training uses stratified train/test split with per-class precision/recall evaluation
- [ ] **ML-05**: `trainModel()` achieves >75% test accuracy with all 5 tiers predicted at >50% recall
- [ ] **ML-06**: ML signal wired into aggregator with weight redistribution (behavioral 35%, gemini 25%, ml 15%, rules 15%, trends 10%)
- [ ] **ML-07**: `ml_score` field stored in analysis_results DB insert
- [ ] **ML-08**: retrain-ml cron regenerates training data from scraped_videos and gates on accuracy >60%

### Calibration

- [ ] **CAL-01**: Aggregator calls `getPlattParameters()` and conditionally applies Platt scaling
- [ ] **CAL-02**: `is_calibrated` boolean added to PredictionResult metadata
- [ ] **CAL-03**: calibration-audit cron runs without error and logs ECE value
- [ ] **CAL-04**: Outcomes POST endpoint exists and works (already built — verify)

### Observability

- [ ] **OBS-01**: `@sentry/nextjs` installed and configured (client, server, edge configs)
- [ ] **OBS-02**: Pipeline stages emit Sentry breadcrumbs; hard failures captured as exceptions
- [ ] **OBS-03**: Structured logger utility outputs JSON in production, pretty in dev
- [ ] **OBS-04**: Logger includes requestId, stage, duration_ms, cost_cents
- [ ] **OBS-05**: All engine module `console.*` calls replaced with structured logger
- [ ] **OBS-06**: `/api/admin/costs` endpoint aggregates cost_cents by day/model

### Test Coverage

- [ ] **TEST-01**: Vitest configured with test utilities and mock factories
- [ ] **TEST-02**: `pnpm test` script added to package.json
- [ ] **TEST-03**: Unit tests for aggregator (weight selection, confidence, feature vector, score clamping)
- [ ] **TEST-04**: Unit tests for normalize (hashtag extraction, duration hints, all 3 input modes)
- [ ] **TEST-05**: Unit tests for ml (feature vector bridge null handling, prediction output range)
- [ ] **TEST-06**: Unit tests for calibration (ECE calculation, Platt scaling math)
- [ ] **TEST-07**: Unit tests for fuzzy (Jaro-Winkler exact/no match, threshold filtering)
- [ ] **TEST-08**: Unit tests for rules (13 regex patterns with positive/negative cases)
- [ ] **TEST-09**: Unit tests for deepseek (circuit breaker state transitions, Zod response parsing)
- [ ] **TEST-10**: Integration tests for pipeline (all mocked stages, DeepSeek failure fallback, Gemini failure, weight redistribution)
- [ ] **TEST-11**: Coverage >80% for engine modules

### Hardening

- [ ] **HARD-01**: Calibration file JSON.parse wrapped in try-catch with fallback values in gemini.ts and deepseek.ts
- [ ] **HARD-02**: Zod schema added for calibration data shape
- [ ] **HARD-03**: Both LLMs fail → partial result returned with LOW confidence (not a throw)
- [ ] **HARD-04**: Circuit breaker half-open probe protected by promise-based mutex
- [ ] **HARD-05**: Optional creator profile scrape trigger when user sets creator_handle

## Future Requirements

### Outcomes Feedback Loop (deferred — user decision)
- **OUT-01**: Auto-scrape posted content after 48h for actual engagement metrics
- **OUT-02**: Analytics dashboard for confidence distributions, cost trends, model drift
- **OUT-03**: UI prompt after 48h: "How did this post perform?"

### Additional LLM Providers (stretch)
- **LLM-01**: Claude or OpenAI as additional fallback providers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Outcomes feedback loop | User decided to defer to future milestone |
| Auto-scrape posted content | Requires consent flow + creator handle linkage |
| Analytics dashboard | Confidence distributions, cost trends, model drift charts — future |
| Additional LLM providers | Claude/OpenAI as fallbacks — stretch goal only |
| Frontend changes | This milestone is purely backend; no UI changes |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRON-01 | Phase 1 | Pending |
| CRON-02 | Phase 1 | Pending |
| CRON-03 | Phase 1 | Pending |
| CRON-04 | Phase 1 | Pending |
| ML-01 | Phase 2 | Pending |
| ML-02 | Phase 2 | Pending |
| ML-03 | Phase 2 | Pending |
| ML-04 | Phase 2 | Pending |
| ML-05 | Phase 2 | Pending |
| ML-06 | Phase 2 | Pending |
| ML-07 | Phase 2 | Pending |
| ML-08 | Phase 2 | Pending |
| CAL-01 | Phase 3 | Pending |
| CAL-02 | Phase 3 | Pending |
| CAL-03 | Phase 3 | Pending |
| CAL-04 | Phase 3 | Pending |
| OBS-01 | Phase 4 | Pending |
| OBS-02 | Phase 4 | Pending |
| OBS-03 | Phase 4 | Pending |
| OBS-04 | Phase 4 | Pending |
| OBS-05 | Phase 4 | Pending |
| OBS-06 | Phase 4 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |
| TEST-04 | Phase 5 | Pending |
| TEST-05 | Phase 5 | Pending |
| TEST-06 | Phase 5 | Pending |
| TEST-07 | Phase 5 | Pending |
| TEST-08 | Phase 5 | Pending |
| TEST-09 | Phase 5 | Pending |
| TEST-10 | Phase 5 | Pending |
| TEST-11 | Phase 5 | Pending |
| HARD-01 | Phase 6 | Pending |
| HARD-02 | Phase 6 | Pending |
| HARD-03 | Phase 6 | Pending |
| HARD-04 | Phase 6 | Pending |
| HARD-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 after initial definition*
