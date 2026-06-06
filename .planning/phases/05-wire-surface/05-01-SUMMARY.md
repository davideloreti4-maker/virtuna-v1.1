---
phase: 05-wire-surface
plan: "01"
subsystem: engine
tags: [engine, apollo, rubric-sum, determinism, schema, cache-invalidation]
dependency_graph:
  requires: []
  provides: [apollo-dimension-score, deterministic-composite, rubric-sum-contract]
  affects: [aggregator, deepseek, types, apollo-core, version]
tech_stack:
  added: []
  patterns: [zod-bounded-field, post-parse-overwrite, deterministic-arithmetic, tdd-london]
key_files:
  created: []
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/deepseek.ts
    - src/lib/engine/apollo-core.ts
    - src/lib/engine/version.ts
    - src/lib/engine/__tests__/deepseek.test.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/factories.ts
    - src/lib/engine/__tests__/version.test.ts
    - src/lib/engine/__tests__/wave3-persona-prompts.test.ts
decisions:
  - "score field required (not optional) in ApolloDimensionSchema — LLM must emit it; TS backstop computes sum regardless"
  - "Band anchors set to Strong=85/Mid=50/Weak=20 in corpus §4; matched in test fixtures"
  - "HOOK_WEIGHT=0.80/BODY_WEIGHT=0.04 constants inside a block-scope to avoid polluting module namespace"
  - "Composite-as-holistic removed from both KNOWLEDGE_CORE §4 and APOLLO_INSTRUCTION step 3"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-06"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 9
---

# Phase 5 Plan 01: D-01 Rubric-Sum Engine Contract Summary

Apollo composite_score replaced from LLM-nondeterministic holistic judgment to deterministic hook-weighted arithmetic sum of six per-dimension numeric scores (HOOK_WEIGHT=0.80, 5 body dims share 0.20), killing the ±5 swing on identical input (R8).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 RED scaffolds | `0a2a7a4d` | deepseek.test.ts, aggregator.test.ts |
| 2 | ApolloDimensionSchema score field + fixture fixes | `f1156c70` | types.ts, factories.ts, deepseek.test.ts, aggregator.test.ts, wave3-persona-prompts.test.ts |
| 3 | Deterministic rubric-sum + corpus §4 inversion | `4290f0c3` | deepseek.ts, apollo-core.ts |
| 4 | ENGINE_VERSION bump 3.7.0→3.8.0 + version test | `0656fc01` + `9d4e8f8c` | version.ts, aggregator.test.ts, version.test.ts |

## What Was Built

### types.ts — `ApolloDimensionSchema.score`
Added `score: z.number().min(0).max(100)` immediately after `band` in `ApolloDimensionSchema`. The field is the band-anchored numeric score (Strong→85, Mid→50, Weak→20) used as input to the deterministic sum. Zod bounds provide V5 defense-in-depth — LLM output is untrusted at this boundary.

### deepseek.ts — post-parse rubric-sum
After the existing `composite_score` clamp at line 149, added a block-scoped `HOOK_WEIGHT=0.80` / `BODY_WEIGHT=0.04` sum over `data.dimensions[].score`. The sum overwrites `data.composite_score` with `Math.min(100, Math.max(0, Math.round(sum)))`. The LLM's holistic composite is discarded.

### apollo-core.ts — §4 corpus inversion
- `KNOWLEDGE_CORE §4` grading-discipline line: kept honest per-dimension band judgment; made explicit the composite is NOT a holistic judgment — it is the arithmetic sum.
- `KNOWLEDGE_CORE §4` output-contract bullets: inverted "not a 0–100 per dimension" → each dimension now requires a numeric score anchored to the 3-band scale; inverted "do not present as arithmetic / not a sum of parts" → composite IS the deterministic sum.
- `APOLLO_INSTRUCTION` step 3: updated from "ONE holistic judgment... No per-dimension numbers; it is a judgment, not arithmetic" to "emit per-dimension numeric scores; TypeScript computes the composite."
- Old contradicting phrases fully removed (grep count = 0 for "do not present the composite as arithmetic").

### version.ts — ENGINE_VERSION 3.8.0
Bumped from `"3.7.0"` to `"3.8.0"` with D-01 reason in the history comment block. D-23 cache invariant: cache keys on `hash::ENGINE_VERSION::userId` — all stale 3.7.0 holistic-score rows auto-invalidate on next `/analyze` call.

## Test Results

- 4 new Wave 0 test cases (3 in deepseek.test.ts, 1 in aggregator.test.ts) — all GREEN after Tasks 2–4
- Full suite: **1817 passed, 0 failed** (172 test files)
- tsc `--noEmit`: 0 new errors from our changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] version.test.ts had hardcoded "3.7.0" version pin**
- **Found during:** Task 4 full suite run
- **Issue:** `src/lib/engine/__tests__/version.test.ts` asserted `ENGINE_VERSION === "3.7.0"` — fails after bump
- **Fix:** Updated pin to `"3.8.0"` and refreshed test description
- **Files modified:** `src/lib/engine/__tests__/version.test.ts`
- **Commit:** `9d4e8f8c`

**2. [Rule 2 - Missing critical] Test fixtures missing `score` field broke tsc**
- **Found during:** Task 2 tsc check
- **Issue:** `factories.ts`, `wave3-persona-prompts.test.ts`, `deepseek.test.ts` apolloDimension fixtures missing required `score` after schema required it
- **Fix:** Added `score` with band-appropriate anchor value (mid→50, strong→85) to all three fixtures; added `makeDeepSeekReasoning` import to `aggregator.test.ts`
- **Files modified:** factories.ts, wave3-persona-prompts.test.ts, deepseek.test.ts, aggregator.test.ts
- **Committed as:** part of Task 2 commit `f1156c70`

**3. [Rule 1 - Bug] APOLLO_INSTRUCTION step 3 still contained contradicting holistic-composite language**
- **Found during:** Task 3 — scanning for all §4 holistic-composite references
- **Issue:** `APOLLO_INSTRUCTION` step 3 (line 264) said "ONE 0–100 holistic, hook-weighted judgment... No per-dimension numbers; it is a judgment, not arithmetic" — directly contradicts D-01
- **Fix:** Replaced with "emit per-dimension numeric scores — TypeScript computes the composite as a deterministic hook-weighted sum"
- **Files modified:** `src/lib/engine/apollo-core.ts`
- **Committed as:** part of Task 3 commit `4290f0c3`

## Known Stubs

None. The rubric-sum contract is fully wired: schema → post-parse overwrite → corpus §4 → cache invalidation. The assembly-hop threading (aggregator → variants.apollo) was verified to be a no-op change (dimensions array already flows through unchanged).

## Threat Flags

No new trust boundaries introduced. T-05-01 (untrusted LLM score) mitigated via zod bounds + post-parse clamp. T-05-02 (cache integrity) mitigated via ENGINE_VERSION bump. T-05-03 (corpus prompt) accepted (byte-stable, no user input flows in).

## Self-Check: PASSED

All 7 modified files confirmed present. All 5 task commits confirmed in git log. Full test suite 1817/1817 passed.
