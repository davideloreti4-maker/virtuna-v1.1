---
phase: 03-pipeline-infrastructure
plan: 01
subsystem: engine-pipeline
tags:
  - pipeline
  - cache
  - typescript
  - vitest
  - tdd
dependency_graph:
  requires: []
  provides:
    - src/lib/engine/version.ts (ENGINE_VERSION constant)
    - src/lib/engine/events.ts (StageEvent union + emit helpers)
    - src/lib/engine/types.ts (SignalAvailability + 4 stub return types + signal_availability field)
    - src/lib/engine/wave0.ts (runWave0 no-op)
    - src/lib/engine/wave3.ts (runWave3 no-op)
    - src/lib/engine/stage10-critique.ts (runStage10Critique no-op)
    - src/lib/engine/stage11-counterfactuals.ts (runStage11Counterfactuals no-op)
    - src/lib/engine/cache/prediction-cache.ts (computeContentHash + lookup/populate L1+L2)
  affects:
    - src/lib/engine/aggregator.ts (PLAN 02 Task 2 will fill the new signal_availability field — intentional cascade documented below)
tech_stack:
  added: []
  patterns:
    - leaf-module-constant (version.ts, zero project imports — RESEARCH Pitfall 8)
    - discriminated-union-events (StageEvent type narrowing on `type` field — CONTEXT D-02)
    - performance-now-timing (never Date.now — drift-free duration measurement)
    - two-tier-cache (L1 in-memory + L2 Supabase analysis_results — RESEARCH Pattern 2)
    - bypassCache-symmetry (bypass=true skips BOTH read and write — Pitfall 6)
    - user-id-scoped-cache-key (T-03-01 mitigation, ASVS V4)
    - typed-stub-return-shapes (no-op stubs preserve return type for future phase swaps)
key_files:
  created:
    - src/lib/engine/version.ts (6 LOC)
    - src/lib/engine/events.ts (49 LOC)
    - src/lib/engine/wave0.ts (26 LOC)
    - src/lib/engine/wave3.ts (24 LOC)
    - src/lib/engine/stage10-critique.ts (23 LOC)
    - src/lib/engine/stage11-counterfactuals.ts (23 LOC)
    - src/lib/engine/cache/prediction-cache.ts (148 LOC)
    - src/lib/engine/__tests__/version.test.ts (20 LOC, 3 tests)
    - src/lib/engine/__tests__/events.test.ts (61 LOC, 5 tests)
    - src/lib/engine/__tests__/stubs.test.ts (104 LOC, 9 tests)
    - src/lib/engine/__tests__/prediction-cache.test.ts (163 LOC, 16 tests)
  modified:
    - src/lib/engine/types.ts (+48 LOC — 5 new interfaces + 1 required field on PredictionResult)
decisions:
  - ENGINE_VERSION = "3.0.0-dev" lives at src/lib/engine/version.ts as a zero-import leaf module (avoids circular imports per RESEARCH Pitfall 8). Phase 12 flips to "3.0.0" with a one-line edit.
  - StageEvent uses a discriminated union on `type` (stage_start | stage_end | pipeline_warning) so consumers narrow via switch. Wave field accepts 0|1|2|3|"aggregator"|"post" exactly per CONTEXT D-02.
  - emitStageStart/emitStageEnd helpers use performance.now() exclusively — never Date.now() — so per-stage durations cannot drift if the wall clock jumps.
  - PredictionResult.signal_availability is REQUIRED (not optional). Aggregator already computes it; making it required forces callers to surface provenance. Cascade: aggregator.ts now has a typecheck error that PLAN 02 Task 2 will fix by populating the field (intentional per plan design).
  - computeContentHash hashes buffer bytes for video_upload, trimmed URL for tiktok_url, trimmed content_text for text — deterministic SHA-256 (64-char hex) per CONTEXT D-10.
  - cacheKey is `${contentHash}::${ENGINE_VERSION}::${userId}` — user_id in the key is the structural defense against cross-tenant cache leakage (T-03-01).
  - Even with service-role Supabase client, the L2 SELECT chain includes `.eq("user_id", userId)` so the row never crosses tenant boundaries (ASVS V4 — verified by grep AC).
  - bypassCache=true is symmetric: skips L1 read AND skips L1 write (Pitfall 6). Tests cover both paths.
  - Unused stub params are prefixed with `_` (`_payload`, `_aggregateResult`, `_deepseekResult`) to satisfy tsconfig `noUnusedParameters: true` strict mode. Plan template did not use the prefix; this is a Rule 1 inline fix.
metrics:
  duration_minutes: 8
  duration_seconds: 484
  completed_date: 2026-05-17T20:13:20Z
  tasks_completed: 5
  source_files_created: 7
  test_files_created: 4
  files_modified: 1
  total_loc_added: ~647
  tests_passing: 33
  test_breakdown:
    version.test.ts: 3
    events.test.ts: 5
    stubs.test.ts: 9
    prediction-cache.test.ts: 16
---

# Phase 03 Plan 01: Pipeline Infrastructure — Wave 0 Leaf Modules Summary

Established 8 new leaf modules (version constant, StageEvent union, 4 wave-stage stubs, types extensions, two-tier prediction cache) with 33 passing TDD tests so PLAN 02 (pipeline.ts orchestrator edits) can import stable contracts without circular-import risk.

## What Was Built

### Task 1 — `src/lib/engine/version.ts` (commit 7d6b575)

Single-source-of-truth constant module:

```ts
export const ENGINE_VERSION = "3.0.0-dev";
```

Zero project-local imports — strictly a leaf module per RESEARCH Pitfall 8. Phase 12's acceptance gate flips `"3.0.0-dev"` → `"3.0.0"` with one line.

**Tests (3):** literal value, type assertion, `-dev` suffix.

### Task 2 — `src/lib/engine/events.ts` (commit 20c7b3b)

Discriminated-union event type + drift-free emit helpers:

```ts
export type StageEvent =
  | { type: "stage_start"; stage: string; wave: StageEventWave; timestamp_ms: number }
  | { type: "stage_end"; stage: string; wave: StageEventWave; duration_ms: number; cost_cents: number; ok: boolean; warning?: string }
  | { type: "pipeline_warning"; message: string; stage?: string };

export function emitStageStart(onEvent, stage, wave): number  // returns performance.now()
export function emitStageEnd(onEvent, stage, wave, startTs, opts): void
```

Wave field is `0 | 1 | 2 | 3 | "aggregator" | "post"` exactly per CONTEXT D-02. Helpers use `performance.now()` exclusively. Undefined callback is a no-op.

**Tests (5):** stage_start emission, stage_end duration computation, cost_cents/ok defaults, override path, undefined callback safety, all 6 wave values accepted.

### Task 3 — `src/lib/engine/types.ts` extensions (commit dd1289d)

Five new exported interfaces:

- `SignalAvailability { behavioral, gemini, ml, rules, trends: boolean }` — surfaced from aggregator
- `Wave0Result { content_type, niche }` — Phase 4 fills
- `PersonaSimulationResult` (6 fields) — Phase 7 fills
- `CritiqueResult` — Phase 9 fills
- `CounterfactualResult` — Phase 9 fills

`PredictionResult` gains a **required** field:

```ts
signal_availability: SignalAvailability;
```

### Task 4 — Wave/Stage no-op stubs (commit 16c7226)

Four leaf modules importing only `./types` + `./events`:

| Stub | Stage names emitted | Wave | Returns |
|------|---------------------|------|---------|
| `runWave0` | `wave_0_content_type`, `wave_0_niche_detector` | `0` | `{ content_type: null, niche: null }` |
| `runWave3` | `wave_3_personas` | `3` | `[]` |
| `runStage10Critique` | `stage_10_critique` | `"post"` | `null` |
| `runStage11Counterfactuals` | `stage_11_counterfactuals` | `"post"` | `null` |

Each stub:
- accepts an optional `onEvent` callback (undefined-safe)
- emits paired start/end events with `cost_cents: 0, ok: true`
- never throws (Phase 4/7/9 contract is null-return-on-failure)

**Tests (9):** return shape per stub + event sequencing per stub + undefined-callback safety for Wave 0.

### Task 5 — `src/lib/engine/cache/prediction-cache.ts` (commit b7b7195)

Two-tier cache + deterministic content hash:

```ts
export function computeContentHash(input, videoBuffer?): string         // SHA-256 hex
export function cacheKey(contentHash, userId): string                   // `${hash}::${ver}::${uid}`
export async function lookupPredictionCache(hash, userId, opts?): PredictionResult | null
export function populatePredictionCache(hash, userId, result, opts?): void
export function rowToPredictionResult(row): PredictionResult            // L2 hydration
export function __resetL1(): void                                       // test-only
```

- L1 = in-memory `createCache<PredictionResult>(24h TTL)` per CONTEXT D-09.
- L2 = Supabase `analysis_results` SELECT scoped by `user_id` + `content_hash` + `engine_version` + `created_at > 24h-cutoff`.
- ASVS V4: `user_id` WHERE clause is present even though we use the service-role client (T-03-01 mitigation, verified by `grep -c '.eq("user_id", userId)' >= 1`).
- `bypassCache: true` short-circuits both lookup AND populate paths (Pitfall 6 symmetric bypass).

**Tests (16):** content hash determinism across 3 input modes, 64-char hex output, different inputs → different hashes, cacheKey composition, L1 miss + L2 miss → null, L1 hit (no Supabase call), L1 miss → L2 hydration, second-call uses L1 not Supabase, bypass read, bypass write, L2 error → null, engine version in key, version bump invalidation by key construction.

## Interface Contracts Established for PLAN 02

PLAN 02 (pipeline.ts orchestrator + aggregator.ts update + route.ts SSE wiring) can now import without circular risk:

```ts
import { ENGINE_VERSION }       from "./version";        // leaf — no cycle
import { type StageEventCallback, emitStageStart, emitStageEnd } from "./events";
import { runWave0 }             from "./wave0";
import { runWave3 }             from "./wave3";
import { runStage10Critique }   from "./stage10-critique";
import { runStage11Counterfactuals } from "./stage11-counterfactuals";
import { computeContentHash, lookupPredictionCache, populatePredictionCache } from "./cache/prediction-cache";
import { type SignalAvailability, type Wave0Result, ... } from "./types";
```

The aggregator re-export pattern that PLAN 02 must implement:

```ts
// In src/lib/engine/aggregator.ts (PLAN 02 Task 2):
import { ENGINE_VERSION } from "./version";
export { ENGINE_VERSION };  // backwards-compat re-export so existing callers continue to work
```

## Test Results

```
src/lib/engine/__tests__/version.test.ts          3 passed
src/lib/engine/__tests__/events.test.ts           5 passed
src/lib/engine/__tests__/stubs.test.ts            9 passed
src/lib/engine/__tests__/prediction-cache.test.ts 16 passed
                                            Total: 33 passing
                                            Duration: 350ms
```

All 4 new test files invoked together via the success-criteria command exit 0:

```bash
npm test -- src/lib/engine/__tests__/version.test.ts \
            src/lib/engine/__tests__/events.test.ts \
            src/lib/engine/__tests__/stubs.test.ts \
            src/lib/engine/__tests__/prediction-cache.test.ts
```

## Deviations from Plan

### 1. [Rule 1 - Bug] Unused-parameter strict-mode compliance in stubs

- **Found during:** Task 4 (after the plan-template stubs were written).
- **Issue:** tsconfig sets `noUnusedParameters: true` (strict). The plan code template used `payload`, `aggregateResult`, `deepseekResult` directly — these would trip TS6133 because the no-op bodies don't reference them.
- **Fix:** Prefixed with `_` (project convention, mirrors `score-to-bucket.ts:14` `_niche: Niche`). Parameter types unchanged; callers don't care about parameter names.
- **Files modified:** `src/lib/engine/wave0.ts`, `wave3.ts`, `stage10-critique.ts`, `stage11-counterfactuals.ts`
- **Commit:** 16c7226

### 2. [Rule 1 - Bug] events.ts comment mentioned `Date.now()`

- **Found during:** Task 2 acceptance criteria check.
- **Issue:** AC5 required `grep -c "Date.now()" src/lib/engine/events.ts == 0`. A doc-comment referenced `Date.now()` as an anti-pattern note, which tripped the grep.
- **Fix:** Rephrased the comment to "never wall-clock time" — same intent, satisfies AC.
- **Files modified:** `src/lib/engine/events.ts`
- **Commit:** 20c7b3b

### 3. [Rule 1 - Bug] rowToPredictionResult spread order

- **Found during:** Task 5 implementation review.
- **Issue:** The plan template put the raw-row spread AFTER explicit cast fields, which means a null `row.signal_availability` would overwrite the safe-default fallback.
- **Fix:** Reordered — spread raw row FIRST, then explicit field rebuilds (with safe defaults) override on top.
- **Files modified:** `src/lib/engine/cache/prediction-cache.ts`
- **Commit:** b7b7195

### 4. [Known cascade — NOT a deviation] aggregator.ts typecheck break

- **Found during:** Task 3 verification (`npx tsc --noEmit`).
- **Status:** **Intentional per plan design.** The Task 3 spec explicitly states `signal_availability` is required (not optional) and "Plan 02 Task 2 updates aggregator.ts to fill this field."
- **Current state:** `src/lib/engine/aggregator.ts:466` reports `TS2741: Property 'signal_availability' is missing in type ... but required in type 'PredictionResult'`.
- **Runtime impact:** None — `aggregator.test.ts` still passes (14 tests). Vitest does not strict-typecheck.
- **Resolution:** PLAN 02 Task 2 (aggregator.ts edit) will populate the field from the existing availability computation already inside aggregator.

### 5. [Pre-existing — out of scope] Test-runner global types not picked up by tsc

- **Observed during:** Task 3 `npx tsc --noEmit` baseline check.
- **Symptom:** All `__tests__/*.test.ts` files report `Cannot find name 'describe' / 'it' / 'expect' / 'vi'` errors.
- **Scope:** Pre-existing issue at baseline (commit 809107a). Vitest config has `globals: true` but tsconfig doesn't include `"types": ["vitest/globals"]`. Tests still run because vitest handles its own type resolution at runtime.
- **Action:** Out of scope for this plan. Not logged to `deferred-items.md` because the team has tolerated this pre-existing state through the entire Engine Foundation milestone; it would be a separate "test types tightening" plan.

## Threat Model — Status

| Threat ID | Mitigation Implementation | Verification |
|-----------|---------------------------|--------------|
| T-03-01 (cross-user prediction leakage) | `cacheKey()` includes `${userId}` AND L2 SELECT includes `.eq("user_id", userId)` even with service-role client | grep AC `>= 1`, prediction-cache test "L1 hit returns same user's cached result" |
| T-03-02 (hash collision attack) | Accepted — SHA-256 collision probability negligible; per-user keying contains blast radius | n/a (accept disposition) |
| T-03-03 (cache stuffing) | `populatePredictionCache` is server-side only, called after a successful pipeline run | grep — no client-callable export path |
| T-03-04 (JSONB column unknown exposure) | `rowToPredictionResult` rebuilds typed fields with safe defaults (null → `{ behavioral: false, ... }`) | unit test covers L2 hydration |
| T-03-05 (L1 unbounded growth) | Accepted — `createCache` TTL evicts at 24h; per-process bounded by Vercel container lifetime | n/a (accept disposition) |
| T-03-06 (service-role privilege escalation via cache) | L2 query always supplies `user_id` from authenticated session (PLAN 03 will pass it through) | grep AC `>= 1` |

ASVS Level 1: V4 Access Control mitigated; V6 Cryptography uses `node:crypto` SHA-256.

## Open Issues / Handoff Notes for PLAN 02

1. **Aggregator cascade resolution (PLAN 02 Task 2):** Update `src/lib/engine/aggregator.ts` to:
   - Add `signal_availability: SignalAvailability` to the returned PredictionResult object (the existing `SignalAvailability` interface inside aggregator.ts at line 35 can be DELETED — `types.ts` is now canonical; import from `./types` instead).
   - Replace the local `const ENGINE_VERSION = "2.1.0"` at line 17 with `import { ENGINE_VERSION } from "./version"` + `export { ENGINE_VERSION }` for backwards-compat.
   - After both changes, `npx tsc --noEmit` should report zero new errors (excluding pre-existing test-runner-global noise).

2. **Pipeline.ts integration (PLAN 02 Task 1+3):** Import the new stubs and the `StageEventCallback`. Call `runWave0` between input parsing and Wave 1; `runWave3` after Wave 2; `runStage10Critique` + `runStage11Counterfactuals` after aggregator. Thread `onStageEvent` through.

3. **Route.ts cache integration (PLAN 03):** Replace any existing analysis-result cache with `lookupPredictionCache` + `populatePredictionCache`. Wire `bypassCache: true` from the eval-harness header (CONTEXT D-15).

4. **No new external dependencies** — every new module uses `node:crypto`, existing `@/lib/cache`, existing `@/lib/supabase/service`, existing `@/lib/logger`. No `package.json` changes needed.

## Self-Check: PASSED

Verified all claimed artifacts exist and all claimed commits land on this branch (per `<self_check>` protocol):

- File `src/lib/engine/version.ts` — FOUND
- File `src/lib/engine/events.ts` — FOUND
- File `src/lib/engine/wave0.ts` — FOUND
- File `src/lib/engine/wave3.ts` — FOUND
- File `src/lib/engine/stage10-critique.ts` — FOUND
- File `src/lib/engine/stage11-counterfactuals.ts` — FOUND
- File `src/lib/engine/cache/prediction-cache.ts` — FOUND
- File `src/lib/engine/types.ts` (modified) — FOUND
- File `src/lib/engine/__tests__/version.test.ts` — FOUND
- File `src/lib/engine/__tests__/events.test.ts` — FOUND
- File `src/lib/engine/__tests__/stubs.test.ts` — FOUND
- File `src/lib/engine/__tests__/prediction-cache.test.ts` — FOUND
- Commit 7d6b575 (Task 1) — FOUND
- Commit 20c7b3b (Task 2) — FOUND
- Commit dd1289d (Task 3) — FOUND
- Commit 16c7226 (Task 4) — FOUND
- Commit b7b7195 (Task 5) — FOUND
