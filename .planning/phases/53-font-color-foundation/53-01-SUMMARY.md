---
phase: 53-font-color-foundation
plan: 01
subsystem: ui
tags: [inter, fonts, css-tokens, tailwind-v4, design-system, raycast]

# Dependency graph
requires: []
provides:
  - "--font-sans Inter-based CSS variable on all pages"
  - "Hex gray scale tokens (50-300) for accurate Tailwind v4 compilation"
  - "--gradient-card-bg at 137deg with Raycast color stops"
  - "--gradient-glass token for glass surfaces"
  - "--shadow-button-secondary token for secondary buttons"
  - "Body line-height 1.5 and letter-spacing 0.2px"
  - "FontFamilyToken, GradientToken, ShadowToken types updated"
affects:
  - "53-02 (component font-display class removal)"
  - "54-card-surface (card gradient and shadow usage)"
  - "55-glass-docs-regression (glass gradient, regression tests)"

# Tech tracking
tech-stack:
  added: ["Inter (next/font/google)"]
  patterns:
    - "Single font family (Inter) for all text, matching Raycast 1:1"
    - "Hex values for dark gray tokens in @theme to avoid oklch compilation inaccuracy"
    - "Glass gradient as named token for reusable glass surfaces"

key-files:
  created: []
  modified:
    - "src/app/globals.css"
    - "src/app/(app)/layout.tsx"
    - "src/app/(marketing)/layout.tsx"
    - "src/types/design-tokens.ts"

key-decisions:
  - "Inter as sole font family -- no display font, matching Raycast exactly"
  - "Gray 50-300 as hex (not oklch) -- prevents Tailwind v4 compilation inaccuracy for light grays"
  - "gradient-glass token identical to gradient-navbar -- same Raycast glass pattern, separate semantic name"

patterns-established:
  - "All font loading via next/font/google with --font-inter CSS variable"
  - "Gray scale: hex for light values (50-300), hex for dark values (400+) -- no oklch in gray tokens"

# Metrics
duration: 3min
completed: 2026-02-06
---

# Phase 53 Plan 01: Font & Color Foundation Summary

**Inter font via next/font/google replacing Satoshi/Funnel Display, gray tokens as hex, Raycast-accurate 137deg card gradient, new glass gradient and button-secondary shadow tokens**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-06T11:32:33Z
- **Completed:** 2026-02-06T11:35:55Z
- **Tasks:** 3
- **Files modified:** 4 (+ 3 font files deleted)

## Accomplishments

- Both layout files now load Inter from next/font/google with --font-inter CSS variable
- All 4 gray oklch tokens (50-300) converted to exact hex values for accurate Tailwind v4 compilation
- Card gradient corrected from 180deg to 137deg with Raycast-extracted color stops (#111214, #0c0d0f)
- New --gradient-glass and --shadow-button-secondary tokens added
- Body line-height fixed from 1.15 to 1.5
- Satoshi woff2 font files and src/fonts/ directory deleted
- TypeScript types updated: FontFamilyToken, GradientToken, ShadowToken

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite font loading in both layout files to use Inter** - `6d600e8` (feat)
2. **Task 2: Overhaul globals.css tokens (fonts, colors, gradients, shadows, body styles)** - `4157d95` (feat)
3. **Task 3: Delete Satoshi font files and update FontFamilyToken type** - `bd58dbe` (feat)

## Files Created/Modified

- `src/app/(app)/layout.tsx` - App route group: Inter font loading, --font-inter CSS variable
- `src/app/(marketing)/layout.tsx` - Marketing route group: Inter font loading, --font-inter CSS variable
- `src/app/globals.css` - Font tokens, gray hex values, 137deg card gradient, glass gradient, button-secondary shadow, body line-height 1.5, removed h1/h2 font-display rule
- `src/types/design-tokens.ts` - FontFamilyToken sans 'display', GradientToken + navbar/glass, ShadowToken + button/button-secondary
- `src/fonts/Satoshi-Regular.woff2` - DELETED
- `src/fonts/Satoshi-Medium.woff2` - DELETED
- `src/fonts/Satoshi-Bold.woff2` - DELETED

## Decisions Made

- **Inter as sole font** -- Raycast uses Inter for all text. No display font needed. Simplifies font loading and eliminates Funnel Display import.
- **Hex for gray 50-300** -- Tailwind v4 compiles oklch to hex at build time with inaccuracy for certain values. Using exact hex ensures pixel-perfect output.
- **gradient-glass = gradient-navbar values** -- Both use the same Raycast glass pattern (137deg, rgba stops) but glass is a semantic name for general glass surfaces while navbar is specific to navigation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **No node_modules installed** -- This is a git worktree without dependencies. Ran `npm install` to enable tsc verification. node_modules is gitignored so this doesn't affect commits.
- **showcase/page.tsx has Satoshi references** -- Expected per plan note. These are in a legacy showcase component, not in layout files. Plan 02 handles component-level cleanup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Font and color foundation is in place for all subsequent Phase 53 plans
- Plan 02 can now safely remove `font-display` class from 11 component files (the token no longer exists)
- Phase 54 card/surface corrections can use the new 137deg gradient and glass tokens
- **Known:** `npx next build` will show errors from components still using `font-display` class -- this is expected and resolved in Plan 02

---
*Phase: 53-font-color-foundation*
*Completed: 2026-02-06*
