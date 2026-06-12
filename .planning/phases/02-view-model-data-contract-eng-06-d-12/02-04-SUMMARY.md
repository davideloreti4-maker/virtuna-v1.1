---
phase: 02-view-model-data-contract-eng-06-d-12
plan: 04
subsystem: reading-data-contract
tags: [view-model, data-01, data-02, data-03, data-04, d-05, d-06, d-07, d-09, d-14, verdict, field-map]
dependency_graph:
  requires:
    - "src/lib/reading/block-types.ts (CanonicalReading + ReadingBlock union, 02-02)"
    - "src/lib/reading/verdict-bands.ts (VERDICT_BANDS + bandFor, 02-02)"
    - "src/lib/reading/from-persisted-row.ts (persisted-half adapter, 02-03)"
  provides:
    - "src/lib/reading/view-model.ts (toReadingBlocks DATA-01 + canonicalFromLive + verdict DATA-04)"
    - "src/lib/reading/FIELD-MAP.md (consumed-vs-dead field map, DATA-03)"
    - "the live half of the DATA-02 identical-render convergence (both paths → CanonicalReading → toReadingBlocks)"
  affects:
    - "Phase 4 (rendering) consumes ReadingBlock[] from toReadingBlocks"
    - "Phase 3 GATE — verdict-banding calibration tunes VERDICT_BANDS that the verdict block reads"
tech_stack:
  added: []
  patterns:
    - "Pure selector (no React/no fetch) consuming the narrow CanonicalReading ONLY (D-09 compile-time prune)"
    - "Honest omit-discipline — every value traces to a real field; absent field → no block (never fabricated)"
    - "Grounded why chain (D-05): verdict_line → the_one_fix → top factor.rationale → '' (band-only, never generic)"
    - "Confidence in band LANGUAGE not a number (D-06); /100 demoted to in-body score (D-07)"
    - "Two-tier degradation (D-14): individual null omits silently; whole-analysis emits first-class analysis-degraded"
    - "canonicalFromLive mirrors fromPersistedRow field-for-field so both paths converge (DATA-02 precondition)"
key_files:
  created:
    - "src/lib/reading/view-model.ts"
    - "src/lib/reading/FIELD-MAP.md"
  modified:
    - ".planning/phases/02-view-model-data-contract-eng-06-d-12/deferred-items.md"
decisions:
  - "deriveFixes accepts both Suggestion objects {text,priority,category} AND bare strings — a raw-string suggestion (older/raw rows, the engine's pre-normalized stream) still becomes a fix rather than being silently dropped (Rule 2 defensive boundary handling; satisfies the 02-01 view-model.test.ts spec)."
  - "canonicalFromLive prefers the explicit live analysis_unavailable/partial_analysis flags, falling back to the same signal_availability derive the persisted half uses — on real data the aggregator sets the flags FROM signal_availability so they equal the sa-derive, keeping the DATA-02 deep-equal exact while letting synthetic inputs set the flag directly."
  - "expert-insight.ceiling prefers apolloReasoning.ceiling_capper, falling back to hero.ceiling — both are both-path fields; theOneFix reads hero.the_one_fix (the persisted-equivalent of the live hero)."
metrics:
  duration_min: 7
  completed: "2026-06-12"
  tasks: 3
  files: 2
---

# Phase 2 Plan 04: Reading View-Model + Verdict + Field Map Summary

The crux-bearing view-model: a pure `toReadingBlocks(canonical) → ReadingBlock[]` selector (DATA-01) plus `canonicalFromLive(result)` — the live-half adapter that mirrors `fromPersistedRow` field-for-field so both ingestion paths converge on the shared `CanonicalReading`. The verdict block carries band + grounded why + confidence-in-language with the `/100` demoted (DATA-04), and the consumed-vs-dead field map is documented (DATA-03). DATA-01 / DATA-03 / DATA-04 are DONE and their tests are GREEN; the DATA-02 deep-equal is correctly authored and **pending the human-action fixture capture** from 02-01 — it goes green by re-running vitest once the real `live-<id>.json` / `persisted-<id>.json` pair exists, with no code change.

## What Was Built

**Task 1 — `src/lib/reading/view-model.ts` (commit `06333768`)**
- `canonicalFromLive(result: PredictionResult): CanonicalReading` — reads `result.hero` / `result.apollo_reasoning` TOP-LEVEL (PATTERNS Resolved Q2), narrows `apolloReasoning` to `{rewrites, ceiling_capper?}` and emits `null` when no rewrites — byte-identical to the persisted narrowing. Mirrors `fromPersistedRow` field-for-field (same coercions, same degradation derive, same defensive reads). Does NOT read `predicted_engagement` / `optimal_post_window` / `audio_fingerprint` (D-09).
- `toReadingBlocks(c: CanonicalReading): ReadingBlock[]` — pure (no React, no fetch). Emits `verdict` ALWAYS; `expert-insight` / `hook` / `audience` / `fixes` / `drivers` / `persona-read` / `content-summary` only when their source field is present; `retention` on a real heatmap, `retention-degraded` on null (D-14, never synthesized); `analysis-degraded` (`tier:'unavailable'|'partial'`, with a `have[]`) on whole-analysis degradation. NO `audio` block (D-09).
- Verdict derivation (DATA-04): `band = bandFor(c.overallScore)`; `why` via the D-05 chain (`hero.verdict_line` → `hero.the_one_fix` → top `factor.rationale` → `''`, never generic); `confidenceLanguage` from a HIGH/MED/LOW→words map (D-06) with the anti-virality gate folding to "Mixed signals" (D-07 seam for Phase 3 boundary-buffer firing); `score` is the in-body `/100`, never the headline.

**Task 2 — three test scaffolds (no new commit — scaffolds authored correctly in 02-01)**
- `verdict.test.ts`: **GREEN** (band derive, grounded-why preference, generic-why prohibition, confidence-in-language, `/100`-demotion).
- `view-model.test.ts`: **GREEN** (taxonomy, no-`audio`/no-DROP-field, heatmap-null → retention-degraded, real-heatmap → retention, whole-analysis → analysis-degraded, individual-null omit).
- `identical-render.test.ts` (DATA-02): correctly authored — globs the fixtures dir, runs both adapters, asserts `toEqual`. **RED, by design** — the real captured fixture pair is absent (the 02-01 Task-2 human-action gate). NOT fabricated, NOT skipped, NOT weakened.

**Task 3 — `src/lib/reading/FIELD-MAP.md` (commit `a0fa6f9d`)**
- KEEP table: each consumed `PredictionResult` field → its `CanonicalReading` field → its `ReadingBlock` kind, both-path availability noted.
- DROP table: every dead/excluded/live-only field with rationale (`rule/trend/gemini/ml_score` null since F43; `predicted_engagement` + `audio_fingerprint` live-only + `optimal_post_window` non-deterministic → D-09; `emotion_arc`/`platform_fit`/`critique`/`retrieval`/`matched_trends`/`feature_vector`/telemetry dropped).
- States `ENGINE_VERSION` unchanged / no `lib/engine/` edits. DROP set consistent with the implemented union (no audio). Resolves F27/F28/F43.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] deriveFixes tolerates both suggestion shapes**
- **Found during:** Task 1 (surfaced when greening `view-model.test.ts` in Task 2)
- **Issue:** The 02-01 `view-model.test.ts` spec passes `suggestions: ["tighten the first 2 seconds"]` (raw strings), but the engine `Suggestion` type is `{id,text,priority,category}`. Reading only `s.text` silently dropped raw-string suggestions → no `fixes` block → spec failed.
- **Fix:** `deriveFixes` now accepts both a bare `string` (→ `{headline}`) and a `Suggestion` object (→ `{headline,category,priority}`). A real suggestion always becomes a fix; defensive boundary handling, no fabrication.
- **Files modified:** `src/lib/reading/view-model.ts`
- **Commit:** `06333768`

## Authentication / Human-Action Gates

**DATA-02 fixture capture (inherited 02-01 Task-2 human-action gate) — NOT an auth gate, a capture gate.** The `identical-render.test.ts` deep-equal requires the REAL `live-<id>.json` / `persisted-<id>.json` pair, which only a genuine smoke-pipeline run produces (live engine API keys + Supabase + an interactive UI video upload). Hand-authoring is forbidden by the phase success criteria. The view-model, verdict, field-map, and their tests were all committed first; the deep-equal goes green later by simply re-running `pnpm test src/lib/reading` after the human runs the 02-01 capture — **no code change should be needed** (both adapters already converge on `CanonicalReading`).

## Verification

- `pnpm exec tsc --noEmit`: **zero errors in `src/lib/reading/`** (`grep "src/lib/reading/"` on tsc output → 0). Repo-wide pre-existing errors (wave3 engine tests, tests/numen DS tests) are out-of-scope and logged to `deferred-items.md`.
- Purity grep on `view-model.ts`: `from 'react' | require('react') | fetch(` → no matches (PASS); contains `function toReadingBlocks` + `canonicalFromLive` (PASS).
- `pnpm test src/lib/reading`: **29/31 PASS** — `view-model.test.ts` + `verdict.test.ts` fully green; the only 2 failures are `identical-render.test.ts` on the absent real fixture (the human-action gate, expected RED).
- `pnpm test` (full suite): **1973 passed, 26 skipped, 2 failed** — the 2 failures are exactly the `identical-render` fixture-gate cases. **No new regressions** introduced by this plan.
- FIELD-MAP verify: contains KEEP + DROP + `predicted_engagement` + `audio_fingerprint` + `ENGINE_VERSION` (PASS).

## Known Stubs

None. The view-model is fully wired — `toReadingBlocks` consumes the real `CanonicalReading` both adapters produce; honest degradation (`retention-degraded`, `analysis-degraded`) is intentional D-14 behavior, not a stub. The "Mixed signals" wording is a live D-07 fold off `antiViralityGated` (a real field), with a documented seam for Phase 3's boundary-buffer firing.

## Requirements Status

| Req | Status | Note |
|-----|--------|------|
| DATA-01 | DONE | `toReadingBlocks` pure, value-bearing blocks, dropped fields produce no block; `view-model.test.ts` green |
| DATA-02 | PENDING (human-action) | deep-equal authored + correct; RED until the real 02-01 fixture pair is captured — NOT marked complete |
| DATA-03 | DONE | `FIELD-MAP.md` KEEP/DROP tables; resolves F27/F28/F43 |
| DATA-04 | DONE | verdict = band + grounded why + confidence-language, `/100` demoted; `verdict.test.ts` green |

## Self-Check: PASSED

- FOUND: src/lib/reading/view-model.ts
- FOUND: src/lib/reading/FIELD-MAP.md
- FOUND commit: 06333768 (feat/view-model)
- FOUND commit: a0fa6f9d (docs/field-map)
