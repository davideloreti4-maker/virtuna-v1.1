# State — Backend Reliability

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate
**Current focus:** Phase 3 in progress (Calibration Wiring). Plan 02 of 02 complete.

## Current Position

Phase: 3 of 6 (Calibration Wiring)
Plan: 2 of 2 in current phase
Status: Plan Complete
Last activity: 2026-02-18 — Plan 03-02 complete (calibration-audit cron and outcomes endpoint verified clean)

Progress: [██████░░░░] 58%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 3min
- Total execution time: 23min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-schedule-crons | 2 | 14min | 7min |
| 02-ml-model-rehabilitation | 3 | 6min | 2min |
| 03-calibration-wiring | 2 | 3min | 1.5min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- Comprehensive database.types.ts update: added all missing tables/columns from migrations rather than just evaluation_tier (01-01)
- Pricing page set to force-dynamic to avoid WhopCheckoutEmbed SSG error (01-01)
- Scrape pipeline verified correct as-is — no bugs found in 4-stage chain (01-02)
- Runtime webhook test deferred to post-deployment smoke test (01-02)
- .env.example is canonical env var documentation with gitignore exception (01-02)
- Milestone scoped: backend-only, no frontend changes this milestone
- Phase 2 (ML) depends on Phase 1 so fresh scraped_videos are available for retraining
- Phases 2, 3, 4 can run in parallel once Phase 1 is complete (Wave 2)
- Phase 5 (tests) waits for Wave 2 so pipeline is fully wired before writing integration tests
- Phase 6 (hardening) is final cleanup pass after all substantive work lands

- Class weights capped at 3x minimum to prevent overfitting to rare tiers (02-01)
- Feature bridge maps DeepSeek shareability/commentProvocation/emotionalCharge/saveWorthiness as semantic engagement proxies (02-01)
- trainModel accepts structured data object directly for retrain cron — avoids write-then-read JSON (02-01)
- Feature vector assembled before ML prediction to feed featureVectorToMLInput bridge (02-02)
- ML score defaults to 0 (not null) in PredictionResult for consistent DB storage (02-02)
- Behavioral weight 0.45->0.35, rules 0.20->0.15 to accommodate ML at 0.15 (02-02)
- saveRate uses likes * 0.15 proxy since scraped_videos has no saves column (02-03)
- Accuracy gate removes uploaded weights from Supabase Storage when <60% test accuracy (02-03)
- Tier assignment uses percentile quintiles (p20/p40/p60/p80) for adaptive thresholds (02-03)
- Fallback threshold at 500 videos minimum for dynamic training (02-03)

- Import PlattParameters type at top level (no circular dependency risk — aggregator -> calibration is one-way) (03-01)
- Try/catch around getPlattParameters() for graceful degradation to uncalibrated mode (03-01)
- No code changes needed for calibration-audit cron or outcomes endpoint — both verified clean against current codebase (03-02)

### Blockers/Concerns

- Circuit breaker is per-serverless-instance (module-level state) — not a distributed lock; HARD-04 addresses this
- ~~training-data.json is a static 2.6MB file~~ RESOLVED: retrain-ml cron now generates training data dynamically from scraped_videos (02-03)
- Calibration has no outcome data yet — CAL-01/CAL-02 wire it conditionally so it degrades gracefully

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 03-01-PLAN.md — Platt scaling wired into aggregator, is_calibrated propagated through types/DB/API. Phase 3 fully complete.
Resume file: None
