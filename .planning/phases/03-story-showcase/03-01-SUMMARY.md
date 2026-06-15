---
phase: 03-story-showcase
plan: 01
subsystem: ui
tags: [nextjs, rsc, marketing, tailwind, motion, placeholder, story]

# Dependency graph
requires:
  - phase: 03-00
    provides: "RED Nyquist gate how-it-works.test.tsx (STORY-01 contract) + the story/ dir scaffold"
  - phase: 02-01
    provides: "Hero pure-RSC marketing-section pattern + Placeholder slot API + flat-warm tokens"
  - phase: 01-02
    provides: "<Placeholder> aspect-locked swappable slot component"
  - phase: 01-03
    provides: "MotionConfigShell + StaggerReveal reduced-motion-gated client leaf"
provides:
  - "STORY-01 — the 3-step 'How it works' RSC section (paste link → audience reacts → get your Simulation)"
  - "#how-it-works stub filled in place on / with the real cream section"
  - "barrel export of HowItWorks from @/components/marketing"
affects: [03-02, 03-03, 05-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Story-section RSC = module-level STEPS const mapped to StaggerRevealItem rows; pure RSC, StaggerReveal the lone client leaf"
    - "Use the NAMED StaggerRevealItem export (not StaggerReveal.Item static prop) inside an RSC — static props don't survive the RSC→client boundary at prerender"

key-files:
  created:
    - src/components/marketing/story/how-it-works.tsx
  modified:
    - src/components/marketing/index.ts
    - src/app/(marketing)/page.tsx

key-decisions:
  - "03-01: HowItWorks is a pure RSC; StaggerReveal entrance is the only client island; / stays statically prerendered (○)"
  - "03-01: imported the NAMED StaggerRevealItem export instead of the StaggerReveal.Item static prop — the static-prop form is undefined across the RSC→client prerender boundary and crashed next build on / (Rule 1 bug fix, matches the showcase precedent)"
  - "03-01: copy reworded so exactly ONE rendered text node carries the product noun (step-3 title 'Get your Simulation') — the 03-00 gate's getByText(/simulat.../) requires a single match; step 2 became 'The audience reacts', step-3 label became 'Your prediction' (safe synonym per plan)"
  - "03-01: section heading is SANS font-semibold (D-C/A3) — Newsreader serif stays precious to the hero; coral not used here (A6)"

patterns-established:
  - "Named-export StaggerRevealItem in RSCs: the build-safe idiom for client-component sub-parts consumed inside a server component"
  - "Single-canonical-noun copy: when a Nyquist gate asserts a product noun via getByText (single match), keep exactly one rendered node carrying it and use safe synonyms elsewhere"

requirements-completed: [STORY-01]

# Metrics
duration: ~18min
completed: 2026-06-15
---

# Phase 03 Plan 01: How It Works Summary

**STORY-01 shipped — a calm, three-beat 'How it works' RSC (paste link → audience reacts → get your Simulation) with labelled aspect-locked Placeholder slots, filled in place on `/` with the LOCKED section rhythm and other sections untouched.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Built `HowItWorks` as a pure Server Component: 3 ordered steps, each a mono numeral + a labelled, aspect-locked `<Placeholder>` (swappable later via `src`, no CLS) + sans title + one Inter line.
- Turned the 03-00 `how-it-works.test.tsx` Nyquist gate from RED (module-not-found) to GREEN (6/6).
- Filled the `#how-it-works` stub in `page.tsx` in place — the LOCKED section rhythm (id/border/padding/measure) and `#the-simulation`/`#pricing`/`#faq`/`#hero` are untouched.
- Found + fixed a prerender crash: the `StaggerReveal.Item` static-prop form is `undefined` across the RSC→client boundary at `next build`; switched to the named `StaggerRevealItem` export. `/` stays static (`○`), build GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build HowItWorks RSC + barrel export** — `ef6c266f` (feat) — TDD GREEN (the 03-00 RED gate was authored in 03-00; this turned it green).
2. **Task 2: Fill #how-it-works stub + RSC prerender fix** — `c38115a4` (feat) — includes the Rule 1 build fix.

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `src/components/marketing/story/how-it-works.tsx` — STORY-01 3-step RSC section (created).
- `src/components/marketing/index.ts` — added `export { HowItWorks } from "./story/how-it-works"` (modified).
- `src/app/(marketing)/page.tsx` — import HowItWorks + replace muted stub `<h2>` with `<HowItWorks/>` inside the unchanged `#how-it-works` section (modified).

## Verification

- `npx vitest run src/components/marketing/story/__tests__/how-it-works.test.tsx` → **6/6 GREEN**, exit 0.
- Full suite: **1955 passed**, 26 skipped, **3 pre-existing RED-by-design gates** remain (see Deferred Issues) — none introduced by this plan.
- `npm run build` → **exit 0**, route table shows `┌ ○ /` (root `/` prerendered as **static** content — the no-CLS / static invariant holds).
- Acceptance greps: no `"use client"` in `how-it-works.tsx`; exactly 3 `[data-variant]` Placeholder slots; no user-facing `reading` noun; no banned `board/`·`reading/`·`viral-results` imports; barrel exports `HowItWorks`; `#how-it-works` wrapper byte-equivalent in substance (id/border/padding/measure preserved).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `StaggerReveal.Item` static prop crashes `next build` prerender of `/`**
- **Found during:** Task 2 (the plan's "quick build is wise" verification step).
- **Issue:** The plan's `<interfaces>` note said "`StaggerReveal.Item` is a static prop (no separate import)". That works in Vitest (direct module eval) but at `next build` prerender a client component's static properties do not cross the RSC→client boundary — `StaggerReveal.Item` resolves to `undefined`, raising `Element type is invalid... got: undefined` and failing the build on `/`.
- **Fix:** Imported the NAMED `StaggerRevealItem` export from `@/components/motion` and used it directly (matches the working `showcase/utilities/page.tsx` precedent). The component remains a pure RSC; `/` stays statically prerendered.
- **Files modified:** `src/components/marketing/story/how-it-works.tsx`
- **Commit:** `c38115a4`

### Copy adjustment (within plan intent)

**2. [Rule 3 - Blocking] Gate's `getByText(/simulat.../)` requires a single rendered match**
- **Found during:** Task 1 (turning the gate GREEN).
- **Issue:** The plan's prescribed copy put the product noun in 3 rendered nodes (step-2 title "The audience simulates", step-3 title "Get your Simulation", step-3 Placeholder label "Your Simulation"). The 03-00 gate asserts the noun via `getByText` (single match) — 3 matches throws.
- **Fix:** Kept the single canonical noun on the step-3 title "Get your Simulation"; reworded step-2 title → "The audience reacts" (verb describing the synthetic-audience mechanism) and step-3 label → "Your prediction" (a safe synonym explicitly allowed by the plan). Noun discipline (D-A) preserved: "Simulation" present, "reading" never used.
- **Files modified:** `src/components/marketing/story/how-it-works.tsx`
- **Commit:** `ef6c266f`

### Format normalization

**3. Collapsed the `<section id="how-it-works">` opening tag to one line**
- The original skeleton split `id=` and `className=` across two lines; the plan's acceptance/verify grep expects the canonical single-line form. Collapsed to one line — no change to id, border, padding, or measure (LOCKED rhythm intact). Commit `c38115a4`.

## Deferred Issues

Three failing test FILES in the full suite are **pre-existing RED-by-design Wave-0 gates from 03-00** (confirmed by STATE.md), NOT introduced by this plan and out of scope here:
- `feature-blocks.test.tsx` — module-not-found; STORY-03, built in 03-03.
- `simulation-showcase.test.tsx` — module-not-found; STORY-02, built in 03-02.
- `footer.test.tsx > #features` — RED until 03-03 wires footer `PRODUCT_LINKS`.

## Known Stubs

The 3 step product visuals are intentional `<Placeholder>` slots (FOUND-03, the marketing-surface-only milestone guardrail) — swappable later via the single `src` prop with no layout shift. This is by design, not an unwired stub.

## Self-Check: PASSED

- Files: all 4 found (`how-it-works.tsx`, barrel `index.ts`, `page.tsx`, `03-01-SUMMARY.md`).
- Commits: `ef6c266f` (Task 1) + `c38115a4` (Task 2 + Rule 1 fix) both present in git history.
