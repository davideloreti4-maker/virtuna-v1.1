---
phase: 06-script-remix-tools
plan: "01"
subsystem: script-foundation
tags: [script, kc, block-schema, renderer, assembler, tdd]
dependency_graph:
  requires: [04-hooks-tool, 05-open-chat-test-reframe]
  provides: [ScriptCardBlockSchema, ScriptCardRenderer, KC_SCRIPT_SYSTEM_PROMPT, script-mode]
  affects: [message-blocks, block-registry, assembler, compiled-kc]
tech_stack:
  added: []
  patterns: [tdd-red-green, typed-block-renderer, kc-compile-time-assembly]
key_files:
  created:
    - src/lib/tools/__tests__/blocks-script.test.ts
    - src/components/thread/script-card-block.tsx
    - .planning/corpus/script.md
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/lib/kc/assembler.ts
    - scripts/regen-kc.ts
    - src/lib/kc/compiled.ts
    - src/components/thread/message-blocks.tsx
decisions:
  - "Script mode mirrors Hooks role set: ['niche','audience','platform','wins','flops'] — GROUND-02 anti-dilution"
  - "ScriptCardBlockSchema: band/fraction describe OPENER ONLY (Pitfall 5 honesty spine) — comment on schema"
  - "ScriptCardRenderer 'Test full →' CTA stub with onTest? prop — wired in 06-05 (mirrors HookCardRenderer plan-01 pattern)"
  - "KC_SCRIPT_SYSTEM_PROMPT assembled at compile time (D-03) via regen-kc.ts — same pattern as hooks/chat"
metrics:
  duration: "~20min"
  completed_date: "2026-06-18"
  tasks: 2
  files: 8
---

# Phase 06 Plan 01: Script Foundation Summary

Script KC slice + typed block + renderer + assembler mode landed as Wave-0 foundation before any route persists a script-card.

## What Was Built

**Task 1 (TDD RED→GREEN): Assembler mode + ScriptCardBlockSchema + registry**

`modeSchema` extended to `z.enum(["idea","hooks","chat","script"])` (Pitfall 2 closed — `assembleBundle({mode:'script'})` no longer throws). `MODE_ROLES.script` added mirroring hooks role set per GROUND-02 anti-dilution. `ScriptCardBlockSchema` defined in `blocks.ts` with: `beats[]` (label/content/timing/retentionMarker), `openingBeatSeed`, `band`, `fraction`, `scrollQuote`, `model: z.literal("sim1-flash")`. Honesty spine comment on schema: band/fraction describe OPENER ONLY (Pitfall 5). `ScriptCardBlock` type exported. `ScriptCardBlockSchema` added to `BlockUnionSchema`. `"script-card"` registered in `BLOCK_REGISTRY` (Pitfall 1 precondition closed — block registered before any persist). 14 tests GREEN.

**Task 2: Renderer + corpus slice + KC compilation**

`ScriptCardRenderer` built cloning `HookCardBlock` shape (THREAD-04 fixed typed renderer). Face: expandable beats list (label · timing · content · retentionMarker expand-on-tap), opener-scoped band chip with "opener stops the scroll" copy (Pitfall 5 honesty label), opening beat seed section, "Test full →" CTA stub (onTest? prop — wired in 06-05). THEME-06 flat-warm: 6% borders, 12px card radius, coral on CTA only. `"script-card": ScriptCardRenderer` added to `BLOCK_COMPONENTS` in message-blocks.tsx (TypeScript enforces completeness). `.planning/corpus/script.md` authored: beat structure (Hook/Setup/Turn/Payoff/CTA), per-beat pacing/timing guidance, retention-marker craft, six failure modes, gold-standard templates, honesty spine, scaffold→deliverable distinction. `regen-kc.ts` extended to read script.md and emit `KC_SCRIPT_SLICE` + `KC_SCRIPT_SYSTEM_PROMPT`. Compiled.ts regenerated.

## Success Criteria — All Met

- `assembleBundle({mode:"script"})` no longer throws (Pitfall 2 closed): YES
- A script-card validates + rehydrates (Pitfall 1 precondition): YES
- KC_SCRIPT_SYSTEM_PROMPT compiled from authored script.md slice: YES
- ScriptCardRenderer with opener-scoped band honesty (Pitfall 5): YES

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `ScriptCardRenderer` "Test full →" CTA: `onTest` prop is undefined at this stage — button renders disabled. Wired in Plan 06-05 (script→test handoff via chain-handoff.ts). This is intentional per plan D-05 and mirrors the HookCardRenderer plan-01 behavior.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced in this plan. `script-card` rehydration goes through `validateBlock` (D-14 existing path) — T-06-01 mitigation in place.

## Self-Check: PASSED

Files:
- FOUND: src/lib/tools/blocks.ts (ScriptCardBlockSchema exported)
- FOUND: src/lib/tools/block-registry.ts ('script-card' entry)
- FOUND: src/components/thread/script-card-block.tsx (199 lines ≥ 40 min)
- FOUND: .planning/corpus/script.md (243 lines ≥ 30 min)
- FOUND: src/lib/kc/compiled.ts (KC_SCRIPT_SYSTEM_PROMPT present)
- FOUND: src/lib/kc/assembler.ts (script in modeSchema + MODE_ROLES)
- FOUND: src/components/thread/message-blocks.tsx (script-card→ScriptCardRenderer wired)
- FOUND: src/lib/tools/__tests__/blocks-script.test.ts (14 tests GREEN)

Commits:
- 86049417: feat(06-01): add script mode to assembler + ScriptCardBlockSchema + registry
- beaea32c: feat(06-01): ScriptCardRenderer + script.md slice + KC_SCRIPT_SYSTEM_PROMPT
