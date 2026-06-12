---
phase: 02-view-model-data-contract-eng-06-d-12
plan: 02
subsystem: reading-contract
tags: [data-contract, types, verdict-bands, discriminated-union, view-model]
requires:
  - "@/lib/engine/types (PredictionResult-derived field types: HeroBlock, Factor, HeatmapPayload, BehavioralPredictions, PersonaBehavioralAggregate, ApolloRewrite, CounterfactualResult, SignalAvailability, Suggestion, HookDecomposition)"
provides:
  - "src/lib/reading/verdict-bands.ts → VERDICT_BANDS constant + bandFor(score) (the Phase 3 calibration target, D-04)"
  - "src/lib/reading/block-types.ts → ReadingBlock discriminated union (D-13) + CanonicalReading intersection shape (D-09) + VerdictBand re-export"
affects:
  - "02-03 from-persisted-row.ts (produces CanonicalReading)"
  - "02-04 view-model.ts (canonicalFromLive + toReadingBlocks consume CanonicalReading → ReadingBlock[])"
  - "Phase 3 verdict-band calibration (tunes VERDICT_BANDS)"
  - "Phase 4 Reading UI (renders ReadingBlock[])"
tech-stack:
  added: []
  patterns:
    - "Discriminated union with literal `kind` tag (mirrors CounterfactualResult convention in engine types)"
    - "Narrow intermediate shape as compile-time intersection enforcer (CanonicalReading)"
    - "Single exported constant as the one calibration target; legacy copies annotated not duplicated"
key-files:
  created:
    - src/lib/reading/verdict-bands.ts
    - src/lib/reading/block-types.ts
  modified:
    - src/components/board/verdict/verdict-constants.ts
    - src/components/board/verdict/verdict-derive.ts
decisions:
  - "D-04: VERDICT_BANDS is the single source of band thresholds (high/70, solid/40, needs-work/0); legacy board copies (BAND_THRESHOLDS, bandLabel) annotated with drift-redirect comments, numeric logic byte-unchanged"
  - "D-13: ReadingBlock is pure data — no className/order/layout/presentation hints"
  - "D-09: CanonicalReading carries only live∩persisted fields; live-only fields (predicted-engagement range, optimal_post_window, audio_fingerprint) physically excluded → compile-time enforcement"
  - "Resolved Q1: NO audio block in the union — audio_fingerprint is live-only (zero persist matches), so an audio block would break the intersection"
metrics:
  duration_min: 3
  completed: 2026-06-12
  tasks: 2
  files: 4
---

# Phase 2 Plan 02: Type Contract (VERDICT_BANDS + ReadingBlock/CanonicalReading) Summary

The phase's funnel-point type contract: a single exported `VERDICT_BANDS` constant (D-04 Phase-3 calibration target) + a `bandFor` total lookup, the pure-data `ReadingBlock` discriminated union (D-13, no audio member), and the deliberately-narrow `CanonicalReading` intersection shape (D-09) that makes "consume only live∩persisted fields" a compile-time guarantee.

## What Was Built

### Task 1 — `src/lib/reading/verdict-bands.ts` (commit `e9813de3`)
- `interface VerdictBand { id: 'high'|'solid'|'needs-work'; label: string; min: number }`.
- `const VERDICT_BANDS: readonly VerdictBand[]` — `high`/70, `solid`/40, `needs-work`/0, descending `min`, `as const`. Reading-facing labels (`High potential`/`Solid contender`/`Needs work`), NOT the board's `Strong`/`Mid`/`Low`.
- `bandFor(score): VerdictBand` — returns the first band whose `min <= score`, falling back to the terminal `needs-work` band → total over every finite score, never `undefined`.
- Header comment marks it the SINGLE Phase-3 calibration target.
- **Drift-prevention annotations** added to the two legacy board copies — `verdict-constants.ts` (above `BAND_THRESHOLDS`) and `verdict-derive.ts` (above `bandLabel`) — each pointing at `@/lib/reading/verdict-bands` `VERDICT_BANDS` so Phase 3 calibration edits the new constant, not a board file. Legacy numeric logic left byte-unchanged (verified: `STRONG: 70` and the `>= 70 → 'High potential'` branch intact); the board still compiles.

### Task 2 — `src/lib/reading/block-types.ts` (commit `2c257f19`)
- `type ReadingBlock` discriminated union (D-13, pure data): `verdict` (band/why/confidenceLanguage/score), `expert-insight` (ceiling/theOneFix/rewrites), `hook`, `retention` (segments + weightedCurve), `retention-degraded` (`reason: 'heatmap_unavailable'`), `audience` (share/completion/comment/save + intents), `fixes` (items), `drivers` (factors), `persona-read` (aggregate), `content-summary` (text), `analysis-degraded` (tier `'unavailable'|'partial'` + have[]). **NO `audio` member** (D-09 / Resolved Q1 — audio_fingerprint is live-only, would break the intersection).
- `interface CanonicalReading` — the narrow live∩persisted shape: `overallScore`, `confidence`/`confidenceLabel`, `antiViralityGated`, `analysisUnavailable`, `partialAnalysis`, `signalAvailability`, nullable `hero`/`apolloReasoning`/`hookDecomposition`/`heatmap`, `behavioralPredictions`, `personaBehavioralAggregate`, `suggestions`, `counterfactuals`, `factors`, `contentSummary`/`overallImpression`. The predicted-engagement range, `optimal_post_window`, `audio_fingerprint`, and the D-02/D-03 dead set are physically EXCLUDED (header documents the omission rule).
- Re-exports `VerdictBand`; field types imported from `@/lib/engine/types` (no re-declaration). Added `Fix` interface (fixes-block item) and `RetentionSegment` alias (derived from `HeatmapPayload['segments']`).

## Verification

- `pnpm exec tsc --noEmit`: both new modules + all edited board files compile with **zero errors of their own**. Total project error count held at the pre-existing baseline of 20.
- Task 1 gates: `VERDICT_BANDS` + `bandFor` exported; `min: 70` on a non-comment line; both legacy files contain a `verdict-bands` drift comment with numeric logic byte-unchanged.
- Task 2 gates: `kind: 'audio'` count == 0; no `predicted_engagement`/`engagement_range` identifier anywhere in the file (node regex gate EXIT 0); union contains `verdict`, `expert-insight`, `retention-degraded`, `analysis-degraded`; exports `ReadingBlock` + `CanonicalReading`; re-uses `VerdictBand`.
- The RED test scaffolds from plan 02-01 (`verdict.test.ts`, `view-model.test.ts`, `identical-render.test.ts`) remain RED as designed — they import from `../view-model` / `../from-persisted-row`, built in plans 02-04 / 02-03. My contract modules satisfy the `VERDICT_BANDS`/`bandFor` and block-type imports those tests reach for, but the suites stay RED until the view-model/normalizer land (expected; not my plan to resolve).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Forbidden-identifier doc tokens tripped the D-09 grep gate**
- **Found during:** Task 2 verification.
- **Issue:** The `block-types.ts` header documented the OMISSION RULE by naming `predicted_engagement` / `variants.engagement_range` verbatim. The plan's automated gate (`node -e ... !/predicted_?[eE]ngagement|engagement_?[rR]ange/`) asserts those identifiers appear NOWHERE in the file, so the doc comment failed the gate even though no such field/type was declared.
- **Fix:** Rephrased the two header lines to describe the excluded field as "the predicted-engagement range (live top-level; persisted under a DIFFERENT `variants.*` key)" without the snake_case tokens, keeping the D-09 documentation intact while making the intersection rule grep-assertable.
- **Files modified:** src/lib/reading/block-types.ts
- **Commit:** 2c257f19

## Pre-existing / Out-of-Scope (NOT fixed — SCOPE BOUNDARY)

The project tsc baseline carries 20 pre-existing errors unrelated to this plan, in three buckets, left untouched:
- Engine test fixtures missing `partial_analysis` / using deprecated `EngagementRange.views` (`verdict/__tests__/fixtures/prediction-result.ts`, `flop-warning.test.ts`, `stage10-critique.test.ts`).
- `wave3/__tests__/fold-*.test.ts` PersonaSlot/segment shape mismatches and possibly-undefined accesses.
- `tests/numen/stage-reveal.test.ts` StageBlockProps overload errors.
- Expected-RED: `src/lib/reading/__tests__/*` cannot resolve `../view-model` / `../from-persisted-row` (built in plans 02-03 / 02-04).

None are caused by, or fixable within, this plan.

## Known Stubs

None. Both files are complete type/constant declarations with no placeholder values, empty data sources, or TODO/FIXME markers.

## Self-Check: PASSED

- FOUND: src/lib/reading/verdict-bands.ts
- FOUND: src/lib/reading/block-types.ts
- FOUND: src/components/board/verdict/verdict-constants.ts (modified)
- FOUND: src/components/board/verdict/verdict-derive.ts (modified)
- FOUND commit: e9813de3 (Task 1)
- FOUND commit: 2c257f19 (Task 2)
