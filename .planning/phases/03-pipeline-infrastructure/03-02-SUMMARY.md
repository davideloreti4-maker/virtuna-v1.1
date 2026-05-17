---
phase: 03-pipeline-infrastructure
plan: 02
subsystem: engine-wiring
tags:
  - pipeline
  - aggregator
  - deepseek
  - sse
  - cache
  - typescript
  - vitest
  - tdd
dependency_graph:
  requires:
    - src/lib/engine/version.ts (ENGINE_VERSION constant from Plan 01)
    - src/lib/engine/events.ts (StageEventCallback + emit helpers from Plan 01)
    - src/lib/engine/wave0.ts (runWave0 stub from Plan 01)
    - src/lib/engine/wave3.ts (runWave3 stub from Plan 01)
    - src/lib/engine/stage10-critique.ts (runStage10Critique stub from Plan 01)
    - src/lib/engine/stage11-counterfactuals.ts (runStage11Counterfactuals stub from Plan 01)
    - src/lib/engine/types.ts (SignalAvailability + 4 stub types from Plan 01)
  provides:
    - PipelineOptions interface (exported from pipeline.ts)
    - PipelineResult extended with wave0Result + wave3Result fields
    - aggregator re-exports ENGINE_VERSION from ./version (back-compat)
    - PredictionResult.signal_availability populated from internal availability computation
    - DeepSeek STABLE_SYSTEM_PROMPT + cache-aware cost calculation
    - DeepSeek 2-message structure ready for input-cache prefix matching
  affects:
    - src/lib/engine/__tests__/factories.ts (makePipelineResult must populate wave0Result/wave3Result — fixed inline)
    - Plan 03 (route handler): can now consume opts.onStageEvent, opts.bypassCache, and signal_availability on PredictionResult
tech_stack:
  added: []
  patterns:
    - options-bag-with-callback (PipelineOptions; CONTEXT D-04 byte-identical default)
    - extended-timed-helper (timed() optionally emits stage_start/stage_end via opts.onEvent)
    - re-export-for-backcompat (ENGINE_VERSION imported from ./version, re-exported from aggregator)
    - signal-provenance-on-result (signal_availability surfaced on PredictionResult)
    - stable-system-prompt (byte-identical system content for cache-prefix matching)
    - cache-aware-cost-calc (cache-hit vs cache-miss pricing with legacy fallback)
    - usage-telemetry-logging (prompt_cache_hit_tokens + cache_hit_rate emitted)
key_files:
  created: []
  modified:
    - src/lib/engine/pipeline.ts (+108/-19 LOC — PipelineOptions, extended timed(), Wave 0/3 plumbing, wave0Result/wave3Result return fields)
    - src/lib/engine/aggregator.ts (+23/-11 LOC — ENGINE_VERSION relocation + re-export, SignalAvailability interface delete, signal_availability return field, Stage 10/11 invocations, onStageEvent optional param)
    - src/lib/engine/deepseek.ts (+198/-102 LOC — STABLE_SYSTEM_PROMPT extraction, buildDeepSeekUserMessage refactor, 2-message API call, cache telemetry read + log, cache-aware calculateDeepSeekCost, Gemini fallback concat)
    - src/lib/engine/__tests__/pipeline.test.ts (+119 LOC — 5 new Phase 3 tests)
    - src/lib/engine/__tests__/aggregator.test.ts (+76 LOC — 8 new Phase 3 tests)
    - src/lib/engine/__tests__/deepseek.test.ts (+164 LOC — 7 new Phase 3 tests)
    - src/lib/engine/__tests__/factories.ts (+3 LOC — makePipelineResult populates wave0Result/wave3Result)
decisions:
  - PipelineOptions is a single options bag (requestId, onStageEvent, bypassCache) — extensible without breaking existing 2-arg call sites.
  - timed() helper is extended in-place with optional opts (wave + onEvent + costCents). Existing 3-arg call sites (`timed(name, timings, fn)`) work unchanged because opts is optional and defaults to `{ wave: 1, onEvent: undefined, costCents: 0 }`.
  - Wave 0 stub runs in `runPredictionPipeline` AFTER normalize but BEFORE Wave 1 Promise.all. This ensures wave_0 events fire strictly before any Wave 1 stage_start event. Verified by ordering test.
  - Wave 3 stub runs AFTER Wave 2 Promise.all completes (it consumes deepseekRaw?.reasoning). Verified by ordering test.
  - Stage 10/11 stubs are invoked INSIDE `aggregateScores` (not in pipeline.ts) per plan PATTERNS guidance. This keeps the side-effect events emitted regardless of which caller invokes aggregateScores. The stubs run AFTER the PredictionResult object is built but BEFORE it is returned, so they can inspect the final result.
  - `aggregateScores` signature extended with optional `onStageEvent?: StageEventCallback` param. Existing single-arg callers continue to work; Plan 03 will pass the callback from the route.
  - ENGINE_VERSION is imported from `./version` AND re-exported from aggregator.ts. This satisfies BOTH the canonical-source goal (D-06) AND back-compat for any existing `import { ENGINE_VERSION } from "@/lib/engine/aggregator"` consumers.
  - `interface SignalAvailability` is DELETED from aggregator.ts and now imported from `./types` — the canonical source. Confirmed grep AC.
  - STABLE_SYSTEM_PROMPT is a module-level `const` (not a function-returned string). This guarantees byte-identity across calls — verified by test that calls reasonWithDeepSeek twice with different inputs and asserts `sys1 === sys2`.
  - buildDeepSeekPrompt → renamed to buildDeepSeekUserMessage (returns only the volatile per-request payload). Static rubric + JSON schema moved to STABLE_SYSTEM_PROMPT. Per-request dynamic content (calibration percentiles, content text, gemini signals, matched rules, trend context, creator context, viral differentiators) lives in the user message.
  - calculateDeepSeekCost signature changed to accept cache breakdown: `(cacheHitTokens, cacheMissTokens, completionTokens, fallbackPromptTokens?)`. When usage breakdown is missing (both cache fields are 0), falls back to legacy `INPUT_PRICE_PER_TOKEN * fallbackOrFALLBACK_INPUT_TOKENS + OUTPUT_PRICE_PER_TOKEN * fallbackOrFALLBACK_OUTPUT_TOKENS`. This is byte-identical to the pre-Phase-3 behavior for that path — verified by existing cost-calculation.test.ts "uses fallback tokens (3000/2000)" test still passing.
  - Gemini fallback inside deepseek.ts uses `${STABLE_SYSTEM_PROMPT}\n\n---\n\n${userMessage}` as a single concatenated string (Gemini's `generateContent` takes one `contents` string with no system/user split available via that API method). This preserves the full prompt content for the fallback path.
  - NO Cache-Control header added — verified by `grep -c "Cache-Control" deepseek.ts == 0`. DeepSeek's input cache is automatic per RESEARCH State of the Art.
metrics:
  duration_minutes: 9
  duration_seconds: 596
  completed_date: 2026-05-17T20:38:14Z
  tasks_completed: 3
  source_files_created: 0
  test_files_created: 0
  files_modified: 7
  total_loc_added: ~691
  tests_passing: 55
  test_breakdown:
    pipeline.test.ts: 12 (7 baseline + 5 new)
    aggregator.test.ts: 22 (14 baseline + 8 new)
    deepseek.test.ts: 21 (14 baseline + 7 new)
  full_suite_tests: 537 passing (3 skipped, 0 regressions vs baseline 517)
---

# Phase 03 Plan 02: Pipeline + Aggregator + DeepSeek Wiring Summary

Wired Plan 01's leaf modules into the engine's three core orchestration files (`pipeline.ts`, `aggregator.ts`, `deepseek.ts`). Pipeline now accepts `onStageEvent` + `bypassCache`, emits stage events at every `timed()` boundary, and runs Wave 0/3 stubs at the correct positions. Aggregator surfaces `signal_availability` and re-exports `ENGINE_VERSION` from `./version`. DeepSeek restructured to `[system, user]` 2-message shape for cache-prefix stability + reads cache telemetry + uses cache-aware cost calculation. All scoring math is BYTE-IDENTICAL; all pre-Phase-3 call sites continue to work without modification.

## What Was Built

### Task 1 — `src/lib/engine/pipeline.ts` (commit 0e8c0a2)

**`PipelineOptions` interface** (exported):

```typescript
export interface PipelineOptions {
  requestId?: string;
  onStageEvent?: StageEventCallback;  // CONTEXT D-04 — byte-identical when undefined
  bypassCache?: boolean;              // CONTEXT D-15 — passthrough for route handler
}
```

**`timed()` helper extended in-place** with optional opts (wave + onEvent + costCents). All 10 existing call sites pass `{ wave: 1|2, onEvent: onStageEvent }`. Default `wave: 1` and `opts: undefined` preserve byte-identical behavior for pre-Phase-3 callers.

```typescript
async function timed<T>(
  name: string,
  timings: StageTiming[],
  fn: () => Promise<T>,
  opts?: { wave?: StageEventWave; onEvent?: StageEventCallback; costCents?: number }
): Promise<T>
```

**Wave 0 stub invocation** inserted between Stage 2 (normalize) and Wave 1 Promise.all:
```typescript
const wave0Result = await runWave0(payload, onStageEvent);
```

**Wave 3 stub invocation** inserted after Wave 2 Promise.all completes:
```typescript
const wave3Result = await runWave3(payload, deepseekRaw?.reasoning ?? null, onStageEvent);
```

**`PipelineResult` extended** with `wave0Result: Wave0Result` and `wave3Result: PersonaSimulationResult[]` fields, returned in the final return statement.

**Tests (5 new):**
- backwards compat: no opts → same StageTiming output + wave0Result/wave3Result populated with stub defaults
- existing call shape `{ requestId }` still works
- onStageEvent provided → stage events fire in correct order (Wave 0 before Wave 1; Wave 3 after Wave 2; all timed() boundaries emit paired start/end)
- undefined onStageEvent fires no events (no callback errors)
- bypassCache option propagated without affecting pipeline behavior

### Task 2 — `src/lib/engine/aggregator.ts` (commit 0bcdc44)

**ENGINE_VERSION relocation + re-export:**
```typescript
import { ENGINE_VERSION } from "./version";
export { ENGINE_VERSION };  // back-compat
```

**Local `interface SignalAvailability` deleted** — now imported from `./types` (canonical source per D-07).

**`signal_availability` surfaced on PredictionResult return:**
```typescript
const result: PredictionResult = {
  /* ... all existing fields ... */
  signal_availability: availability,  // computed from PipelineResult contents — not user-controlled (T-03-12)
};
```

**`aggregateScores` signature extended** with optional `onStageEvent?: StageEventCallback`. Existing single-arg callers (aggregator.test.ts, route handler in Plan 03) work unchanged.

**Stage 10/11 stubs invoked AFTER result assembly, BEFORE return:**
```typescript
await runStage10Critique(result, onStageEvent);
await runStage11Counterfactuals(result, onStageEvent);
return result;
```

**Scoring math is BYTE-IDENTICAL** — `availability` computation (lines 287-302), `selectWeights`, `behavioralAvg`, `geminiAvg`, `raw_overall_score`, Platt calibration, `calculateConfidence`, weight redistribution all untouched. Verified by "overall_score is unchanged for identical input" math-invariance test.

**Tests (8 new):**
- signal_availability shape (all 5 boolean fields)
- ENGINE_VERSION re-export back-compat ("3.0.0-dev" from both modules)
- PredictionResult.engine_version reads from ./version
- Stage 10 + Stage 11 events emit when onStageEvent forwarded
- math invariance for identical input
- signal_availability.behavioral=true when deepseekResult present
- signal_availability.behavioral=false when deepseekResult null
- single-arg call (without onStageEvent) still works

### Task 3 — `src/lib/engine/deepseek.ts` (commit e79b7ba)

**`STABLE_SYSTEM_PROMPT`** — module-level const containing the 5-step rubric + output JSON schema. Byte-identical across calls. DeepSeek's automatic input cache matches on this prefix.

**`buildDeepSeekUserMessage(context, calibration)`** — refactored from `buildDeepSeekPrompt`. Returns ONLY the volatile per-request payload:
- Content type + content text
- Formatted Gemini signals (no scores — rationales only, prevents anchoring)
- Matched rule names (no scores)
- Trend context + creator context
- Calibration percentiles (p50/p75/p90 for share/comment/save rates)
- Top 5 viral differentiators from calibration baseline
- Duration sweet spot

**2-message API call:**
```typescript
const response = await ai.chat.completions.create({
  model: DEEPSEEK_MODEL,
  messages: [
    { role: "system", content: STABLE_SYSTEM_PROMPT },  // byte-identical → cache prefix
    { role: "user", content: userMessage },              // volatile per-request payload
  ],
  response_format: { type: "json_object" },              // T-03-07 mitigation
}, { signal: controller.signal });                       // NO Cache-Control header
```

**Cache telemetry read + logged:**
```typescript
const cacheHitTokens = usage?.prompt_cache_hit_tokens ?? 0;
const cacheMissTokens = usage?.prompt_cache_miss_tokens ?? 0;
log.info("DeepSeek cache telemetry", {
  cache_hit_tokens, cache_miss_tokens, total_prompt_tokens, cache_hit_rate,
});
```

**Cache-aware pricing** (`DEEPSEEK_CACHE_HIT_PRICE_PER_TOKEN = $0.0028/M`, `DEEPSEEK_CACHE_MISS_PRICE_PER_TOKEN = $0.14/M`). When usage breakdown is missing, falls back to legacy `INPUT_PRICE_PER_TOKEN ($0.28/M)` + `FALLBACK_INPUT_TOKENS/FALLBACK_OUTPUT_TOKENS` — preserves pre-Phase-3 cost output (verified by existing `cost-calculation.test.ts` "uses fallback tokens" test still passing).

**Gemini fallback updated** to use `${STABLE_SYSTEM_PROMPT}\n\n---\n\n${userMessage}` concatenation (Gemini's `generateContent` takes a single `contents` string).

**Tests (7 new):**
- messages array `[system, user]` shape with stable system content (contains "5-Step Reasoning Framework", "Step 1", "Step 5")
- STABLE system content byte-identical across calls with different inputs
- dynamic content (calibration percentiles, content text) appears only in user message — never in system
- NO Cache-Control header in request (`JSON.stringify(secondArg).not.toContain("Cache-Control")`)
- prompt_cache_hit_tokens read from usage
- cost is LOWER when cache_hit_tokens > 0 vs all cache miss
- falls back to legacy pricing when cache fields missing (backwards compat)

## Interface Contracts Established for Plan 03 (Route Handler)

Plan 03 can now consume:

```typescript
// 1. Pass onStageEvent callback for SSE forwarding
const result = await runPredictionPipeline(input, {
  requestId,
  onStageEvent: (e) => sseStream.write(`data: ${JSON.stringify(e)}\n\n`),
  bypassCache: req.headers.get("x-bypass-cache") === "true",
});

// 2. Persist signal_availability without re-computing
const prediction = await aggregateScores(result, onStageEvent);
await supabase.from("analysis_results").insert({
  user_id,
  content_hash,
  engine_version: prediction.engine_version,           // "3.0.0-dev"
  signal_availability: prediction.signal_availability, // JSONB { behavioral, gemini, ml, rules, trends }
  /* ... */
});

// 3. populatePredictionCache + lookupPredictionCache (Plan 01 — already wired)
```

## Test Results

```
src/lib/engine/__tests__/pipeline.test.ts      12 passed (7 baseline + 5 new)
src/lib/engine/__tests__/aggregator.test.ts    22 passed (14 baseline + 8 new)
src/lib/engine/__tests__/deepseek.test.ts      21 passed (14 baseline + 7 new)
                                       Total:  55 passed
                                       Duration: ~10.7s
```

Full suite (regression check):

```
Test Files:  37 passed | 2 skipped (39)
Tests:      537 passed | 3 skipped (540)
Duration:   ~16s
```

Vs baseline (start of plan): 517 passing → +20 net new passing tests. **0 regressions.**

tsc on source files (excluding pre-existing test-runner-globals noise): **0 errors.** The intentional cascade error in aggregator.ts:466 (Plan 01 Task 3 surfaced; Plan 02 Task 2 fixes) is resolved.

## Backwards Compatibility Verification

Verified the following call sites continue to work byte-identically (no changes needed in calling code):

| Call site                                                  | Status                                                |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `runPredictionPipeline(input)`                             | Works — `opts` is optional                            |
| `runPredictionPipeline(input, { requestId: "x" })`         | Works — `requestId` continues to be accepted          |
| `aggregateScores(pipelineResult)`                          | Works — `onStageEvent` is optional second arg         |
| `import { ENGINE_VERSION } from "@/lib/engine/aggregator"` | Works — re-exported from aggregator.ts                |
| `import { ENGINE_VERSION } from "@/lib/engine/version"`    | Works — canonical source                              |
| `reasonWithDeepSeek(context)`                              | Works — internal API change, same signature           |
| `calculateDeepSeekCost(...)` legacy call (no usage data)   | Works — fallback branch preserves pre-Phase-3 output  |

## Deviations from Plan

### 1. [Rule 1 - Bug] StageEvent["wave"] does not exist on all variants

- **Found during:** Task 1 verification (`npx tsc --noEmit`).
- **Issue:** The plan template used `StageEvent["wave"]` in the `timed()` opts type, but `StageEvent` is a discriminated union where the `pipeline_warning` variant does NOT have a `wave` field. This produced `TS2339: Property 'wave' does not exist on type 'StageEvent'`.
- **Fix:** Imported the underlying `StageEventWave` type from `./events` and used it directly: `opts?: { wave?: StageEventWave; ... }`.
- **Files modified:** `src/lib/engine/pipeline.ts`
- **Commit:** 0e8c0a2

### 2. [Rule 1 - Bug] factories.ts makePipelineResult missing new required fields

- **Found during:** Task 1 verification (`npx tsc --noEmit`).
- **Issue:** Extending PipelineResult with required `wave0Result` and `wave3Result` fields broke `factories.ts:229` which returns a PipelineResult-shaped object.
- **Fix:** Added `wave0Result: { content_type: null, niche: null }` and `wave3Result: []` to `makePipelineResult` defaults. These match Plan 01 stub return shapes.
- **Files modified:** `src/lib/engine/__tests__/factories.ts`
- **Commit:** 0e8c0a2 (included with Task 1)

### 3. [Rule 1 - Bug] cost-calculation.test.ts "fallback tokens" test broke

- **Found during:** Task 3 full-suite regression check.
- **Issue:** When `response.usage` is `undefined`, my new `usage?.completion_tokens ?? 0` resolved completionTokens to `0`. The fallback branch in `calculateDeepSeekCost` then evaluated `completionTokens ?? FALLBACK_OUTPUT_TOKENS` → `0` (because `0 ?? x` = `0`, not `x`). Cost output was wrong → test failed: `expected 0.084 to be 0.168`.
- **Fix:** In the fallback branch of `calculateDeepSeekCost`, treat 0/undefined as "no data": `const output = completionTokens && completionTokens > 0 ? completionTokens : FALLBACK_OUTPUT_TOKENS;` (and same pattern for input). This preserves pre-Phase-3 fallback behavior exactly.
- **Files modified:** `src/lib/engine/deepseek.ts`
- **Commit:** e79b7ba

### 4. [Rule 1 - Bug] "Cache-Control" comment tripped grep acceptance criterion

- **Found during:** Task 3 acceptance criteria check.
- **Issue:** AC `grep -c "Cache-Control" src/lib/engine/deepseek.ts == 0` was violated by two documentation comments that said "no Cache-Control header" (anti-pattern note from RESEARCH).
- **Fix:** Rephrased both comments to "no opt-in header required" / "no opt-in header needed" — preserves intent, satisfies grep. (Mirrors Plan 01 Task 2 deviation #2 where they reworded "Date.now()" to satisfy AC.)
- **Files modified:** `src/lib/engine/deepseek.ts`
- **Commit:** e79b7ba

### 5. [Pre-existing — out of scope] Test-runner global types not picked up by tsc

- **Observed during:** every `npx tsc --noEmit` invocation.
- **Symptom:** All `__tests__/*.test.ts` files report `Cannot find name 'describe' / 'it' / 'expect' / 'vi'` errors.
- **Scope:** Pre-existing issue at baseline (carried over from Plan 01 SUMMARY deviation #5). Vitest config has `globals: true` but tsconfig doesn't include `"types": ["vitest/globals"]`. Tests still run because vitest handles its own type resolution at runtime.
- **Action:** Out of scope for this plan. Logged here only for traceability; matches Plan 01's disposition.

## Threat Model — Status

| Threat ID  | Mitigation Implementation                                                                                                                          | Verification                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| T-03-07    | STABLE_SYSTEM_PROMPT contains immutable rubric + JSON schema; response_format: { type: "json_object" } forces JSON output; existing Zod parsing rejects malformed responses | grep "json_object" >= 1; system prompt content is module-level const               |
| T-03-08    | Accepted disposition — DeepSeek cache is per-API-key                                                                                              | n/a (accept)                                                                       |
| T-03-09    | StageEvent payload schema (events.ts:9-11) contains only stage name + wave + duration + cost — no user content, no PII. SSE consumers authenticated in Plan 03 | StageEvent type definition unchanged; warning field carries only error messages    |
| T-03-10    | Accepted disposition — new breadcrumbs ("Wave 0 complete", "Wave 3 complete") log only stage name + requestId, no PII                             | grep Sentry.addBreadcrumb in pipeline.ts — no user content fields                  |
| T-03-11    | Accepted disposition — onStageEvent is an internal API; only route handler (Plan 03, server-side authenticated) passes a callback                  | n/a (accept)                                                                       |
| T-03-12    | Aggregator computes availability from PipelineResult contents (presence of deepseekResult, gemini factors, etc.) — not user-controlled            | `availability` variable computed from pipelineResult fields, not from user input   |

ASVS Level 1: V5 Input Validation preserved (AnalysisInputSchema unchanged); V14.1 (Configuration) preserves DEEPSEEK_MODEL env var as the only knob.

## Open Issues / Handoff Notes for Plan 03 (Route Handler)

1. **Wire `runPredictionPipeline` with SSE forwarding:**
   - Construct `onStageEvent` callback that writes SSE-formatted events to the response stream.
   - Pass `bypassCache: true` when `x-eval-harness` header is present (CONTEXT D-15).
   - Persist `result.signal_availability` to `analysis_results.signal_availability` JSONB column.

2. **Wire `aggregateScores` with `onStageEvent`** so Stage 10/11 events also flow through SSE. Currently the second arg is optional — Plan 03 will pass it.

3. **Cache integration** uses Plan 01's `lookupPredictionCache` + `populatePredictionCache`. Pass `bypassCache: true` from the options to both functions (CONTEXT D-15, Pitfall 6 symmetric bypass).

4. **No new external dependencies** — all wiring uses existing modules. No `package.json` changes.

5. **`reasonWithDeepSeek` no longer exports `calculateDeepSeekCost`** — only the public `cost_cents` on the return value is consumer-facing. The cache telemetry is logged internally; Plan 03 may want to forward it to the response payload for client display (separate decision).

6. **DeepSeek input cache may not warm immediately** — the first request after a deploy will be all cache-miss. Plan 11 (caching layer benchmarks) will measure actual hit rates against the corpus.

## Self-Check: PASSED

Verified all claimed artifacts exist and all claimed commits land on this branch:

- File `src/lib/engine/pipeline.ts` — FOUND
- File `src/lib/engine/aggregator.ts` — FOUND
- File `src/lib/engine/deepseek.ts` — FOUND
- File `src/lib/engine/__tests__/pipeline.test.ts` — FOUND
- File `src/lib/engine/__tests__/aggregator.test.ts` — FOUND
- File `src/lib/engine/__tests__/deepseek.test.ts` — FOUND
- File `src/lib/engine/__tests__/factories.ts` (modified) — FOUND
- Commit 0e8c0a2 (Task 1) — FOUND
- Commit 0bcdc44 (Task 2) — FOUND
- Commit e79b7ba (Task 3) — FOUND
