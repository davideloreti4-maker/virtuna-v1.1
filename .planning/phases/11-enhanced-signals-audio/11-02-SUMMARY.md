---
phase: 11-enhanced-signals-audio
plan: 02
subsystem: engine
tags: [hashtag-scoring, saturation-detection, popularity-weighting, trends, feature-vector]

requires:
  - phase: 11-enhanced-signals-audio
    plan: 01
    provides: Fuzzy sound matching + trends infrastructure + audioTrendingMatch wiring
  - phase: 05-pipeline-architecture
    provides: FeatureVector assembly with hashtagRelevance placeholder
provides:
  - Semantic hashtag scoring with popularity weighting and saturation detection
  - hashtag_relevance (0-1) in TrendEnrichment for FeatureVector consumption
  - Quality-weighted trend_score contribution replacing raw count
affects: [12-e2e-testing]

tech-stack:
  added: []
  patterns: [log-scaled popularity weighting, blocklist + frequency saturation detection]

key-files:
  created: []
  modified:
    - src/lib/engine/trends.ts
    - src/lib/engine/types.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/pipeline.ts

key-decisions:
  - "Saturation blocklist: #fyp, #foryou, #foryoupage, #viral, #trending, #xyzbca"
  - "Saturation threshold: hashtag appearing in > 40% of scraped videos"
  - "Log10-scaled popularity prevents mega-view tags from dominating relevance"
  - "maxExpectedRelevance = 3 calibration: user with 3 highly-relevant trending hashtags scores ~1.0"
  - "Saturated tags contribute 10% of normal weight to trend_score (not useless, just not differentiating)"

patterns-established:
  - "Hashtag frequency map from scraped videos for popularity-weighted scoring"
  - "Dual saturation detection: hardcoded blocklist + dynamic frequency threshold"

duration: 2min
completed: 2026-02-17
---

# Plan 11-02: Semantic Hashtag Scoring Summary

**Log-scaled popularity weighting with dual saturation detection replaces naive hashtag overlap counting, delivering 0-1 hashtag_relevance to FeatureVector**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-17T07:57:35Z
- **Completed:** 2026-02-17T07:59:54Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Hashtag frequency map built from scraped videos (count + totalViews per tag)
- Dual saturation detection: hardcoded blocklist (#fyp, #viral, etc.) AND dynamic 40% frequency threshold
- Log10-scaled popularity weighting prevents mega-view tags from dominating scores
- hashtag_relevance (0-1) added to TrendEnrichment type and returned from enrichWithTrends
- FeatureVector.hashtagRelevance wired from trendEnrichment.hashtag_relevance (replaces placeholder 0)
- trend_score hashtag contribution now quality-weighted (max 30) instead of raw count

## Task Commits

1. **Task 1: Semantic hashtag scoring with popularity weighting and saturation detection** - `3732dcc` (feat)

## Files Created/Modified
- `src/lib/engine/trends.ts` - Replaced naive hashtagOverlap with frequency map, saturation detection, popularity-weighted scoring
- `src/lib/engine/types.ts` - Added `hashtag_relevance: number` to TrendEnrichment interface
- `src/lib/engine/aggregator.ts` - Wired `trendEnrichment.hashtag_relevance` into FeatureVector assembly
- `src/lib/engine/pipeline.ts` - Added `hashtag_relevance: 0` to fallback TrendEnrichment objects

## Decisions Made
- Log10 scaling for view counts prevents extreme outliers (billion-view tags) from dominating
- maxExpectedRelevance = 3 as calibration constant: a user using 3 highly-relevant trending hashtags scores 1.0
- Saturated tags still contribute to trend_score at 10% weight (they indicate platform awareness, just not differentiation)
- Array.from(new Set()) for ES2017 target compatibility (consistent with project convention from 04-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added hashtag_relevance to pipeline.ts fallback TrendEnrichment objects**
- **Found during:** Task 1 (type-check verification)
- **Issue:** Two fallback TrendEnrichment objects in pipeline.ts (DEFAULT_TREND_ENRICHMENT and DeepSeek placeholder) were missing the new hashtag_relevance field
- **Fix:** Added `hashtag_relevance: 0` to both objects
- **Files modified:** src/lib/engine/pipeline.ts
- **Verification:** TypeScript type-check passes
- **Committed in:** 3732dcc (part of task commit)

**2. [Rule 3 - Blocking] Used Array.from(Set) instead of Set iteration**
- **Found during:** Task 1 (type-check verification)
- **Issue:** `for (const tag of userHashtags)` where userHashtags was a Set triggers TS error with ES2017 target (no downlevelIteration)
- **Fix:** Changed to `Array.from(new Set(...))` consistent with project convention established in Phase 04-02
- **Files modified:** src/lib/engine/trends.ts
- **Verification:** TypeScript type-check passes
- **Committed in:** 3732dcc (part of task commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 11 signals now complete (fuzzy sound matching, hashtag relevance, audio trending match)
- hashtagRelevance and audioTrendingMatch feed real data to ML model via featureVectorToMLInput
- Ready for Phase 12 end-to-end testing

---
*Phase: 11-enhanced-signals-audio*
*Completed: 2026-02-17*
