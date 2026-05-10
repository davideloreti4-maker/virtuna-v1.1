---
phase: 02-foundation-hero
plan: 01
subsystem: ui

tags: [landing, css, scroll-behavior, accessibility, barrel-export, frankenstein]

# Dependency graph
requires:
  - phase: 01-brand-spine-visual-metaphor
    provides: BRAND-05 plagiarism audit identifying hero-section.tsx as plagiarized
provides:
  - "BehavioralHero import + JSX wired into landing entry (component itself created in Plan 04)"
  - "Landing barrel exports BehavioralHero and no longer exports HeroSection"
  - "Legacy plagiarized hero-section.tsx removed from repository"
  - "Smooth scroll CSS rule on html element with prefers-reduced-motion: reduce fallback"
affects: [02-04, 03, 04, 05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forward-compatible anchor scroll: smooth-scroll CSS rule landed before #science target ships (Phase 4)"
    - "Wave-1 scaffold strategy: import unresolved, build fails until Wave-2 component lands"

key-files:
  created: []
  modified:
    - "src/app/globals.css (added scroll-behavior smooth + reduced-motion override after html,body block)"
    - "src/app/(marketing)/page.tsx (HeroSection -> BehavioralHero in import + JSX)"
    - "src/components/landing/index.ts (HeroSection export removed; BehavioralHero export added at top)"
  deleted:
    - "src/components/landing/hero-section.tsx (85 lines, plagiarized H1 'Human Behavior, Simulated' + generic 'Get in touch' CTA)"

key-decisions:
  - "Place BehavioralHero export at TOP of barrel (before BackersSection) per RESEARCH.md alphabetical convention"
  - "Use separate `html { scroll-behavior: smooth }` block (NOT merged into existing html,body block) so the @media (prefers-reduced-motion) override stays clean"
  - "Skip BehavioralHeroProps named-type export - component takes only className?: string per RESEARCH.md §1"
  - "Use git rm (not bash rm) to delete hero-section.tsx so the deletion is staged for commit cleanly"

patterns-established:
  - "Wave-1 intermediate state pattern: import names land before component implementations; pnpm build fails until subsequent wave"
  - "Reduced-motion CSS pattern: separate html selector block + prefers-reduced-motion: reduce media query overriding to scroll-behavior: auto"

requirements-completed: [BUILD-01]

# Metrics
duration: 5min
completed: 2026-05-10
---

# Phase 02 Plan 01: Behavioral Hero Scaffold Summary

**Landing entry now imports BehavioralHero with smooth-scroll CSS in place; legacy plagiarized HeroSection removed; component implementation lands in Plan 04.**

## Performance

- **Duration:** ~5 min (327s)
- **Started:** 2026-05-10T21:08:05Z
- **Completed:** 2026-05-10T21:13:32Z
- **Tasks:** 3
- **Files modified:** 3 modified, 1 deleted

## Accomplishments

- Replaced plagiarized `<HeroSection />` import + JSX with `<BehavioralHero />` in `src/app/(marketing)/page.tsx`, preserving the order of all six other landing sections (Backers, Features, Stats, CaseStudy, Partnership, FAQ).
- Updated `src/components/landing/index.ts` barrel: removed `HeroSection` export, added `BehavioralHero` export at the top of the file.
- Deleted `src/components/landing/hero-section.tsx` (85 lines, plagiarized "Human Behavior, Simulated" H1 and generic "Get in touch" CTA), confirmed via `grep -r` that no remaining source-file references exist.
- Added `html { scroll-behavior: smooth }` plus `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }` to `globals.css` between the existing `html,body` block (line 288-296) and the `@theme inline` block. Fixes Research drift item #2 (CONTEXT.md D-28 incorrectly assumed the rule was already present).
- All other landing sections, the existing `html,body` declarations, and `persona-card.tsx` remain untouched.

## Task Commits

Each task was committed atomically on branch `worktree-agent-a5e8114a752804b76`:

1. **Task 1: Add scroll-behavior CSS block to globals.css** — `454f958` (feat)
2. **Task 2: Update landing barrel and swap HeroSection import in marketing page** — `b31f4dc` (feat)
3. **Task 3: Delete legacy plagiarized hero-section.tsx** — `15c9357` (chore)

## Files Created/Modified

- `src/app/globals.css` — Appended 10 lines (blank + 7 CSS rule + blank): `html { scroll-behavior: smooth }` and `@media (prefers-reduced-motion: reduce)` override, both placed after the existing `html,body` block and before `@theme inline`.
- `src/app/(marketing)/page.tsx` — Replaced `HeroSection` with `BehavioralHero` in both the import destructure (line 2) and the JSX (line 16). All other section components and Footer untouched. Final line count: 27 (unchanged).
- `src/components/landing/index.ts` — Removed `export { HeroSection } from "./hero-section"` and added `export { BehavioralHero } from "./BehavioralHero"` at the top of the file (line 1). Final line count: 14 (unchanged).
- `src/components/landing/hero-section.tsx` — Deleted (85 lines removed; staged via `git rm`).

## VALIDATION.md Per-Task Verification Map Entries

| Task ID | Acceptance Check | Result |
|---------|------------------|--------|
| 02-01-01 | `grep -q "scroll-behavior: smooth"` + `grep -q "prefers-reduced-motion: reduce"` + `grep -c scroll-behavior == 2` + html,body block intact | PASS |
| 02-01-02 | `BehavioralHero` in page.tsx + barrel; `HeroSection` absent from both; `BackersSection` still in both; line counts 14 (barrel) and 27 (page) | PASS |
| 02-01-03 | `! test -f hero-section.tsx`; zero references to `hero-section`/`HeroSection` in `src/`; `persona-card.tsx` retained | PASS |

## Decisions Made

- **BehavioralHero export placement**: Placed at top of barrel rather than alphabetically between Backers and CaseStudy. This matches RESEARCH.md note that the file already deviates from strict alpha ordering (e.g., `FeatureCard` precedes `FeaturesSection`). Top placement also makes the file's most-imported export easy to spot.
- **Separate `html` selector for scroll-behavior**: Did NOT merge `scroll-behavior: smooth` into the existing `html, body { ... }` block. Reason: the `@media (prefers-reduced-motion: reduce)` override targets `html` only; keeping the rules in their own selector block makes the override one-to-one obvious.
- **No `BehavioralHeroProps` type export**: RESEARCH.md §1 confirmed the component contract is `(props: { className?: string })`. A named-type export adds no value for a single optional prop.
- **`git rm` rather than `bash rm`**: Stages the deletion for commit cleanly without an extra `git add` step.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — this plan adds no UI rendering itself; it wires up an import name (`BehavioralHero`) for a component that Plan 04 creates. Per CONTEXT.md and the plan's `<objective>`, this is the explicit Wave-1 intermediate state where `pnpm build` fails on unresolved import. Plan 04 lands the component and resolves it.

## Threat Surface Scan

No new security-relevant surface introduced. The plan is purely scaffold/CSS:
- No new network endpoints or routes
- No new auth paths (existing `src/lib/supabase/middleware.ts` unchanged)
- No new file access patterns
- No schema changes
- No new npm dependencies (verified `package.json` not modified)

The threat register's STRIDE entries (T-2-01..T-2-04) all have their dispositions held: zero external imports per D-18, no new copy strings introduced (lint-vocab gating still applies), and `prefers-reduced-motion: reduce` fallback guarantees the smooth-scroll DOS-acceptance rationale.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02-04 (BehavioralHero composition, Wave 2) can land the component file at `src/components/landing/BehavioralHero.tsx` and `pnpm build` will succeed once it does.
- Plans 02 and 03 (also Wave 1, run in parallel with this one) produce the canvas + constants + policy doc that Plan 04 consumes.
- The `#science` anchor target on the secondary CTA does not yet exist; it ships in Phase 4 (Science section). Until then the click is a no-op scroll, which is acceptable per orchestrator decision #3 (forward-compatible).
- WCAG AA reduced-motion verification (BUILD-05) will validate this CSS in Phase 5.

## Self-Check: PASSED

- File `src/app/globals.css` exists and contains both required rules: FOUND
- File `src/app/(marketing)/page.tsx` exists and imports `BehavioralHero`: FOUND
- File `src/components/landing/index.ts` exists, exports `BehavioralHero`, no `HeroSection` reference: FOUND
- File `src/components/landing/hero-section.tsx`: ABSENT (intentional Task 3 deletion)
- File `src/components/landing/persona-card.tsx`: FOUND (retained per Task 3 scope)
- Commit `454f958` (Task 1): FOUND in git log
- Commit `b31f4dc` (Task 2): FOUND in git log
- Commit `15c9357` (Task 3): FOUND in git log

---
*Phase: 02-foundation-hero*
*Completed: 2026-05-10*
