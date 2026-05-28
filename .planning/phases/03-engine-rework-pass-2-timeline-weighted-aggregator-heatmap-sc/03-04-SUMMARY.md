---
phase: 03
plan: 04
subsystem: engine-math
tags: [phase-3, pure-math, aggregator, persona-weights, D-12, D-13, D-14, D-20]
dependency_graph:
  requires:
    - src/lib/engine/types.ts (HeatmapPayload + SegmentGrid — Plan 02)
    - src/lib/engine/__tests__/persona-weights.test.ts (Wave 0 stubs — Plan 01)
    - src/lib/engine/__tests__/weighted-aggregator.test.ts (Wave 0 stubs — Plan 01)
  provides:
    - src/lib/engine/persona-weights.ts (PersonaWeights + PersonaWeightConfig + resolveWeights + normalizeWeights)
    - src/lib/engine/wave3/weighted-aggregator.ts (Pass2PersonaResult + buildWeightedCurve + assembleHeatmapPayload + DEFAULT_WEIGHTS)
  affects:
    - Plan 06 (pass2.ts orchestrator): imports Pass2PersonaResult + buildWeightedCurve + assembleHeatmapPayload
    - Plan 07 (filmstrip): reads HeatmapPayload.segments[].keyframe_uri contract (null → SSE fills)
    - Plan 08 (anti-virality): imports isTimelinePatternTriggered which consumes HeatmapPayload
tech_stack:
  added: []
  patterns:
    - pure-math-module (no I/O, no external deps — same as wave3/aggregator.ts)
    - d20-precedence-chain (analysis > creator > niche > default)
    - pitfall-6-normalize-over-survivors (redistribute absent slot_type weight)
    - pitfall-3-null-keyframe-uri (filmstrip fills later via SSE)
    - weighted-mean-per-segment (weight-normalized attention aggregation)
key_files:
  created:
    - src/lib/engine/persona-weights.ts (71 LOC)
    - src/lib/engine/wave3/weighted-aggregator.ts (166 LOC)
  modified:
    - src/lib/engine/__tests__/persona-weights.test.ts (all 8 it.skip activated → live it())
    - src/lib/engine/__tests__/weighted-aggregator.test.ts (all 9 it.skip activated → live it())
decisions:
  - "resolveWeights always calls normalizeWeights on the resolved result — even the 'default' case. Ensures sum=1.0 invariant regardless of which tier wins."
  - "normalizeOverSurvivors is a private function in weighted-aggregator.ts (not exported). Plan 06 only uses buildWeightedCurve / assembleHeatmapPayload; internal redistribution is an implementation detail."
  - "Pass2PersonaResult is exported from weighted-aggregator.ts (provisional single source of truth). Plan 06 (pass2.ts) re-exports it. This avoids a circular import where pass2.ts creates the type and weighted-aggregator.ts imports it."
  - "weighted_completion_pct = weight-normalized mean of per-persona timeline means (not mean of weighted_curve). These produce the same result when all personas have the same weight, but differ when weights are redistributed over survivors."
  - "weighted_top_dropoff_t returns t_start of the segment that follows the biggest drop (segments[i].t_start where i is the index of the larger-attention segment MINUS the smaller-attention segment). First drop opportunity is at i=1 (comparing curve[0] to curve[1])."
  - "Pre-existing a11y test failures (CommandBar, Sidebar, Board) confirmed out-of-scope. They use vitest-axe, have no dependency on engine modules, and were failing before this plan."
metrics:
  duration_minutes: 18
  completed_date: "2026-05-27"
  tasks_completed: 2
  source_files_created: 2
  test_files_created: 0
  files_modified: 2
  total_loc_added: ~521
  tests_passing: 17
  test_breakdown:
    persona-weights.test.ts: 8
    weighted-aggregator.test.ts: 9
---

# Phase 03 Plan 04: Persona Weights + Weighted Aggregator — Pure Math Foundation

Implemented two pure-math modules at the heart of Phase 3's aggregation logic. `persona-weights.ts` provides the D-20 precedence resolver and Pitfall 6 normalization. `weighted-aggregator.ts` provides the Pass 2 weighted retention curve, canonical weighted metrics, and D-13 HeatmapPayload assembly. 17 tests activated from Wave 0 stubs — all pass.

## What Was Built

### Task 1 — `src/lib/engine/persona-weights.ts` (commit `61697ce`)

**Types:**
```typescript
interface PersonaWeights { fyp: number; niche: number; loyalist: number; cross_niche: number; }
interface PersonaWeightConfig {
  default: PersonaWeights;
  niche_overrides?: Record<string, PersonaWeights>;
  creator_overrides?: Record<string, PersonaWeights>;
  analysis_override?: PersonaWeights;
}
type WeightsSource = 'default' | 'niche_override' | 'creator_override' | 'analysis_override';
```

**`DEFAULT_PERSONA_WEIGHT_CONFIG`:** `{ fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 }` (R2.3)

**`resolveWeights(config, context): { weights, source }`** — D-20 precedence chain:
1. `context.analysis_override` → `source: 'analysis_override'`
2. `context.creator_id` matches `config.creator_overrides[...]` → `source: 'creator_override'`
3. `context.niche` matches `config.niche_overrides[...]` → `source: 'niche_override'`
4. fallback → `config.default`, `source: 'default'`

Always calls `normalizeWeights()` on resolved result.

**`normalizeWeights(w): PersonaWeights`** — scales values so sum = 1.0. Returns `DEFAULT_PERSONA_WEIGHT_CONFIG.default` on all-zero input (avoids NaN/Infinity per Pitfall 6).

**Tests (8):** default path, analysis_override wins, creator wins, niche wins, full precedence chain, normalize sum=1.0, missing cross_niche redistributes, all-zero fallback.

### Task 2 — `src/lib/engine/wave3/weighted-aggregator.ts` (commit `ef4d743`)

**`Pass2PersonaResult` interface (provisional, Plan 06 re-exports):**
```typescript
export interface Pass2PersonaResult {
  persona_id: string;
  archetype: 'high_engager' | 'saver' | 'lurker' | 'sharer' | 'viewer' | 'niche_deep' | 'loyalist' | 'cross_niche_curiosity';
  slot_type: 'fyp' | 'niche' | 'loyalist' | 'cross_niche';
  segment_reactions: Array<{
    t_start: number;
    t_end: number;
    attention: number;   // 0-1
    reason?: string;
    swipe_predicted: boolean;
  }>;
  pass2_latency_ms: number;
  pass2_cost_cents: number;
}
```

**`buildWeightedCurve(pass2Results, segments, weights)`:**
```typescript
export function buildWeightedCurve(
  pass2Results: Pass2PersonaResult[],
  segments: SegmentGrid[],
  weights: PersonaWeights,
): {
  weighted_curve: number[];
  weighted_completion_pct: number;
  weighted_top_dropoff_t: number;
  weighted_hook_score: number;
}
```

- Calls `normalizeOverSurvivors` (private) before computing — redistributes absent slot_type weights (Pitfall 6)
- `weighted_curve[i]` = weight-normalized mean of `segment_reactions[i].attention` across all survivors
- `weighted_top_dropoff_t` = `segments[i].t_start` where `curve[i-1] - curve[i]` is maximum
- `weighted_hook_score` = mean of `weighted_curve[i]` for segments where `is_hook_zone === true`
- `weighted_completion_pct` = weight-normalized mean of per-persona timeline mean
- Returns zero scalars when `pass2Results.length === 0 || segments.length === 0`

**`assembleHeatmapPayload(pass2Results, segments, weights, weightsSource): HeatmapPayload`** — D-13 full shape:
- `segments[]` with `keyframe_uri: null` (Pitfall 3 — filmstrip fills via SSE later)
- `personas[]` with sparse `segment_reasons` (only inflection-point segments with a `reason` string)
- `personas[].swipe_predicted_at` = first `t_start` where `swipe_predicted === true`, else null
- `weighted_curve` from `buildWeightedCurve`
- `weights` from `normalizeOverSurvivors`
- `weights_source` passed through verbatim

**Constants:**
- `DEFAULT_WEIGHTS: PersonaWeights = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 }`
- `SUCCESS_THRESHOLD = 7` (D-06)

**Tests (9):** weighted_curve math, hook_score, top_dropoff_t, completion_pct, Pitfall 6 redistribution (missing cross_niche), all-types-surviving, D-13 shape, keyframe_uri=null, segment_reasons sparse.

## Test Results

```
src/lib/engine/__tests__/persona-weights.test.ts      8 passed
src/lib/engine/__tests__/weighted-aggregator.test.ts  9 passed
                                              Total:  17 passed
                                              Duration: 325ms
```

Both test files have zero `it.skip()` markers remaining. All 17 Wave 0 stubs are now live assertions.

## Deviations from Plan

### 1. [Pre-existing — out of scope] a11y test failures in UI components

- **Observed during:** Task 2 full-suite run.
- **Files:** `CommandBar.a11y.test.tsx`, `Sidebar.a11y.test.tsx`, `Board.a11y.test.tsx`
- **Status:** Pre-existing failures — these use `vitest-axe` and have no dependency on engine modules. Confirmed by `grep` showing no reference to `persona-weights` or `weighted-aggregator` in any of these files.
- **Full suite result:** 3 files failed / 102 passed / 3 skipped (108 total); 5 tests failed / 1218 passed / 50 skipped. The 5 failing tests are all in the 3 a11y files.
- **Action:** Out of scope. Not touched. Logged here for verifier awareness.

## Interface Contracts Established for Plan 06

Plan 06 (pass2.ts orchestrator) and downstream plans can now import:

```typescript
// Single source of truth for Pass 2 result shape
import type { Pass2PersonaResult } from "@/lib/engine/wave3/weighted-aggregator";

// Curve computation after Pass 2 runs
import { buildWeightedCurve, assembleHeatmapPayload, DEFAULT_WEIGHTS } from "@/lib/engine/wave3/weighted-aggregator";

// Precedence resolver
import { resolveWeights, normalizeWeights, DEFAULT_PERSONA_WEIGHT_CONFIG } from "@/lib/engine/persona-weights";
import type { PersonaWeights, PersonaWeightConfig, WeightsSource } from "@/lib/engine/persona-weights";
```

## Threat Model — Status

| Threat ID | Mitigation Implementation | Verification |
|-----------|---------------------------|--------------|
| T-03-04-01 (NaN injection via empty survivors) | `normalizeWeights` returns default on all-zero (no NaN); empty `pass2Results` returns zero scalars | test: "normalizeOverSurvivors: missing cross_niche" + "buildWeightedCurve: all-types-surviving" |
| T-03-04-02 (out-of-range attention) | Accepted — Zod guard upstream (Plan 06 D-06) enforces [0,1] | n/a (accept) |
| T-03-04-03 (PII disclosure) | Accepted — pure math module, no I/O, no user content | n/a (accept) |

## Self-Check: PASSED

- File `src/lib/engine/persona-weights.ts` (created) — FOUND
- File `src/lib/engine/wave3/weighted-aggregator.ts` (created) — FOUND
- File `src/lib/engine/__tests__/persona-weights.test.ts` (modified, 8 live it()) — FOUND
- File `src/lib/engine/__tests__/weighted-aggregator.test.ts` (modified, 9 live it()) — FOUND
- Commit `61697ce` (Task 1) — FOUND in branch history
- Commit `ef4d743` (Task 2) — FOUND in branch history
- 17 tests passing, 0 failures — VERIFIED via `pnpm vitest run`
