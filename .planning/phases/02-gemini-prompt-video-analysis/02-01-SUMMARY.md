---
phase: 02-gemini-prompt-video-analysis
plan: 01
subsystem: api
tags: [gemini, tiktok, video-analysis, zod, prompt-engineering, calibration]

# Dependency graph
requires:
  - phase: 01-data-analysis
    provides: calibration-baseline.json with viral thresholds and differentiators
provides:
  - GeminiResponseSchema v2 with 5 TikTok-aligned factors
  - analyzeWithGemini (text) with calibration-embedded prompt
  - analyzeVideoWithGemini (video) with file upload/poll/cleanup
  - GeminiVideoResponseSchema with 4 video production signals
  - Token-based cost estimation for Gemini Flash
affects: [04-deepseek-integration, 05-pipeline-aggregation, 07-video-upload-flow]

# Tech tracking
tech-stack:
  added: [node:fs/promises for runtime calibration loading]
  patterns: [calibration data embedding in LLM prompts, Gemini Files API upload/poll/cleanup lifecycle, token-based cost estimation]

key-files:
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/gemini.ts

key-decisions:
  - "5 TikTok factors replace 5 generic factors: Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge"
  - "Absolute scoring (not niche-relative) with most content 4-7, above 8 exceptional"
  - "Calibration thresholds embedded in prompt at runtime from calibration-baseline.json"
  - "Token-based cost estimation with Flash pricing ($0.15/1M input, $0.60/1M output)"
  - "Video analysis as separate function (not merged with text) for different input shapes"
  - "50MB video size cap as safety net before Phase 7 upstream validation"
  - "Video errors fail hard with no fallback to text mode"

patterns-established:
  - "CalibrationData interface: typed subset of calibration-baseline.json for prompt embedding"
  - "loadCalibrationData(): cached runtime file read for server-side calibration data"
  - "buildTextPrompt/buildVideoPrompt: prompt-as-function pattern with calibration + niche injection"
  - "calculateCost(): token-based cost with fallback estimates when usageMetadata unavailable"
  - "Gemini Files API lifecycle: upload -> poll PROCESSING->ACTIVE -> analyze -> delete in finally"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 2 Plan 1: Gemini Prompt & Video Analysis Summary

**TikTok-aligned 5-factor Gemini prompt with calibration embedding + video analysis via Gemini Files API upload**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T10:53:52Z
- **Completed:** 2026-02-16T10:57:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced 5 generic content factors with 5 TikTok-specific factors (Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge) each with score/rationale/improvement_tip
- Embedded calibration thresholds from 7,321-video analysis into Gemini prompt (viral share rate, WES p90, duration sweet spot, top 3 differentiators)
- Added full video analysis path with Gemini Files API upload, processing poll, video-specific prompt with 4 video signals, and file cleanup
- Switched from hardcoded cost to token-based estimation with Flash pricing and soft cost caps

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Rewrite GeminiResponseSchema v2 + Video analysis path** - `fdc0b4b` (feat)
   - Both tasks modify the same 2 files (types.ts, gemini.ts) and were implemented together as a single coherent change

## Files Created/Modified
- `src/lib/engine/types.ts` - GeminiResponseSchema v2 (5 factors), GeminiVideoResponseSchema, GeminiVideoSignalsSchema, FactorSchema updated
- `src/lib/engine/gemini.ts` - Rewritten prompt with calibration embedding, text + video analysis paths, token-based costs, Gemini Files API lifecycle

## Decisions Made
- Merged Task 1 and Task 2 into a single commit because both tasks modify the same two files and the video schema/function depends on the text schema rewrite
- Used `import.meta.url` + `path.dirname` to resolve calibration-baseline.json relative to the module (ESM-compatible)
- Used `new Uint8Array(buffer)` to convert Node.js Buffer to BlobPart (TypeScript strict compatibility)
- Set video timeout to 30s (vs 15s for text) and video poll timeout to 60s for Gemini Files API processing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Buffer to Blob type incompatibility**
- **Found during:** Task 2 (Video analysis implementation)
- **Issue:** `new Blob([videoBuffer])` fails TypeScript strict checks because Node.js Buffer's `buffer` property returns `ArrayBufferLike` (which includes `SharedArrayBuffer`) but `BlobPart` expects `ArrayBuffer`
- **Fix:** Wrapped with `new Uint8Array(videoBuffer)` which extracts a clean ArrayBufferView
- **Files modified:** src/lib/engine/gemini.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors in gemini.ts
- **Committed in:** fdc0b4b

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary TypeScript strictness fix. No scope creep.

## Issues Encountered
- aggregator.ts has type errors due to referencing old `description` and `tips` fields on factors -- this is expected per the plan (verification item 10) and will be fixed in Phase 4/5 when the aggregation formula is rewritten

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GeminiResponseSchema v2 ready for downstream consumption in Phase 4 (DeepSeek) and Phase 5 (pipeline/aggregation)
- Video analysis function ready for Phase 7 (video upload flow) to call
- aggregator.ts type errors (description -> rationale, tips -> improvement_tip) must be fixed in Phase 5
- Calibration data loading pattern established for reuse in other modules

## Self-Check: PASSED

- FOUND: src/lib/engine/types.ts
- FOUND: src/lib/engine/gemini.ts
- FOUND: fdc0b4b (Task 1+2 commit)

---
*Phase: 02-gemini-prompt-video-analysis*
*Completed: 2026-02-16*
