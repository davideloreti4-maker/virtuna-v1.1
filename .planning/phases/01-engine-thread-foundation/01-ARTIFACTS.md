# Phase 1 — Artifacts this phase produces

Every symbol created across all four Phase-1 plans. Downstream phases (P3 Ideas, P4 Hooks, P5 Chat) consume these. This is the phase manifest the executor and verifier check against.

## New files

| File | Plan | Provides |
|------|------|----------|
| `src/lib/tools/blocks.ts` | 01 | `MarkdownBlock`, `BandBlock`, `PersonasBlock` zod schemas + `z.infer` types + `BlockUnion` |
| `src/lib/tools/block-registry.ts` | 01 | `BLOCK_REGISTRY` (schema half), `BlockType`, `validateBlock()`, `assertBlocksInRegistry()` |
| `src/lib/tools/block-registry.tsx` | 01 | client companion: attaches `component` to each registry key |
| `src/lib/tools/tool-runner.ts` | 01 | `ToolRunner<TOut>` contract, `KnowledgeBundle` type, `dispatchToolOutput()` |
| `src/lib/tools/__tests__/block-registry.test.ts` | 01 | registry + validateBlock behavior tests |
| `src/lib/tools/__tests__/tool-runner.test.ts` | 01 | tool-runner dispatch tests |
| `src/components/thread/message-blocks.tsx` | 01 | `MessageBlocks` host (body[] → registry component, re-validates) |
| `src/components/thread/unsupported-block.tsx` | 01 | `UnsupportedBlock` static placeholder |
| `src/components/thread/markdown-block.tsx` | 01 | markdown renderer (react-markdown + rehype-sanitize) |
| `src/components/thread/band-block.tsx` | 01 | Flash/Max band renderer (band word + fraction + model tag; no number) |
| `src/components/thread/personas-block.tsx` | 01 | Flash persona expand (`{archetype,verdict,quote}` list) |
| `supabase/migrations/20260617000000_threads_messages.sql` | 02 | `threads` + `messages` tables + RLS + partial unique index |
| `src/lib/threads/threads.ts` | 02 | `createGroundedThreadLazy()`, `getThread()`, `getOpenThread()` |
| `src/lib/threads/messages.ts` | 02 | `insertMessage()`, `loadMessages()` (rehydration re-validation) |
| `src/lib/threads/__tests__/messages.test.ts` | 02 | persistence round-trip + re-validation tests |
| `src/lib/engine/flash/flash-schema.ts` | 03 | `FlashPersona`, `FlashResultSchema`, `coerceFlashResponse()` |
| `src/lib/engine/flash/flash-prompts.ts` | 03 | `STABLE_FLASH_SYSTEM_PROMPT`, `buildFlashUserContent(text, framing)` |
| `src/lib/engine/flash/flash-aggregate.ts` | 03 | `aggregateFlash(personas)` → `{band, fraction}` (pure) |
| `src/lib/engine/flash/run-flash-text-mode.ts` | 03 | `runFlashTextMode(content_text, framing)` → `FlashResult` |
| `src/lib/engine/flash/__tests__/flash-schema.test.ts` | 03 | schema + coerce tests |
| `src/lib/engine/flash/__tests__/flash-aggregate.test.ts` | 03 | band/fraction threshold tests |
| `src/lib/tools/runners/flash-runner.ts` | 03 | Flash `ToolRunner` (model: sim1-flash; emits band + personas blocks) |
| `src/components/app/home/tool-chips.tsx` | 04 | `ToolChips` (chip row + active-model field + cost slot) |
| `src/components/app/home/__tests__/tool-chips.test.tsx` | 04 | chip selection + active-model tests |

## Modified files

| File | Plan | Change |
|------|------|--------|
| `src/components/app/home/composer.tsx` | 04 | + chip state, active-model field; Test loop + nav guard preserved |
| `src/components/app/home/__tests__/composer-navigate-guard.test.tsx` | 04 | extended: chip click + hydration id do not navigate |
| `src/types/database.types.ts` | 02 | regenerated from live DB (adds `threads`, `messages` types) |

## Table names

- `public.threads` — `id`, `user_id`, `type` (`grounded`\|`open`), `reading_id` uuid NULL FK → `analysis_results(id)` ON DELETE SET NULL, `created_at`, `updated_at`; PARTIAL UNIQUE(`reading_id`) WHERE `reading_id IS NOT NULL`
- `public.messages` — `id`, `thread_id` FK → `threads(id)` ON DELETE CASCADE, `role` (`user`\|`assistant`\|`tool`), `body` jsonb = `[{type, props}]`, `created_at`

## Types / interfaces / unions

- `ToolRunner<TOut>` — `{id, model, promptTemplate, knowledgeBundle, outputSchema, renderer, stream?}` (THREAD-06 contract)
- `BlockType` = `"markdown" | "band" | "personas"` (renderer-registry key union)
- `KnowledgeBundle` (P1 placeholder; Phase 2 GROUND-* fills it)
- `FlashResult` / `FlashPersona` (`{archetype, verdict: stop|scroll, quote}`)
- Tool id union `"test" | "idea" | "hooks" | "chat"`; model union `"sim1-max" | "sim1-flash"`

## Functions

- `validateBlock(raw)`, `assertBlocksInRegistry(blocks, allowed)`, `dispatchToolOutput(runner, modelOutput)`
- `createGroundedThreadLazy(readingId, userId)`, `getThread(id)`, `getOpenThread(userId)`, `insertMessage(threadId, role, blocks)`, `loadMessages(threadId)`
- `runFlashTextMode(content_text, framing)`, `aggregateFlash(personas)`, `coerceFlashResponse(raw)`, `buildFlashUserContent(text, framing)`

## Components

- `MessageBlocks`, `UnsupportedBlock`, `MarkdownBlock`, `BandBlock`, `PersonasBlock`, `ToolChips`

## Env vars

- `FLASH_MODEL` (new; mirrors `FOLD_MODEL`; defaults to `QWEN_FAST_MODEL` = `qwen3.6-flash`) — selects the SIM-1 Flash text-mode model. No new secret (reuses existing `QWEN_*` / Supabase config).

## Explicitly NOT touched (regression gate)

- `src/lib/engine/pipeline.ts`, `aggregator.ts`, `version.ts` (ENGINE_VERSION stays `3.19.0`), `wave3/fold*.ts`, the `analysis_results` table — the protected SIM-1 Max path (D-12 / Pitfall #2).
