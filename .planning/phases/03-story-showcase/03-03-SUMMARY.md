---
phase: 03-story-showcase
plan: 03
subsystem: ui
tags: [marketing, landing, rsc, nextjs, tailwind, static-prerender, feature-deep-dive]

# Dependency graph
requires:
  - phase: 03-story-showcase
    provides: "03-00 RED feature-blocks + footer #features gates; 03-01 HowItWorks RSC + StaggerRevealItem named-export idiom; 03-02 SimulationShowcase RSC + LOCKED #the-simulation section"
  - phase: 01-foundation-shell
    provides: "Placeholder slot (aspect-locked, FOUND-03); marketing barrel; flat-warm @theme tokens; Header NAV_LINKS + Footer PRODUCT_LINKS; MotionConfigShell; (marketing)/page.tsx scroll skeleton"
  - phase: 02-hero-signature-moment
    provides: "pure-RSC section discipline + ○ / static-prerender precedent (02-02-SUMMARY)"
provides:
  - "STORY-03 — FeatureBlocks: 4 alternating benefit + Placeholder deep-dive rows (pure RSC)"
  - "FeatureBlock leaf — single two-column md:order-* flip row (pure RSC)"
  - "new <section id='features'> mounted between #the-simulation and #pricing"
  - "'Features' → #features anchor in header NAV_LINKS (5 links) + footer PRODUCT_LINKS"
  - "phase-level static-prerender guarantee — assembled / builds ○ static, exit 0"
affects: [phase-04-conversion, phase-05-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Alternating feature deep-dive: FeatureBlocks maps FEATURES through <FeatureBlock flip={i % 2 === 1}/>; flip drives md:order-1/md:order-2 column swap, collapses to a single stacked column below md (responsive by construction, no fixed pixel widths)"
    - "Section heading SANS the Newsreader serif (D-C) + coral kept precious (A6) — same discipline as HowItWorks/SimulationShowcase"
    - "One array edit in header NAV_LINKS surfaces the anchor in BOTH the desktop bar and the mobile disclosure panel (both map NAV_LINKS); footer PRODUCT_LINKS mirrors it"

key-files:
  created:
    - src/components/marketing/story/feature-block.tsx
    - src/components/marketing/story/feature-blocks.tsx
  modified:
    - src/components/marketing/index.ts
    - src/app/(marketing)/page.tsx
    - src/components/layout/header.tsx
    - src/components/layout/footer.tsx

key-decisions:
  - "Shipped FEATURES with 4 benefits (predict / where-they-drop / audience / weakest-lever) — the recommended four from the interfaces block; satisfies the 3 ≤ n ≤ 4 contract with the richer end."
  - "Section heading copy = 'Everything you need to know before you post' (the suggested h2), SANS serif (D-C)."
  - "Feature copy uses the canonical product noun 'Simulation'/'synthetic crowd' and avoids the barred words 'viral'/'AI' (D-09 carried)."
  - "Task 1 leaf + section + barrel committed as ONE feature commit (the 03-00 tests were already authored RED; this plan is the GREEN step, not the RED step) — the per-task atomic-commit boundary is preserved."

patterns-established:
  - "FeatureBlock flip idiom: cn(flip && 'md:order-2') on the copy column + cn(flip && 'md:order-1') on the Placeholder — the canonical in-repo alternating-row pattern (none existed before)."

requirements-completed: [STORY-03]

# Metrics
duration: 4min
completed: 2026-06-15
---

# Phase 03 Plan 03: Story & Showcase — Feature Deep-Dives Summary

**STORY-03 shipped: four alternating benefit + Placeholder feature-deep-dive rows in a new `#features` section between The Simulation and Pricing, with a "Features" anchor added to both the header nav (5 links) and footer — and the assembled `/` verified `○` statically prerendered.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-15T09:14:23Z
- **Completed:** 2026-06-15T09:18:18Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- **Task 1 — `2554af26`:** Built `feature-block.tsx` (pure-RSC leaf: a `grid grid-cols-1 items-center gap-10 md:grid-cols-2` row pairing an h3 benefit + one-line body with exactly one labelled, aspect-locked `<Placeholder variant="image" aspect="16/10">`; `cn(flip && "md:order-2")` / `cn(flip && "md:order-1")` swaps the column order on alternate rows, collapsing to a stacked single column on mobile) and `feature-blocks.tsx` (pure-RSC section: a module-level `FEATURES` const of 4 benefits mapped through `<FeatureBlock flip={i % 2 === 1}/>` inside a `StaggerReveal` entrance leaf, sans-serif `<h2>`). Added `FeatureBlocks` to the marketing barrel. The 03-00 feature-blocks gate (4 cases) turned GREEN.
- **Task 2 — `d1f1a4af`:** Inserted a new `<section id="features" className="border-t border-border px-6 py-20">` rendering `<FeatureBlocks/>` BETWEEN `#the-simulation` (line 57) and `#pricing` (line 75), matching the LOCKED rhythm exactly (an ADD, not a fill — D-E / Pitfall 3). Added `{ label: "Features", href: "#features" }` to header `NAV_LINKS` (now 5 links; one edit surfaces it in the desktop bar AND the mobile disclosure panel) and the same entry to footer `PRODUCT_LINKS`. The 03-00 footer `#features` anchor row turned GREEN; header suite no regression (17/17 layout tests pass).
- **Task 3 — [BLOCKING] phase static-prerender + full-suite gate (verification-only, no source change):** Confirmed all 4 story section/leaf files (`how-it-works`, `simulation-showcase`, `feature-blocks`, `feature-block`) carry NO `"use client"` directive (motion lives only in the `StaggerReveal`/`FadeInUp` client leaves). Full suite green (1967 passed / 26 skipped / 0 failed across 186 files). `npm run build` exit 0 with the route table showing `┌ ○ /` (Static) — no `"use client"` leaked to a section root. No fix needed.

## Verification

- `npx vitest run src/components/marketing/story/__tests__/feature-blocks.test.tsx` → PASS (4/4, STORY-03 GREEN)
- `npx vitest run src/components/layout/__tests__/footer.test.tsx src/components/layout/__tests__/header.test.tsx` → PASS (17/17; footer `#features` row GREEN, header no regression)
- `npm test` → 1967 passed, 26 skipped, 0 failed (186 files passed, 1 skipped)
- `npm run build` → exit 0, route table `┌ ○ /` (Static, NOT `ƒ`)
- use-client leak grep → all 4 story files clean (`grep -rL '"use client"'` returns all 4)
- copy hygiene → no `viral`/`AI` in headline literals; no `board/`·`reading/`·`viral-results` imports

## Deviations from Plan

None — plan executed exactly as written. The only nuance: the Task 1 acceptance greps for "banned imports" and "banned words" match the words where they appear inside the new files' DOC COMMENTS (which describe the rules being followed), not in any actual `import` statement or headline literal — verified separately with targeted greps (`^import .*(board/|reading/|viral-results)` and `(title:|body:|<h2|<h3).*(viral|AI)` both empty). No real violation.

## Known Stubs

The four feature visuals are intentional `<Placeholder variant="image" aspect="16/10">` slots (FOUND-03, marketing-surface-only milestone guardrail) — each is labelled and aspect-locked, swappable later via the single `src` prop once numen-rework ships real screenshots. This is the milestone's by-design placeholder contract, not an incomplete implementation.

## Self-Check: PASSED

- FOUND: src/components/marketing/story/feature-block.tsx
- FOUND: src/components/marketing/story/feature-blocks.tsx
- FOUND commit: 2554af26
- FOUND commit: d1f1a4af
