---
phase: 01-engine-thread-foundation
plan: 03
subsystem: engine-flash
tags: [flash, sim1-flash, text-mode, tool-runner, engine, tdd]
dependency_graph:
  requires: [01-01]
  provides: [FlashResultSchema, coerceFlashResponse, aggregateFlash, STABLE_FLASH_SYSTEM_PROMPT, buildFlashUserContent, runFlashTextMode, flashRunner, mapFlashResultToBlocks]
  affects: [src/lib/engine/flash/, src/lib/tools/runners/flash-runner.ts]
tech_stack:
  added: []
  patterns: [TDD-RED-GREEN, bounded-Qwen-call, fold-fork, FLASH_MODEL-env-seam, deterministic-aggregate, registry-validated-blocks]
key_files:
  created:
    - src/lib/engine/flash/flash-schema.ts
    - src/lib/engine/flash/flash-aggregate.ts
    - src/lib/engine/flash/flash-prompts.ts
    - src/lib/engine/flash/run-flash-text-mode.ts
    - src/lib/engine/flash/__tests__/flash-schema.test.ts
    - src/lib/engine/flash/__tests__/flash-aggregate.test.ts
    - src/lib/tools/runners/flash-runner.ts
  modified: []
decisions:
  - "STRONG_THRESHOLD=6, MIXED_THRESHOLD=3 named as ENGINE-01 calibration constants (tunable per inline-scoring spec)"
  - "coerceFlashResponse handles 3 sloppiness cases: bare array, fenced JSON string, verdict casing"
  - "FLASH_MODEL env seam defaults to QWEN_FAST_MODEL (qwen3.6-flash) — product label sim1-flash is decoupled from the infrastructure model"
  - "flashRunner.id = 'hooks' in P1 (P3/P4 will also register 'idea'); chip stays disabled until P3/P4 flip it"
  - "mapFlashResultToBlocks exported separately for testability"
metrics:
  duration: 7m
  completed_date: "2026-06-17T07:53:01Z"
  tasks_completed: 3
  files_created: 7
  tests_added: 36
---

# Phase 1 Plan 3: SIM-1 Flash Text-Mode Engine Summary

## One-liner

SIM-1 Flash text-mode engine path: one bounded Qwen call returns 10 per-persona stop/scroll verdicts + first-person quotes, rolled into a qualitative band+fraction via a pure deterministic aggregator, exposed as a sim1-flash-tagged ToolRunner — HARD ISOLATED from the protected Max path.

## What Was Built

### Task 1: Flash schema + deterministic aggregate (TDD)

**flash-schema.ts** — FlashPersonaSchema + FlashResultSchema (`.length(10)`, mirrors FoldResponseSchema) + coerceFlashResponse (salvages bare arrays, fenced JSON strings, verdict casing variants). Zod enforces the hard 10-persona contract after coercion.

**flash-aggregate.ts** — Pure deterministic `aggregateFlash(personas): {band, fraction}`. Thresholds `STRONG_THRESHOLD=6` / `MIXED_THRESHOLD=3` are named constants documented as ENGINE-01 calibration tunable. Output has exactly two fields — band + fraction — NO score/percentile/views/engagement/reach (D-11 honesty spine).

**36 tests** — 15 schema tests, 21 aggregate tests. All green.

### Task 2: Flash prompts + runFlashTextMode

**flash-prompts.ts** — `STABLE_FLASH_SYSTEM_PROMPT` (byte-stable cache prefix with all 10 ARCHETYPE_DEFINITIONS verbatim from persona-registry.ts) + `buildFlashUserContent(text, framing)` where `framing: "hook"|"idea"|"chat"` swaps ONLY the persona question + band verbiage (D-04). Persona data pulled from `wave3/persona-registry.ts` (D-05 — data-driven, not hardcoded).

**run-flash-text-mode.ts** — `runFlashTextMode(content_text, framing)` mirrors the fold.ts bounded-call envelope: `getQwenClient + AbortController(60s) + temperature:0 + seed:QWEN_SEED + response_format:json_object + stripModelOutput → coerceFlashResponse → FlashResultSchema.safeParse`. Model resolved behind `FLASH_MODEL` env defaulting to `QWEN_FAST_MODEL`. Returns whole (no streaming, P1 Pitfall #6).

HARD ISOLATION verified: zero imports from `pipeline`, `aggregator`, `version`, or `wave3/fold*` in the entire `src/lib/engine/flash/` directory.

### Task 3: Flash ToolRunner + regression proof

**flash-runner.ts** — `flashRunner: ToolRunner<FlashOutput>` with `model:"sim1-flash"`, `renderer:["band","personas"]`, `outputSchema: FlashOutputSchema`. `mapFlashResultToBlocks(result)` produces BandBlock (band+fraction+model:"sim1-flash") + PersonasBlock ({personas:[{archetype,verdict,quote}]}) and runs `assertBlocksInRegistry` against the BLOCK_REGISTRY SSOT. `runFlashRunner(content_text, framing)` is the full pipeline helper.

**Engine regression gate:** 83 test files / 1043 tests GREEN. `version.test.ts` asserts `ENGINE_VERSION === "3.19.0"` — PASSED. `version.ts`, `pipeline.ts`, `aggregator.ts` byte-untouched.

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED commit: `4b4e1d3c` — `test(01-03): add failing tests for flash schema + aggregate (TDD RED)`
- GREEN commit: `9197c0c8` — `feat(01-03): implement FlashResultSchema + coerceFlashResponse + aggregateFlash`
- REFACTOR: none needed — code was clean in GREEN

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Flash module is a pure server-side engine library.

## Self-Check: PASSED
