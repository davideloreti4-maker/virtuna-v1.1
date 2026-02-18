---
phase: 04-observability
plan: 03
subsystem: infra
tags: [sentry, structured-logging, observability, nanoid, requestId]

# Dependency graph
requires:
  - phase: 04-01
    provides: "Sentry SDK initialized in Next.js config"
  - phase: 04-02
    provides: "createLogger structured logger in src/lib/logger.ts"
provides:
  - "All engine modules use createLogger instead of console.*"
  - "Every catch block has Sentry.captureException with stage tags"
  - "Pipeline emits Sentry breadcrumbs after Wave 1 and Wave 2"
  - "requestId generated per pipeline run and threaded to API route"
  - "PipelineResult.requestId field for downstream consumers"
affects: [05-integration-tests, 06-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createLogger({ module }) at module top-level for all engine files"
    - "Sentry.captureException in every catch block before fallback or re-throw"
    - "Sentry.addBreadcrumb after stage completion with duration_ms and cost data"
    - "requestId generated via nanoid(12) in analyze route, passed to pipeline"

key-files:
  created: []
  modified:
    - src/lib/engine/pipeline.ts
    - src/lib/engine/gemini.ts
    - src/lib/engine/deepseek.ts
    - src/lib/engine/rules.ts
    - src/lib/engine/ml.ts
    - src/lib/engine/calibration.ts
    - src/app/api/analyze/route.ts
    - src/app/api/admin/calibration-report/route.ts

key-decisions:
  - "requestId generated in analyze route and passed to pipeline via opts parameter"
  - "Sentry breadcrumbs added in pipeline (waves), gemini (text+video), and deepseek (reasoning+fallback)"
  - "Error objects logged as error.message strings for JSON serialization compatibility"

patterns-established:
  - "Module-level logger: const log = createLogger({ module: 'name' }) at file top"
  - "Sentry exception capture: always before fallback return or re-throw, with stage tag"
  - "Cost logging: log.warn when cost_cents exceeds soft cap thresholds"
  - "requestId threading: generated once per request, propagated through pipeline"

# Metrics
duration: 6min
completed: 2026-02-18
---

# Phase 4 Plan 3: Engine Structured Logging Summary

**Replaced all 25+ console.* calls in 6 engine modules and 2 API routes with createLogger structured logging, Sentry breadcrumbs on stage completion, and Sentry.captureException in every catch block, with requestId threading for log correlation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-18T11:07:35Z
- **Completed:** 2026-02-18T11:13:44Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Zero console.* calls remain in src/lib/engine/ or the two API routes (OBS-05)
- Every catch block in the engine has Sentry.captureException with stage and requestId tags (OBS-02)
- Pipeline emits Sentry breadcrumbs after Wave 1 and Wave 2 with stage lists (OBS-02)
- Gemini and DeepSeek modules emit breadcrumbs with duration_ms, cost_cents, model data (OBS-02)
- requestId generated per pipeline run via nanoid(12), threaded from analyze route through pipeline (OBS-04)
- All log calls include structured fields: module, requestId, stage, duration_ms, cost_cents where applicable (OBS-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Instrument pipeline.ts with requestId, Sentry breadcrumbs, and structured logging** - `9e1378e` (feat)
2. **Task 2: Replace console.* in all engine modules with structured logger + Sentry** - `43f2778` (feat)

## Files Created/Modified
- `src/lib/engine/pipeline.ts` - Added requestId generation, Sentry breadcrumbs, captureException in all 7 catch blocks, structured logging
- `src/lib/engine/gemini.ts` - Replaced 2 console.warn with log.warn, added breadcrumbs for text and video analysis, captureException on failure
- `src/lib/engine/deepseek.ts` - Replaced 5 console.* with structured logs, added breadcrumbs for reasoning and fallback, captureException on retry exhaustion
- `src/lib/engine/rules.ts` - Replaced 8 console.* with structured logs, captureException for rule loading and semantic eval failures
- `src/lib/engine/ml.ts` - Replaced 7 console.* with structured logs, captureException for weight upload and model load failures
- `src/lib/engine/calibration.ts` - Replaced 1 console.error with structured log + captureException
- `src/app/api/analyze/route.ts` - Added requestId generation, passes to pipeline, replaced console.error
- `src/app/api/admin/calibration-report/route.ts` - Replaced console.error with structured log + captureException

## Decisions Made
- requestId generated in analyze route (not pipeline) so it can be included in API response metadata
- Sentry breadcrumbs in pipeline (wave-level), gemini (text+video), deepseek (reasoning+fallback) -- not in rules/ml/calibration which are lower-level
- Error objects always logged as error.message string to ensure JSON serialization works

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All engine modules now emit structured logs and Sentry events
- Phase 4 observability complete -- all 4 plans finished
- Ready for Phase 5 (integration tests) which can now assert on structured log output
- Ready for Phase 6 (hardening) final cleanup pass

---
*Phase: 04-observability*
*Completed: 2026-02-18*
