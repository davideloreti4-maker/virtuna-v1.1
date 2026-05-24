---
phase: 09
plan: 01
subsystem: engine-types
tags: [platform-fit, self-critique, counterfactuals, test-stubs, wave0]
requires: [08-retrieval-types]
provides: [algo-01..06-platform-fit-types, critique-01..03-types, counter-01..04-types]
affects: [aggregator, predictions, pipeline]
tech-stack:
  added: [PlatformFitResult-schema]
  patterns: [optional-score-weight, optional-prediction-field, dynamic-import-test-stub]
key-files:
  created:
    - src/lib/engine/wave4/__tests__/platform-fit.test.ts
    - src/lib/engine/wave4/__tests__/platform-fit-prompts.test.ts
    - src/lib/engine/__tests__/stage10-critique.test.ts
    - src/lib/engine/__tests__/stage11-counterfactuals.test.ts
    - src/lib/engine/__tests__/aggregator-platform-fit.test.ts
  modified:
    - src/lib/engine/types.ts
decisions:
  - 'PlatformFitResult uses Zod schema (z.object) matching existing Phase 4/7/8 pattern'
  - 'platform_fit on SignalAvailability is optional (?): preserves back-compat for pre-Phase-9 construction sites'
  - 'platform_fit, critique, counterfactuals on PredictionResult are optional: Wave 2 plans will start emitting them'
  - 'platform_fit weight is optional in score_weights: redistributes when SignalAvailability.platform_fit = false'
  - 'Test stubs for unimplemented modules use dynamic import inside async it() to guarantee RED failure'
metrics:
  duration: 0h 8m
  completed: '2026-05-20'
---

# Phase 9 Plan 01: Types & Wave 0 test stubs

Lock Zod-validated TypeScript contracts for all Phase 9 new types. Create Wave 0 test stubs intentionally failing (RED) for Wave 2 implementation plans to drive RED→GREEN.

## Changes

### `src/lib/engine/types.ts`

1. **`PlatformFitResult` interface + Zod schema** — New at end of file (Phase 9 section). Fields: `platform` (string), `fit_score` (0-100), `rationale` (string), `watermark_penalty?` (optional boolean). Follows existing `AudioFingerprintResult` / `BenchmarkRetrievalResult` patterns.

2. **`SignalAvailability`** — Added optional `platform_fit?: boolean` field after `retrieval`. Matches existing optional provenance key pattern (`audio`, `audio_fingerprint`, `retrieval`).

3. **`PredictionResult`** — Added 3 optional fields at end of interface:
   - `platform_fit?: PlatformFitResult | null`
   - `critique?: CritiqueResult | null`
   - `counterfactuals?: CounterfactualResult | null`

4. **`score_weights` (inline type)** — Added optional `platform_fit?: number` after `retrieval`. Follows existing `audio`/`retrieval` weight pattern.

### Wave 0 test stubs (5 files, all RED)

| File | Tests | Failure mode |
|------|-------|-------------|
| `wave4/__tests__/platform-fit.test.ts` | ALGO-01..06 | Dynamic import fails — `platform-fit` module doesn't exist |
| `wave4/__tests__/platform-fit-prompts.test.ts` | Prompt builder stubs | Dynamic import fails — module doesn't exist |
| `__tests__/stage10-critique.test.ts` | CRITIQUE-01..03 | No-op returns null; tests expect non-null `CritiqueResult` |
| `__tests__/stage11-counterfactuals.test.ts` | COUNTER-01..04 (LIKELY_FLOP) | No-op returns null; tests expect non-null counterfactuals |
| `__tests__/aggregator-platform-fit.test.ts` | platform_fit in selectWeights | `selectWeights` doesn't handle `platform_fit` yet |

## Test Results

All 5 test files FAIL (RED): 11 failed, 2 passed, 7 todo. The 2 passed tests are valid (COUNTER-04 expects null for high-scoring content; sum normalization unchanged).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/lib/engine/types.ts`: verified PlatformFitResult, SignalAvailability.platform_fit, PredictionResult fields, score_weights.platform_fit all present
- `src/lib/engine/wave4/__tests__/platform-fit.test.ts`: exists, imports runPlatformFit via dynamic import
- `src/lib/engine/wave4/__tests__/platform-fit-prompts.test.ts`: exists, dynamic import
- `src/lib/engine/__tests__/stage10-critique.test.ts`: exists, imports runStage10Critique
- `src/lib/engine/__tests__/stage11-counterfactuals.test.ts`: exists, imports runStage11Counterfactuals
- `src/lib/engine/__tests__/aggregator-platform-fit.test.ts`: exists, imports selectWeights
- Commits: 716d720 (feat), 594a3d2 (test)
