---
phase: 03
plan: 08
subsystem: engine
tags: [phase-3, pipeline, aggregator, SSE, integration, TDD, heatmap, weighted-aggregator]
dependency_graph:
  requires: [03-02, 03-04, 03-05, 03-06, 03-07]
  provides: [PipelineResult.pass2Outcome, PipelineResult.segments, PredictionResult.heatmap, PredictionResult.weighted_*, signal_availability.pass2_timeline, filmstrip SSE, pass2_persona_end attentions]
  affects: [aggregator.ts, pipeline.ts, stream/route.ts, events.ts, wave3/pass2.ts]
tech_stack:
  added: []
  patterns: [TDD-london-school, vi.hoisted-mocks, discriminated-union-events, DB-poll-SSE, fire-and-forget-filmstrip]
key_files:
  created: []
  modified:
    - src/lib/engine/pipeline.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/types.ts
    - src/lib/engine/events.ts
    - src/lib/engine/wave3/pass2.ts
    - src/app/api/analyze/[id]/stream/route.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/factories.ts
decisions:
  - "Expose segments?: SegmentGrid[] on PipelineResult (Task 1 + Task 2) — aggregator.assembleHeatmapPayload requires original SegmentGrid[] which is unavailable from pass2Results alone"
  - "resolveWeights called with wave0Result.niche.primary_slug — enables future niche-specific weight overrides at aggregation time"
  - "isAntiViralityGatedFull replaces isAntiViralityGated in aggregateScores (both initial and POST-critique evaluations) — preserves Pitfall 7 ordering invariant"
  - "Stream route filmstrip polling: delta-only via knownKeyframeIndices Set — prevents duplicate filmstrip_segment_ready events on repeated poll cycles"
  - "pass2_persona_end event extended with attentions[] + swipe_predicted_at (additive, optional) — stream route reads these from JSONB rather than live callback chain"
metrics:
  duration: "~90 minutes (continuation from prior session for Task 1)"
  completed: "2026-05-27T09:34:09Z"
  tasks_completed: 3
  files_modified: 8
---

# Phase 03 Plan 08: Phase 3 End-to-End Integration Summary

Final integration of Phase 3 pipeline + aggregator + SSE transport: filmstrip fire-and-forget at wave_0_complete, Pass 2 orchestration after Pass 1, weighted retention curve + HeatmapPayload on PredictionResult, isAntiViralityGatedFull dual-trigger gate, and filmstrip/persona streaming partials over SSE.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD RED+GREEN) | Wire pipeline.ts filmstrip + Pass 2 + PipelineResult.segments | 661a063 (prior session) | pipeline.ts, pipeline.test.ts |
| 2 RED | Failing aggregator tests (Phase 3 wiring) | c801271 | aggregator.test.ts, factories.ts, pipeline.ts |
| 2 GREEN | Implement aggregator.ts Pass 2 wiring | 886a317 | aggregator.ts, types.ts, aggregator.test.ts |
| 3 | Extend stream route + events + pass2 (SSE) | d5ffe7a | route.ts, events.ts, pass2.ts |

## Test Results

- aggregator.test.ts: 52 tests pass (7 new Phase 3 tests green)
- aggregator-anti-virality.test.ts: 4 tests pass
- pipeline.test.ts: 29 tests pass
- Full engine suite: 613 tests pass, 9 skipped (all pre-existing skips)

## Implementation Details

### Task 1 (Pipeline wiring — prior session)
- `triggerFilmstripGeneration(analysisId, segments, videoUrl)` at wave_0_complete (fire-and-forget, never awaited)
- `runWave3Pass2(omniSegments, keyframeUris, wave3Result, demoContext, onStageEvent)` after Pass 1
- `pass2Outcome: Wave3Pass2Outcome | null` + `segments?: SegmentGrid[]` added to `PipelineResult`
- `buildDemographicContext()` helper: maps UTC hour → time_of_day, follower_count → follower_tier
- `readKeyframeUris()` helper: reads `analyses.analysis_results.heatmap.segments[].keyframe_uri` via `(supabase as any)` cast (analyses table not in generated types)

### Task 2 (Aggregator wiring)
- Phase 3 block in `aggregateScores`: when `pass2_aggregate_built && omniSegments.length > 0`, calls:
  - `resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, { niche: wave0Result.niche?.primary_slug })` → persona weights
  - `buildWeightedCurve(pass2Results, segments, weights)` → `weighted_completion_pct`, `weighted_top_dropoff_t`, `weighted_hook_score`
  - `assembleHeatmapPayload(pass2Results, segments, weights, source)` → `HeatmapPayload`
- `isAntiViralityGatedFull(confidence, heatmap)` replaces `isAntiViralityGated(confidence)` in both PRE and POST-critique evaluations
- `anti_virality_reason` + `dropoff_segment_indices` added to `PredictionResult` (optional, backwards-compatible)
- `signal_availability.pass2_timeline` = `pass2_aggregate_built ?? false`
- Pass 1 fallback: when `pass2_aggregate_built === false` → `heatmap=null`, `weighted_*=null`

### Task 3 (SSE stream extension)
- `events.ts`: `pass2_persona_end` extended with `attentions?: number[]` + `swipe_predicted_at?: number | null` (additive)
- `wave3/pass2.ts`: success `pass2_persona_end` event now includes `attentions` (from `segment_reactions.map(sr => sr.attention)`) and `swipe_predicted_at` (from first `swipe_predicted=true` reaction)
- `stream/route.ts`: DB poll loop extended with:
  - `extractPartialPersonas()`: reads `analysis_results.partial.personas` JSONB; emits `partial` event on change (JSON diff)
  - `extractHeatmapSegments()`: reads `analysis_results.heatmap.segments` JSONB
  - `knownKeyframeIndices` Set: delta-only `filmstrip_segment_ready` emission per segment index

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] wave0Result.niche type mismatch in resolveWeights call**
- **Found during:** Task 2 GREEN (TypeScript check)
- **Issue:** `resolveWeights` expects `niche?: string` but `wave0Result.niche` is `{ primary_slug, micro_slug, confidence } | null`
- **Fix:** Use `wave0Result.niche?.primary_slug ?? undefined`
- **Files modified:** `src/lib/engine/aggregator.ts`
- **Commit:** 886a317

**2. [Rule 2 - Missing] PredictionResult missing anti_virality_reason + dropoff_segment_indices**
- **Found during:** Task 2 GREEN implementation
- **Issue:** `isAntiViralityGatedFull` returns `{ reason, dropoff_segment_indices }` but `PredictionResult` had no fields for them
- **Fix:** Added `anti_virality_reason?: "confidence" | "timeline_pattern" | "both" | null` and `dropoff_segment_indices?: number[]` to `PredictionResult` in types.ts
- **Files modified:** `src/lib/engine/types.ts`
- **Commit:** 886a317

**3. [Rule 3 - Blocking] PipelineResult.segments needed for aggregator.assembleHeatmapPayload**
- **Found during:** Task 2 planning — `assembleHeatmapPayload` requires original `SegmentGrid[]` not reconstructable from `pass2Results`
- **Fix:** Added `segments?: SegmentGrid[]` to `PipelineResult` interface; pipeline.ts return exposes `omniSegments`; `makePipelineResult` factory default set to `undefined`
- **Files modified:** `src/lib/engine/pipeline.ts`, `src/lib/engine/__tests__/factories.ts`
- **Commit:** c801271 (part of RED phase)

## Known Stubs

None — all Phase 3 behaviors are wired end-to-end. The `pass2_persona_start/end` events flow through `onStageEvent` inside `runWave3Pass2`; the stream route reads partial state from the DB poll (not a live callback chain) which is the documented pragmatic path for this plan.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The stream route addition (`extractPartialPersonas`, `extractHeatmapSegments`) reads only from the same `analysis_results` row already fetched under IDOR mitigation (`user_id` filter). The filmstrip `knownKeyframeIndices` state is request-scoped (not shared across requests).

## Self-Check: PASSED

All files present:
- src/lib/engine/pipeline.ts: FOUND
- src/lib/engine/aggregator.ts: FOUND
- src/lib/engine/types.ts: FOUND
- src/lib/engine/events.ts: FOUND
- src/lib/engine/wave3/pass2.ts: FOUND
- src/app/api/analyze/[id]/stream/route.ts: FOUND
- .planning/phases/03-.../03-08-SUMMARY.md: FOUND

All commits present:
- 661a063: Task 1 feat(03-08) pipeline wiring
- c801271: Task 2 test(03-08) RED
- 886a317: Task 2 feat(03-08) GREEN
- d5ffe7a: Task 3 feat(03-08) SSE stream
