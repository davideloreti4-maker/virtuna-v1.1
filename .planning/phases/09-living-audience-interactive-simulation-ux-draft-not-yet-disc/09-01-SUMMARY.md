---
phase: 09-living-audience-interactive-simulation-ux
plan: 01
subsystem: audience-lens
tags: [requirements, determinism, population, cascade, pure-math, tdd]
requires:
  - "PersonaNode shape from src/components/board/_kit (buildPersonaNodes output)"
  - "mulberry32 seeded-PRNG pattern from src/components/board/_kit/PersonaGraph.tsx"
provides:
  - "instantiatePopulation — 1,000-from-10 deterministic swarm (Population·1,000 core, W4)"
  - "weightedRollup — SSOT counters for Panel·10 + Population·1,000"
  - "cascadeOrder — deterministic staggered-cascade reveal order (W3, D-06)"
  - "LIVE-01..LIVE-07 formal requirements + Phase 9 traceability"
affects:
  - "W3 staggered cascade (consumes cascadeOrder)"
  - "W4 Population swarm component (consumes instantiatePopulation + weightedRollup)"
tech-stack:
  added: []
  patterns:
    - "Pure tree-shakeable math module (no React/DOM) for determinism-critical logic"
    - "Largest-remainder allocation for exact proportional dot counts"
    - "Seeded mulberry32 (copied, not imported — source is 'use client') for SSR-safe variance"
key-files:
  created:
    - "src/components/audience-lens/lens-derive.ts"
    - "src/components/audience-lens/__tests__/lens-derive.test.ts"
  modified:
    - ".planning/REQUIREMENTS.md"
decisions:
  - "Verdict derived from watchThrough (>= 0.5 = stop) — keeps the module pure over the existing PersonaNode shape; no new field added to buildPersonaNodes"
  - "weightedRollup scales to a fixed 1,000 so Panel·10 and Population·1,000 report the same weighted mix at different resolutions (Test 3 identity)"
  - "30% affinity-neighbour blend uses the NEXT node in input order as the deterministic neighbour (no geometry available in the pure layer)"
metrics:
  duration: 5m
  completed: "2026-06-19T10:04:59Z"
  tasks: 2
  files: 3
---

# Phase 9 Plan 01: AudienceLens requirements + Population/cascade math core Summary

Formalized LIVE-01..LIVE-07 into REQUIREMENTS.md and built `lens-derive.ts` — the pure,
deterministic 1,000-from-10 instantiation, weighted rollup, and cascade-ordering math that
Population·1,000 (W4) and the staggered cascade (W3) both consume, proven byte-stable by tests.

## What Was Built

### Task 1 — LIVE-01..LIVE-07 formalized (commit 78c30466)
- New `### LIVE — Living Audience (AudienceLens, P9)` section in REQUIREMENTS.md with seven
  `- [ ] **LIVE-NN**` bullets (descriptions verbatim from 09-RESEARCH §Phase Requirements).
- Seven `| LIVE-NN | Phase 9 | Pending |` traceability rows appended; no existing rows touched.
- Coverage tracking can now resolve every Phase 9 requirement ID.

### Task 2 — lens-derive.ts pure math core (TDD: RED 0c56afd2 → GREEN 52fc67fd)
- `instantiatePopulation(nodes, {total=1000, seed})` → `PopulationDot[]`: largest-remainder
  proportional allocation (counts sum EXACTLY to total), each dot stamped with its archetype's
  real verdict + watch-through plus bounded seeded jitter; ~30% blend to an affinity neighbour.
- `weightedRollup(nodes)`: weighted stop/scroll counters scaled to 1,000 — the single source
  consumed by BOTH Panel·10 and Population·1,000 (no re-rolled band math).
- `cascadeOrder(nodes)`: deterministic verdict→weight→id reveal order (D-06).
- `PopulationDot` / `LensVerdict` / `WeightedRollup` types exported; geometry x/y optional
  (filled by the W4 swarm component) so the math is fully testable without a DOM.

## Verification

- `npx vitest run .../lens-derive.test.ts` → 7 passed / 0 failed (all five behaviors green:
  count+proportionality, byte-identical determinism, weighted-rollup identity, bounded
  real-verdict-only variance, cascade purity).
- Determinism gate: no executable `Math.random` / `Date.now` in lens-derive.ts (only the literal
  words appear in comments documenting the prohibition).
- `npm run lint` → No issues found. `npm run build` → compiled + TypeScript passed (exit 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript strict noUncheckedIndexedAccess on array indexing**
- **Found during:** Task 2 GREEN (npm run build)
- **Issue:** `counts[order[k].i] += 1` and `counts[i]` / neighbour indexing tripped "Object is
  possibly 'undefined'" under the project's strict index-access tsconfig — build failed.
- **Fix:** Guarded `order[k]` with a null-check + `break`; used `(counts[entry.i] ?? 0) + 1`;
  defaulted `counts[i] ?? 0` and `nodes[(i+1)%len] ?? node`. No behavior change (deterministic
  allocation/seeding preserved; tests still byte-identical green).
- **Files modified:** src/components/audience-lens/lens-derive.ts
- **Commit:** 52fc67fd (folded into GREEN before commit)

## Notes for Downstream

- W4 swarm: read `PopulationDot.archetype` + `verdict` + `sentiment`; compute x/y geometry
  there (Box-Muller scatter around archetype anchors, same pattern as PersonaGraph viewerDots).
- W3 cascade: drive stagger off `cascadeOrder(nodes)` — stops reveal before scrolls, heaviest first.
- The live counters MUST read from `weightedRollup`, not by counting dots, to stay identical to Panel·10.

## Self-Check: PASSED

- FOUND: src/components/audience-lens/lens-derive.ts
- FOUND: src/components/audience-lens/__tests__/lens-derive.test.ts
- FOUND: .planning/REQUIREMENTS.md
- Commits FOUND: 78c30466, 0c56afd2, 52fc67fd
