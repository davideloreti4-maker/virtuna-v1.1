# State — Backend Reliability

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate
**Current focus:** Phase 7 (Observability Completion) in progress. Phases 1-6 complete (25 plans). Phase 7 added to close observability gaps.

## Current Position

Phase: 7 of 7 (Observability Completion)
Plan: 2 of 3 in current phase
Status: In Progress
Last activity: 2026-02-18 — Plan 07-02 complete. Structured logging added to trends.ts and creator.ts.

Progress: [█████████▒] 96%

## Performance Metrics

**Velocity:**
- Total plans completed: 27
- Average duration: 3min
- Total execution time: 83min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-schedule-crons | 2 | 14min | 7min |
| 02-ml-model-rehabilitation | 3 | 6min | 2min |
| 03-calibration-wiring | 2 | 3min | 1.5min |
| 04-observability | 4 | 10min | 2.5min |
| 05-test-coverage | 8 | 24min | 3min |
| 06-hardening | 5 | 20min | 4min |
| 07-observability-completion | 2 | 3min | 1.5min |

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

- Zero-dependency structured logger — edge-runtime compatible, no pino/winston (04-02)
- logger.ts is the ONLY sanctioned console.* location after 04-03 migration (04-02)
- emit() separates bindings from per-call data for efficient child logger pattern (04-02)
- Client-side JS aggregation instead of SQL RPC to avoid migration for cost endpoint (04-04)
- Group by gemini_model (always present) not deepseek_model (may be null) (04-04)
- requestId generated in analyze route and passed to pipeline via opts parameter (04-03)
- Sentry breadcrumbs in pipeline (waves), gemini (text+video), deepseek (reasoning+fallback) (04-03)
- Error objects always logged as error.message string for JSON serialization (04-03)

- Added setup.test.ts smoke test because Vitest v4 exits 1 when no test files found (05-01)
- Factory functions use Partial<T> spread pattern for override flexibility (05-01)
- resetCircuitBreaker uses export function (not re-export) to avoid TS2323 redeclaration (05-01)
- Fixed NaN bug in selectWeights when all signals unavailable — added early-return guard (05-02)
- Global aggregate coverage threshold (not per-file) — intentional to avoid over-testing low-value branches (05-08)
- Pipeline integration tests use vi.useFakeTimers for DeepSeek/Gemini retry delays (05-08)

- Zod schemas validate only the fields each module uses from calibration JSON (not full structure) (06-01)
- Fallback calibration uses conservative hardcoded values matching approximate p90 thresholds (06-01)
- loadCalibrationData returns null on failure — callers use ?? fallback pattern (06-01)

- Gemini availability detected by checking if any factor score > 0 — false only for fallback (06-02)
- Explicit confidence override to LOW (0.2) rather than patching calculateConfidence algorithm (06-02)
- DeepSeek can still succeed when Gemini fails — it calls OpenAI directly (06-02)

- Per-instance probeInFlight mutex (not distributed lock) — matches serverless-per-instance circuit breaker scope (06-03)
- probeInFlight cleared in both recordSuccess and recordFailure for all exit paths (06-03)
- Defensive guard in half-open branch blocks additional requests even if state reached unexpectedly (06-03)

- Scrape fields mapped to existing creator_profiles columns: displayName->display_name, followerCount->tiktok_followers, avatarUrl->avatar_url, bio->bio (06-04)
- tiktok_handle destructured from parsed.data before user_settings upsert to avoid unknown column error (06-04)
- Service client used for creator_profiles write — bypasses RLS since user client may lack permissions (06-04)

- Single-field addition to close fallback log gap — all other stage logs already had complete fields from Phase 04 (07-01)
- No test modifications needed for trends.ts/creator.ts logging — both test files already mock @/lib/logger (07-02)

### Blockers/Concerns

- Circuit breaker is per-serverless-instance (module-level state) — not a distributed lock; HARD-04 addresses this
- ~~training-data.json is a static 2.6MB file~~ RESOLVED: retrain-ml cron now generates training data dynamically from scraped_videos (02-03)
- Calibration has no outcome data yet — CAL-01/CAL-02 wire it conditionally so it degrades gracefully

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 07-02-PLAN.md (2 of 3 in Phase 7). Plan 07-03 remains.
Resume file: None
