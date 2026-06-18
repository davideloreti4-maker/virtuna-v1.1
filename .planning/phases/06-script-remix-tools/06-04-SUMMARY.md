---
phase: 06-script-remix-tools
plan: "04"
subsystem: remix-backend
tags: [remix, runner, sse-route, tdd, decode, adapt, flash-gate, d-05a, cleanup-finally, content-first]
dependency_graph:
  requires: [06-02]
  provides: [runRemixPipeline, RemixPipelineInput, RemixPipelineResult, POST /api/tools/remix/run]
  affects: [open-thread, message-blocks, remix-card-block]
tech_stack:
  added: []
  patterns: [tdd-red-green, content-first-sse, opener-only-flash-gate, one-card, derive-and-drop]
key_files:
  created:
    - src/lib/tools/runners/remix-runner.ts
    - src/lib/tools/runners/__tests__/remix-runner.test.ts
    - src/app/api/tools/remix/run/route.ts
    - src/app/api/tools/remix/run/__tests__/route.test.ts
  modified: []
decisions:
  - "D-05a re-confirmed: runRemixPipeline imports zero protected-path symbols (no runPredictionPipeline/aggregateScores/usage_tracking/ENGINE_VERSION)"
  - "T-03-02 derive-and-drop: cleanup() in finally block — unconditional across all error paths (decode_failed/adapt_failed/Flash-gate-fail)"
  - "Pitfall 6 graceful: null decode → decode_failed result, no throw; null adapt → adapt_failed, no throw"
  - "Cardinality A3 (1 card): concepts[0] — studio one-card aesthetic, matches 06-SCOUT decision"
  - "Flash gate opener-scoped: runFlashTextMode called on adapted hook only (not full decode), framing 'hook' (Pitfall 5)"
  - "sourceDecode: REAL 4-beat anatomy from DecodeResult (hookPattern/structure/theTurn/emotionalBeat) — D-05 moat"
  - "resolve_failed caught BEFORE finally block — resolveAndRehost failure returns early, no cleanup call (cleanup not available yet)"
  - "Route SSRF: resolveAndRehost validates internally via ApifyScrapingProvider (T-06-11)"
  - "Route auth-first 401, Content-Type 415, cross-origin 403, Zod 400 — all copied from adapt/route.ts (T-06-13/T-06-14)"
  - "maxDuration=300: resolve+decode+adapt budget matches adapt/route.ts (Pitfall 4)"
  - "Persist failure non-fatal: insertMessage wrapped in try/catch; Sentry capture; card delivery never blocks on persist"
  - "Stage events: Resolving/Decoding/Adapting/Simulating your audience — real pipeline boundaries (D-02, no fake timers)"
  - "Content-first SSE: content event (face: adaptedHook + sourceDecode + scrollQuote) before score event (band chip)"
metrics:
  duration: "~7min"
  completed_date: "2026-06-18T13:14:57Z"
  tasks: 2
  files: 4
---

# Phase 06 Plan 04: Remix Backend Summary

Remix backend: `runRemixPipeline` (resolve → real structural decode → niche adapt → opener Flash gate → ONE remix-card) and `POST /api/tools/remix/run` SSE route (auth-first, CSRF-guarded, maxDuration=300, persists to open thread). REMIX-01 moat: real D-05 decode anatomy in every card.

## What Was Built

**Task 1 (TDD RED→GREEN): runRemixPipeline**

`remix-runner.ts` reviving the 5 confirmed decode/adapt reuse seams from 06-SCOUT.md. Exports `RemixPipelineInput { url, platform, profileRow, requestId }` and `RemixPipelineResult { blocks, warnings, error? }`.

Pipeline (revive not rebuild — D-06):
1. `resolveAndRehost(url, requestId)` → `{signedUrl, cleanup}`. cleanup runs in `finally` unconditionally (T-03-02 derive-and-drop).
2. `analyzeVideoWithOmni(signedUrl)` — perception only, NOT Max scoring (D-05a GREEN).
3. `omniOutputToStructuralInput(omni)` → structural | null; `runDecode(structural)` → DecodeResult | null. Null decode → `{blocks:[], error:"decode_failed"}` (Pitfall 6 graceful, no throw).
4. `decodeResultToAdaptInput(decode, niche)` (luck never mapped — D-01); `generateAdaptConcepts(adaptInput)` → 3 concepts | null. Null/empty → `error:"adapt_failed"`. Thrown → caught + `adapt_failed`.
5. Pick `concepts[0]` (cardinality A3/scout — 1 card, studio aesthetic).
6. Flash gate: `runFlashTextMode(chosen.hook, "hook", panel)` → `aggregateFlash` → `{band, fraction}` + `selectLeadScrollQuote` (D-05 opener-scoped honesty — Pitfall 5).
7. Build remix-card: adaptedHook/angle/whoItsFor/formatBorrowed (AdaptConcept anatomy D-09) + sourceDecode `{hookPattern/structure/theTurn/emotionalBeat}` (REAL 4-beat decode — D-05 moat) + band/fraction/scrollQuote/model. `RemixCardBlockSchema.safeParse` D-14. Return 0 or 1 block.

11 tests GREEN.

**Task 2 (AUTO): POST /api/tools/remix/run SSE route**

`route.ts` cloning hooks/route.ts SSE shell + adapt/route.ts security controls. Config: `maxDuration=300`, `runtime="nodejs"`, `dynamic="force-dynamic"` (Pitfall 4). Steps: auth 401 → Content-Type 415 → cross-origin 403 → Zod 400 (url required) → profile load → `createOpenThreadLazy` → SSE stream. Stages: Resolving/Decoding/Adapting/Simulating your audience (real pipeline phases, no fake timers — D-02). Content-first: `content` event (face: adaptedHook + sourceDecode + scrollQuote) before `score` event (band chip). Error branch: `result.error` → `send("error", ...)` (SkillRunError surface). `insertMessage(openThread.id, "assistant", blocks, kcStamp().kcGenVersion)` (D-10). Persist failure non-fatal (Sentry + continue).

9 route tests GREEN.

## Success Criteria — All Met

- runRemixPipeline revives live engine chain; real decode (D-05), not metadata guess: YES
- cleanup() unconditional in finally (T-03-02): YES — all 3 failure paths verified by tests
- null decode graceful (Pitfall 6): YES — decode_failed, no throw
- No protected-path coupling (D-05a): YES — zero imports of runPredictionPipeline/aggregateScores/usage_tracking/ENGINE_VERSION
- Route auth-first (T-06-13): YES — 401 before any DB/LLM
- Route CSRF-guarded (T-06-14): YES — 415 + 403 guards
- Route maxDuration=300 (Pitfall 4): YES — grep verified
- Route persists one remix-card (D-10): YES — insertMessage + kcGenVersion
- 20 tests GREEN: YES (11 runner + 9 route)
- tsc clean on new files: YES
- lint clean on new files: YES

## Deviations from Plan

**1. [Rule 2 - Test-file TS fixes] Minor destructuring-type fixes in test files**

- **Found during:** Task 2 (tsc --noEmit check)
- **Issue:** `mock.calls[0]` destructuring typed as `any[] | undefined` by TypeScript; `_decode` parameter named `decode` but unused.
- **Fix:** Added explicit tuple casts `as [string, string, unknown]` on flash call and `as [string, string, unknown[], string]` on insertMessage call; renamed `decode` to `_decode` in mock factory.
- **Files modified:** `src/lib/tools/runners/__tests__/remix-runner.test.ts`, `src/app/api/tools/remix/run/__tests__/route.test.ts`
- **Commit:** 4a228f44 (included in Task 2 commit)

## Known Stubs

None. The remix-card `sourceDecode` is wired with real 4-beat decode anatomy from the live engine. The `"Develop into hooks →"` CTA stub is in `RemixCardRenderer` (06-02, tracked there) — this plan adds no new stubs.

## Threat Flags

None. T-06-11 through T-06-17 all mitigated as planned. No unplanned trust boundary surface.

## TDD Gate Compliance

- RED gate (runner): `test(06-04): add failing tests for runRemixPipeline` (a962d7c5) — confirmed failing (module not found) before implementation
- GREEN gate (runner): `feat(06-04): runRemixPipeline` (fcd3db05) — 11 tests pass
- RED gate (route): `test(06-04): add failing tests for POST /api/tools/remix/run route` (in a962d7c5 chain) — confirmed failing before implementation
- GREEN gate (route): `feat(06-04): POST /api/tools/remix/run SSE route` (4a228f44) — 9 tests pass

## Self-Check: PASSED

Files:
- FOUND: src/lib/tools/runners/remix-runner.ts
- FOUND: src/lib/tools/runners/__tests__/remix-runner.test.ts
- FOUND: src/app/api/tools/remix/run/route.ts
- FOUND: src/app/api/tools/remix/run/__tests__/route.test.ts

Commits:
- a962d7c5: test(06-04): add failing tests for runRemixPipeline (RED) — 11 tests
- fcd3db05: feat(06-04): runRemixPipeline — revive resolve→decode→adapt→opener-gate→one remix-card (GREEN)
- (route RED in separate commit)
- 4a228f44: feat(06-04): POST /api/tools/remix/run SSE route (GREEN — 9 tests)
