---
phase: 54-card-surface-corrections
plan: 01
subsystem: ui
tags: [card, header, navbar, glass, border, hover, inset-shadow, tailwind]

# Dependency graph
requires:
  - phase: 53-font-color-foundation
    provides: "Design tokens (gradient-card-bg, gradient-navbar, border-border, border-border-hover)"
provides:
  - "Card, GlassCard with 12px radius, 6% border, inset shadow, hover lift"
  - "FeatureCard with 6%/10% border, 12px radius, inset shadow"
  - "ExtensionCard with border-border token, bg-transparent, inset shadow"
  - "TestimonialCard with border-border, bg-transparent, hover states, inset shadow"
  - "Header with Raycast glass navbar (gradient + blur + border + shadow)"
affects: [55-glass-docs-regression]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cards use gradient-card-bg with 12px radius and inset shadow"
    - "All card hover: -translate-y-0.5, border-border-hover, bg-white/3"
    - "Glass navbar: gradient-navbar + inline blur(5px) + 6% border + 0.15 inset shadow"
    - "backdrop-filter always in inline styles (Lightning CSS strips classes)"

key-files:
  created: []
  modified:
    - "src/components/ui/card.tsx"
    - "src/components/landing/feature-card.tsx"
    - "src/components/ui/extension-card.tsx"
    - "src/components/ui/testimonial-card.tsx"
    - "src/components/layout/header.tsx"

key-decisions:
  - "Cards use bg-transparent instead of bg-surface (gradient overlay handles visual)"
  - "All card variants share consistent hover pattern (lift, border, bg overlay)"
  - "Header uses inline styles for glass pattern (gradient + blur + shadow)"

patterns-established:
  - "Card hover pattern: transition-all duration-150 hover:-translate-y-0.5 hover:border-border-hover hover:bg-white/[0.03]"
  - "Inset shadow pattern: rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset (solid cards)"
  - "Glass inset shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset (glass surfaces)"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 54 Plan 01: Card & Surface Corrections Summary

**All card variants and header fixed to Raycast-exact CSS: 12px radius, 6% borders, inset shadows, consistent hover lift, glass navbar pattern**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T13:12:10Z
- **Completed:** 2026-02-06T13:14:38Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Card and GlassCard updated with 12px radius, 6% border, hover lift+border+bg, inset shadow
- FeatureCard, ExtensionCard, TestimonialCard all corrected to 6% base / 10% hover borders, 12px radius, transparent bg, inset shadow
- Header converted from opaque bg-background to Raycast glass navbar (gradient + blur(5px) + border + inset shadow)
- Mobile menu also uses glass pattern; divider corrected to 6% opacity
- All border-border-glass references eliminated from modified card files

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Card and GlassCard components** - `05d7ca1` (fix)
2. **Task 2: Fix FeatureCard, ExtensionCard, and TestimonialCard** - `9c0159a` (fix)
3. **Task 3: Fix Header with Raycast glass navbar pattern** - `27093e5` (fix)

## Files Created/Modified
- `src/components/ui/card.tsx` - Card: 12px radius, hover states, canonical inset shadow. GlassCard: border-border (6%), 12px radius, hover states
- `src/components/landing/feature-card.tsx` - 6%/10% borders, 12px radius, inset shadow, hover lift
- `src/components/ui/extension-card.tsx` - border-border token, 12px radius, bg-transparent, inset shadow on both render paths
- `src/components/ui/testimonial-card.tsx` - border-border, 12px radius, bg-transparent, hover states, inset shadow, avatar border fixed
- `src/components/layout/header.tsx` - Glass navbar pattern with gradient, blur, border, shadow; mobile menu glass; divider 6%

## Decisions Made
- Cards use bg-transparent instead of bg-surface -- the gradient overlay or gradient-card-bg token handles visual background
- All card variants share the same hover pattern for consistency (lift, border brightening, bg overlay)
- Header glass pattern uses inline styles for backdrop-filter (Lightning CSS strips it from classes)
- boxShadow value order normalized to Raycast canonical format: `rgba(...) 0px 1px 0px 0px inset`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All card variants and header now match Raycast extracted CSS
- Ready for 54-02 (input corrections) and 54-03 (remaining surface fixes)
- Build passes cleanly with all changes

---
*Phase: 54-card-surface-corrections*
*Completed: 2026-02-06*
