---
phase: 56-earnings-tab
plan: 02
subsystem: ui
tags: [recharts, area-chart, motion, framer-motion, tailwind, earnings, period-selector]

# Dependency graph
requires:
  - phase: 53-foundation-tab-shell
    provides: design tokens (border-subtle, surface-elevated, foreground-muted, accent)
  - phase: 56-earnings-tab plan 01
    provides: MonthlyEarning type, formatCurrency utility, Recharts installed
provides:
  - EarningsPeriodSelector component with sliding pill animation
  - EarningsChart component with coral gradient area chart and dark tooltip
affects: [56-earnings-tab plan 03 (EarningsTab container wires these components)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recharts v3 custom tooltip via function content prop (not JSX element)"
    - "Unique SVG gradient IDs to prevent cross-chart collisions"
    - "Unique motion layoutId per animation context to prevent cross-component conflicts"

key-files:
  created:
    - src/components/app/brand-deals/earnings-period-selector.tsx
    - src/components/app/brand-deals/earnings-chart.tsx
  modified: []

key-decisions:
  - "[DEC-56-02-01] Use TooltipContentProps (not TooltipProps) for Recharts v3 custom tooltip"
  - "[DEC-56-02-02] Pass tooltip as function content prop (not JSX element) for Recharts v3 type safety"

patterns-established:
  - "Recharts v3 custom tooltip pattern: function content prop with TooltipContentProps type"
  - "SVG gradient ID namespacing: prefix with component name (earnings-area-gradient)"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 56 Plan 02: Earnings Chart & Period Selector Summary

**Recharts area chart with coral/orange gradient fill, solid dark tooltip, and sliding pill period selector using motion layoutId**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T10:47:18Z
- **Completed:** 2026-02-06T10:49:25Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- EarningsPeriodSelector with four period pills (7D, 30D, 90D, All Time) and spring-animated sliding pill
- EarningsChart with coral (#FF7F50) gradient fill area chart, dark-themed axes, and horizontal grid lines
- Solid dark tooltip (#222326 bg, no blur) displaying formatted month and currency value
- Unique layoutId and SVG gradient ID to prevent animation/rendering conflicts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EarningsPeriodSelector component** - `037be7a` (feat)
2. **Task 2: Create EarningsChart component** - `ce70e23` (feat)

## Files Created/Modified
- `src/components/app/brand-deals/earnings-period-selector.tsx` - Period selector with 4 pills (7D/30D/90D/All Time), motion layoutId sliding pill animation, keyboard a11y
- `src/components/app/brand-deals/earnings-chart.tsx` - Recharts AreaChart with coral gradient fill, dark-themed axes (white/0.4), horizontal grid (white/0.04), solid dark tooltip, 1s mount animation

## Decisions Made
- [DEC-56-02-01] Used `TooltipContentProps` instead of `TooltipProps` for Recharts v3 -- the v3 API splits tooltip configuration props from content render props
- [DEC-56-02-02] Passed custom tooltip as function content prop (`content={EarningsTooltip}`) instead of JSX element (`content={<EarningsTooltip />}`) -- Recharts v3 requires this for proper type safety since `TooltipContentProps` has required fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Recharts v3 TooltipProps type mismatch**
- **Found during:** Task 2 (EarningsChart creation)
- **Issue:** Plan specified `TooltipProps<number, string>` for custom tooltip, but Recharts v3 moved `active`, `payload`, `label` to `TooltipContentProps` (separate from `TooltipProps` which is for the `<Tooltip>` component itself)
- **Fix:** Changed import to `TooltipContentProps`, passed tooltip as function reference instead of JSX element
- **Files modified:** src/components/app/brand-deals/earnings-chart.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** ce70e23 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary type correction for Recharts v3 API. No scope creep.

## Issues Encountered
None beyond the auto-fixed type mismatch above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both presentational components ready for EarningsTab container (Plan 03)
- EarningsPeriodSelector exports `Period` type for state management
- EarningsChart accepts `MonthlyEarning[]` data prop from container
- Chart uses unique gradient ID and layoutId -- safe to compose alongside other charts/tabs

---
*Phase: 56-earnings-tab*
*Completed: 2026-02-06*
