# State — Backend Reliability

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate
**Current focus:** Phase 2 (ML Model Rehabilitation) — Plan 01 complete, Plans 02-03 remaining

## Current Position

Phase: 2 of 6 (ML Model Rehabilitation)
Plan: 1 of 3 in current phase
Status: Executing
Last activity: 2026-02-18 — Plan 02-01 complete (class weighting, feature bridge, data-param trainModel)

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5min
- Total execution time: 16min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-schedule-crons | 2 | 14min | 7min |
| 02-ml-model-rehabilitation | 1 | 2min | 2min |

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

### Blockers/Concerns

- Circuit breaker is per-serverless-instance (module-level state) — not a distributed lock; HARD-04 addresses this
- training-data.json is a static 2.6MB file — ML-08 replaces with dynamic generation from scraped_videos
- Calibration has no outcome data yet — CAL-01/CAL-02 wire it conditionally so it degrades gracefully

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 02-01-PLAN.md — ML core rehabilitation (class weighting, feature bridge, data-param overload). Plans 02-02 and 02-03 next.
Resume file: None
