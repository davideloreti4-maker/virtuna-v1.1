---
phase: 04-observability
verified: 2026-02-18T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
re_verification: false
gaps:
  - truth: "Pipeline stage logs in production are valid JSON with requestId, stage, duration_ms, and cost_cents fields"
    status: partial
    reason: "No single stage-completion log entry contains all four required fields simultaneously. The 'Pipeline complete' log (pipeline.ts:334) includes requestId (via binding), stage, and duration_ms but omits cost_cents. Stage-level module logs (gemini, deepseek, rules, ml) include cost_cents in warning-path entries only, and use 'module' binding rather than a 'stage' field. The Sentry breadcrumbs include duration_ms+cost_cents but are not JSON log entries."
    artifacts:
      - path: "src/lib/engine/pipeline.ts"
        issue: "log.info('Pipeline complete') at line 334 includes stage+duration_ms but no cost_cents field"
      - path: "src/lib/engine/gemini.ts"
        issue: "No structured log call at stage completion — only a Sentry breadcrumb (line 327) contains duration_ms+cost_cents"
      - path: "src/lib/engine/deepseek.ts"
        issue: "Primary attempt path logs cost_cents only in warning condition (>1.0); success path uses Sentry breadcrumb rather than a log.info with all four fields"
    missing:
      - "Add log.info('Stage complete') call at the end of each stage's happy path in pipeline.ts with { stage: '<stage_name>', duration_ms, cost_cents } so requestId (from binding) + stage + duration_ms + cost_cents all appear in one JSON entry"
      - "Alternatively, emit a combined log in the timed() wrapper that includes stage name and accept cost as optional data, then pass cost_cents at call site for cost-bearing stages"
human_verification:
  - test: "Send a request to POST /api/analyze with a valid payload and observe server logs"
    expected: "Each stage emits at least one JSON log line containing requestId, stage, duration_ms, and cost_cents as top-level JSON fields"
    why_human: "Requires running the app with NODE_ENV=production to observe actual JSON output and confirm all four fields appear in log lines"
---

# Phase 04: Observability Verification Report

**Phase Goal:** Every pipeline failure is captured in Sentry, every stage emits structured JSON logs with duration and cost, and an admin endpoint exposes daily cost aggregates.
**Verified:** 2026-02-18
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A thrown exception in any engine stage appears as an issue in the Sentry project dashboard | VERIFIED | 15 `Sentry.captureException` calls across all 6 engine files; `onRequestError = Sentry.captureRequestError` in instrumentation.ts captures Server Component errors; SDK initialized in sentry.server.config.ts |
| 2 | Pipeline stage logs in production are valid JSON with requestId, stage, duration_ms, and cost_cents fields | PARTIAL | requestId and module are bound on every logger; stage+duration_ms appear in "Pipeline complete" log; cost_cents appears only in warning-path or Sentry breadcrumbs, not in a stage-completion JSON log entry |
| 3 | No console.log, console.error, or console.warn calls remain in any src/lib/engine/ file | VERIFIED | Zero console.* calls found in pipeline.ts, gemini.ts, deepseek.ts, rules.ts, ml.ts, calibration.ts |
| 4 | GET /api/admin/costs returns a JSON array of { date, model, total_cost_cents } rows grouped by day | VERIFIED | src/app/api/admin/costs/route.ts exists, queries analysis_results, groups by date+gemini_model, returns sorted array, protected by CRON_SECRET auth |

**Score:** 3/4 truths verified (Truth 2 is partial)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sentry.server.config.ts` | Sentry Node.js SDK init | VERIFIED | Imports @sentry/nextjs, calls Sentry.init with dsn, environment, tracesSampleRate, sendDefaultPii |
| `sentry.edge.config.ts` | Sentry Edge SDK init | VERIFIED | Imports @sentry/nextjs, calls Sentry.init |
| `src/instrumentation.ts` | register() + onRequestError hook | VERIFIED | exports register() with conditional dynamic imports; exports onRequestError = Sentry.captureRequestError |
| `src/instrumentation-client.ts` | Client-side Sentry init | VERIFIED | Sentry.init with tracesSampleRate:0; also exports onRouterTransitionStart |
| `next.config.ts` | withSentryConfig wrapper | VERIFIED | Wraps nextConfig with withSentryConfig, uses env vars for org/project |
| `src/lib/logger.ts` | Structured logger with JSON prod + pretty dev | VERIFIED | 75 lines, exports createLogger/logger/Logger, JSON.stringify in production path, pretty format in dev, child() works |
| `src/lib/engine/pipeline.ts` | Pipeline with requestId + Sentry breadcrumbs | VERIFIED | requestId generated via nanoid(12), createLogger with requestId binding, 7 captureException calls, 2 addBreadcrumb calls after each wave |
| `src/lib/engine/gemini.ts` | Gemini with structured logging + Sentry | VERIFIED | createLogger at module level, 2 addBreadcrumb calls, 2 captureException calls, zero console.* |
| `src/lib/engine/deepseek.ts` | DeepSeek with structured logging + Sentry | VERIFIED | createLogger at module level, 2 addBreadcrumb calls, 1 captureException call, zero console.* |
| `src/lib/engine/rules.ts` | Rules with structured logging | VERIFIED | createLogger at module level, 7 log.* calls replacing console.*, 2 captureException calls, zero console.* |
| `src/lib/engine/ml.ts` | ML with structured logging | VERIFIED | createLogger at module level, 6 log.* calls, 2 captureException calls, zero console.* |
| `src/lib/engine/calibration.ts` | Calibration with structured logging | VERIFIED | createLogger at module level, 1 log.error call, 1 captureException call, zero console.* |
| `src/app/api/admin/costs/route.ts` | Admin cost aggregation endpoint | VERIFIED (with caveat) | GET handler exports, queries analysis_results, client-side grouping by date+gemini_model, COALESCE null to 0, ?days param, 30+ lines — but catch block at line 86 still uses console.error instead of structured logger |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/instrumentation.ts` | `sentry.server.config.ts` | dynamic import in register() when NEXT_RUNTIME=nodejs | WIRED | `await import("../sentry.server.config")` at line 5 |
| `src/instrumentation.ts` | `sentry.edge.config.ts` | dynamic import in register() when NEXT_RUNTIME=edge | WIRED | `await import("../sentry.edge.config")` at line 8 |
| `src/lib/engine/pipeline.ts` | `@/lib/logger` | import createLogger, generate requestId, child loggers per stage | WIRED | Line 3: `import { createLogger }`, line 134: `createLogger({ requestId, module: "pipeline" })` |
| `src/lib/engine/gemini.ts` | `@sentry/nextjs` | Sentry.captureException + Sentry.addBreadcrumb | WIRED | 2 captureException + 2 addBreadcrumb calls |
| `src/lib/engine/deepseek.ts` | `@sentry/nextjs` | Sentry.captureException + Sentry.addBreadcrumb | WIRED | 1 captureException + 2 addBreadcrumb calls |
| `src/app/api/admin/costs/route.ts` | `analysis_results` table | Supabase client-side aggregation query | WIRED | `.from("analysis_results").select(...)` at line 50 |
| `src/app/api/admin/costs/route.ts` | `@/lib/cron-auth` | verifyCronAuth Bearer token protection | WIRED | `import { verifyCronAuth }` line 2; called at line 25 |
| `src/app/api/analyze/route.ts` | `runPredictionPipeline` | passes requestId option | WIRED | Line 171: `runPredictionPipeline(validated, { requestId })` |

---

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| OBS-01: Sentry SDK installed and configured | SATISFIED | All 5 Sentry config files exist and are wired |
| OBS-02: Exceptions in engine stages captured in Sentry | SATISFIED | 15 captureException calls across all catch blocks |
| OBS-03: Structured logger with JSON production output | SATISFIED | logger.ts outputs JSON.stringify in production, pretty in dev |
| OBS-04: Stage logs include requestId, stage, duration_ms, cost_cents | BLOCKED | No single stage completion log entry includes all four fields — cost_cents missing from pipeline completion log; stage field inconsistent in module logs |
| OBS-05: Zero console.* in src/lib/engine/ | SATISFIED | Confirmed zero console.* in all 6 engine files |
| OBS-06: GET /api/admin/costs returns daily cost aggregates | SATISFIED | Endpoint exists, functional, protected, correct response shape |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/admin/costs/route.ts` | 86 | `console.error("[admin/costs] Failed to aggregate costs:", error)` | Warning | Inconsistent with the structured logger pattern; leftover from incomplete migration of this file's catch block. Does not block goal (Truth 4 is about endpoint response shape), but violates plan 04-03's intent of clean console.* replacement |

---

## Human Verification Required

### 1. Stage Log Fields in Production

**Test:** Run the app with `NODE_ENV=production`, send a valid POST to `/api/analyze`, and capture server stdout
**Expected:** Each stage emits at least one JSON log line that includes `requestId`, `stage`, `duration_ms`, and `cost_cents` as top-level fields in a single entry
**Why human:** Requires live execution with production env vars to observe actual JSON log output

### 2. Sentry Issue Capture

**Test:** With a valid `NEXT_PUBLIC_SENTRY_DSN` set, trigger a failure in a pipeline stage (e.g., provide invalid Gemini response or disconnect network) and verify issue appears in Sentry dashboard
**Expected:** Issue appears in the Sentry project with correct tags (stage name, requestId)
**Why human:** Requires a Sentry account, real DSN, and live error to verify dashboard capture

---

## Gaps Summary

One gap blocks full goal achievement:

**Truth 2 (structured log fields)** is partial. The stage logs use `requestId` (via binding) and `module` consistently, and individual fields like `duration_ms` and `cost_cents` appear in various log calls. But the goal requires all four fields — `requestId`, `stage`, `duration_ms`, `cost_cents` — in stage completion log entries. Currently:

- The "Pipeline complete" log at `pipeline.ts:334` has `requestId`+`stage`+`duration_ms` but NOT `cost_cents`
- Gemini's stage completion emits a Sentry breadcrumb with `duration_ms`+`cost_cents` but no corresponding `log.info` call — the logger entry for gemini only fires on cost-cap warnings
- DeepSeek's success path logs `duration_ms`+`cost_cents` only for the Gemini-fallback path (`deepseek.ts:524`); the primary success path only emits a Sentry breadcrumb

The fix is targeted: add a `log.info("Stage complete", { stage, duration_ms, cost_cents })` call at the end of each cost-bearing stage's happy path in gemini.ts and deepseek.ts, and add `cost_cents` to the pipeline completion log.

A secondary, lower-severity issue: `src/app/api/admin/costs/route.ts` line 86 has a residual `console.error` in its catch block. This does not block Truth 4 (the endpoint is functional), but is inconsistent with the phase's console.* elimination intent.

---

_Verified: 2026-02-18_
_Verifier: Claude (gsd-verifier)_
