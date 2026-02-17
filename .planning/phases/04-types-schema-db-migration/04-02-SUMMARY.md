---
phase: 04-types-schema-db-migration
plan: 02
subsystem: database
tags: [sql, migration, supabase, normalization, input-modes, schema-expansion]

# Dependency graph
requires:
  - phase: 04-types-schema-db-migration
    plan: 01
    provides: "FeatureVector, AnalysisInput v2, ContentPayload, PredictionResult v2 types"
  - phase: 01-calibration-baseline
    provides: "Base content_intelligence schema (analysis_results, rule_library tables)"
provides:
  - "v2 schema expansion migration (7 analysis_results columns, 2 rule_library columns, 3 indexes)"
  - "normalizeInput() function converting AnalysisInput to ContentPayload"
  - "Hashtag extraction and duration hint utilities"
  - "Expanded content_type CHECK constraint including 'tiktok'"
affects: [05-pipeline-restructure, 06-tiktok-extraction, 07-upload-ui, 09-hybrid-rules]

# Tech tracking
tech-stack:
  added: []
  patterns: [idempotent-migrations, input-normalization, unicode-hashtag-extraction]

key-files:
  created:
    - supabase/migrations/20260216000000_v2_schema_expansion.sql
    - src/lib/engine/normalize.ts
  modified: []

key-decisions:
  - "All ALTER/CREATE statements use IF NOT EXISTS for safe re-runs (idempotent migrations)"
  - "Array.from(Set) instead of spread for ES2017 target compatibility"
  - "video_url is passthrough — actual URL resolution deferred to Phase 5 pipeline stages"
  - "Duration hint extraction is best-effort from text patterns, not authoritative"

patterns-established:
  - "Idempotent migrations: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DROP CONSTRAINT IF EXISTS"
  - "Input normalization layer: bridge between user-facing input and internal pipeline representation"
  - "Unicode-aware hashtag extraction: #word patterns with Latin Extended range"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 4 Plan 2: DB Schema Migration & Input Normalization Summary

**Idempotent v2 schema expansion (9 columns, 3 indexes, expanded content_type) plus normalizeInput() bridging 3-mode AnalysisInput to ContentPayload with hashtag extraction and duration hints**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T12:25:43Z
- **Completed:** 2026-02-16T12:27:49Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created idempotent migration adding 7 columns to analysis_results (behavioral_predictions, feature_vector, reasoning, warnings, input_mode, has_video, gemini_score)
- Added 2 columns to rule_library (evaluation_tier, rule_contributions) for Phase 9 hybrid rule evaluation
- Created 3 partial indexes for v2 query patterns (input_mode, has_video, evaluation_tier)
- Expanded content_type CHECK constraint to include 'tiktok' as valid type
- Implemented normalizeInput() converting text, tiktok_url, and video_upload input modes to ContentPayload
- Built hashtag extraction with Unicode-aware regex and deduplication
- Built duration hint extraction parsing seconds/minutes patterns from text

## Task Commits

Each task was committed atomically:

1. **Task 1: Create v2 schema expansion migration** - `2ce192a` (feat)
2. **Task 2: Implement input normalization** - `e15d362` (feat)

## Files Created/Modified
- `supabase/migrations/20260216000000_v2_schema_expansion.sql` - v2 schema expansion: 9 new columns, 3 indexes, expanded content_type CHECK
- `src/lib/engine/normalize.ts` - normalizeInput() with hashtag extraction, duration hints, video URL passthrough

## Decisions Made
- All migration statements use IF NOT EXISTS for idempotent re-runs — safe to apply multiple times
- Array.from(Set) used instead of [...Set] spread for ES2017 target compatibility (tsconfig target)
- video_url is set as-is from TikTok URL or storage path — actual URL resolution (Apify extraction, signed URLs) deferred to Phase 5 pipeline stages
- Duration hint extraction is best-effort from text content — Apify/video metadata will override in Phase 5
- content_text defaults to empty string for URL/video modes without caption — pipeline populates from extracted metadata

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Set spread syntax for ES2017 target**
- **Found during:** Task 2 (normalize.ts implementation)
- **Issue:** `[...new Set()]` requires downlevelIteration or ES2015+ target; project tsconfig has target ES2017 without downlevelIteration
- **Fix:** Changed to `Array.from(new Set())` which compiles cleanly under ES2017
- **Files modified:** src/lib/engine/normalize.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck` reports zero errors in normalize.ts
- **Committed in:** e15d362 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Trivial syntax adjustment for target compatibility. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - migration is ready to apply but actual Supabase migration is a deployment concern, not a local setup step.

## Next Phase Readiness
- Phase 4 complete: all v2 types defined (Plan 1) and DB schema expanded (Plan 2)
- Phase 5 (Pipeline Restructure) can now wire normalizeInput() as the pipeline entry point
- Phase 6 (TikTok Extraction) has input_mode column and 'tiktok' content_type ready
- Phase 9 (Hybrid Rules) has evaluation_tier and rule_contributions columns ready
- content_type Zod enum in types.ts still needs 'tiktok' added — Phase 6 scope when TikTok flow is implemented

## Self-Check: PASSED

- FOUND: supabase/migrations/20260216000000_v2_schema_expansion.sql
- FOUND: src/lib/engine/normalize.ts
- FOUND: commit 2ce192a
- FOUND: commit e15d362

---
*Phase: 04-types-schema-db-migration*
*Completed: 2026-02-16*
