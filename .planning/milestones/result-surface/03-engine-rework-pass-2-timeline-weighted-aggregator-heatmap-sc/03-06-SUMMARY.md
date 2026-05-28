---
phase: "03"
plan: "06"
subsystem: engine/wave3/pass2
tags: [phase-3, pass2, thinking-mode, orchestrator, qwen, tdd]
dependency_graph:
  requires: ["03-01", "03-02", "03-04"]
  provides: ["runWave3Pass2", "Wave3Pass2Outcome", "STABLE_PASS2_SYSTEM_PROMPT", "buildPass2UserContent", "Pass2ResponseSchema", "DemographicContext"]
  affects: ["src/lib/engine/wave3/pass2.ts", "src/lib/engine/wave3/persona-prompts-pass2.ts", "src/lib/engine/__tests__/pass2.test.ts"]
tech_stack:
  added: ["persona-prompts-pass2.ts", "pass2.ts (full implementation replacing stub)"]
  patterns: ["Promise.allSettled 10-parallel", "retry-once on Zod failure", "DashScope thinking-mode enable_thinking+thinking_budget", "D-23 telemetry", "D-24 cost ceiling", "stage events per persona + wave level"]
key_files:
  created:
    - src/lib/engine/wave3/persona-prompts-pass2.ts
  modified:
    - src/lib/engine/wave3/pass2.ts
    - src/lib/engine/__tests__/pass2.test.ts
decisions:
  - "@ts-expect-error on individual property assignments (not as never inline) to satisfy both grep criteria and tsc-green"
  - "Test 9 (segment mismatch D-06) tested via all-10-fail scenario (concurrent execution prevents deterministic per-slot call ordering)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-27"
  tasks: 2
  files_created: 1
  files_modified: 2
---

# Phase 03 Plan 06: Pass 2 Orchestrator + Prompt Builders Summary

Pass 2 per-persona timeline orchestrator: 10 parallel qwen3.6-plus thinking-mode calls producing per-segment attention [0,1] with Zod validation, D-06 quality guards, D-23 latency/cost telemetry, D-24 cost ceiling.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | persona-prompts-pass2.ts | f1f0315 | src/lib/engine/wave3/persona-prompts-pass2.ts (created) |
| 2 | pass2.ts orchestrator + tests | 9f895df | src/lib/engine/wave3/pass2.ts, src/lib/engine/__tests__/pass2.test.ts |

## runWave3Pass2 Signature

```typescript
export async function runWave3Pass2(
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
  pass1Results: PersonaSimulationResult[],
  demo?: DemographicContext,
  onEvent?: StageEventCallback,
): Promise<Wave3Pass2Outcome>
```

```typescript
export interface Wave3Pass2Outcome {
  pass2Results: Pass2PersonaResult[];
  warnings: string[];
  cost_cents: number;
  pass2_success_count: number;
  pass2_aggregate_built: boolean;
}
```

## Test Results (15 tests — all passing)

| # | Test Name | Status |
|---|-----------|--------|
| 1 | fires exactly 10 parallel calls with enable_thinking: true | PASS |
| 2 | all-succeed → 10 Pass2PersonaResult entries with full shape | PASS |
| 3 | 7/10 succeed → pass2_aggregate_built=true + 3 failure warnings | PASS |
| 4 | 5/10 succeed → pass2_aggregate_built=false | PASS |
| 5 | Promise.allSettled isolation — 10 attempted even with rejections | PASS |
| 6 | cost telemetry: wave_3_pass2 stage_end carries cost_cents >= 0 | PASS |
| 7 | events: 22 stage events when all 10 succeed (10 per-persona pairs + 1 wave pair) | PASS |
| 8 | Zod validation failure → retry-once → 11 total API calls | PASS |
| 9 | segment count mismatch validation → persona dropped from aggregate (D-06) | PASS |
| 10 | AbortError → no retry → slot fails after first attempt | PASS |
| 11 | thinking_budget: 8000 present in every API call argument | PASS |
| 12 | D-23 telemetry: pass2_latency_ms + pass2_cost_cents logged per persona | PASS |
| 13 | buildPass2UserContent with all-null keyframeUris → length 1, type "text" | PASS |
| 14 | buildPass2UserContent with 3 non-null interleaved → 3 image_url items + 1 text | PASS |
| 15 | STABLE_PASS2_SYSTEM_PROMPT contains literal "EXACTLY" | PASS |

## D-23 Log Output Shape

```json
{
  "level": "info",
  "msg": "pass2 persona complete",
  "archetype": "tough_crowd",
  "persona_id": "fyp-1-tough_crowd-beauty",
  "pass2_latency_ms": 1243,
  "pass2_cost_cents": 0.000312
}
```

## D-24 Cost Ceiling Code Path

Triggered when `totalCostCents > 50` (0.50 dollars per analysis):

```typescript
if (totalCostCents > COST_ALERT_THRESHOLD_CENTS) {
  log.error("pass2 cost ceiling exceeded", {
    total_cost_cents: totalCostCents,
    threshold_cents: 50,
  });
  Sentry.captureException(new Error("pass2_cost_ceiling"), {
    tags: { stage: "wave_3_pass2" },
  });
}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @ts-expect-error placement for DashScope extensions**
- **Found during:** Task 2
- **Issue:** Using `as never` on the entire call object literal suppresses errors for all fields — `@ts-expect-error` on individual lines inside would become "unused" directives, causing TS2578 errors.
- **Fix:** Assigned `enable_thinking` and `thinking_budget` as separate property assignments on a pre-built `callParams` object, then applied `@ts-expect-error` before each assignment. The final `callParams as never` cast is the runtime-safe cast for `create()`.
- **Files modified:** src/lib/engine/wave3/pass2.ts
- **Commit:** 9f895df

**2. [Rule 1 - Bug] Test 9 (segment mismatch) concurrency ordering**
- **Found during:** Task 2 test implementation
- **Issue:** Promise.allSettled runs all 10 slots concurrently; mock call ordering is non-deterministic. Setting `callCount <= 2` to return mismatches didn't reliably target a single slot's both attempts.
- **Fix:** Changed Test 9 to make ALL calls return mismatch → verifies every persona drops (pass2_success_count=0), retry-once fires (20 total calls), and D-06 warning is emitted.
- **Files modified:** src/lib/engine/__tests__/pass2.test.ts
- **Commit:** 9f895df

## Known Stubs

None. Both source files are fully implemented. The stub in pass2.ts has been replaced.

## Threat Surface Scan

No new network endpoints or auth paths introduced. All threat mitigations from plan's threat register are implemented:
- T-03-06-01: `z.number().min(0).max(1)` on attention field in Pass2ResponseSchema
- T-03-06-02: explicit `segment_reactions.length !== segments.length` check after Zod parse
- T-03-06-04: `thinking_budget: 8000` caps tokens; D-24 alert at 50 cents fires
- T-03-06-05: Pass 1 verdict passed as data-only text block (not system role)

## Self-Check: PASSED

- FOUND: src/lib/engine/wave3/persona-prompts-pass2.ts
- FOUND: src/lib/engine/wave3/pass2.ts
- FOUND: src/lib/engine/__tests__/pass2.test.ts
- FOUND: commit f1f0315 (Task 1: persona-prompts-pass2.ts)
- FOUND: commit 9f895df (Task 2: pass2.ts + tests)
- FOUND: commit 1d4a110 (fix: TSC type cast for Test 12)
- TSC: no errors in pass2.ts or persona-prompts-pass2.ts
- Tests: 15/15 passing
