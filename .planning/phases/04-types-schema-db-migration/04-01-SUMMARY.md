---
phase: 04-types-schema-db-migration
plan: 01
subsystem: types
tags: [typescript, zod, feature-vector, prediction-result, types]

# Dependency graph
requires:
  - phase: 02-gemini-prompt-video-analysis
    provides: "FactorSchema with rationale/improvement_tip, GeminiVideoSignalsSchema"
  - phase: 03-deepseek-prompt-model-switch
    provides: "BehavioralPredictionsSchema, ComponentScoresSchema, DeepSeekResponseSchema"
provides:
  - "FeatureVector interface — standardized signal backbone for all pipeline stages"
  - "AnalysisInput v2 with 3 input modes (text, tiktok_url, video_upload)"
  - "ContentPayload interface — normalized internal representation"
  - "PredictionResult v2 with behavioral_predictions, feature_vector, reasoning, warnings"
  - "Updated Factor interface (rationale/improvement_tip)"
affects: [05-pipeline-restructure, 07-upload-ui, 08-results-ui, 06-tiktok-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns: [feature-vector-backbone, input-mode-discriminator, zod-refine-validation]

key-files:
  created: []
  modified:
    - src/lib/engine/types.ts

key-decisions:
  - "FeatureVector uses camelCase for TypeScript convention (hookScore not hook_score)"
  - "AnalysisInput uses Zod .refine() for conditional field validation based on input_mode"
  - "PredictionResult confidence is numeric 0-1 with separate confidence_label for UI display"
  - "Deprecated v1 types removed now (not deferred to Phase 5) per plan specification"
  - "score_weights uses named keys (behavioral/gemini/rules/trends) instead of v1 (rule/trend/ml)"

patterns-established:
  - "Input mode discriminator: input_mode enum drives which fields are required"
  - "Feature vector as shared backbone: all pipeline stages contribute to and consume FeatureVector"
  - "Numeric confidence (0-1) with categorical label for UI: confidence + confidence_label pattern"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 4 Plan 1: V2 Type Definitions Summary

**FeatureVector signal backbone, 3-mode AnalysisInput with Zod refine, ContentPayload normalized type, and PredictionResult v2 with behavioral predictions and feature vector**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T12:21:18Z
- **Completed:** 2026-02-16T12:23:15Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Defined FeatureVector with 26 signal fields spanning Gemini factors, video signals, DeepSeek components, rules, trends, audio, caption/hashtag, and content metadata
- Expanded AnalysisInput to support text, tiktok_url, and video_upload modes with Zod refine conditional validation
- Added ContentPayload as normalized internal representation with extracted hashtags, resolved video URL, and optional metadata
- Replaced PredictionResult with v2 including behavioral_predictions, feature_vector, reasoning, warnings, numeric confidence, and v2 score weights (behavioral 45%, gemini 25%, rules 20%, trends 10%)
- Updated Factor interface to match Gemini v2 output (rationale/improvement_tip instead of description/tips)
- Removed all deprecated v1 types: PersonaReaction, Variant, ConversationTheme interfaces and their Zod schemas

## Task Commits

Each task was committed atomically:

1. **Task 1: Define FeatureVector, ContentPayload, and expand AnalysisInput** - `2349f47` (feat)
2. **Task 2: Define PredictionResult v2 and clean up deprecated types** - `4c47e59` (feat)

## Files Created/Modified
- `src/lib/engine/types.ts` - All v2 type definitions: FeatureVector, AnalysisInput v2, ContentPayload, PredictionResult v2, updated Factor

## Decisions Made
- FeatureVector uses camelCase for TypeScript convention (hookScore not hook_score) — consistent with existing codebase patterns
- AnalysisInput uses Zod `.refine()` for conditional field validation — cleaner than union discriminator for 3-mode validation
- PredictionResult confidence is numeric (0-1) with separate confidence_label (ConfidenceLevel) for UI display — follows ENG-07 decision
- Deprecated v1 types removed immediately rather than deferred — plan specified removal, downstream errors are Phase 5 work
- score_weights uses named keys (behavioral/gemini/rules/trends) instead of v1 (rule/trend/ml) — matches v2 aggregation formula

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All v2 types defined and exported — Phase 5 (pipeline restructure) can now build the aggregator against these contracts
- Expected downstream type errors in aggregator.ts (old Factor.description/tips, old PredictionResult shape, deprecated type references) — these are Phase 5 scope
- Phase 7 (upload UI) can reference AnalysisInput's 3 input modes
- Phase 8 (results UI) can reference PredictionResult v2 shape

## Self-Check: PASSED

- FOUND: src/lib/engine/types.ts
- FOUND: .planning/phases/04-types-schema-db-migration/04-01-SUMMARY.md
- FOUND: commit 2349f47
- FOUND: commit 4c47e59

---
*Phase: 04-types-schema-db-migration*
*Completed: 2026-02-16*
