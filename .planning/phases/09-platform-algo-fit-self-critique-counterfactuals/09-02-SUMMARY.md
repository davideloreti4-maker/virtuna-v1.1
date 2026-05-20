---
phase: 09
plan: 02
subsystem: gemini-engine
tags: [watermark-detection, schema, prompt, back-compat]
requires: [05-gemini-schema]
provides: [algo-06-watermark-detection]
affects: [gemini-hook-decomposition]
tech-stack:
  added: []
  patterns: [optional-nested-object-zod, optional-property-gemini-schema]
key-files:
  created: []
  modified:
    - src/lib/engine/gemini/schemas.ts
    - src/lib/engine/gemini/prompts.ts
decisions:
  - 'watermark_detected is a fully optional object — missing, partial, or all-false all valid'
  - 'Gemini schema marks watermark_detected NOT in required array, making it optional at the API level'
  - 'Prompt includes explicit negative examples to prevent false positives on creator content'
metrics:
  duration: 0h 5m
  completed: '2026-05-20'
---

# Phase 9 Plan 02: Watermark detection schema + prompt extension

Reuses existing Gemini Pro call — no new calls, no new cost. Extends Phase 5 hook-decomposition schema and prompt with platform watermark detection booleans (tiktok, ig, yt).

## Changes

### `src/lib/engine/gemini/schemas.ts`

1. **HookDecompositionZodSchema** — Added `watermark_detected: z.object({tiktok, ig, yt}).optional()`. Each inner boolean is also `.optional()`. The entire `watermark_detected` object is optional on the parent — pre-Phase-9 JSONB cached rows without this field still pass Zod validation without changes.

2. **HOOK_SEGMENT_GEMINI_SCHEMA** — Mirrored `watermark_detected` in the Gemini literal `hook_decomposition.properties`. NOT added to the `required` array (lines 205-213), so Gemini may omit the field. Gemini schema uses `Type.BOOLEAN` for each platform boolean.

### `src/lib/engine/gemini/prompts.ts`

3. **buildHookSystemPrompt** — Added `## Watermark Detection` section between Cross-Modal Scores and Scoring Rules. Includes:
   - Detection instructions for tiktok, ig, yt booleans
   - Explicit negative examples (creator handles, brand logos, text overlays, UI chrome, re-uploads)
   - Guidance to omit field entirely when no platform watermark is visible

## Verification

- TypeScript compilation passes with no errors in modified files (pre-existing errors in unrelated test files only)
- Back-compat verified: `watermark_detected` is `.optional()` on the Zod schema and not in the Gemini `required` array — old cached JSONB rows without the field still validate correctly
- No files outside `schemas.ts` and `prompts.ts` were modified

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/lib/engine/gemini/schemas.ts`: verified watermark_detected in both Zod (line 62) and Gemini schema (line 196)
- `src/lib/engine/gemini/prompts.ts`: verified Watermark Detection section present (line 53)
- Commit `c4e3072` exists with both files
