---
phase: 03-story-showcase
plan: 08
subsystem: ui
tags: [hero, marketing, nyquist-test, vitest, rsc, product-noun]

# Dependency graph
requires:
  - phase: 02-hero-signature
    provides: the product-shot hero showcase (desktop window + phone) whose desktop slot this renames
provides:
  - "Hero desktop showcase slot labelled 'Numen Simulation' — the locked product noun now holds above the fold (WR-01)"
  - "Hero test pins /numen simulation/i (retired /numen reading/i gone)"
affects: [phase-05-hardening, hero, story-showcase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-match getByText discipline: scope HERO-01 subcopy query to the verb /simulates/i so it never collides with the 'Numen Simulation' slot label"

key-files:
  created: []
  modified:
    - src/components/marketing/hero/hero.tsx
    - src/components/marketing/hero/__tests__/hero.test.tsx

key-decisions:
  - "03-08: Hero desktop slot label 'Numen reading' → 'Numen Simulation' — the last place on / shipping the retired noun is gone; page-wide 'Simulation, never reading' lock now holds above the fold (WR-01)"
  - "03-08: HERO-01 subcopy assertion narrowed /simulat(?:es|ion|e)/i → /simulates/i so the new 'Numen Simulation' slot label does not create a second /simulat/i match (single-match getByText discipline, carried from 03-02)"

patterns-established:
  - "When adding a new label that shares a stem with an existing single-match getByText query, narrow the existing query to the unique surface (verb form) rather than switching to getAllByText"

requirements-completed: [STORY-01, STORY-02, STORY-03]

# Metrics
duration: ~6min
completed: 2026-06-15
---

# Phase 3 Plan 08: Lock Product Noun Above the Fold (WR-01) Summary

**Hero desktop showcase slot renamed "Numen reading" → "Numen Simulation"; the one place on `/` still shipping the retired noun is gone, and the hero test now pins the locked noun — page-wide noun lock holds above the fold.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-15T11:24Z
- **Completed:** 2026-06-15T11:30Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Hero desktop showcase `<Placeholder label>` flipped from "Numen reading" to "Numen Simulation" (hero.tsx); all surrounding comments/docblock reworded for the locked noun
- HERO-03/04 test assertion flipped `getByText(/numen reading/i)` → `/numen simulation/i`; `it()` title → "renders the desktop Simulation slot (the OUTPUT)"
- Retired noun "reading" eliminated from the entire hero directory (`grep -ri 'numen reading' src/components/marketing/hero/` → nothing)
- Hero suite 8/8 GREEN; `npm run build` exit 0; `/` stays `○` static (hero remains a pure RSC, no `use client`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename hero desktop slot to "Numen Simulation" + flip the hero test assertion (WR-01)** — `ea72d607` (fix)

**Plan metadata:** (this commit — docs)

## Files Created/Modified
- `src/components/marketing/hero/hero.tsx` — desktop showcase Placeholder label "Numen reading" → "Numen Simulation"; docblock + inline comments reworded ("the Numen Simulation = the OUTPUT", "the Simulation (output)"). Phone slot ("Your TikTok"), browser chrome ("numen.app"), H1, subcopy, CTA all UNCHANGED. Stays a pure RSC.
- `src/components/marketing/hero/__tests__/hero.test.tsx` — HERO-03/04 assertion → `/numen simulation/i`; test title → "desktop Simulation slot"; suite docblock reworded; HERO-01 subcopy query narrowed `/simulat(?:es|ion|e)/i` → `/simulates/i` (deviation — see below).

## Decisions Made
- Label rename was the sole content change (plan intent). Adjacent comments/docblock wording updated for consistency, as the plan explicitly permitted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed the HERO-01 subcopy assertion to avoid a new ambiguous-match failure**
- **Found during:** Task 1 (hero suite run after the rename)
- **Issue:** Adding the slot label "Numen Simulation" introduced a SECOND element matching the HERO-01 subcopy query `getByText(/simulat(?:es|ion|e)/i)` (the subcopy verb "simulates" + the new slot noun "Simulation"). `getByText` is single-match → `TestingLibraryElementError: Found multiple elements`. This was a direct, blocking consequence of the plan's intended rename; the plan's own copy↔test single-match discipline (03-02 decision) required keeping the subcopy node unique.
- **Fix:** Narrowed the HERO-01 query from the bare `/simulat/i` stem to the verb form `/simulates/i`. The subcopy renders "simulates" in its own `<span>`; the slot label "Simulation" does not match `/simulates/i`, so the subcopy is again the unique node. Plan's locked tests (H1 verbatim, CTA routing, phone slot, browser chrome) untouched.
- **Files modified:** src/components/marketing/hero/__tests__/hero.test.tsx
- **Verification:** Hero suite 8/8 GREEN; subcopy still asserted non-empty and present; the new slot test independently asserts `/numen simulation/i`.
- **Committed in:** `ea72d607` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was necessary for correctness — the rename itself caused the collision, and resolving it preserved the plan's single-match test discipline. No scope creep; no behavior or visual change.

## Issues Encountered
None beyond the deviation above (resolved on first attempt).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- WR-01 (gap-closure) closed: the locked product noun "Simulation" now holds across the entire page, including above the fold.
- 03-05 remains the last open gap-closure plan for Phase 03 (consumes the 03-04 skeleton primitives).
- `/` stays statically prerendered; hero remains a pure RSC. No blockers.

## Self-Check: PASSED

---
*Phase: 03-story-showcase*
*Completed: 2026-06-15*
