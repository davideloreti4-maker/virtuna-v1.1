---
phase: 09-living-audience-interactive-simulation-ux
plan: 05
subsystem: audience-lens
tags: [audience-lens, population, swarm, determinism, weighted-rollup, batched-cascade, theme-06, live-05, tdd]
requires:
  - "instantiatePopulation + weightedRollup from audience-lens/lens-derive (the pure 1,000-from-10 math core, 09-01)"
  - "PersonaNode shape + mulberry32 Box-Muller scatter pattern from board/_kit/PersonaGraph (200-dot layout scaled to 1,000)"
  - "AudienceLens scale-toggle shell + reserved Population slot from 09-02 (D-07 last-used)"
  - "buildFlatPersonaNodes/clusterFlatNodes + the cascade reveal pattern from 09-04"
provides:
  - "PopulationSwarm — deterministic 1,000-dot swarm; weighted-rollup counters; batched cascade; archetype-breakdown drill; always-present sr-only mirror"
  - "Population·1,000 toggle side now LIVE in AudienceLens (the reserved slot is filled — the 'missing touch' of sketch 005 ships as a lean v1)"
  - "PopulationRegion — host-owned single batched cascade-on-play timeline (reducedMotion-gated)"
affects:
  - "Future P9+ per-dot drill (DEFERRED, D-01 — the archetype breakdown is the v1 drill; the swarm geometry already carries x/y to extend later)"
  - "Any surface mounting AudienceLens (flat or heatmap) now gets Population·1,000 for free — same nodes, denser resolution"
tech-stack:
  added: []
  patterns:
    - "Presentation-over-real-verdicts: Population is byte-identical seeded resolution of the 10's REAL verdicts — zero model calls, no scoring-path import (STATE same-video score-identity protected)"
    - "Single batched SVG dot layer + one batched opacity-progress cascade (NEVER 1,000 per-dot <animate> SMIL elements — Pitfall 2)"
    - "Counters read from weightedRollup(nodes), never counted off the dots, so Panel·10 and Population·1,000 report the IDENTICAL aggregate (D-02 honesty)"
    - "Seeded mulberry32 Box-Muller scatter (copied, not imported — geometry-only) for SSR-safe / determinism-gate-safe dot placement"
key-files:
  created:
    - "src/components/audience-lens/PopulationSwarm.tsx"
    - "src/components/audience-lens/__tests__/population-swarm.test.tsx"
  modified:
    - "src/components/audience-lens/AudienceLens.tsx"
decisions:
  - "Cascade-on-play is driven by the PARENT (PopulationRegion in AudienceLens) as a single 0→1 progress fraction passed to PopulationSwarm.cascadeProgress — keeps the swarm a pure presentation component and the motion timeline batched (one decision per dot, not per-dot SMIL)"
  - "Dot x/y geometry is computed in the component (Box-Muller scatter around golden-angle archetype anchors, same layout as PersonaGraph) while verdict/sentiment/counts come from lens-derive — the component adds ONLY geometry, never re-derives the honest math"
  - "Empty-nodes Population path renders just the honesty label (no fabricated swarm); the AudienceLens Population branch now shows EmptyReaction when there is no reaction (mirrors the Panel branch)"
  - "happy-dom @vitest-environment pragma added to the test (matches the repo's component-test convention; the default vitest env is node)"
metrics:
  duration: 3m
  completed: "2026-06-19T10:52:00Z"
  tasks: 2
  files: 3
---

# Phase 9 Plan 05: Population·1,000 deterministic swarm Summary

Built `PopulationSwarm` — an honest, lean v1 of the Population·1,000 scale: a deterministic
`mulberry32` 1,000-dot swarm instantiated from the 10 calibrated archetypes (zero model calls),
live counters that are literally `weightedRollup(nodes)` (the SAME numbers Panel·10 shows), a
single batched cascade-on-play, and an archetype-breakdown drill — then wired it into the
AudienceLens scale toggle's reserved Population slot. The audience now scales from 10 to 1,000 as
ONE honest signal at two resolutions, never a fabricated crowd. The "missing touch" of locked
sketch 005 (D-01) ships, with the riskiest part (per-dot drill) deliberately held back.

## What Was Built

### Task 1 — PopulationSwarm component + tests (TDD: RED d6654566 → GREEN 0ec97b11)
- `PopulationSwarm.tsx` (`'use client'`): consumes `instantiatePopulation(nodes, {total, seed})`
  for the deterministic dots and `weightedRollup(nodes)` for the counters (both pure, from 09-01).
  Adds ONLY x/y geometry — a seeded `mulberry32` Box-Muller Gaussian scatter around golden-angle
  archetype anchors (the proven PersonaGraph layout scaled to 1,000). Renders the dots as a SINGLE
  batched SVG `<circle>` layer (NOT 1,000 per-dot `<animate>` SMIL elements — Pitfall 2). Live
  counters in Display 30px = the weighted rollup; worst cluster reads coral, all else cream-alpha;
  honesty label in `--color-cream-muted`. The archetype breakdown (rows per archetype with a
  representative verbatim) is the v1 drill (per-dot drill DEFERRED, D-01). The sr-only aggregate +
  breakdown mirror is ALWAYS present, independent of motion state. Imports NOTHING from the engine
  scoring path.
- `population-swarm.test.tsx` (happy-dom): 4 behavior tests — (1) deterministic render
  (byte-identical dot cx/cy/fill across two renders), (2) counter identity (rendered counters ===
  `weightedRollup(nodes)`), (3) a11y mirror + breakdown always present, (4) source imports nothing
  from `runPredictionPipeline`/`aggregateScores`/`ENGINE_VERSION` and uses no `Math.random`/`Date.now`.

### Task 2 — Wire into the scale toggle + batched cascade-on-play (commit a52c5ff0)
- `AudienceLens.tsx`: replaced the reserved `PopulationSlot` placeholder with a `PopulationRegion`
  that renders `<PopulationSwarm>` fed the SAME `nodes` the Panel uses (one source — D-02 honesty).
  Switching Panel⇄Population is pure presentation — no refetch, no re-score. `PopulationRegion`
  owns the cascade-on-play as ONE batched motion timeline: a single `progress` fraction advances
  0→1 on a calm 40ms tick and is passed to `PopulationSwarm.cascadeProgress`, which dims un-revealed
  dots via one batched opacity decision (Pitfall 2). All motion gated on `reducedMotion` (static
  swarm + the always-present sr-only mirror cover the reduced path). The scale toggle still
  remembers last-used per-Read via the existing `useLensScale` (D-07). Removed the now-unused
  `POPULATION_HONESTY` const (the swarm carries its own honesty label) and the placeholder
  subcomponent; empty-nodes Population now shows `EmptyReaction` (mirrors the Panel branch).

## Verification

- `npx vitest run .../population-swarm.test.tsx` → 4 passed / 0 failed (determinism + counter
  identity + a11y mirror + no scoring-path touch).
- Related suites (`persona-cloud.test.tsx`, `lens-derive.test.ts`) re-run with the swarm + wiring →
  20 passed / 0 failed — the additive changes broke nothing.
- Determinism gate: `grep -L 'Math.random|Date.now|runPredictionPipeline|aggregateScores|ENGINE_VERSION'`
  on `PopulationSwarm.tsx` → clean (no executable prohibited tokens; the test strips comments before
  asserting).
- Counters === `weightedRollup` === Panel·10 numbers (D-02 honesty — Test 2 locks this).
- Cascade = one batched progress timeline (not per-dot SMIL); sr-only mirror always present.
- `npm run build` → compiled successfully (exit 0). `npx eslint` on `PopulationSwarm.tsx`,
  `AudienceLens.tsx`, and the test → No issues found (the new/modified files are clean; the
  repo-wide 62 pre-existing lint errors are untouched, out of scope per the scope boundary).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Component test needs the happy-dom environment**
- **Found during:** Task 1 GREEN (first vitest run)
- **Issue:** The repo's default vitest environment is `node` (fast pure-module tests); rendering
  `PopulationSwarm` threw `ReferenceError: document is not defined`.
- **Fix:** Added the repo's standard `/** @vitest-environment happy-dom */` pragma at the top of
  `population-swarm.test.tsx` (the exact convention every other component test file uses, e.g.
  `persona-cloud.test.tsx`). No code change; tests then went green.
- **Files modified:** src/components/audience-lens/__tests__/population-swarm.test.tsx
- **Commit:** 0ec97b11 (folded into GREEN before commit)

## Deferred Human-Check (Task 2)

Task 2 carries a `<human-check>` (advisory, not a blocking `checkpoint:*` task): on a real mobile
viewport, open the Lens on a Reading, toggle to Population·1,000, press Play — confirm the 1,000-dot
cascade animates smoothly without dropped frames / main-thread jank, the live counters match the
Panel·10 numbers, and with OS reduce-motion on the swarm renders static with the sr-only summary.
The automated verify (build + tests + determinism grep) all passed; the mobile-smoothness profiling
is deferred to the phase-end human-verify (`human_verify_mode: end-of-phase`). If SVG janks on the
target device, the documented fallback (A3) is to fall the swarm-only render to canvas — viable
because per-dot drill is deferred. No code change is needed unless the device profile flags jank.

## Notes for Downstream

- **Per-dot drill (P9+):** `PopulationSwarm` already places every dot at a stable x/y from
  `instantiatePopulation` (which stamps each dot with `archetype` + `verdict` + `sentiment`), so a
  future tap-to-drill can hang off the existing geometry without re-deriving the math.
- **Counters are the contract:** any future Population feature MUST keep reading from
  `weightedRollup(nodes)`, never counting the dots, to preserve Panel↔Population identity (D-02).
- **Canvas fallback:** if mobile profiling flags jank, swap the batched SVG `<circle>` layer for a
  single `<canvas>` draw (same dot data) — the cascade is already a single progress fraction, so the
  canvas path redraws once per tick, not per-dot.

## Self-Check: PASSED

- FOUND: src/components/audience-lens/PopulationSwarm.tsx
- FOUND: src/components/audience-lens/__tests__/population-swarm.test.tsx
- FOUND: src/components/audience-lens/AudienceLens.tsx (PopulationSwarm wired)
- Commits FOUND: d6654566, 0ec97b11, a52c5ff0
