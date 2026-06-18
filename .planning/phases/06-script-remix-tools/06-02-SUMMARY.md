---
phase: 06-script-remix-tools
plan: "02"
subsystem: remix-foundation
tags: [remix, block-schema, renderer, assembler, reuse-scout, tdd, d-05a]
dependency_graph:
  requires: [06-01]
  provides: [RemixCardBlockSchema, RemixCardRenderer, remix-mode, 06-SCOUT]
  affects: [message-blocks, block-registry, assembler, blocks]
tech_stack:
  added: []
  patterns: [tdd-red-green, typed-block-renderer, reuse-scout, d-05a-guard]
key_files:
  created:
    - src/lib/tools/__tests__/blocks-remix.test.ts
    - src/components/thread/remix-card-block.tsx
    - .planning/phases/06-script-remix-tools/06-SCOUT.md
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/lib/kc/assembler.ts
    - src/components/thread/message-blocks.tsx
decisions:
  - "REMIX-01 reuse scout: 5 decode/adapt functions confirmed importable as-is (resolveAndRehost, omniOutputToStructuralInput, runDecode, decodeResultToAdaptInput, generateAdaptConcepts)"
  - "D-05a GREEN: decode/adapt path disjoint from runPredictionPipeline/aggregateScores/ENGINE_VERSION — verified against live code"
  - "Route decision (D-06/A1): new SSE route /api/tools/remix/run (not reusing /api/remix/adapt — wrong ownership model for open thread flow)"
  - "Cardinality (A3): 1 remix-card per run (concepts[0]) — studio one-card aesthetic, mirrors hooks pattern"
  - "RemixCardBlockSchema band/fraction describe ADAPTED HOOK scroll-stop ONLY (Pitfall 5 honesty spine)"
  - "sourceDecode in RemixCardBlock carries REAL 4-beat decode anatomy (D-05 moat) — hookPattern/structure/theTurn/emotionalBeat"
  - "Remix mode mirrors Hooks role set ['niche','audience','platform','wins','flops'] — GROUND-02 anti-dilution"
  - "'Develop into hooks →' CTA stub — wired in 06-05 (mirrors HookCardRenderer plan-01 pattern)"
metrics:
  duration: "~5min"
  completed_date: "2026-06-18"
  tasks: 2
  files: 7
---

# Phase 06 Plan 02: Remix Foundation Summary

Remix reuse scout (REMIX-01 gate) + remix mode + remix-card typed block + RemixCardRenderer landed as Wave-2 foundation before any route persists a remix-card.

## What Was Built

**Task 1: REMIX-01 Reuse Scout (06-SCOUT.md)**

`06-SCOUT.md` written confirming all REMIX-01 mandated findings against live code:
- **D-05a GREEN**: decode.ts + adapt.ts contain zero references to `runPredictionPipeline`, `aggregateScores`, `usage_tracking`, or `ENGINE_VERSION`. Decode uses `QWEN_DECODE_MODEL` (defaults to `QWEN_REASONING_MODEL`). Adapt uses `QWEN_REASONING_MODEL` directly. No protected SIM-1 Max path crossed.
- **Reuse surface**: 5 functions confirmed importable as-is for 06-04 (`resolveAndRehost`, `omniOutputToStructuralInput`, `runDecode`, `decodeResultToAdaptInput`, `generateAdaptConcepts`) with exact signatures documented.
- **Dead UI boundary**: `board/adapt/*` components not present in worktree; `AdaptConcept` shape used as reference only — new `remix-card` built fresh (THREAD-04).
- **Route decision**: New SSE route `/api/tools/remix/run` (existing `/api/remix/adapt` is non-SSE + Reading-scoped, wrong shape for open thread). 5 security controls to copy: auth-first 401, Content-Type 415, cross-origin 403, Zod 400 validation, `maxDuration=300`, `cleanup()` in finally (T-03-02).
- **Cardinality**: 1 card (concepts[0]) per studio one-card aesthetic.

**Task 2 (TDD RED→GREEN): Assembler mode + RemixCardBlockSchema + registry + renderer**

`modeSchema` extended to `z.enum(["idea","hooks","chat","script","remix"])` (Pitfall 2 closed — `assembleBundle({mode:'remix'})` no longer throws). `MODE_ROLES.remix` added mirroring hooks role set per GROUND-02 anti-dilution. `RemixCardBlockSchema` defined in `blocks.ts` with:
- `adaptedHook`, `angle`, `whoItsFor`, `formatBorrowed` (the AdaptConcept anatomy, D-09 UI mapping)
- `sourceDecode: { hookPattern, structure, theTurn, emotionalBeat }` (REAL 4-beat decode output — D-05 moat, NOT a metadata guess)
- `band`, `fraction`, `scrollQuote` (adapted-hook opener-scoped signal, Pitfall 5 honesty spine)
- `model: z.literal("sim1-flash")` (D-10 provenance)

`RemixCardBlock` type exported. `RemixCardBlockSchema` added to `BlockUnionSchema`. `"remix-card"` registered in `BLOCK_REGISTRY` (Pitfall 1 precondition closed). `RemixCardRenderer` built cloning `HookCardBlock` shape: face shows `adaptedHook` headline + "Borrowed:" coral chip + angle/whoItsFor muted sub-rows + scrollQuote; expand reveals the real decode anatomy (4 beats — the D-05 moat); opener-scoped band chip (Pitfall 5); "Develop into hooks →" CTA stub (wired in 06-05). `"remix-card": RemixCardRenderer` added to `BLOCK_COMPONENTS`. 12 tests GREEN.

## Success Criteria — All Met

- REMIX-01 reuse scout complete (06-SCOUT.md present, D-05a gate satisfied): YES
- D-05a re-confirmed GREEN against live code: YES
- `assembleBundle({mode:'remix'})` no longer throws (Pitfall 2 closed): YES
- remix-card validates + rehydrates (Pitfall 1 precondition): YES
- RemixCardRenderer surfaces REAL decode anatomy (D-05), not metadata guess: YES
- 12 tests GREEN; lint clean; tsc clean on modified files: YES

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `RemixCardRenderer` "Develop into hooks →" CTA: `onDevelop` prop is undefined at this stage — button renders disabled. Wired in Plan 06-05 (remix→hooks chain handoff via chain-handoff.ts). Intentional per plan D-05 and mirrors HookCardRenderer plan-01 behavior.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced in this plan. `remix-card` rehydration goes through `validateBlock` (D-14 existing path) — T-06-04 mitigation in place. D-05a verified GREEN (T-06-03 mitigation confirmed).

## Self-Check: PASSED

Files:
- FOUND: src/lib/tools/blocks.ts (RemixCardBlockSchema exported)
- FOUND: src/lib/tools/block-registry.ts ('remix-card' entry)
- FOUND: src/components/thread/remix-card-block.tsx (177 lines ≥ 40 min)
- FOUND: .planning/phases/06-script-remix-tools/06-SCOUT.md (167 lines ≥ 20 min)
- FOUND: src/lib/kc/assembler.ts (remix in modeSchema + MODE_ROLES)
- FOUND: src/components/thread/message-blocks.tsx (remix-card→RemixCardRenderer wired)
- FOUND: src/lib/tools/__tests__/blocks-remix.test.ts (12 tests GREEN)

Commits:
- 971838ee: docs(06-02): REMIX-01 reuse scout — D-05a GREEN + decode/adapt seams + route decision
- (RED) test(06-02): add failing tests for remix-card block schema + registry + assembler mode
- 7a2b958d: feat(06-02): remix mode in assembler + RemixCardBlockSchema + registry + renderer
