---
phase: 10-calibration-ml-training
plan: 03
subsystem: ml
tags: [training-data, feature-extraction, machine-learning, supabase, tiktok]

# Dependency graph
requires:
  - phase: 01-data-analysis
    provides: calibration-baseline.json with WES percentile thresholds for tier assignment
provides:
  - Training data extraction script (scripts/extract-training-data.ts)
  - ML-ready training dataset (src/lib/engine/training-data.json) with 15 features and 1-5 virality labels
affects: [10-04 ML model training, calibration pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [feature-normalization-0-1, deterministic-shuffle-fisher-yates, seed-based-reproducibility]

key-files:
  created:
    - scripts/extract-training-data.ts
    - src/lib/engine/training-data.json
  modified: []

key-decisions:
  - "All 15 features normalized to 0-1 range for ML compatibility (clamped via clamp01)"
  - "Deterministic Fisher-Yates shuffle using video ID hash seeds for reproducible train/test splits"
  - "Virality tier assignment reuses calibration-baseline.json WES percentile thresholds (p25/p50/p75/p90)"
  - "No extreme outlier filtering (unlike analyze-dataset.ts) -- let ML model learn from full distribution"

patterns-established:
  - "Feature extraction pattern: standalone script with dotenv + service role Supabase client"
  - "Training data JSON format: featureNames array + trainSet/testSet with features[][] and labels[]"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 10 Plan 3: Training Data Extraction Summary

**15-feature ML training dataset extracted from 7358 scraped TikTok videos with WES-based virality tier labels and 80/20 deterministic split**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T18:21:06Z
- **Completed:** 2026-02-16T18:22:55Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Extracted 15 normalized features per video: engagement rates (share/comment/like/save), depth ratios (share-to-like, comment-to-like), duration, hashtag count, sound presence, caption length, follower tier, views-per-follower, weekday/hour posted
- Assigned virality tier labels 1-5 using WES percentile thresholds from calibration-baseline.json
- Produced 5886 train / 1472 test samples with deterministic reproducible split
- All features verified in 0-1 range via spot checks across multiple samples

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extract-training-data.ts script** - `2d81113` (feat)

## Files Created/Modified
- `scripts/extract-training-data.ts` - Training data extraction script (fetches from Supabase, extracts features, assigns labels, splits train/test)
- `src/lib/engine/training-data.json` - Output dataset (7358 samples, 15 features, 5 virality tiers)

## Decisions Made
- All 15 features normalized to 0-1 range using domain-specific normalization (duration/180, hashtags/30, caption/2000, views-per-follower/50)
- Deterministic shuffle uses simple hash of video ID + index as Fisher-Yates seed for reproducibility
- Follower tier encoded as ordinal: nano=0.1, micro=0.3, mid=0.5, macro=0.7, mega=0.9, unknown=0.5
- Binary features (hasTrendingSound, hasFollowerData) encoded as 0/1
- No p99.5 extreme outlier filtering (unlike analyze-dataset.ts) -- only removes zero views and null duration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Training data ready for ML model consumption in Plan 10-04
- JSON format with separate train/test sets, feature name array, and label arrays
- Label distribution: tier 1: 1836, tier 2: 1844, tier 3: 1843, tier 4: 1100, tier 5: 735

---
*Phase: 10-calibration-ml-training*
*Completed: 2026-02-16*
