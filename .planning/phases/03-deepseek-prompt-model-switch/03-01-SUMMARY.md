---
phase: 03-deepseek-prompt-model-switch
plan: 01
subsystem: api
tags: [deepseek, tiktok, prompt-engineering, calibration, behavioral-predictions, cot, zod]

# Dependency graph
requires:
  - phase: 01-data-analysis
    provides: calibration-baseline.json with viral thresholds and differentiators
  - phase: 02-gemini-prompt-video-analysis
    provides: GeminiAnalysis type with rationale/improvement_tip fields, calibration loading pattern
provides:
  - DeepSeekResponseSchema v2 with behavioral predictions and component sub-scores
  - BehavioralPredictionsSchema (completion/share/comment/save pct + percentiles)
  - ComponentScoresSchema (7 sub-scores for Phase 5 aggregator)
  - buildDeepSeekPrompt with 5-step CoT framework and calibration embedding
  - formatGeminiSignals for score-free signal handoff
  - calculateDeepSeekCost with V3.2-reasoning pricing
affects: [05-pipeline-aggregation, 08-ui-results-display]

# Tech tracking
tech-stack:
  added: [node:fs/promises for DeepSeek calibration loading]
  patterns: [5-step CoT prompt framework, score-free signal handoff between LLMs, behavioral prediction output schema]

key-files:
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/deepseek.ts

key-decisions:
  - "5-step CoT framework: Completion, Engagement, Pattern Match, Fatal Flaw, Final Scores"
  - "Behavioral predictions replace refined_score: completion_pct, share_pct, comment_pct, save_pct with percentile context"
  - "7 component sub-scores feed Phase 5 aggregator (hook_effectiveness, retention_strength, shareability, comment_provocation, save_worthiness, trend_alignment, originality)"
  - "Gemini signals stripped of numeric scores — only rationales and improvement tips passed to prevent anchoring"
  - "Token-based cost at V3.2-reasoning pricing ($0.28/1M input, $0.42/1M output) with 1.0 cent soft cap"
  - "Timeout increased from 30s to 45s for reasoning model CoT outputs"
  - "Dead v1 fields (persona_reactions, variants, conversation_themes, refined_score) removed from DeepSeek schema, Zod schemas marked @deprecated"

patterns-established:
  - "formatGeminiSignals(): strips numeric scores from Gemini output for score-free LLM-to-LLM signal handoff"
  - "buildDeepSeekPrompt(): prompt-as-function pattern with calibration + Gemini signals + rule/trend context injection"
  - "calculateDeepSeekCost(): token-based cost with fallback estimates matching Gemini's calculateCost() pattern"
  - "DeepSeekCalibrationData interface: typed subset of calibration-baseline.json for DeepSeek prompt embedding"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 3 Plan 1: DeepSeek Prompt & Model Switch Summary

**5-step CoT behavioral prediction prompt with calibration embedding, score-free Gemini handoff, and V3.2-reasoning token-based cost estimation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T11:58:34Z
- **Completed:** 2026-02-16T12:02:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote DeepSeekResponseSchema v2 with behavioral predictions (completion/share/comment/save pct + percentiles) and 7 component sub-scores for Phase 5 aggregation
- Built 5-step CoT prompt framework embedding calibration data from 7,321 analyzed TikTok videos (share/comment/save rate percentiles, top 5 viral differentiators, duration sweet spot)
- Implemented score-free Gemini signal handoff via formatGeminiSignals() — passes rationales and tips only, preventing DeepSeek from anchoring on Gemini's numeric scores
- Replaced hardcoded cost estimate with token-based pricing at V3.2-reasoning rates ($0.28/1M input, $0.42/1M output)
- Removed dead v1 code: stripThinkTags, REASONING_PROMPT constant, persona_reactions/variants/conversation_themes from DeepSeek output

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite DeepSeekResponseSchema v2 with behavioral predictions** - `d446136` (feat)
2. **Task 2: Rewrite DeepSeek prompt with 5-step CoT, calibration data, and token-based cost** - `24d0eb2` (feat)

## Files Created/Modified
- `src/lib/engine/types.ts` - DeepSeekResponseSchema v2 (behavioral_predictions, component_scores, suggestions, warnings, confidence), BehavioralPredictionsSchema, ComponentScoresSchema; deprecated old Zod schemas
- `src/lib/engine/deepseek.ts` - 5-step CoT prompt via buildDeepSeekPrompt(), formatGeminiSignals() for score-free handoff, calculateDeepSeekCost() with V3.2 pricing, DeepSeekCalibrationData interface, loadCalibrationData() cache

## Decisions Made
- Kept deprecated Zod schemas (PersonaReactionSchema, VariantSchema, ConversationThemeSchema) with JSDoc @deprecated tags because aggregator.ts and UI components still reference them — cleanup deferred to Phase 5
- Used same calibration loading pattern as Gemini (import.meta.url + path.dirname, cached after first read) for consistency
- Video signals in formatGeminiSignals() note presence ("assessed") without numeric values to inform DeepSeek that video analysis occurred
- Warnings array (from CoT Step 4 Fatal Flaw Check) surfaces fatal flaws directly in output — distinct from suggestions
- Confidence is now an enum ("high"/"medium"/"low") based on signal availability, replacing the free-text confidence_reasoning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused variable in formatGeminiSignals**
- **Found during:** Task 2 (DeepSeek prompt rewrite)
- **Issue:** `const vs = analysis.video_signals` was declared but never used (TypeScript strict mode error TS6133)
- **Fix:** Removed the unused variable assignment since video signal presence check doesn't need the values
- **Files modified:** src/lib/engine/deepseek.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors in deepseek.ts
- **Committed in:** 24d0eb2

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial TypeScript strictness fix. No scope creep.

## Issues Encountered
- aggregator.ts has type errors due to referencing old DeepSeek fields (refined_score, confidence_reasoning, persona_reactions, variants, conversation_themes) plus Phase 2 Gemini factor field changes (description -> rationale, tips -> improvement_tip) -- expected per plan, will be fixed in Phase 5 when aggregation formula is rewritten

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DeepSeekResponseSchema v2 with behavioral predictions ready for Phase 5 aggregation formula
- 7 component sub-scores ready for weighted combination in Phase 5
- formatGeminiSignals() pattern ready for reuse if other LLMs added
- aggregator.ts type errors (old DeepSeek fields + old Gemini factor fields) must be fixed in Phase 5
- Deprecated Zod schemas and interfaces must be cleaned up in Phase 5

## Self-Check: PASSED

- FOUND: src/lib/engine/types.ts
- FOUND: src/lib/engine/deepseek.ts
- FOUND: d446136 (Task 1 commit)
- FOUND: 24d0eb2 (Task 2 commit)

---
*Phase: 03-deepseek-prompt-model-switch*
*Completed: 2026-02-16*
