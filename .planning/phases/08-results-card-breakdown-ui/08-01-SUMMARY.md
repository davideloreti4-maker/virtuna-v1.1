---
phase: 08-results-card-breakdown-ui
plan: 01
subsystem: ui
tags: [react, tailwind, glassmorphism, expand-animation, prediction-result]

# Dependency graph
requires:
  - phase: 04-type-definitions
    provides: "PredictionResult, Factor, ConfidenceLevel types"
  - phase: 15-foundation-primitives
    provides: "GlassProgress, GlassCard, Badge, Text components"
provides:
  - "ImpactScore component accepting v2 overall_score + confidence_label"
  - "FactorBreakdown component accepting v2 Factor[] with expand-on-click"
affects: [08-02, 08-03, results-page-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns: ["score-range color mapping (coral/default/purple)", "expand-on-click with max-h CSS transition", "fixed display order for factor list consistency"]

key-files:
  modified:
    - src/components/app/simulation/impact-score.tsx
    - src/components/app/simulation/attention-breakdown.tsx

key-decisions:
  - "Fixed factor order (Scroll-Stop, Completion, Rewatch, Share, Emotional) for muscle memory over worst-first sort"
  - "Score color thresholds: >=7 coral, >=4 default, <4 purple"
  - "GlassCard with className p-4 instead of non-existent padding prop"
  - "FactorBreakdown re-exported as AttentionBreakdown for backward compat during migration"

patterns-established:
  - "Factor color mapping: getFactorColor(score) -> coral/default/purple by threshold"
  - "Expand-on-click: max-h-0/max-h-24 transition with opacity for smooth reveal"
  - "Confidence badge config: Record<ConfidenceLevel, {variant, text}> lookup"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 8 Plan 1: Results Card & Breakdown UI Summary

**Hero score with confidence badge and 5-factor TikTok breakdown with expand-on-click tips using v2 PredictionResult types**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T17:02:28Z
- **Completed:** 2026-02-16T17:04:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ImpactScore rewritten to accept v2 overall_score + confidence_label with Badge display
- FactorBreakdown replaces v1 AttentionBreakdown with 5 TikTok factors, horizontal progress bars, and expand-on-click improvement tips
- Both components use v2 PredictionResult data shapes directly with no v1 type imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite ImpactScore to v2 hero score with confidence badge** - `21d39b1` (feat)
2. **Task 2: Rewrite AttentionBreakdown to v2 FactorBreakdown with expand-on-click** - `b527af4` (feat)

## Files Created/Modified
- `src/components/app/simulation/impact-score.tsx` - Hero score display with /100, confidence badge, score label
- `src/components/app/simulation/attention-breakdown.tsx` - 5-factor breakdown with progress bars and expandable tips

## Decisions Made
- Fixed factor display order (Scroll-Stop, Completion, Rewatch, Share, Emotional) chosen over worst-first sort for consistency and muscle memory
- Score color thresholds: >=7 coral (good), >=4 default (mid-range), <4 purple (low) per LOCKED decision
- Used `className="p-4"` instead of non-existent `padding="md"` prop on GlassCard for correct TypeScript typing
- Re-exported FactorBreakdown as AttentionBreakdown for backward compatibility during the migration period (Plan 3 will update imports)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ImpactScore and FactorBreakdown ready to be wired into the results page (Plan 3)
- Both components accept v2 PredictionResult fields directly
- Old consumers will get type errors until Plan 3 updates their props (expected)

## Self-Check: PASSED

- FOUND: src/components/app/simulation/impact-score.tsx
- FOUND: src/components/app/simulation/attention-breakdown.tsx
- FOUND: .planning/phases/08-results-card-breakdown-ui/08-01-SUMMARY.md
- FOUND: commit 21d39b1
- FOUND: commit b527af4

---
*Phase: 08-results-card-breakdown-ui*
*Completed: 2026-02-16*
