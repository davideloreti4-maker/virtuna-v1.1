---
phase: "07"
plan: "02b"
subsystem: engine.wave3.orchestrator
tags:
  - persona
  - wave3
  - orchestrator
  - deepseek
  - promise-allsettled
  - circuit-breaker
  - cost-telemetry

requires:
  - phase: 07-multi-persona-simulation/07-01
    provides: selectPersonaSlots, PersonaSlot, ARCHETYPES, buildPersonaSystemPrompt, buildPersonaUserMessage, PersonaResponseSchema
  - phase: 07-multi-persona-simulation/07-02a
    provides: aggregatePersonaResults helper, PipelineResult.personaBehavioralAggregate field, PredictionResult.persona_behavioral_aggregate, factories default null
provides:
  - Wave3Outcome interface (aggregate + results + warnings)
  - runWave3 widened signature (payload, deepseekResult, wave0Result, creatorContext, onEvent?)
  - 10-call Promise.allSettled orchestration with isCircuitOpen fast-fail
  - Cache-aware cost telemetry (W-4 OUTPUT_PRICE = 0.28/M)
  - Per-persona stage events (wave_3_persona_{archetype}_{slot_type})
  - Pipeline.ts surfaces real personaBehavioralAggregate (no longer placeholder null)
affects: [07-03-aggregator-integration, 07-04-eval-harness-ab]

tech-stack:
  added: []
  patterns:
    - "Promise.allSettled orchestration over 10 parallel deepseek-chat calls (mirrors wave0.ts)"
    - "Cache-aware cost telemetry via usage.prompt_cache_hit_tokens / prompt_cache_miss_tokens (Phase 4 wave0/niche-detector.ts pattern)"
    - "Per-call retry-once on validation-failed error message only — no retry on AbortError or non-validation errors (Pitfall 5)"
    - "vi.hoisted + vi.mock importOriginal — preserves other deepseek.ts exports while overriding isCircuitOpen (W-3)"

key-files:
  created:
    - src/lib/engine/__tests__/wave3.test.ts
  modified:
    - src/lib/engine/wave3.ts
    - src/lib/engine/pipeline.ts
    - src/lib/engine/__tests__/pipeline.test.ts
    - src/lib/engine/__tests__/stubs.test.ts

key-decisions:
  - "B-1 honored — no edit to deepseek.ts; isCircuitOpen already exported at line 736"
  - "W-3 importOriginal pattern in vi.mock('../deepseek') across wave3.test.ts + stubs.test.ts"
  - "W-4 honored — OUTPUT_PRICE = 0.28 / 1_000_000 (grep for 0.42 returns 0)"
  - "Rule 1 deviation: pipeline.test.ts mocks rewired to route Wave 2 vs Wave 3 responses by system-prompt content — old mocks served one shape, broke new orchestrator's schema validation"
  - "Rule 1 deviation: 2 PIPE-01/bypassCache assertions updated from wave3Result=[] to wave3Result.length=10 — Wave 3 now actually fires; old assertions encoded the stub-era contract"
  - "Rule 3 deviation: wave3.test.ts mock refs moved into vi.hoisted() — top-level const refs were captured before vi.mock factory hoist, causing ReferenceError"
  - "aggregator.ts placeholder fields from Plan 07-02a remain unchanged in this plan (signal_availability.personas + behavioralSource swap deferred to Plan 07-03)"

patterns-established:
  - "Wave3Outcome envelope — wave-fan-out orchestrators return { aggregate, results, warnings } so the pipeline can surface aggregate + per-item details + degradation reasons together"
  - "Per-persona stage event naming wave_3_persona_{archetype}_{slot_type} — preserves wave-level stage_name wave_3_personas while distinguishing the 10 parallel calls in event streams"

requirements-completed: [PERSONA-01, PERSONA-02, PERSONA-03, PERSONA-04, PERSONA-05, PERSONA-06, PERSONA-07, PERSONA-10]

duration: 35m
completed: 2026-05-19
---

# Plan 07-02b Summary

Rewrote `src/lib/engine/wave3.ts` from the Phase 3 D-17 no-op stub into a 10-call Promise.allSettled DeepSeek V4 Flash orchestrator with circuit-breaker fast-fail, per-call retry-once on validation failure, cache-aware cost telemetry, and per-persona stage events. Widened `pipeline.ts` to pass `wave0Result` + `creatorContext` into the new signature and surface the real `personaBehavioralAggregate` (replacing the Plan 07-02a placeholder null). Added 12 orchestration tests in `wave3.test.ts` and updated the 2 Wave 3 backward-compat tests in `stubs.test.ts` to the widened signature.

## Performance

- **Duration:** ~35 min single-shot execution (no transport errors encountered)
- **Tasks:** 3
- **Files modified:** 4
- **Files created:** 1 (`wave3.test.ts`)
- **Tests:** 14 new/updated (12 wave3 + 2 stubs) — all pass; 0 regressions across 822-test suite

## Accomplishments

- Rewrote `wave3.ts` (~280 LOC, replacing 25 LOC stub) — 10 parallel `deepseek-chat` calls via `Promise.allSettled`, per-slot stage events, per-call cost telemetry, circuit-breaker fast-fail
- Added `Wave3Outcome` interface — `{ aggregate, results, warnings }` envelope returned by `runWave3`
- Widened `pipeline.ts` Wave 3 call site — passes `wave0Result` (D-11 routing) + `creatorContext` (D-03 loyalist grounding); destructures `Wave3Outcome` into `wave3Result` + `personaBehavioralAggregate` + appended warnings
- Updated pipeline.ts return block to surface real `personaBehavioralAggregate` (no longer placeholder null)
- Added `wave3.test.ts` (12 orchestration tests) covering parallel-call count, D-13 threshold (met + not-met), Promise.allSettled isolation, cost telemetry, event count (22 events), env override, cache prefix stability, retry-once mechanic, AbortError no-retry, W-3 circuit-breaker fast-fail
- Updated `stubs.test.ts` Wave 3 block — 2 widened-signature backward-compat tests on shape + event names
- Rewired `pipeline.test.ts` DeepSeek mocks (3 `beforeEach` blocks) to route Wave 2 reasoning vs Wave 3 persona calls by system-prompt content marker; updated 2 stale `wave3Result.toEqual([])` assertions to `toHaveLength(10)` reflecting the new contract

## Task Commits

1. **Task 1: wave3.ts rewrite** — `6323bb2` (feat) — 10-call Promise.allSettled orchestrator + circuit-breaker fast-fail + retry-once + cost telemetry
2. **Task 2: pipeline.ts widened call site + test mocks updated** — `6db92eb` (feat) — passes wave0Result + creatorContext; surfaces real personaBehavioralAggregate; pipeline.test.ts mocks routed by system-prompt content
3. **Task 3: wave3.test.ts + stubs.test.ts widened-signature backward-compat** — `2131711` (test) — 12 orchestration tests + 2 stubs tests; all 14 pass

## Files Created/Modified

- `src/lib/engine/wave3.ts` — Phase 3 D-17 no-op stub replaced with full Phase 7 orchestrator (~280 LOC; +261 lines, -12 lines)
- `src/lib/engine/pipeline.ts` — Wave 3 call site widened (line 514-526); return block surfaces real `personaBehavioralAggregate` (lines 568-571)
- `src/lib/engine/__tests__/pipeline.test.ts` — 3 `beforeEach` DeepSeek mocks rewired to `mockImplementation` distinguishing Wave 2 reasoning vs Wave 3 persona response by system-prompt content marker; 2 assertions updated to `toHaveLength(10)`
- `src/lib/engine/__tests__/stubs.test.ts` — Wave 3 stub block replaced with widened-signature backward-compat block; `beforeEach` import added
- `src/lib/engine/__tests__/wave3.test.ts` *(new, ~360 LOC, 12 tests)* — full orchestration test surface using `vi.hoisted` + `vi.mock` `importOriginal` for `../deepseek`

## Decisions Made

### Plan-driven decisions (honored as written)

- **B-1 enforcement**: No edit to `src/lib/engine/deepseek.ts`. `isCircuitOpen` already exported at line 736 (`export { DEEPSEEK_MODEL, isCircuitOpen };`). `git diff src/lib/engine/deepseek.ts` returns empty.
- **W-3 importOriginal pattern**: Both `wave3.test.ts` and `stubs.test.ts` use `vi.mock("../deepseek", async (importOriginal) => { const orig = await importOriginal<typeof import("../deepseek")>(); return { ...orig, isCircuitOpen: ... }; })`. This preserves all other deepseek exports while overriding only `isCircuitOpen` — without this pattern, mocking `../deepseek` would break unrelated tests that depend on the full module surface.
- **W-4 OUTPUT_PRICE**: `OUTPUT_PRICE = 0.28 / 1_000_000` in `wave3.ts` (mirrors `wave0/niche-detector.ts:23`). `grep -c "0.42 / 1_000_000" src/lib/engine/wave3.ts` returns `0`.
- **Aggregator integration deferred to Plan 07-03**: This plan does NOT touch `aggregator.ts`'s `availability` block (no `signal_availability.personas` key wiring), does NOT add the optional `behavioralSource` param, does NOT swap the production read of `behavioral_predictions`. The Plan 07-02a placeholder field assignments (`persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null`, `persona_simulation_results: pipelineResult.wave3Result`) remain unchanged — they now receive real (non-default) values when Wave 3 runs.

### Cross-cutting decisions

- **Wave-level cost summing**: `totalCostCents` is incremented inside `callPersona` ONLY on success (not on failure). Wave-level `stage_end.cost_cents` is the sum across the 10 calls (or fewer when some failed before reaching the cost-attribution line). Failed calls still emit per-persona `stage_end` with `ok: false`.
- **Per-persona Sentry tags**: Failures inside `callPersona` capture to Sentry with `{ stage: "wave_3_persona", archetype, slot_type }`. The orchestrator does NOT wrap the outer body in a try/catch — `Promise.allSettled` handles the survivors/rejections split, and the only non-call failure mode (selectPersonaSlots length mismatch — Pitfall 2) is captured separately at the top of `runWave3`.
- **`selectPersonaSlots` fallback**: Both `wave0Result.content_type === null` AND missing primary niche flow through `selectPersonaSlots` (which has its own `?? "other"` fallback). The wave3 orchestrator does not need to pre-handle these — it just passes the nullable slugs in.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] pipeline.test.ts DeepSeek mocks served one response shape for both call types**
- **Found during:** Task 2 verification (`pnpm test` run after pipeline.ts edit)
- **Issue:** Three `beforeEach` blocks in `pipeline.test.ts` set `mockDeepSeekCreate.mockResolvedValue(...)` with `makeDeepSeekReasoning()` content. The new Wave 3 orchestrator validates responses against `PersonaResponseSchema` — DeepSeekReasoning content does NOT satisfy the persona schema → all 10 persona calls fail validation → 11 warnings → happy-path assertion `warnings.toEqual([])` fails.
- **Fix:** Replaced all three `mockResolvedValue` with `mockImplementation(args => ...)` that inspects the system-prompt content for the persona-specific marker text `"TikTok For You Page viewer"`. When the marker is present (Wave 3 call), returns a valid `PersonaResponseSchema`-compatible JSON. Otherwise (Wave 2 reasoning call), returns `makeDeepSeekReasoning()`.
- **Files modified:** `src/lib/engine/__tests__/pipeline.test.ts`
- **Commit:** `6db92eb`

**2. [Rule 1 — Bug] pipeline.test.ts hardcoded `wave3Result.toEqual([])` assertions from stub-era contract**
- **Found during:** Task 2 verification
- **Issue:** Two pre-existing tests (line 527 PIPE-01 "byte-identical backwards compat" + line 643 bypassCache) asserted `expect(result.wave3Result).toEqual([])` — encoding the Phase 3 D-17 stub-era empty-array contract. Phase 7 Plan 07-02b's contract is that Wave 3 actually fires 10 calls, so `wave3Result` now has up to 10 entries.
- **Fix:** Updated both assertions to `toHaveLength(10)` (under the default mock, all 10 calls succeed). Added inline comments documenting the Phase 7 behavior change.
- **Files modified:** `src/lib/engine/__tests__/pipeline.test.ts`
- **Commit:** `6db92eb`

**3. [Rule 3 — Blocking issue] vi.hoisted required for shared mock refs in wave3.test.ts**
- **Found during:** Task 3 first test run (vitest reported `ReferenceError: Cannot access 'mockIsCircuitOpen' before initialization`)
- **Issue:** The plan's literal test scaffolding declared `const mockCreate = vi.fn();` and `const mockIsCircuitOpen = vi.fn(() => false);` at top-level, then referenced them inside `vi.mock("openai", () => ...)` and `vi.mock("../deepseek", ...)` factories. Vitest hoists `vi.mock` calls to the very top of the file (before const declarations), so the factory captures undefined refs.
- **Fix:** Moved the two mock refs into a `vi.hoisted(() => ({ mockCreate: vi.fn(), mockIsCircuitOpen: vi.fn(() => false) }))` block at the top, then `vi.mock` factories close over the hoisted refs. This is the canonical Vitest pattern for sharing mocks with hoisted `vi.mock`.
- **Files modified:** `src/lib/engine/__tests__/wave3.test.ts`
- **Commit:** `2131711`

These deviations don't change scope (still 4 file modifications + 1 new test file as planned) — they're tactical fixes to make the planned test surface load correctly + to align pre-existing pipeline.test.ts with the new Wave 3 contract.

## Verification Results

```bash
$ grep -c "0.42 / 1_000_000" src/lib/engine/wave3.ts
0

$ grep -nE "import \{ isCircuitOpen \}|export interface Wave3Outcome|Promise.allSettled|SUCCESS_THRESHOLD = 7|OUTPUT_PRICE = 0.28 / 1_000_000|wave_3_persona_\${slot.archetype}_\${slot.slot_type}|wave_3_circuit_breaker_open|PER_CALL_TIMEOUT_MS = 15_000|validation failed" src/lib/engine/wave3.ts
21:import { isCircuitOpen } from "./deepseek";
40:const OUTPUT_PRICE = 0.28 / 1_000_000;
42:const PER_CALL_TIMEOUT_MS = 15_000;
43:const SUCCESS_THRESHOLD = 7;
61:export interface Wave3Outcome {
99:  warnings: ["wave_3_circuit_breaker_open"],
133:  const stageName = `wave_3_persona_${slot.archetype}_${slot.slot_type}`;
188:  throw new Error(`validation failed: ${validated.error.message}`);
210:  const isValidation = lastError.message.includes("validation failed");
238:  const settledResults = await Promise.allSettled(slots.map(callPersona));

$ git diff HEAD~3 -- src/lib/engine/deepseek.ts
# (empty — B-1 honored)

$ git diff HEAD~3 -- src/lib/niches/taxonomy.ts
# (empty — Pitfall 7 honored)

$ pnpm test -- run
Test Files  60 passed | 2 skipped (62)
Tests       818 passed | 4 skipped (822)
```

Verbose breakdown:
- `wave3.test.ts`: **12/12 pass** (PERSONA-01, PERSONA-11, D-13 met/not-met, isolation, cost telemetry, event count, env override, cache prefix stability, retry-once, AbortError no-retry, W-3 circuit-breaker fast-fail)
- `stubs.test.ts` Wave 3 block: **2/2 pass** (widened-signature backward-compat: shape + event names)
- `wave3-aggregator.test.ts` (Plan 07-02a carry-over): **11/11 pass**
- `pipeline.test.ts`: **all pass** (3 `beforeEach` mocks updated + 2 assertions rewritten — happy path + PIPE-01 + bypassCache + DeepSeek failure + Gemini failure + onStageEvent + Wave 0 + pre_creator_context all green)
- `aggregator.test.ts` (carry-over): no regressions

## Plan 07-03 Hand-off

This plan delivers the orchestration substrate; Plan 07-03 will:

1. Wire `signal_availability.personas` on the aggregator's `availability` block (currently just the Plan 07-02a placeholder field assignments — the boolean provenance flag is not yet set).
2. Add the optional `behavioralSource` param to `aggregateScores` for the D-14 lightweight A/B eval (substituted run reads `personaBehavioralAggregate` instead of `deepseek.behavioral_predictions`).
3. Promote `SignalAvailability.personas` from optional (`personas?: boolean`) to required (`personas: boolean`) once the aggregator path is exercised.
4. Decide percentile-band sourcing — current `wave3/aggregator.ts` uses a decile-bucketed `percentileLabel`; Phase 10 may revise to corpus-driven percentile bands.

Plan 07-04 owns the eval-harness extension that exercises the new `behavioralSource: "personas"` param.

## Self-Check: PASSED

- src/lib/engine/wave3.ts (modified): FOUND
- src/lib/engine/pipeline.ts (modified): FOUND
- src/lib/engine/__tests__/pipeline.test.ts (modified): FOUND
- src/lib/engine/__tests__/stubs.test.ts (modified): FOUND
- src/lib/engine/__tests__/wave3.test.ts (new): FOUND
- Commit 6323bb2 (Task 1: wave3.ts rewrite): FOUND
- Commit 6db92eb (Task 2: pipeline.ts widened + test mocks): FOUND
- Commit 2131711 (Task 3: wave3.test.ts + stubs.test.ts): FOUND
- 12/12 wave3.test.ts tests pass
- 2/2 stubs.test.ts Wave 3 backward-compat tests pass
- 818/818 total tests pass; 0 regressions across pipeline + aggregator + Wave 0 suites
- `git diff src/lib/engine/deepseek.ts` empty (B-1 honored)
- `git diff src/lib/niches/taxonomy.ts` empty (Pitfall 7 honored)
- `grep -c "0.42 / 1_000_000" src/lib/engine/wave3.ts` returns 0 (W-4 honored)
- `pnpm tsc --noEmit` shows no errors
