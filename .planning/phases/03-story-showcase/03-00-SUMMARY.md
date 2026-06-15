---
phase: 03-story-showcase
plan: 00
subsystem: testing
tags: [vitest, testing-library, happy-dom, nyquist, red-by-design, story-sections]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "<Placeholder> slot (data-variant + inline aspect-ratio hooks), marketing barrel, footer.test.tsx it.each anchor idiom"
  - phase: 02-hero-signature
    provides: "hero.test.tsx render+token-assert idiom, product-noun discipline (Simulation), happy-dom pragma convention"
provides:
  - "RED-by-design Nyquist gate for STORY-01 (how-it-works.test.tsx — 3 ordered steps, Placeholder slots, noun discipline)"
  - "RED-by-design Nyquist gate for STORY-02 (simulation-showcase.test.tsx — verbatim 'The Simulation' heading + all 5 named outputs + Placeholder visual)"
  - "RED-by-design Nyquist gate for STORY-03 (feature-blocks.test.tsx — 3-4 blocks, benefit+Placeholder pairing, alternating md:order flip)"
  - "Extended footer anchor gate including '#features' (RED until 03-03 wires the link)"
affects: [03-01, 03-02, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 Nyquist scaffold: section tests created BEFORE their components; module-not-found is the intended success signal"
    - "Placeholder-presence assertion via container.querySelectorAll('[data-variant]') + style.aspectRatio length > 0 (Success Criterion 4, no-CLS)"
    - "Resilience rule: assert stable tokens (regex) not full sentences; heading verbatim only where LOCKED ('The Simulation')"

key-files:
  created:
    - src/components/marketing/story/__tests__/how-it-works.test.tsx
    - src/components/marketing/story/__tests__/simulation-showcase.test.tsx
    - src/components/marketing/story/__tests__/feature-blocks.test.tsx
  modified:
    - src/components/layout/__tests__/footer.test.tsx

key-decisions:
  - "Step ordinals matched by word-boundary regex (/\\b0?N\\b/) so '01' or '1' both satisfy the order assertion"
  - "Per-step / per-block titles asserted as level-3 headings (section <h2> owns the section title)"
  - "'The Simulation' heading asserted VERBATIM (LOCKED, mirrors #the-simulation anchor); the 5 outputs matched by stable tokens"

patterns-established:
  - "RED-by-design Wave-0: import the not-yet-built section component; module-not-found IS the pass signal"
  - "Placeholder count === block/step count (one Placeholder per block/step)"

requirements-completed: [STORY-01, STORY-02, STORY-03]

# Metrics
duration: 1min
completed: 2026-06-15
---

# Phase 03 Plan 00: Story-Showcase Nyquist Scaffold Summary

**RED-by-design Vitest gates for STORY-01/02/03 (how-it-works, simulation-showcase, feature-blocks) plus an extended footer `#features` anchor gate — all failing with module-not-found exactly as intended, ready to turn GREEN across 03-01/02/03.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Created `src/components/marketing/story/__tests__/` with 3 RED section tests encoding the STORY-01/02/03 acceptance contract.
- Each story test asserts ordered content, Placeholder presence (`[data-variant]`), and no-CLS inline aspect-ratio (Success Criterion 4).
- `how-it-works.test.tsx` gates noun discipline: product noun "Simulation"/"simulates" present, "reading" forbidden as a user-facing noun.
- `simulation-showcase.test.tsx` gates the verbatim "The Simulation" heading + all 5 named outputs (audience simulation, watch-through %, Hook, Retention/where-they-drop, Shareability).
- `feature-blocks.test.tsx` gates 3-4 blocks, benefit-headline↔Placeholder pairing, and the alternating `md:order-*` flip.
- Extended `footer.test.tsx` `it.each` anchor array with `#features` (between `#the-simulation` and `#pricing`), gating the footer mirror 03-03 will wire.
- Scoped story vitest run is RED with `Failed to resolve import` for all three section components — the intended Wave-0 state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the three RED story-section test files** - `949b18e8` (test)
2. **Task 2: Extend the footer anchor test to gate '#features'** - `8eadcd7d` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/components/marketing/story/__tests__/how-it-works.test.tsx` - STORY-01 gate: 3 ordered steps, Placeholder slots, noun discipline, no-CLS aspect-ratio.
- `src/components/marketing/story/__tests__/simulation-showcase.test.tsx` - STORY-02 gate: verbatim "The Simulation" heading, 5 named outputs, Placeholder visual.
- `src/components/marketing/story/__tests__/feature-blocks.test.tsx` - STORY-03 gate: 3-4 blocks, benefit+Placeholder pairing, alternating md:order flip.
- `src/components/layout/__tests__/footer.test.tsx` - extended the it.each anchor array with `#features`.

## Decisions Made
- Step ordinals matched by word-boundary regex (`/\b0?N\b/`) so either `01` or `1` numbering passes the order assertion — keeps the implementer free on numeral style.
- Per-step / per-block titles asserted as level-3 headings; the section's own `<h2>` owns the section title.
- "The Simulation" heading asserted VERBATIM (LOCKED — matches the `#the-simulation` anchor); the five outputs matched by stable tokens (resilience rule).
- `#features` placed between `#the-simulation` and `#pricing` to match the locked nav order.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The verify command in the plan greps the vitest *stdout* for `Failed to resolve import`, but the environment tees vitest through a JSON reporter (stdout shows only `PASS (0) FAIL (0)`). Confirmed RED directly via the JSON log + a non-zero exit code (`exit=1`) and the message `Failed to resolve import "../how-it-works|../simulation-showcase|../feature-blocks"` for all three suites. The RED-by-design intent is satisfied; the cosmetic grep mismatch is an environment reporter artifact, not a test defect.

## Known Stubs

None. This is a test-only plan; the not-yet-built section components are intentional Wave-0 RED targets (built in 03-01/02/03), not stubs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 03-01 (HowItWorks), 03-02 (SimulationShowcase), 03-03 (FeatureBlocks + footer/header/page wiring) each have an executable RED gate to turn GREEN.
- No framework install needed — Vitest + Testing Library + happy-dom already present.
- The footer `#features` row stays RED until 03-03 adds "Features" to `footer.tsx` PRODUCT_LINKS — expected at Wave 0.

## Self-Check: PASSED

All created files verified present on disk; both task commits (`949b18e8`, `8eadcd7d`) found in git log.

---
*Phase: 03-story-showcase*
*Completed: 2026-06-15*
