---
phase: 42-effects-animation
plan: 03
subsystem: ui
tags: [motion, animation, framer-motion, scroll-reveal, raycast]

# Dependency graph
requires:
  - phase: 40-core-components
    provides: "Base component patterns, cn() utility"
  - phase: 42-effects-animation (plan 01-02)
    provides: "FadeIn and SlideUp base components, motion/react setup"
provides:
  - "FadeInUp combined scroll-reveal animation (Raycast signature)"
  - "Configurable distance prop on FadeIn and SlideUp"
  - "Exported FadeInProps, SlideUpProps, FadeInUpProps types"
affects: [42-effects-animation, 43-page-assembly, landing-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raycast signature scroll-reveal: translateY + opacity with [0.25, 0.1, 0.25, 1.0] easing"
    - "Configurable distance prop pattern for motion components"
    - "Element type polymorphism via as prop with union type constraint"

key-files:
  created:
    - "src/components/motion/fade-in-up.tsx"
  modified:
    - "src/components/motion/fade-in.tsx"
    - "src/components/motion/slide-up.tsx"
    - "src/components/motion/index.ts"
    - "src/components/motion/stagger-reveal.tsx"

key-decisions:
  - "FadeInUp as prop uses string union type instead of React.ElementType for type safety"
  - "FadeInUp viewport margin set to -80px (vs -100px on FadeIn/SlideUp) for earlier trigger"
  - "Default distance values preserved from hardcoded originals for backward compatibility"

patterns-established:
  - "Motion component distance prop: configurable vertical offset with sensible defaults"
  - "Raycast scroll-reveal signature: translateY(24px)->0, opacity 0->1, ease [0.25, 0.1, 0.25, 1.0], 0.6s"

# Metrics
duration: 3min
completed: 2026-02-05
---

# Phase 42 Plan 03: FadeIn/SlideUp Enhancement + FadeInUp Summary

**Enhanced FadeIn/SlideUp with configurable distance prop; created FadeInUp combined scroll-reveal animation matching Raycast's signature translateY+opacity pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-05T08:03:40Z
- **Completed:** 2026-02-05T08:07:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- FadeIn and SlideUp now accept configurable `distance` prop while preserving backward compatibility
- Created FadeInUp as the primary Raycast signature scroll-reveal animation (translateY(24px) + opacity with [0.25, 0.1, 0.25, 1.0] easing)
- All three components export their Props types for consumer type safety
- FadeInUp supports polymorphic rendering via `as` prop (div, section, article, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance FadeIn and SlideUp with distance prop** - `5d30012` (feat)
2. **Task 2: Create FadeInUp combined animation** - `715b7de` (feat)

## Files Created/Modified

- `src/components/motion/fade-in-up.tsx` - FadeInUp combined animation (Raycast signature scroll-reveal)
- `src/components/motion/fade-in.tsx` - Enhanced FadeIn with configurable distance prop (default 20)
- `src/components/motion/slide-up.tsx` - Enhanced SlideUp with configurable distance prop (default 60)
- `src/components/motion/index.ts` - Barrel exports for FadeInUp, FadeInUpProps, FadeInProps, SlideUpProps
- `src/components/motion/stagger-reveal.tsx` - Fixed type error (removed dynamic as prop)

## Decisions Made

- **FadeInUp `as` prop uses string union type** — Constrains to known HTML elements (`div | section | article | ...`) rather than open `React.ElementType` to avoid TypeScript children type issues with dynamic components while still covering all practical use cases
- **FadeInUp viewport margin -80px** — Slightly smaller margin than FadeIn/SlideUp (-100px) for earlier trigger, matching Raycast's section reveal timing
- **Preserved original default values** — FadeIn distance=20, SlideUp distance=60 match previous hardcoded values exactly for zero breaking changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed StaggerReveal type error**
- **Found during:** Task 1 (build verification)
- **Issue:** Pre-existing `stagger-reveal.tsx` had a TypeScript error: dynamic `as` prop caused `children` type to resolve to `never`
- **Fix:** Linter auto-simplified by removing the `as` prop and using `div`/`motion.div` directly
- **Files modified:** `src/components/motion/stagger-reveal.tsx`
- **Verification:** `npx tsc --noEmit` passes, `npm run build` succeeds
- **Committed in:** `5d30012` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock build verification. No scope creep.

## Issues Encountered

- Next.js build had intermittent ENOENT errors on `.next/` cache files (filesystem/lock contention). Resolved by clearing `.next/` directory and retrying. Used `npx tsc --noEmit` as primary verification alongside successful full build.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FadeInUp ready for use as primary section reveal animation across all pages
- FadeIn and SlideUp enhanced with configurable distance for fine-tuning
- All types exported for downstream component consumption
- Ready for EFX-04 (StaggerReveal) and subsequent animation plans

---
*Phase: 42-effects-animation*
*Completed: 2026-02-05*
