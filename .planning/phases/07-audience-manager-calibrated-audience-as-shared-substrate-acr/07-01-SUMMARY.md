---
phase: 07-audience-manager-calibrated-audience-as-shared-substrate-acr
plan: "01"
subsystem: audience-core
tags: [audience, persona-weights, tdd, domain-types, goal-intent, temperature-disposition]
dependency_graph:
  requires: [src/lib/engine/persona-weights.ts, src/lib/engine/wave3/persona-registry.ts, src/components/board/audience/audience-constants.ts]
  provides: [src/lib/audience/audience-types.ts, src/lib/audience/goal-intent.ts, src/lib/audience/temperature-disposition.ts, src/lib/audience/resolve-audience-weights.ts]
  affects: [07-02, 07-03, 07-04, 07-05, 07-06]
tech_stack:
  added: []
  patterns: [TDD-London-School, deterministic-table-lookup, array-shaped-resolver, analysis_override-precedence]
key_files:
  created:
    - src/lib/audience/audience-types.ts
    - src/lib/audience/goal-intent.ts
    - src/lib/audience/temperature-disposition.ts
    - src/lib/audience/resolve-audience-weights.ts
    - src/lib/audience/__tests__/goal-intent.test.ts
    - src/lib/audience/__tests__/temperature-disposition.test.ts
    - src/lib/audience/__tests__/resolve-audience-weights.test.ts
  modified:
    - src/lib/engine/__tests__/persona-weights.test.ts
decisions:
  - "GOAL_INTENT_BIAS: grow→new_creator, sell→niche_heavy, authority→niche_heavy, nurture→established (D-05 locked mapping seeded from WEIGHT_PRESETS)"
  - "resolveAudienceWeights accepts Audience[] (multi-select-ready); single-resolution semantics in v1 (Pitfall 5)"
  - "General→DEFAULT free by construction (no override injected); AUD-03 regression gate holds"
  - "TEMPERATURE_DISPOSITION is presentation-only lens; never feeds engine vocabulary"
metrics:
  duration: "~5m"
  completed: "2026-06-18"
  tasks_completed: 2
  files_count: 8
---

# Phase 7 Plan 01: Audience Domain Core Summary

Pure deterministic audience domain core — 4 modules, 49 tests green, 0 TypeScript errors in new files.

## What Was Built

**Audience domain type SSOT** (`audience-types.ts`) defining: `GoalIntent`, `Temperature`, `Disposition`, `AudienceType`, `AudiencePlatform`, `CalibratedPersona`, `AudienceProfile`, and the `Audience` interface mirroring the DB schema. Imports `PersonaWeights` from engine and `Archetype` from `wave3/persona-registry` — no engine vocabulary redefined.

**Goal-intent bias table** (`goal-intent.ts`) with the locked D-05 mapping seeded from `WEIGHT_PRESETS`:
| GoalIntent | WEIGHT_PRESETS key | fyp | niche | loyalist | cross_niche |
|---|---|---|---|---|---|
| grow | new_creator | 0.75 | 0.15 | 0.05 | 0.05 |
| sell | niche_heavy | 0.30 | 0.55 | 0.10 | 0.05 |
| authority | niche_heavy | 0.30 | 0.55 | 0.10 | 0.05 |
| nurture | established | 0.40 | 0.20 | 0.30 | 0.10 |

`[ASSUMED]` per D-05 — values tune in post-P7 refinement run.

**Temperature×Disposition label lens** (`temperature-disposition.ts`) — presentation-only (D-02):
| Archetype | Temperature | Disposition |
|---|---|---|
| tough_crowd | cold | skeptic |
| lurker | cold | lurker |
| cross_niche_curiosity | cold | scanner |
| high_engager | warm | connector |
| saver | warm | collector |
| sharer | warm | connector |
| purposeful_viewer | warm | scanner |
| niche_deep_buyer | hot | converter |
| niche_deep_scout | hot | skeptic |
| loyalist | hot | connector |

**resolveAudienceWeights** (`resolve-audience-weights.ts`) — array-shaped multi-select-ready resolver:
```typescript
// Signature (Pitfall 5 compliant — array-shaped for future multi-select)
resolveAudienceWeights(audiences: Audience[]): { weights: PersonaWeights; source: WeightsSource }

// General/empty → DEFAULT (regression gate free by construction)
resolveAudienceWeights([])              // source: 'default'
resolveAudienceWeights([general])       // source: 'default' (is_general=true)

// Calibrated → analysis_override (goal-bias pre-baked at calibration)
resolveAudienceWeights([calibrated])    // source: 'analysis_override'
```

## Test Coverage

| File | Tests | Result |
|---|---|---|
| goal-intent.test.ts | 11 | PASS |
| temperature-disposition.test.ts | 16 | PASS |
| resolve-audience-weights.test.ts | 14 | PASS |
| persona-weights.test.ts (extended) | 8 (+3 new) | PASS |
| **Total** | **49** | **All green** |

## Key Decisions Made

1. **GOAL_INTENT_BIAS locked mapping**: `grow→new_creator`, `sell/authority→niche_heavy`, `nurture→established` — seeded directly from `WEIGHT_PRESETS` constants (no invented mixes). Flagged `[ASSUMED]` per D-05 for value tuning in refinement.

2. **resolveAudienceWeights array-shaped**: signature accepts `Audience[]` not `Audience | null` — Pitfall 5 compliance. V1 resolves `audiences[0]`; multi-select later is purely additive.

3. **General→DEFAULT free by construction**: no special `is_general` branch needed in resolveWeights — simply pass no `analysis_override`. The regression gate (AUD-03) asserts `resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {})` returns the byte-stable `{ fyp:0.65, niche:0.20, loyalist:0.10, cross_niche:0.05 }`.

4. **Temperature×Disposition is presentation-only**: compile-time exhaustiveness check (`_ExhaustiveCheck` type constraint) ensures any future 11th archetype breaks the build immediately rather than silently returning `undefined`.

## Downstream Contracts

**07-02 (persistence/CRUD):** import `Audience` from `@/lib/audience/audience-types`.

**07-03 (calibration):** use `biasForGoalIntent(intent)` to pre-bake `persona_weights`; use `labelForArchetype(archetype)` for CalibratedPersona fields. The resolver does NOT re-apply bias per-call.

**07-04 (wiring):** call `resolveAudienceWeights(audiences)` in the route before passing weights to `buildNicheAwareSystemPrompt`. Signature: `(audiences: Audience[]) => { weights, source }`.

**07-06 (blocking gate):** General-identity anchor is in `persona-weights.test.ts` — run `pnpm exec vitest run src/lib/engine/__tests__/persona-weights.test.ts` to verify.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors found in unrelated files (flash-schema.test.ts, fold-adapter.test.ts, flop-warning.test.ts, etc.) — all pre-date this plan and are out of scope per deviation rules. Logged below.

## Commits

| Hash | Message |
|---|---|
| a404ec38 | test(07-01): add failing tests for goal-intent bias + temperature×disposition lens (RED) |
| 45208fd3 | feat(07-01): audience domain types + goal-intent bias + temperature×disposition lens (GREEN) |
| dee7a197 | test(07-01): add failing tests for resolveAudienceWeights + General-identity anchor (RED) |
| b882a8eb | feat(07-01): resolveAudienceWeights — array-shaped, multi-select-ready resolver (GREEN) |

## Threat Flags

None — all new files are pure computation modules (no network, no I/O, no auth surface).

## Self-Check: PASSED

All created files verified:
- src/lib/audience/audience-types.ts: EXISTS
- src/lib/audience/goal-intent.ts: EXISTS
- src/lib/audience/temperature-disposition.ts: EXISTS
- src/lib/audience/resolve-audience-weights.ts: EXISTS
- src/lib/audience/__tests__/goal-intent.test.ts: EXISTS
- src/lib/audience/__tests__/temperature-disposition.test.ts: EXISTS
- src/lib/audience/__tests__/resolve-audience-weights.test.ts: EXISTS

All commits verified in git log: a404ec38, 45208fd3, dee7a197, b882a8eb.

No engine constants mutated: grep -rn "ARCHETYPE_DEFINITIONS|DEFAULT_PERSONA_WEIGHT_CONFIG =" src/lib/audience/ returns only a comment reference.
