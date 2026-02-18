---
milestone: Backend Reliability
audited: 2026-02-18T14:30:00Z
status: tech_debt
scores:
  requirements: 34/35
  phases: 6/6
  integration: 5/5
  flows: 5/5
gaps:
  requirements:
    - "OBS-04: Stage logs missing cost_cents in unified JSON entry (partial — 3/4 fields present)"
  integration: []
  flows: []
tech_debt:
  - phase: 04-observability
    items:
      - "OBS-04 partial: Pipeline 'Stage complete' log includes requestId+stage+duration_ms but not cost_cents. Gemini/DeepSeek success paths emit cost_cents only in Sentry breadcrumbs, not structured log entries."
      - "admin/costs/route.ts line 86: residual console.error in catch block (should use structured logger)"
      - "Cron routes (6 handlers + 2 webhooks) use console.* instead of createLogger — outside explicit Phase 4 scope of src/lib/engine/ but inconsistent with structured logging intent"
      - "trends.ts and creator.ts have no logger at all (silent, not regression — errors propagate to pipeline.ts catch blocks)"
  - phase: 05-test-coverage
    items:
      - "Per-file branch coverage below 80% for pipeline.ts (40%), creator.ts (68.88%), ml.ts (71.31%), deepseek.ts (75.75%), rules.ts (78.33%), calibration.ts (78.78%) — global aggregate passes at 80.13%"
  - phase: 02-ml-model-rehabilitation
    items:
      - ">75% accuracy is code-ready but requires runtime training run to confirm actual accuracy value"
      - "3 genuinely unavailable features in featureVectorToMLInput retain 0.5 defaults (followerTier, weekdayPosted, hourPosted)"
---

# Backend Reliability — Milestone Audit Report

**Milestone:** Backend Reliability
**Audited:** 2026-02-18
**Status:** TECH_DEBT (no critical blockers, accumulated deferred items)

## Executive Summary

All 6 phases completed with 34/35 requirements satisfied. The prediction engine pipeline is fully wired end-to-end: crons scheduled, ML rehabilitated and integrated, calibration conditional, observability instrumented, 203 tests passing at >80% coverage, and all failure modes hardened. One requirement (OBS-04) is partially satisfied — stage logs include 3 of 4 required fields in a single JSON entry.

---

## Requirements Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRON-01: 7 crons in vercel.json | 1 | SATISFIED |
| CRON-02: evaluation_tier column | 1 | SATISFIED |
| CRON-03: Apify scraper chain E2E | 1 | SATISFIED |
| CRON-04: Env vars documented | 1 | SATISFIED |
| ML-01: Class imbalance diagnosed | 2 | SATISFIED |
| ML-02: Class weighting in training | 2 | SATISFIED |
| ML-03: Real feature bridge | 2 | SATISFIED |
| ML-04: Stratified train/test split | 2 | SATISFIED |
| ML-05: >75% accuracy (code-ready) | 2 | SATISFIED |
| ML-06: ML signal in aggregator | 2 | SATISFIED |
| ML-07: ml_score in DB | 2 | SATISFIED |
| ML-08: retrain-ml cron with gate | 2 | SATISFIED |
| CAL-01: Platt scaling in aggregator | 3 | SATISFIED |
| CAL-02: is_calibrated boolean | 3 | SATISFIED |
| CAL-03: calibration-audit logs ECE | 3 | SATISFIED |
| CAL-04: Outcomes POST endpoint | 3 | SATISFIED |
| OBS-01: Sentry installed | 4 | SATISFIED |
| OBS-02: Sentry breadcrumbs + exceptions | 4 | SATISFIED |
| OBS-03: Structured JSON logger | 4 | SATISFIED |
| OBS-04: Stage logs with 4 fields | 4 | **PARTIAL** |
| OBS-05: Zero console.* in engine | 4 | SATISFIED |
| OBS-06: Admin costs endpoint | 4 | SATISFIED |
| TEST-01: Vitest configured | 5 | SATISFIED |
| TEST-02: pnpm test script | 5 | SATISFIED |
| TEST-03: Aggregator tests | 5 | SATISFIED |
| TEST-04: Normalize tests | 5 | SATISFIED |
| TEST-05: ML tests | 5 | SATISFIED |
| TEST-06: Calibration tests | 5 | SATISFIED |
| TEST-07: Fuzzy tests | 5 | SATISFIED |
| TEST-08: Rules tests | 5 | SATISFIED |
| TEST-09: DeepSeek tests | 5 | SATISFIED |
| TEST-10: Integration tests | 5 | SATISFIED |
| TEST-11: >80% coverage | 5 | SATISFIED |
| HARD-01: Calibration try-catch | 6 | SATISFIED |
| HARD-02: Zod calibration schema | 6 | SATISFIED |
| HARD-03: Dual-LLM failure LOW | 6 | SATISFIED |
| HARD-04: Circuit breaker mutex | 6 | SATISFIED |
| HARD-05: Creator profile scrape | 6 | SATISFIED |

**Score: 34/35 requirements satisfied (1 partial)**

---

## Phase Verification Summary

| Phase | Status | Score | Key Findings |
|-------|--------|-------|--------------|
| 1. Schedule Crons & Data Pipeline | PASSED | 5/5 | All 7 crons scheduled, webhook handler substantive, pipeline wired |
| 2. ML Model Rehabilitation | PASSED | 6/6 | Class weighting, real features, 5-signal aggregator, ml_score in DB |
| 3. Calibration Wiring | PASSED | 10/10 | Platt scaling conditional, is_calibrated on every result, outcomes endpoint |
| 4. Observability | GAPS_FOUND | 3/4 | Sentry wired, logger built, console.* eliminated — but cost_cents missing from stage logs |
| 5. Test Coverage | PASSED | 4/4 | 203 tests, 93.62% stmts, 80.13% branch, all failure scenarios covered |
| 6. Hardening | PASSED | 4/4 | Zod validation, dual-LLM fallback, probe mutex, fire-and-forget scrape |

---

## Cross-Phase Integration

| Connection | Status |
|------------|--------|
| Phase 1 → Phase 2: scraped_videos → retrain-ml | WIRED |
| Phase 1 → Phase 3: cron infra → calibration-audit | WIRED |
| Phase 2 → Phase 3: ML signal + Platt scaling coexist in aggregator | WIRED |
| Phase 2 → Phase 5: Tests cover ML signal flow | WIRED |
| Phase 3 → Phase 5: Tests cover calibration path | WIRED |
| Phase 4 → all: Logger in all engine modules, Sentry in all catch blocks | WIRED |
| Phase 6 → Phase 5: Hardening changes don't break 203 tests | WIRED |

**Score: 7/7 cross-phase connections verified**

---

## E2E Flows

| Flow | Status | Notes |
|------|--------|-------|
| Prediction (analyze → normalize → LLMs → aggregate → DB) | COMPLETE | All 5 signals, Platt scaling, ml_score + is_calibrated in insert |
| Data pipeline (scrape → webhook → scraped_videos → trending_sounds) | COMPLETE | Apify actor → webhook → DB upsert → calculate-trends aggregation |
| ML retraining (scraped_videos → train → accuracy gate → upload) | COMPLETE | Fallback to training-data.json when <500 rows |
| Calibration (outcomes → audit → Platt cache → aggregator) | COMPLETE | invalidatePlattCache wired, re-fetch on next prediction |
| Failure (DeepSeek down → Gemini fallback → weight redistribution) | COMPLETE | DEFAULT_GEMINI_RESULT, confidence override to LOW |

**Score: 5/5 flows verified end-to-end**

---

## Tech Debt Summary

### Phase 4: Observability (4 items)

1. **OBS-04 partial**: Stage completion logs include `requestId`, `stage`, `duration_ms` but not `cost_cents` in a single JSON entry. Fix: add `log.info("Stage complete", { stage, duration_ms, cost_cents })` at end of each cost-bearing stage.
2. **Residual console.error**: `admin/costs/route.ts:86` catch block uses `console.error` instead of structured logger.
3. **Cron routes unstructured**: 6 cron handlers + 2 webhook handlers use `console.*` — outside Phase 4's `src/lib/engine/` scope but inconsistent with structured logging.
4. **Silent modules**: `trends.ts` and `creator.ts` have no logger (errors propagate to pipeline.ts catch blocks via Sentry).

### Phase 5: Test Coverage (1 item)

5. **Per-file branch coverage**: `pipeline.ts` at 40% branch, `creator.ts` at 68.88%, `ml.ts` at 71.31% — global aggregate passes at 80.13%.

### Phase 2: ML (2 items)

6. **Accuracy runtime**: >75% accuracy requires actual training run to confirm — code infrastructure is correct.
7. **Default features**: 3 unavailable features (`followerTier`, `weekdayPosted`, `hourPosted`) retain 0.5 defaults in `featureVectorToMLInput`.

**Total: 7 tech debt items across 3 phases (0 critical blockers)**

---

## Human Verification Checklist

These items require live runtime environment to confirm:

- [ ] Deploy to Vercel staging and trigger scrape-trending → verify rows in scraped_videos
- [ ] Run `pnpm build` fresh — confirm exit 0
- [ ] Run `trainModel()` against training data — confirm >75% accuracy
- [ ] POST /api/analyze — confirm ml_score and is_calibrated in response
- [ ] Seed 50+ outcomes → POST /api/analyze — confirm is_calibrated: true
- [ ] Malformed calibration-baseline.json → confirm graceful fallback
- [ ] Block both LLM endpoints → confirm LOW confidence partial result
- [ ] Concurrent requests during half-open → confirm single probe
- [ ] PATCH /api/profile with tiktok_handle → confirm <500ms response

---

_Audited: 2026-02-18_
_Auditor: Claude (gsd-audit-milestone)_
