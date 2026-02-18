---
phase: 02-ml-model-rehabilitation
plan: 03
subsystem: ml
tags: [retrain-cron, dynamic-training, percentile-tiers, scraped-videos, accuracy-gate]

# Dependency graph
requires:
  - phase: 02-ml-model-rehabilitation
    plan: 01
    provides: "stratifiedSplit, trainModel data-param overload, logPerClassMetrics"
provides:
  - "Dynamic training data generation from scraped_videos with feature extraction"
  - "Percentile-based quintile tier assignment (no hardcoded view thresholds)"
  - "Accuracy gate at 60% preventing bad model deployment"
  - "Fallback to training-data.json when <500 scraped videos"
affects: [05-integration-tests (cron behavior), 06-hardening (monitoring/logging)]

# Tech tracking
tech-stack:
  added: []
  patterns: [percentile-based tier assignment, save estimation proxy (likes*0.15), accuracy-gated deployment]

key-files:
  created: []
  modified:
    - src/app/api/cron/retrain-ml/route.ts

key-decisions:
  - "saveRate uses likes * 0.15 proxy since scraped_videos has no saves column"
  - "Accuracy gate removes uploaded weights from Supabase Storage when <60% (rather than preventing upload)"
  - "Tier assignment uses percentile quintiles (p20/p40/p60/p80) for adaptive thresholds"
  - "Fallback threshold set at 500 videos minimum for dynamic training"

patterns-established:
  - "Dynamic ML training: query live data, generate features, train, gate, persist"
  - "Save estimation: likes * 0.15 as industry proxy for missing saves column"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 2 Plan 03: Retrain-ML Cron Dynamic Data Summary

**Retrain-ML cron rewritten to query scraped_videos, generate 15-feature vectors with save proxy, assign tiers via percentile quintiles, use stratified splitting, and gate model deployment on 60% accuracy**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T10:09:41Z
- **Completed:** 2026-02-18T10:11:48Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Retrain-ML cron now queries up to 10K scraped_videos from Supabase instead of reading static training-data.json
- videoToFeatures() converts raw scraped metrics to 15-element feature vectors matching the model's expected feature order
- assignTiers() uses percentile-based quintiles (p20/p40/p60/p80) for adaptive tier boundaries instead of hardcoded view count thresholds
- Accuracy gate at 60% removes uploaded weights from Supabase Storage, preventing bad models from deploying
- Graceful fallback to training-data.json when fewer than 500 scraped videos are available
- Tier distribution logged on every run for production monitoring

## Task Commits

Both tasks target the same file and were committed together:

1. **Task 1+2: Build helpers + wire dynamic data query, stratified split, accuracy gate, fallback** - `4406cc4` (feat)

## Files Created/Modified

- `src/app/api/cron/retrain-ml/route.ts` - Complete rewrite: dynamic Supabase query, videoToFeatures (15 features with save proxy), assignTiers (percentile quintiles), stratified split, accuracy gate, fallback to training-data.json

## Decisions Made

- **Save estimation proxy:** scraped_videos has no saves column, so saveRate is estimated as `likes * 0.15` (industry proxy for TikTok save-to-like ratio)
- **Accuracy gate approach:** Rather than adding a `skipPersist` option to trainModel, the cron lets trainModel persist normally then removes the bad weights from Supabase Storage if accuracy < 60%. Simpler and avoids changing the ml.ts API further.
- **Percentile quintiles over hardcoded thresholds:** Tier boundaries adapt to the actual distribution of view counts in the data, avoiding stale thresholds as the content landscape evolves.
- **500-video fallback threshold:** Below this count, percentile-based tiers become unreliable, so the cron falls back to the static training data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode array index access**
- **Found during:** Task 1 (tier distribution logging)
- **Issue:** `tierCounts[label - 1]++` fails TypeScript strict null checks ("Object is possibly undefined")
- **Fix:** Added bounds check and nullable coalescing: `tierCounts[idx] = (tierCounts[idx] ?? 0) + 1`
- **Files modified:** src/app/api/cron/retrain-ml/route.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 4406cc4

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 (ML Model Rehabilitation) is now fully complete: all 3 plans done
- ml.ts has class weighting, stratified split, per-class metrics, and data-param overload (Plan 01)
- Aggregator wires ML signal with 0.15 weight into 5-signal scoring (Plan 02)
- Retrain cron generates dynamic training data from scraped_videos (Plan 03)
- Ready for Phase 3+ (Wave 2 parallelizable phases) or Phase 5 (integration tests)

## Self-Check: PASSED

- [x] src/app/api/cron/retrain-ml/route.ts exists
- [x] 02-03-SUMMARY.md exists
- [x] Commit 4406cc4 found (Task 1+2)

---
*Phase: 02-ml-model-rehabilitation*
*Completed: 2026-02-18*
