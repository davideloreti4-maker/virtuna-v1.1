---
phase: 04-audience-sim-fold-brain-2-the-bet
plan: "03"
subsystem: engine/wave3/fold + engine/aggregator + engine/pipeline
tags: [fold, adapter, aggregator, pipeline, audience-sim, heatmap, behavioral-source]
dependency_graph:
  requires:
    - 04-02 (fold.ts LLM layer + stub adapters)
  provides:
    - adaptFoldToPersonaSimResults (real implementation — PersonaSimulationResult[])
    - adaptFoldToPass2Results (real implementation — Pass2PersonaResult[] with niche_deep→niche map)
    - aggregator.ts behavioralSource:"fold" branch (behavioral aggregate + heatmap)
    - pipeline.ts foldOutcome (Wave3FoldOutcome | null, default OFF behind ENGINE_USE_FOLD=1)
  affects:
    - Plan 04 A/B referee (ab-fold-referee.ts — @ts-expect-error shim removed, "fold" union live)
    - Plan 05 flip (foldOutcome + behavioralSource:"fold" wired; flip = set ENGINE_USE_FOLD=1 in prod)
tech_stack:
  added: []
  patterns:
    - niche_deep→niche slot_type map (Pitfall 5 — mirrors assembleHeatmapPayload:240)
    - satisfies Pass2PersonaResult (structural type check, no as unknown as cast)
    - IIFE behavioral branch selection (fold → personas → deepseek fallback chain)
    - Process env flag + PipelineOptions duck-typed extension for default-OFF guard (ENGINE_USE_FOLD / useFold)
    - Dynamic import for persona-registry inside pipeline try block (avoids circular at top-level)
key_files:
  created: []
  modified:
    - src/lib/engine/wave3/fold.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/pipeline.ts
    - src/lib/engine/__tests__/factories.ts
    - scripts/ab-fold-referee.ts
decisions:
  - "adaptFoldToPersonaSimResults synthesizes reasoning from archetype name — PersonaSimulationResult.reasoning is required (min 1) but absent from FoldResponse; 'fold-derived: {archetype}' satisfies the constraint without inventing data"
  - "Pass2PersonaResult does NOT have swipe_predicted_at or segment_reasons fields — those are derived by assembleHeatmapPayload from segment_reactions; adapter only populates the 6 required fields"
  - "foldOutcome uses satisfies Pass2PersonaResult (not as unknown as) for structural type safety at return site"
  - "aggregator behavioralSource fold branch uses an IIFE to cleanly express the 3-way fallback without nested ternaries"
  - "pipeline fold invocation uses dynamic import for selectPersonaSlots to avoid introducing a top-level circular dependency between pipeline.ts and persona-registry.ts"
  - "factories.ts updated with foldOutcome: null default — required field, must be present for PipelineResult type compatibility"
metrics:
  duration: "~35 min"
  completed: "2026-06-05"
  tasks_completed: 2
  files_created: 0
  files_modified: 5
---

# Phase 4 Plan 3: Fold Adapter Wiring + Pipeline Integration Summary

**One-liner:** Real fold adapters (FoldResponse → PersonaSimulationResult[] + Pass2PersonaResult[] with niche_deep→niche normalization) + aggregator "fold" branch routing BOTH behavioral aggregate and heatmap from foldOutcome + pipeline foldOutcome field default-OFF behind ENGINE_USE_FOLD=1.

## What Was Built

**Task 1 — fold.ts adapters + D-07 diversity guard wiring**

- `adaptFoldToPersonaSimResults(fold, slots)`: maps each `FoldResponse.personas[i]` to a `PersonaSimulationResult` using the RESEARCH field-by-field table (6 intent fields + fold-derived reasoning from archetype name). `slot_type` and `niche` sourced from the matching `PersonaSlot` by `persona_id` (with `archetype` fallback).
- `adaptFoldToPass2Results(fold, slots)`: maps to `Pass2PersonaResult[]` — applies `niche_deep→niche` slot_type normalization via `mapSlotType()` helper (Pitfall 5 / T-04-04 mitigation, mirrors `assembleHeatmapPayload:240` exactly). `segment_reactions` passed through verbatim; `pass2_latency_ms = 0`, `pass2_cost_cents = 0` (fold is a single call, cost tracked on `Wave3FoldOutcome.cost_cents`).
- `mapSlotType()` private helper: `"niche_deep" → "niche"`, all other values pass through typed.
- `buildSlotMap()`: dual-key index (persona_id + archetype) for O(1) slot lookup with fallback.
- `runFold`: updated to stash validated data in `foldPersonas` on successful parse + segment-count guard, then call both adapters before returning. Diversity guard now pushes warning into `warnings[]` instead of silently discarding the `{warn}` result.
- **Tests**: `fold-adapter.test.ts` + `fold-diversity-guard.test.ts` — 6/6 GREEN.
- **Commit**: `f289eaf5`

**Task 2 — aggregator.ts "fold" branch + pipeline.ts foldOutcome wiring**

- `aggregator.ts`: Extended `AggregateScoresOptions.behavioralSource` union to `"deepseek" | "personas" | "fold"`. Added IIFE behavioral branch: when `source="fold"` + `foldOutcome.fold_success`, calls `aggregatePersonaResults(foldOutcome.personaSimResults)` → behavioral aggregate. Falls back to personas → deepseek chain. Heatmap: `heatmapPass2Results` selected from `foldOutcome.pass2Results` when `source="fold"`; existing `pass2Outcome.pass2Results` otherwise. `buildWeightedCurve` + `assembleHeatmapPayload` math byte-untouched (D-11/D-12). Imported `aggregatePersonaResults` from `./wave3/aggregator`.
- `pipeline.ts`: Added `foldOutcome: Wave3FoldOutcome | null` to `PipelineResult`. Added `EmotionArcPoint` to imports. Conditional fold invocation block after pass2 block, guarded by `process.env.ENGINE_USE_FOLD === "1"` (default OFF — D-09 / T-04-05). When off: `foldOutcome = null`, 10-pass runs exactly as today. When on: calls `runFold(foldSlots, omniSegments, keyframeUrisForFold, verbatimText, emotionArc, onStageEvent)` — reuses same keyframeUris + slot routing as pass2; emotion_arc and verbatim plucked from `geminiResult.analysis` (same pattern as aggregator). `runWave3Pass2` call site preserved (dormant-not-deleted, D-09 / T-04-06).
- `ab-fold-referee.ts`: Removed `@ts-expect-error` fold-union shim — union now includes `"fold"`.
- `factories.ts`: Added `foldOutcome: null` default to `makePipelineResult` (required field, null = fold off / no segments).
- **Full test suite**: 1826/1826 GREEN.
- **Commit**: `bf44f0d3`

## Deviations from Plan

### Auto-adjusted (Rule 2 — missing required field)

**[Rule 2 - Missing critical field] Pass2PersonaResult does not have swipe_predicted_at or segment_reasons**

- **Found during:** Task 1 implementation
- **Issue:** Plan docstring described mapping `swipe_predicted_at` and `segment_reasons` into `adaptFoldToPass2Results`, but `Pass2PersonaResult` (defined in `weighted-aggregator.ts`) only has `persona_id`, `archetype`, `slot_type`, `segment_reactions[]`, `pass2_latency_ms`, `pass2_cost_cents`. Those heatmap fields are computed by `assembleHeatmapPayload` from `segment_reactions`.
- **Fix:** Adapter only populates the 6 required fields. `swipe_predicted: boolean` is preserved in each `segment_reactions[]` entry — `assembleHeatmapPayload` extracts `swipe_predicted_at` from there. Removed unused `swipeReaction` / `segmentReasons` local variables.
- **Files modified:** `src/lib/engine/wave3/fold.ts`
- **Commit:** `f289eaf5`

### Auto-adjusted (Rule 1 — factories.ts PipelineResult type)

**[Rule 1 - Bug] factories.ts missing foldOutcome field causes tsc error**

- **Found during:** Task 2, TypeScript check
- **Issue:** After adding `foldOutcome: Wave3FoldOutcome | null` as a required field on `PipelineResult`, `makePipelineResult` in factories.ts produced a TS2322 error (`undefined` not assignable to `Wave3FoldOutcome | null`).
- **Fix:** Added `foldOutcome: null` default to the factory, matching the pattern of `pass2Outcome: null`.
- **Files modified:** `src/lib/engine/__tests__/factories.ts`
- **Commit:** `bf44f0d3`

## Verification Results

**fold-adapter.test.ts + fold-diversity-guard.test.ts:** 6/6 PASS (GREEN)

**Full vitest suite:** 1826/1826 PASS (GREEN)

**tsc --noEmit:** Zero errors in aggregator.ts / pipeline.ts / ab-fold-referee.ts / fold.ts. Pre-existing test scaffold TS errors in fold-adapter.test.ts (5), fold-diversity-guard.test.ts (1), fold-schema.test.ts (5) unchanged from Plan 02 state.

**Acceptance criteria:**

- [x] `grep -c "niche_deep" fold.ts` = 6 (≥ 1 — map referenced)
- [x] `grep -c "Math.max|Math.min" fold.ts` = 1 line containing both (formula present)
- [x] No `throw` inside `checkDiversityGuard` — warns only, never throws
- [x] `aggregatePersonaResults` + `buildWeightedCurve` accept adapted arrays without throw (fold-adapter.test.ts GREEN)
- [x] aggregator.ts + weighted-aggregator.ts NOT in plan files_modified (D-11/D-12 byte-untouched)
- [x] `grep -c '"fold"' aggregator.ts` = 7 (≥ 2 — union + branch)
- [x] `grep -c "foldOutcome" aggregator.ts` = 6 (≥ 1)
- [x] `grep -c '?? "deepseek"' aggregator.ts` = 1 (production default preserved)
- [x] `grep -c "foldOutcome" pipeline.ts` = 6 (≥ 2)
- [x] `grep -c "ENGINE_USE_FOLD|useFold" pipeline.ts` = 7 (≥ 1 — default-OFF guard)
- [x] `grep -c "runWave3Pass2" pipeline.ts` = 3 (≥ 1 — dormant-not-deleted D-09)
- [x] `grep -c "until Plan 03 adds" ab-fold-referee.ts` = 0 (shim removed)

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

Threat mitigations verified present:
- T-04-04: `mapSlotType()` in `adaptFoldToPass2Results` normalizes `niche_deep→niche`; fold-adapter.test.ts asserts no `niche_deep` leaks
- T-04-05: `ENGINE_USE_FOLD` defaults OFF; `behavioralSource` defaults `"deepseek"` — production pipeline unchanged
- T-04-06: `runWave3Pass2` call site preserved (grep count 3); fold block is ADDITIVE only

## Known Stubs

None — all stubs from Plan 02 (`adaptFoldToPersonaSimResults` / `adaptFoldToPass2Results` returning `[]`) are now real implementations.

## Self-Check: PASSED
