---
phase: 01-engine-thread-foundation
plan: "01"
subsystem: tools
tags: [block-registry, tool-runner, renderer, thread, SSOT, zod, typescript]
dependency_graph:
  requires: []
  provides:
    - src/lib/tools/blocks.ts (MarkdownBlock, BandBlock, PersonasBlock schemas + types)
    - src/lib/tools/block-registry.ts (BLOCK_REGISTRY SSOT, validateBlock, assertBlocksInRegistry, BlockType)
    - src/lib/tools/block-registry.tsx (client companion: BLOCK_COMPONENT_REGISTRY)
    - src/lib/tools/tool-runner.ts (ToolRunner<TOut> interface + dispatchToolOutput)
    - src/components/thread/message-blocks.tsx (block host, re-validates per D-14)
    - src/components/thread/unsupported-block.tsx (static placeholder, never executes props)
    - src/components/thread/markdown-block.tsx (react-markdown + rehype-sanitize)
    - src/components/thread/band-block.tsx (band word + fraction + model tag, no numeric score)
    - src/components/thread/personas-block.tsx (Flash persona expand, D-03 shape)
  affects:
    - Plans 03 (Flash engine) and 04 (composer) — both consume ToolRunner + BLOCK_REGISTRY
    - Any consumer of blocks.ts schemas (tool-runner boundary + message rehydration)
tech_stack:
  added: []
  patterns:
    - Registry-dispatch pattern (BLOCK_REGISTRY as SSOT, no scattered switch statements)
    - TDD London School (failing test → implementation → green)
    - Zod safeParse model-boundary validation (never throws, mirrors fold-prompts.ts)
    - D-14 double-validation (write boundary + rehydration)
key_files:
  created:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/lib/tools/block-registry.tsx
    - src/lib/tools/tool-runner.ts
    - src/lib/tools/__tests__/block-registry.test.ts
    - src/lib/tools/__tests__/tool-runner.test.ts
    - src/components/thread/message-blocks.tsx
    - src/components/thread/unsupported-block.tsx
    - src/components/thread/markdown-block.tsx
    - src/components/thread/band-block.tsx
    - src/components/thread/personas-block.tsx
  modified: []
decisions:
  - "block-registry.ts stays component-free (server-importable); component map lives in message-blocks.tsx and block-registry.tsx (separate files to avoid .ts/.tsx bundler resolution ambiguity)"
  - "dispatchToolOutput convention: structured output schema root must expose a blocks[] array field"
  - "BandBlock carries no numeric score — band word + fraction + model tag only (D-02/D-11)"
  - "PersonasBlock uses a Flash-specific list renderer, not PersonaCloud (A5 — incompatible HeatmapPayload shape)"
  - "ToolRunner stream?: boolean reserved but unused in P1 — seam for IDEAS-02 Phase 3 streaming"
metrics:
  duration: "17 minutes"
  completed: "2026-06-17T07:41:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 11
  files_modified: 0
---

# Phase 1 Plan 01: Renderer Registry + Tool-Runner Contract Summary

**One-liner:** Zod-validated BLOCK_REGISTRY SSOT maps type→{component,schema}; ToolRunner<TOut> contract routes structured model output → typed blocks (or null→markdown); MessageBlocks re-validates each block on render — structural enforcement of THREAD-04 "no model-generated UI."

## What Was Built

### Task 1: Block schemas + BLOCK_REGISTRY SSOT + validateBlock

`blocks.ts` defines three Zod v4 block schemas shaped `{type: literal, props: object}`:
- `MarkdownBlock` — `{text: string}`
- `BandBlock` — `{band: enum(Strong|Mixed|Weak), fraction: string, model: enum(sim1-flash|sim1-max)}` — no 0-100 number (D-11 honesty spine); model tag on the block for provenance (D-10)
- `PersonasBlock` — `{personas: [{archetype, verdict: enum(stop|scroll), quote: string(1-160)}]}` — exact D-03 shape

`block-registry.ts` exports `BLOCK_REGISTRY` (server-importable, zero client-component imports), `BlockType`, `validateBlock` (never throws, always returns `{ok:true,block}|{ok:false}`), and `assertBlocksInRegistry` (throws if block type outside allowed subset).

Commits: `d73df865` (RED test) → `46c2b929` (GREEN implementation)

### Task 2: Block renderer components + message-blocks host + unsupported placeholder

Six files created:
- `unsupported-block.tsx` — static "Unsupported content" placeholder, receives no props from model
- `markdown-block.tsx` — react-markdown + rehype-sanitize (mirrors reading-chat.tsx pattern)
- `band-block.tsx` — renders band word + fraction + model tag; distinct Flash/Max container styling (D-10); reuses score-gauge zone-color CSS variables only (not the gauge component — Pitfall #1)
- `personas-block.tsx` — Flash-specific expand list reading `{archetype, verdict, quote}`; no PersonaCloud import (A5)
- `block-registry.tsx` — client companion attaching components to registry keys
- `message-blocks.tsx` — re-validates each block via `validateBlock()` before render (D-14)

Commit: `f5d4dab7`

### Task 3: ToolRunner contract + dispatchToolOutput

`tool-runner.ts` exports:
- `ToolRunner<TOut>` interface with THREAD-06 fields: `id`, `model`, `promptTemplate`, `knowledgeBundle`, `outputSchema`, `renderer: BlockType[]`, `stream?` (reserved, unused in P1)
- `KnowledgeBundle` opaque placeholder (Phase 2 fills it)
- `dispatchToolOutput(runner, modelOutput)` — schema present → safeParse → assertBlocksInRegistry → typed blocks; schema null → single markdown block

Commit: `d2c189af`

## Verification Results

```
✓ src/lib/tools/__tests__/block-registry.test.ts (10 tests)
✓ src/lib/tools/__tests__/tool-runner.test.ts (6 tests)
✓ pnpm exec tsc --noEmit → 0 errors in src/lib/tools/** and src/components/thread/**
✓ grep -rniE "score|0-100|percentile|toFixed|views|engagement" src/components/thread/band-block.tsx → CLEAN
✓ grep -rn "switch.*\.type" src/lib/tools src/components/thread → CLEAN (no scattered switch)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .ts/.tsx module resolution ambiguity**
- **Found during:** Task 2
- **Issue:** TypeScript `bundler` moduleResolution resolves `@/lib/tools/block-registry` to the `.ts` file, making `BLOCK_COMPONENT_REGISTRY` (defined in `.tsx`) unreachable without an explicit `.tsx` extension import. `allowImportingTsExtensions` is not set in `tsconfig.json`.
- **Fix:** Inlined the `BLOCK_COMPONENTS` map directly in `message-blocks.tsx` (the only consumer); `block-registry.tsx` still exists as the plan requires for external client consumers that can import it directly.
- **Files modified:** `src/components/thread/message-blocks.tsx`, `src/lib/tools/block-registry.tsx`
- **Impact:** None to the architecture — the component map is still co-located with the registry, just split across two import surfaces (`.ts` for server schema, `.tsx` for client components).

## Known Stubs

None. All three block types are fully implemented end-to-end: schema → validated renderer → host component. No placeholder text or hardcoded empty values flow to UI rendering.

## Threat Flags

None. No new network endpoints, auth paths, or file access patterns introduced. Pure library/component code with no trust boundaries.

## Self-Check: PASSED

Files exist:
- /Users/davideloreti/virtuna-numen-tools/src/lib/tools/blocks.ts ✓
- /Users/davideloreti/virtuna-numen-tools/src/lib/tools/block-registry.ts ✓
- /Users/davideloreti/virtuna-numen-tools/src/lib/tools/block-registry.tsx ✓
- /Users/davideloreti/virtuna-numen-tools/src/lib/tools/tool-runner.ts ✓
- /Users/davideloreti/virtuna-numen-tools/src/components/thread/message-blocks.tsx ✓
- /Users/davideloreti/virtuna-numen-tools/src/components/thread/unsupported-block.tsx ✓
- /Users/davideloreti/virtuna-numen-tools/src/components/thread/band-block.tsx ✓

Commits:
- d73df865: test(01-01) RED block-registry ✓
- 46c2b929: feat(01-01) block schemas + BLOCK_REGISTRY ✓
- f5d4dab7: feat(01-01) block renderer components ✓
- d2c189af: feat(01-01) ToolRunner contract ✓
