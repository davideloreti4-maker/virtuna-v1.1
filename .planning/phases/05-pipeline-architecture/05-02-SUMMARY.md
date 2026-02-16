---
phase: 05-pipeline-architecture
plan: 02
subsystem: engine
tags: [aggregator, scoring, confidence, feature-vector, api-route, sse, pipeline-wiring]

# Dependency graph
requires:
  - phase: 05-pipeline-architecture/01
    provides: "PipelineResult with all stage outputs (gemini, deepseek, rules, trends, creator context)"
  - phase: 04-types-schema-db-migration
    provides: "PredictionResult v2 type, FeatureVector interface, BehavioralPredictions, AnalysisInput"
provides:
  - "v2 aggregation formula: behavioral 45% + gemini 25% + rules 20% + trends 10%"
  - "Numeric confidence (0-1) based on signal availability + model agreement"
  - "FeatureVector assembly from all pipeline stage outputs"
  - "API route wired to runPredictionPipeline() + aggregateScores()"
  - "DB insert with v2 columns (behavioral_predictions, feature_vector, warnings, etc.)"
  - "Client hook with v2 SSE phase names and AnalysisInput-compatible input type"
affects: [phase-6-refinement, ui-components, dashboard, analysis-history]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline-aggregator-separation, signal-availability-confidence, model-agreement-scoring, weighted-multi-model-aggregation]

key-files:
  created: []
  modified:
    - src/lib/engine/aggregator.ts
    - src/app/api/analyze/route.ts
    - src/hooks/queries/use-analyze.ts

key-decisions:
  - "Behavioral score from DeepSeek 7 component scores averaged and normalized to 0-100"
  - "Gemini score from 5 factor scores averaged and normalized to 0-100"
  - "Confidence = signal availability (0-0.6) + model agreement direction (0-0.4)"
  - "Low confidence warning auto-appended when confidence < 0.4"
  - "Fallback BehavioralPredictions with 0/N-A when DeepSeek is null (shouldn't occur per strict-fail)"
  - "API route simplified: single pipeline call + aggregate, no direct engine module imports"

patterns-established:
  - "PipelineResult -> aggregateScores() -> PredictionResult: clean separation of orchestration and scoring"
  - "Signal availability scoring: base 0.2 + conditional bonuses for video/trends/rules/confidence"
  - "Model agreement: same-direction = 0.4, close = 0.2, divergent = 0.0"
  - "Score weight object (SCORE_WEIGHTS) exported for transparency in results"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 5 Plan 2: Aggregation + API Route Wiring Summary

**v2 weighted aggregation (behavioral 45% + gemini 25% + rules 20% + trends 10%) with numeric confidence, FeatureVector assembly, and pipeline-wired API route**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T13:11:03Z
- **Completed:** 2026-02-16T13:13:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote aggregator with v2 formula replacing v1 (rule 50% + trend 30% + ml 20%)
- Implemented numeric confidence (0-1) combining signal availability and model agreement direction
- Assembled complete FeatureVector from Gemini factors, video signals, DeepSeek component scores, rules, and trends
- Wired API route to use runPredictionPipeline() + aggregateScores() pattern
- Updated DB insert with all v2 columns and removed v1 columns
- Updated client hook with v2 SSE phase names and AnalysisInput-compatible input type

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite aggregator with v2 formula, confidence, and FeatureVector assembly** - `3b33d43` (feat)
2. **Task 2: Wire pipeline into API route and update client hook** - `47e4428` (feat)

## Files Created/Modified
- `src/lib/engine/aggregator.ts` - Complete rewrite: v2 formula, numeric confidence, FeatureVector assembly, cost tracking, ENGINE_VERSION 2.0.0
- `src/app/api/analyze/route.ts` - Replaced inline pipeline logic with runPredictionPipeline() + aggregateScores(), v2 DB insert
- `src/hooks/queries/use-analyze.ts` - Updated AnalysisPhase type (analyzing/reasoning/scoring), v2 input type with input_mode

## Decisions Made
- **Behavioral score calculation:** Average all 7 DeepSeek component scores (0-10), normalize to 0-100 by multiplying by 10. Simple and transparent.
- **Gemini score calculation:** Average all 5 Gemini factor scores (0-10), normalize to 0-100. Same pattern as behavioral.
- **Confidence formula:** Two-component: signal availability (how much data we have, 0-0.6) + model agreement (do Gemini and DeepSeek agree on direction relative to 50 midpoint, 0-0.4). This means confidence can never be HIGH without both models agreeing.
- **DeepSeek null fallback:** Provided fallback BehavioralPredictions with 0/N-A values in case DeepSeek is null, even though strict-fail mode means this shouldn't occur. Defensive programming.
- **Route simplification:** Reduced from 4 inline phases (analyzing/matching/simulating/generating) to 2 SSE phases (analyzing/scoring), since the pipeline handles all orchestration internally.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Pipeline Architecture) is now complete -- both plans executed
- Full prediction pipeline: input -> 10-stage wave pipeline -> v2 aggregation -> PredictionResult
- Ready for Phase 6 (refinement/testing) or any downstream phases
- Pre-existing TypeScript errors in UI components (simulation/) and scripts are unrelated to pipeline work

## Self-Check: PASSED

- [x] `src/lib/engine/aggregator.ts` exists
- [x] `src/app/api/analyze/route.ts` exists
- [x] `src/hooks/queries/use-analyze.ts` exists
- [x] Commit `3b33d43` found (Task 1: aggregator rewrite)
- [x] Commit `47e4428` found (Task 2: API route + client hook)
- [x] TypeScript: zero errors in all 3 modified files
- [x] No v1 dead code references remain

---
*Phase: 05-pipeline-architecture*
*Completed: 2026-02-16*
