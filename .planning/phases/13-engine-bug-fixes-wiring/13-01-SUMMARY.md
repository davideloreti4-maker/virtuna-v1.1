---
phase: 13-engine-bug-fixes-wiring
plan: 01
subsystem: api
tags: [supabase, validation, content-type, cron, pipeline]

# Dependency graph
requires:
  - phase: 09-rule-engine-v2
    provides: "rule_contributions JSONB column and per-rule accuracy tracking"
  - phase: 07-creation-flow-v2
    provides: "test-creation-flow with input_mode tabs"
provides:
  - "validate-rules cron correctly fetches rule_contributions for per-rule accuracy"
  - "content_type dynamically mapped from input_mode (text->thread, tiktok_url->video, video_upload->video)"
  - "video_upload guard preventing pipeline crashes from sentinel/placeholder paths"
affects: [validate-rules, analyze-api, test-creation-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Input mode to content type mapping pattern for payload construction"
    - "Sentinel value rejection guard for file upload validation"

key-files:
  created: []
  modified:
    - "src/app/api/cron/validate-rules/route.ts"
    - "src/components/app/test-creation-flow.tsx"
    - "src/app/api/analyze/route.ts"

key-decisions:
  - "text input_mode maps to content_type 'thread' (closest DB enum match for text-only content)"
  - "video_storage_path must start with 'videos/' prefix (Supabase Storage bucket convention)"

patterns-established:
  - "CONTENT_TYPE_MAP: Record<string, string> for input_mode to content_type translation"
  - "Sentinel rejection pattern: check for known placeholder values before pipeline execution"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 13 Plan 01: Engine Bug Fixes Summary

**Three surgical fixes: rule_contributions in cron select, dynamic content_type from input_mode, and video_upload sentinel guard returning 400**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T13:07:01Z
- **Completed:** 2026-02-17T13:08:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- validate-rules cron now includes `rule_contributions` in its Supabase select query, enabling per-rule accuracy computation
- content_type is derived from input_mode via mapping (text->thread, tiktok_url->video, video_upload->video) instead of hardcoded "video"
- video_upload mode with sentinel "pending-upload" or invalid paths returns 400 with user-friendly message instead of pipeline crash

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix validate-rules cron select + content_type derivation** - `da3810e` (fix)
2. **Task 2: Add video_upload guard in analyze API route** - `bfa4027` (fix)

## Files Created/Modified
- `src/app/api/cron/validate-rules/route.ts` - Added rule_contributions to .select() query
- `src/components/app/test-creation-flow.tsx` - Added CONTENT_TYPE_MAP and dynamic content_type in payload
- `src/app/api/analyze/route.ts` - Replaced weak validation with strict sentinel/prefix guard

## Decisions Made
- text input_mode maps to content_type "thread" (closest DB enum match for text-only content)
- video_storage_path must start with "videos/" prefix matching Supabase Storage bucket convention
- Fallback content_type defaults to "video" if input_mode is unrecognized (defensive)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three bugs fixed, build passes cleanly
- Ready for Plan 02 of phase 13

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both commits (da3810e, bfa4027) verified in git log
- SUMMARY.md created at expected path
- Build passes with zero errors

---
*Phase: 13-engine-bug-fixes-wiring*
*Completed: 2026-02-17*
