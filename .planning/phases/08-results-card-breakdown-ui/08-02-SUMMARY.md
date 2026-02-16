---
phase: 08-results-card-breakdown-ui
plan: 02
subsystem: ui
tags: [react, tailwind, behavioral-predictions, suggestions, stat-cards, effort-tags]

# Dependency graph
requires:
  - phase: 04-types-and-contracts
    provides: BehavioralPredictions and Suggestion types from engine/types.ts
  - phase: 08-results-card-breakdown-ui/01
    provides: FactorBreakdown component pattern (plan 01 established v2 results component pattern)
provides:
  - BehavioralPredictionsSection component (4 stat cards with percentile context)
  - SuggestionsSection component (after-only format with effort tags)
  - Backward-compatible InsightsSection re-export for transition
affects: [08-results-card-breakdown-ui/03, results-panel-rewiring]

# Tech tracking
tech-stack:
  added: []
  patterns: [stat-card-grid-responsive, effort-tag-mapping, caption-for-xs-text]

key-files:
  created:
    - src/components/app/simulation/behavioral-predictions.tsx
  modified:
    - src/components/app/simulation/insights-section.tsx

key-decisions:
  - "Used Caption component for xs-sized text (Text only supports sm/base/lg)"
  - "Effort tag mapping: high=Quick Win, medium=Medium, low=Major via Badge variants"
  - "Added backward-compat InsightsSection re-export to avoid breaking existing imports before Plan 3 rewires"
  - "GlassCard blur=sm glow=false for stat cards — subtle glass without heavy blur"

patterns-established:
  - "Stat card pattern: GlassCard p-3 with Caption label, bold value, Caption percentile, GlassProgress"
  - "Effort tag mapping: priority -> human-readable effort label with semantic Badge variant"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 8 Plan 2: Behavioral Predictions & Suggestions Summary

**4 responsive stat cards (completion/share/comment/save %) with percentile context, plus after-only suggestions with effort tags (Quick Win/Medium/Major)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T17:02:12Z
- **Completed:** 2026-02-16T17:05:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- BehavioralPredictionsSection renders 4 stat cards with percentage values, percentile context, and coral progress bars
- Responsive grid: 2x2 on narrow screens, 4-across on lg breakpoint
- SuggestionsSection replaces old InsightsSection with v2 Suggestion[] data shape
- Effort tags (Quick Win / Medium / Major) mapped from suggestion priority via Badge variants
- All suggestions visible with no collapse/show-more pattern
- Backward-compatible InsightsSection re-export preserved for Plan 3 transition

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BehavioralPredictions stat cards component** - `8a47662` (feat)
2. **Task 2: Rewrite InsightsSection to SuggestionsSection with effort tags** - `815de64` (feat)

## Files Created/Modified
- `src/components/app/simulation/behavioral-predictions.tsx` - New BehavioralPredictionsSection with 4 stat cards (completion, share, comment, save rates)
- `src/components/app/simulation/insights-section.tsx` - Rewritten from v1 InsightsSection (string[]) to v2 SuggestionsSection (Suggestion[]) with effort tags

## Decisions Made
- Used Caption component for xs-sized text since Text only supports sm/base/lg sizes
- Effort tag mapping: high priority = "Quick Win" (success badge), medium = "Medium" (warning), low = "Major" (default)
- GlassCard with blur="sm" and glow={false} for lightweight glass aesthetic on stat cards
- Added backward-compatible InsightsSection re-export to prevent compilation errors in existing consumers until Plan 3 rewires them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Text size="xs" type error**
- **Found during:** Task 1 (BehavioralPredictions component)
- **Issue:** Plan specified `Text size="xs"` but Text component only accepts "sm" | "base" | "lg"
- **Fix:** Used Caption component (renders text-xs text-foreground-muted) instead of Text with unsupported xs size
- **Files modified:** src/components/app/simulation/behavioral-predictions.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** 8a47662 (Task 1 commit)

**2. [Rule 3 - Blocking] Added backward-compatible InsightsSection re-export**
- **Found during:** Task 2 (SuggestionsSection rewrite)
- **Issue:** Renaming InsightsSection to SuggestionsSection broke imports in app/index.ts and results-panel.tsx
- **Fix:** Added `export const InsightsSection = SuggestionsSection` at end of file for backward compatibility
- **Files modified:** src/components/app/simulation/insights-section.tsx
- **Verification:** app/index.ts and insights-section.tsx compile without import errors
- **Committed in:** 815de64 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- results-panel.tsx has pre-existing type errors from v1 prop shapes being passed to already-v2 components (ImpactScore, AttentionBreakdown, InsightsSection). This is expected and will be resolved by Plan 3 (ResultsPanel rewiring).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BehavioralPredictionsSection and SuggestionsSection ready to be integrated into ResultsPanel by Plan 3
- Both components accept v2 data shapes (BehavioralPredictions type, Suggestion[] type)
- InsightsSection backward-compat export can be removed once Plan 3 rewires ResultsPanel

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/components/app/simulation/behavioral-predictions.tsx
- FOUND: src/components/app/simulation/insights-section.tsx
- FOUND: .planning/phases/08-results-card-breakdown-ui/08-02-SUMMARY.md
- FOUND: commit 8a47662
- FOUND: commit 815de64

---
*Phase: 08-results-card-breakdown-ui*
*Completed: 2026-02-16*
