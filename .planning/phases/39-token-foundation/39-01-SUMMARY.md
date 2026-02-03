---
phase: 39-token-foundation
plan: 01
subsystem: ui
tags: [design-tokens, raycast, playwright, glassmorphism, typography, css]

# Dependency graph
requires:
  - phase: none (first extraction phase)
    provides: fresh start after reset
provides:
  - Raycast design token extraction data (39-EXTRACTION-DATA.md)
  - Navbar glassmorphism values (blur, gradients, borders)
  - Homepage hero typography (h1, subtitle, CTAs)
  - Brand color identification (#ff6363 to replace with coral #FF7F50)
  - Font stack documentation (Inter, JetBrains Mono, Geist Mono)
  - Multiple glassmorphism patterns (navbar, window, dropdown, cards)
  - Spacing and border-radius scales
  - 9 verification screenshots
affects: [39-02, 39-03, 40-components, globals.css]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Playwright MCP extraction workflow (navigate, screenshot, evaluate, document)
    - Glassmorphism pattern library (5px to 48px blur variants)
    - Dark-mode first color palette (body #07080a, text #ffffff)

key-files:
  created:
    - .planning/phases/39-token-foundation/39-EXTRACTION-DATA.md
    - .planning/phases/39-token-foundation/screenshots/01-navbar.png
    - .planning/phases/39-token-foundation/screenshots/02-homepage-hero.png
    - .planning/phases/39-token-foundation/screenshots/03-button-hover.png
    - .planning/phases/39-token-foundation/screenshots/04-section-1.png
    - .planning/phases/39-token-foundation/screenshots/04-section-2.png
    - .planning/phases/39-token-foundation/screenshots/04-section-3.png
    - .planning/phases/39-token-foundation/screenshots/04-section-4.png
    - .planning/phases/39-token-foundation/screenshots/04-section-5.png
    - .planning/phases/39-token-foundation/screenshots/04-section-6.png
  modified: []

key-decisions:
  - "Brand color identified: Raycast uses #ff6363 (red) - will be replaced with #FF7F50 (coral)"
  - "Font stack: Inter (variable 300-700), JetBrains Mono, Geist Mono"
  - "Glassmorphism blur scale: 5px (navbar) to 48px (action bars)"
  - "Page background: #07080a (near-black)"

patterns-established:
  - "Glassmorphism: backdrop-filter blur + rgba gradient + white/6% border + inset box-shadow"
  - "Button shadows: multi-layer box-shadow for depth (outer ring + glow + inset top/bottom)"
  - "Typography scale: 14px (nav), 16px (small), 18px (body), 20px (h2), 56-64px (h1)"

# Metrics
duration: ~25min
completed: 2026-02-03
---

# Phase 39 Plan 01: Homepage Extraction Summary

**Real Playwright extraction of Raycast navbar + homepage tokens with 9 verification screenshots and comprehensive glassmorphism documentation**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-03
- **Completed:** 2026-02-03
- **Tasks:** 4 auto tasks + 1 checkpoint (approved)
- **Files created:** 10 (1 extraction doc + 9 screenshots)

## Accomplishments

- Extracted global navbar with glassmorphism values (blur 5px, gradient, white/6% border, inset shadow)
- Documented hero typography (h1: 64px/600, subtitle: 18px/400, Inter font)
- Identified Raycast brand color #ff6363 to replace with coral #FF7F50
- Catalogued 8+ glassmorphism variants (navbar, window, dropdown, tooltip, dock, footer)
- Captured hover states for buttons and nav links
- Extracted font stack: Inter (variable 300-700), JetBrains Mono, Geist Mono
- Documented spacing scale (2px to 224px) and border-radius scale (2px to 1000px)
- Created 9 verification screenshots proving real browser extraction

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract Global Navbar** - `78ef546` (feat)
2. **Task 2: Extract Homepage Hero** - `08db595` (feat)
3. **Task 3: Extract Hover States, Fonts, Glassmorphism** - `ea77bb1` (feat)
4. **Task 4: Extract Homepage Remaining Sections** - `e0c2705` (feat)
5. **Task 5: Checkpoint** - User approved extraction

## Files Created/Modified

- `.planning/phases/39-token-foundation/39-EXTRACTION-DATA.md` - Complete extraction data (490 lines)
- `screenshots/01-navbar.png` - Homepage with navbar visible
- `screenshots/02-homepage-hero.png` - Hero section
- `screenshots/03-button-hover.png` - Button hover state
- `screenshots/04-section-1.png` through `04-section-6.png` - Scrolled homepage sections

## Decisions Made

1. **Brand color mapping:** Raycast #ff6363 will map to coral #FF7F50
2. **Deep red variant:** Raycast #d72a2a will need a darker coral variant
3. **Font strategy:** Use Inter variable font (native to Next.js) + JetBrains Mono for code
4. **Glassmorphism naming:** Document by context (navbar-glass, window-glass, tooltip-glass, etc.)

## Deviations from Plan

None - plan executed exactly as written using Playwright MCP for all extractions.

## Issues Encountered

None - Playwright MCP worked as expected for navigation, screenshot capture, and computed style evaluation.

## Next Phase Readiness

**Ready for 39-02:** Store, Pro, and AI page extraction
- Global navbar already extracted (reusable across all pages)
- Extraction methodology proven and documented
- Screenshot verification workflow established

**What 39-02 will add:**
- Store cards and badges
- Pro pricing cards
- AI chat interface components
- Additional section patterns

---
*Phase: 39-token-foundation*
*Completed: 2026-02-03*
