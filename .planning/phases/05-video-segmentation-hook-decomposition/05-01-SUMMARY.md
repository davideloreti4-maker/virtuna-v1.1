---
phase: "05"
plan: "01"
subsystem: engine
tags:
  - phase-5
  - foundations
  - gemini-segmentation
  - schemas
  - cost-helper
  - prompts
dependency_graph:
  requires:
    - phase-4 # Wave 0 content_type + niche detection (env-var-with-default pattern; Type literal import)
    - phase-3 # SignalAvailability provenance contract (D-07 forward-compat)
  provides:
    - HookSegmentZodSchema
    - BodySegmentZodSchema
    - CtaSegmentZodSchema
    - HookDecompositionZodSchema
    - HookSegmentResult
    - BodySegmentResult
    - CtaSegmentResult
    - HookDecomposition
    - HOOK_SEGMENT_GEMINI_SCHEMA
    - BODY_SEGMENT_GEMINI_SCHEMA
    - CTA_SEGMENT_GEMINI_SCHEMA
    - calculateCost(model, usageMetadata) # per-model
    - buildHookPrompt
    - buildBodyPrompt
    - buildCtaPrompt
    - GEMINI_HOOK_MODEL # env-var export
    - GEMINI_BODY_MODEL
    - GEMINI_CTA_MODEL
    - stripFences # was file-local, now exported
    - CalibrationData # was file-local, now exported
  affects:
    - src/lib/engine/types.ts # GeminiVideoAnalysis + SignalAvailability widening
    - src/lib/engine/gemini.ts # env-var exports, calculateCost shim, stripFences export
    - src/lib/engine/aggregator.ts # 3-line placeholder bump for new SignalAvailability keys
tech_stack:
  added: [] # No new deps — uses existing @google/genai + zod
  patterns:
    - per-model-cost-helper
    - zod-plus-gemini-responseschema-pair
    - stable-system-volatile-user-prompt-split
    - env-var-with-default
key_files:
  created:
    - src/lib/engine/gemini/schemas.ts
    - src/lib/engine/gemini/cost.ts
    - src/lib/engine/gemini/prompts.ts
    - src/lib/engine/__tests__/gemini-schemas.test.ts
    - src/lib/engine/__tests__/gemini-types-widening.test.ts
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/gemini.ts
    - src/lib/engine/aggregator.ts
    - .env.example
    - src/lib/engine/__tests__/aggregator.test.ts # SignalAvailability literal updates
    - src/lib/engine/__tests__/deepseek.test.ts # Type enum exposed in @google/genai mock
decisions:
  - D-01: per-segment Gemini 3 preview models (HOOK=Pro, BODY/CTA=Flash) via env vars
  - D-02: SEGMENT-06 satisfied by D-01 env-var-with-default pattern
  - D-05: CTA presence-aware schema with cross-field .refine invariant
  - D-12: SignalAvailability widened with gemini_hook/body/cta as REQUIRED provenance keys (not in SCORE_WEIGHT_KEYS)
  - D-13: GeminiVideoAnalysis widened with hook_decomposition + cta_segment as OPTIONAL+NULLABLE (preserves makeGeminiAnalysis() factory typecheck — Pitfall #10)
  - D-15-partial: Prompt builders accept niche + contentType + creatorStyle; full creator-context injection deferred to Plan 02
metrics:
  duration_minutes: 28
  completed_date: "2026-05-18"
  tests_added: 24
  tests_passing_after: 362
  tests_skipped: 3
---

# Phase 5 Plan 01: Foundations — Schemas, Types, Cost, Prompts Summary

**One-liner:** Foundation scaffolding for Gemini-3 segmented video analysis — Zod + responseSchema pairs, per-model cost helper closing Pitfall #9 (Pro under-counted ~13× vs Flash), prompt builders with stable-prefix / volatile-suffix discipline, type widening that preserves makeGeminiAnalysis() typecheck (Pitfall #10), and env-var indirection for GA migration.

## What Was Built

### New files (3 source + 2 tests)

| File | Role | Key exports |
|------|------|-------------|
| `src/lib/engine/gemini/schemas.ts` | model | `HookSegmentZodSchema`, `BodySegmentZodSchema`, `CtaSegmentZodSchema` (with `.refine` cross-field invariant), `HookDecompositionZodSchema` + inferred types `HookSegmentResult` / `BodySegmentResult` / `CtaSegmentResult` / `HookDecomposition`, plus hand-written Gemini OpenAPI-3 responseSchema literals `HOOK_SEGMENT_GEMINI_SCHEMA` / `BODY_SEGMENT_GEMINI_SCHEMA` / `CTA_SEGMENT_GEMINI_SCHEMA` (CTA literal sets `propertyOrdering: ["cta_present", ...]` to bias the model toward emitting the discriminator first) |
| `src/lib/engine/gemini/cost.ts` | utility | `calculateCost(model, usageMetadata)` — per-model pricing table (gemini-3.1-pro-preview / gemini-3-pro-preview / gemini-3-flash-preview / gemini-3.1-flash-lite / gemini-2.5-flash). Unknown model falls back to Flash-preview pricing (no throw) per threat T-5-01-05 |
| `src/lib/engine/gemini/prompts.ts` | utility | `buildHookPrompt` / `buildBodyPrompt` / `buildCtaPrompt`. Stable-system rubric + volatile-user context split (cacheable prefix per AI-SPEC §4b). Hook rubric embeds the 4 sub-modality definitions, presence-aware weakest_modality guard ("do NOT name it as weakest_modality" for absent modalities), cognitive_load polarity warning ("HIGHER = WORSE"), and top-3 calibration differentiators |
| `src/lib/engine/__tests__/gemini-schemas.test.ts` | test | 16 tests — RED gate at commit `e117ccc`, GREEN gate at `eb7e0df` |
| `src/lib/engine/__tests__/gemini-types-widening.test.ts` | test | 8 tests — RED gate at `fa97ad3`, GREEN gate at `fda82c8` |

### Modified files

| File | Change |
|------|--------|
| `src/lib/engine/types.ts` | Added `import {...} from "./gemini/schemas"` + re-export of `HookDecomposition` / `CtaSegmentResult` / `BodySegmentResult` (one import surface for downstream). `SignalAvailability` widened with 3 REQUIRED keys: `gemini_hook` / `gemini_body` / `gemini_cta` (provenance — must NOT enter `SCORE_WEIGHT_KEYS`). `GeminiVideoResponseSchema` widened via `.extend({ hook_decomposition: HookDecompositionZodSchema.optional().nullable(), cta_segment: CtaSegmentZodSchema.optional().nullable() })` — preserves `makeGeminiAnalysis()` factory typecheck (Pitfall #10) |
| `src/lib/engine/gemini.ts` | Added 3 exported env-var consts (`GEMINI_HOOK_MODEL` = `gemini-3.1-pro-preview`, `GEMINI_BODY_MODEL` = `gemini-3-flash-preview`, `GEMINI_CTA_MODEL` = `gemini-3-flash-preview`). `stripFences` function now exported. `CalibrationData` interface now exported (was file-local). `calculateCost` body replaced with thin shim that delegates to `./gemini/cost.ts` pinning `GEMINI_MODEL` — legacy call sites at lines ~357 and ~497 unchanged, behavior byte-identical (D-11 invariant verified by 11/11 cost-calculation.test.ts passing). Removed dead `INPUT_PRICE_PER_TOKEN` / `OUTPUT_PRICE_PER_TOKEN` / `FALLBACK_INPUT_TOKENS` / `FALLBACK_OUTPUT_TOKENS` consts (price table now owned by `cost.ts`) |
| `src/lib/engine/aggregator.ts` | 3-line placeholder bump in the `SignalAvailability` construction literal at line ~340 — adds `gemini_hook: false`, `gemini_body: false`, `gemini_cta: false`. Plan 03 swaps these for `pipelineResult.geminiResult.signalAvailability.gemini_<segment> ?? false`. Required so the types.ts widening compiles at the single construction site without ripple |
| `.env.example` | 3 new lines under AI/LLM section: `GEMINI_HOOK_MODEL=gemini-3.1-pro-preview`, `GEMINI_BODY_MODEL=gemini-3-flash-preview`, `GEMINI_CTA_MODEL=gemini-3-flash-preview`. PREVIEW-suffixed defaults (bare `gemini-3-pro` / `gemini-3-flash` are invalid SDK strings per wave0/content-type-detector.ts:13). Migration to GA is a single env-var flip |

## Decisions Implemented

- **D-01** Hook → `gemini-3.1-pro-preview`; Body + CTA → `gemini-3-flash-preview`. Env-overridable. Defaults locked at preview suffix.
- **D-02** SEGMENT-06 satisfied — three new env vars (`GEMINI_HOOK_MODEL` / `GEMINI_BODY_MODEL` / `GEMINI_CTA_MODEL`) with the canonical env-var-with-default idiom (`process.env.X ?? "default"`).
- **D-05** CTA segment presence-aware shape: `cta_present: boolean` discriminator + `strength: number | null` + `type: enum | null` + `rationale: string`. Cross-field `.refine` invariant: when `cta_present=true` both `strength` and `type` must be non-null; when `false` both must be null. Gemini's responseSchema literal expresses presence via `nullable: true` + `propertyOrdering: ["cta_present", ...]`.
- **D-12** `SignalAvailability` widened with 3 required keys (`gemini_hook` / `gemini_body` / `gemini_cta`). Provenance keys — must NOT be added to `SCORE_WEIGHT_KEYS` (Phase 4 Cross-File Constraint #3 carries forward).
- **D-13** `GeminiVideoAnalysis` widened with `hook_decomposition` (`HookDecomposition | null`) and `cta_segment` (`CtaSegmentResult | null`) as `.optional().nullable()` — Pitfall #10 closure (existing factories.ts:22 `makeGeminiAnalysis()` continues to typecheck unchanged).
- **D-15-partial** Prompt builders accept `niche`, `contentType`, and `creatorStyle` via `SegmentedPromptOptions`. Full creator-context injection (Cards 4–5) deferred to Plan 02 when the budget assessment is done with real Gemini calls.

## Requirements Addressed

- **SEGMENT-06** — env-var infrastructure for per-segment model selection (env-var-with-default idiom matches Phase 4 wave0/content-type-detector.ts:14 precedent). FULL closure here at the infrastructure level; segment helpers (Plan 02) consume the env vars.
- **HOOK-01..07** — schema-level (Zod definitions + Gemini OpenAPI-3 literals). Actual hook scoring requires live Gemini calls — Plan 02 ships those helpers consuming `HOOK_SEGMENT_GEMINI_SCHEMA` + `HookSegmentZodSchema`.

## Pitfalls Closed at the Foundation Layer

| Pitfall | Where | Disposition |
|---------|-------|-------------|
| #9 — per-model cost (hook Pro under-counted by ~13× vs Flash if helper uses single-model rates) | `src/lib/engine/gemini/cost.ts` | CLOSED. Per-model table; unknown model falls back to Flash preview (no throw — threat T-5-01-05). |
| #10 — existing test factory `makeGeminiAnalysis()` must continue to typecheck | `src/lib/engine/types.ts` `.optional().nullable()` widening | CLOSED. `makeGeminiAnalysis()` unchanged; 11 cost-calculation tests + 30 aggregator tests + 21 deepseek tests pass without modification |
| `Type` enum import chain (schemas.ts → types.ts → deepseek.ts test mock) | `src/lib/engine/__tests__/deepseek.test.ts` | FIXED — mock now exposes `Type.OBJECT/ARRAY/STRING/NUMBER/BOOLEAN`. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Update test fixtures for required-key bump**
- **Found during:** Task 2 typecheck after widening `SignalAvailability` with 3 required keys.
- **Issue:** `src/lib/engine/__tests__/aggregator.test.ts` had 11 inline `SignalAvailability` literals (lines 74, 94, 115, 132, 153, 172, 193-197 inline 5-tuple, 483, 502, 511, 526) that omitted the new `gemini_hook` / `gemini_body` / `gemini_cta` keys → 11 TS2345 errors.
- **Fix:** Used `perl -i -0777 -pe` to batch-insert `gemini_hook: false, gemini_body: false, gemini_cta: false,` into every `SignalAvailability` literal (single-line + multi-line variants).
- **Files modified:** `src/lib/engine/__tests__/aggregator.test.ts`.
- **Commit:** `fda82c8`.

**2. [Rule 1 — Bug] Expose `Type` enum in deepseek.test.ts genai mock**
- **Found during:** Full engine test suite run after Task 2 type widening.
- **Issue:** `src/lib/engine/__tests__/deepseek.test.ts` mocks `@google/genai` without the `Type` export. After Task 2, `types.ts` imports `./gemini/schemas` which imports `Type` from `@google/genai` at module load — vitest's hoisted mock then short-circuits the real export, causing `Type.OBJECT is undefined`.
- **Fix:** Added `Type: { OBJECT, ARRAY, STRING, NUMBER, BOOLEAN }` to the mock — same shape as the other test files (cost-calculation.test.ts, wave0-content-type.test.ts) already use.
- **Files modified:** `src/lib/engine/__tests__/deepseek.test.ts`.
- **Commit:** `fda82c8`.

**3. [Rule 1 — Bug] Remove dead pricing constants from gemini.ts**
- **Found during:** TS6133 unused-variable warnings after replacing `calculateCost` body with shim.
- **Issue:** `INPUT_PRICE_PER_TOKEN` / `OUTPUT_PRICE_PER_TOKEN` / `FALLBACK_INPUT_TOKENS` / `FALLBACK_OUTPUT_TOKENS` consts in `gemini.ts` are now unreferenced — the price table moved to `./gemini/cost.ts`, the tokenizer-fallback consts live there too.
- **Fix:** Deleted the 4 dead consts; left a short comment pointing readers to `./gemini/cost.ts`.
- **Files modified:** `src/lib/engine/gemini.ts`.
- **Commit:** `fda82c8`.
- **Note:** Plan text said "may safely DELETE the now-unused constants ... otherwise keep them dead-but-unused. Keep FALLBACK_INPUT_TOKENS and FALLBACK_OUTPUT_TOKENS constants — they remain used by other call sites." Verified by grep: ZERO call sites in `gemini.ts` reference the fallback consts after the shim swap. Removing them avoids TS6133 noise; semantically equivalent because the same values live in `cost.ts`.

### Out-of-Scope (Logged, Not Fixed)

Pre-existing repo-wide TS errors (1081 on base, 967 after my changes — my changes **net-reduced errors by 9**, never added any). The remaining ~967 errors are all in test files that lack `@types/vitest` global declarations in `tsconfig.json` — out of scope per the executor scope-boundary rule. Files affected: `pipeline.test.ts` (151 errors), `creator.test.ts` (112), `deepseek.test.ts` (111), `calibration.test.ts` (99), `rules.test.ts` (98), `gemini.test.ts` (89), `cost-calculation.test.ts` (65), `video-e2e.test.ts` (64), `trends.test.ts` (49), `fuzzy.test.ts` (42), plus the pre-existing `pipeline.ts:132` `CreatorContext` shape mismatch from earlier phases. All 23 test files **pass at runtime** (`pnpm test`) — the TS errors are vitest-globals declarations only. Recorded in `.planning/deferred-items.md` for a future tsconfig sweep.

## Tests

| Suite | Count | Status |
|-------|-------|--------|
| `gemini-schemas.test.ts` (new) | 16 | passing |
| `gemini-types-widening.test.ts` (new) | 8 | passing |
| `cost-calculation.test.ts` (legacy regression) | 11 | passing |
| `aggregator.test.ts` (legacy regression) | 30 | passing |
| `deepseek.test.ts` (legacy regression) | 21 | passing |
| **Full engine suite** | **362 + 3 skipped** | **all passing — zero regressions** |

`pnpm tsc --noEmit` adds zero new errors over base (net -9, because the aggregator.test.ts fixture update closed 11 errors that the SignalAvailability widening would otherwise have created).

## Commits

| Hash | Type | Message |
|------|------|---------|
| `e117ccc` | test(05-01) | RED — failing tests for schemas / cost / prompts |
| `eb7e0df` | feat(05-01) | GREEN — schemas.ts + cost.ts + prompts.ts (Task 1) |
| `fa97ad3` | test(05-01) | RED — failing tests for type widening + cost shim + stripFences export |
| `fda82c8` | feat(05-01) | GREEN — types.ts / gemini.ts / aggregator.ts widening + fixture updates (Task 2) |
| `89b4938` | chore(05-01) | .env.example — 3 segment env vars (Task 3) |

## Open Follow-ups for Plan 02 / Plan 03

- **Plan 02** imports `HookSegmentZodSchema` / `BodySegmentZodSchema` / `CtaSegmentZodSchema` + corresponding `HOOK_SEGMENT_GEMINI_SCHEMA` / etc., plus `buildHookPrompt` / `buildBodyPrompt` / `buildCtaPrompt`, plus per-model `calculateCost(model, ...)` from `./gemini/cost.ts`. Helpers reuse `getClient()` singleton + `stripFences` (now exported) from `../gemini`. Each segment helper owns its `AbortController` + `setTimeout` + `clearTimeout` + Sentry stage tag (`gemini_hook` / `gemini_body` / `gemini_cta`).
- **Plan 03** swaps the 3-line aggregator placeholder bump (`gemini_<segment>: false`) to read from `pipelineResult.geminiResult.signalAvailability` returned by `analyzeVideoSegmented`. The existing `gemini` key becomes derived: `gemini = gemini_hook || gemini_body || gemini_cta`. CTA-penalty branch (D-06) keys on `wave0Result.content_type?.type` × `geminiAnalysis.cta_segment?.cta_present`.
- **Deferred** — Gemini native context caching for the hook prompt prefix (Section 4b.4 of AI-SPEC). Trigger condition: hook-segment cost trends above 1.5¢/call in Phase 10 telemetry.

## Self-Check: PASSED

- [x] All 3 plan files created: `src/lib/engine/gemini/schemas.ts`, `src/lib/engine/gemini/cost.ts`, `src/lib/engine/gemini/prompts.ts`
- [x] 2 new test files: `src/lib/engine/__tests__/gemini-schemas.test.ts`, `src/lib/engine/__tests__/gemini-types-widening.test.ts`
- [x] 3 modified source files: `src/lib/engine/types.ts`, `src/lib/engine/gemini.ts`, `src/lib/engine/aggregator.ts`
- [x] `.env.example` extended with 3 new entries (preview-suffixed defaults)
- [x] All 5 task commits exist on the worktree branch (e117ccc, eb7e0df, fa97ad3, fda82c8, 89b4938)
- [x] All 13 plan-level grep acceptance gates pass
- [x] All Plan-scoped tests pass (24 new + 21+30+11 regression = 86 passing)
- [x] Full engine suite passes (362 + 3 skipped) — zero regressions
- [x] No new TS errors introduced by Plan 05-01 (net -9 vs base)
- [x] No live Gemini calls (foundation only)
- [x] No modifications to STATE.md / ROADMAP.md (orchestrator owns those writes)
