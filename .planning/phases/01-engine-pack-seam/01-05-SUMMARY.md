---
phase: 01-engine-pack-seam
plan: 05
subsystem: engine
tags: [pack-seam, route-dispatch, PACK-01, analyze-endpoint, identity-wrap, in-place-cut]

# Dependency graph
requires:
  - phase: 01-03
    provides: "SOCIALS_PACK + resolvePack(mode) — pack.run = runPredictionPipeline, pack.scoring.run = aggregateScores (identity wraps)"
  - phase: 01-04
    provides: "pack-seam-smoke.test.ts — the BLOCKING D-03 structural gate that guards this rewire against regression"
provides:
  - "Production /api/analyze route reaches orchestration + scoring ONLY via resolvePack(\"socials\").run + .scoring.run — no direct runPredictionPipeline/aggregateScores import remains (PACK-01 on the live route)"
affects: [01-06 (Predict pack mounts the same resolvePack dispatch contract the route now consumes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route call sites dispatch via resolvePack(mode) — the endpoint holds no direct scorer/pipeline import; the socials overall_score math is behind the seam (PACK-01)"
    - "Identity-wrap rewire: pack.run === runPredictionPipeline, pack.scoring.run === aggregateScores — opts object + tAgg/aggregateMs timing + onStageEvent wiring preserved verbatim; behaviour unchanged"

key-files:
  created: []
  modified:
    - src/app/api/analyze/route.ts

key-decisions:
  - "Both live call sites (JSON branch + SSE branch) resolve the pack inline (const pack = resolvePack(\"socials\")) and dispatch run + scoring.run through it; the two-entrypoint structure (Open Q2) is preserved so the route keeps its own inter-call aggregateMs timing."
  - "Two direct imports (runPredictionPipeline, aggregateScores) removed only AFTER both branches were rewired — kept through Task 1 so the SSE branch still type-checked mid-rewire."
  - "Comment mentions of the old fn names (route.ts:326, 395, 808, 915, 1024) left untouched — only import statements and live call expressions changed."

requirements-completed: [PACK-01]

# Metrics
duration: 5min
completed: 2026-06-26
---

# Phase 01 Plan 05: Route Pack-Dispatch Summary

**The production `/api/analyze` endpoint now reaches orchestration and scoring ONLY through `resolvePack("socials")` — both the JSON branch and the SSE branch dispatch via `pack.run(...)` + `pack.scoring.run(...)`, and the two direct `runPredictionPipeline`/`aggregateScores` imports are gone. Identity wraps: same functions, same opts, same `tAgg`/`aggregateMs` timing, same `onStageEvent` wiring — behaviour unchanged (PACK-01 on the live route).**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 1 (`src/app/api/analyze/route.ts`)

## Accomplishments
- **JSON branch (`if (wantsJSON)`):** added `const pack = resolvePack("socials");`; `runPredictionPipeline(validated, {...})` → `pack.run(validated, {...})` (opts `requestId`/`bypassCache`/`userId: user.id`/`audience: activeAudience` verbatim); `aggregateScores(pipelineResult, undefined)` → `pack.scoring.run(pipelineResult, undefined)`; surrounding try/catch orphan cleanup + `tAgg`/`aggregateMs` preserved.
- **SSE branch:** added `const pack = resolvePack("socials");`; `runPredictionPipeline(validated, {...})` (incl. `analysisId` + `onStageEvent`) → `pack.run(...)`; `aggregateScores(pipelineResult, (event) => send("stage", event))` → `pack.scoring.run(...)` with the `tAgg`/`aggregateMs` timing block and `onStageEvent` forwarding intact.
- **Dead imports removed:** `import { runPredictionPipeline } from "@/lib/engine/pipeline"` and `import { aggregateScores } from "@/lib/engine/aggregator"` deleted; replaced by a single `import { resolvePack } from "@/lib/engine/packs"`. No `^import` of either old symbol remains.
- **Gates green:** `tsc --noEmit` clean for `route.ts`; the D-03 BLOCKING `pack-seam-smoke.test.ts` + the `src/app/api/analyze/__tests__` suite pass together (6 files / 51 tests passed, ~12s).

## Task Commits

1. **Task 1 — dispatch JSON branch through pack** - `6eebd112` (refactor)
2. **Task 2 — dispatch SSE branch + drop dead imports** - `5580ef12` (refactor)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP.

## Files Created/Modified
- `src/app/api/analyze/route.ts` - import line 9-10 collapsed to a single `resolvePack` import; JSON branch (~787) + SSE branch (~1000) each resolve the pack inline and dispatch `pack.run` + `pack.scoring.run`. No behaviour change — identity wraps; opts + timing + eventing preserved.

## Decisions Made
- Both branches resolve the pack inline (`const pack = resolvePack("socials")`) rather than hoisting a single shared const — keeps each branch self-contained and the diff local to the two call sites.
- Removed the two dead imports only in Task 2 (after the SSE branch was rewired) so `route.ts` type-checked at every step; Task 1 intentionally kept them since the SSE branch still referenced `runPredictionPipeline`/`aggregateScores`.
- Two-entrypoint structure (Open Q2) preserved — the route still calls `run` then `scoring.run` as separate awaits, retaining its own `aggregateMs` measurement of the inter-call tail.

## Deviations from Plan
None — plan executed exactly as written. (One transient self-correction during Task 1: the dead imports were briefly removed then restored, since the SSE branch still needed them until Task 2; the committed Task 1 diff keeps all three imports as the plan specifies.)

## Issues Encountered
None. tsc clean for `route.ts`; smoke gate + route tests green on first run after the rewire.

## Known Stubs
None. Both call sites bind the REAL pack (`pack.run` = `runPredictionPipeline`, `pack.scoring.run` = `aggregateScores`); no placeholder or mock data on the live path.

## Threat Flags
None. No new trust boundary, endpoint, input, or schema — the client → `/api/analyze` boundary (zod `AnalysisInputSchema` + `user.id` auth) is unchanged; only the internal two-call indirection moved behind `resolvePack`. T-01-RR (refactor regression) is mitigated by the D-03 smoke + route `__tests__` (both green); ENGINE_VERSION stays 3.20.0 (T-01-CP). pipeline SSRF/re-host handling untouched (T-01-ID, accept).

## Self-Check: PASSED

- FOUND: src/app/api/analyze/route.ts (modified)
- FOUND: no `^import` of runPredictionPipeline/aggregateScores in route.ts
- FOUND: pack.scoring.run present in route.ts (both branches)
- FOUND commit: 6eebd112 (Task 1)
- FOUND commit: 5580ef12 (Task 2)

---
*Phase: 01-engine-pack-seam*
*Completed: 2026-06-26*
