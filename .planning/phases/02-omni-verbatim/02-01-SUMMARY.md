---
phase: 02-omni-verbatim
plan: 01
subsystem: engine/qwen
tags: [verbatim, schema, prompt, contracts, tdd]
dependency_graph:
  requires: []
  provides: [verbatim-zod-contracts, verbatim-system-prompt, wave0-regression-test]
  affects: [schemas.ts, omni-analysis.ts, omni-analysis-verbatim.test.ts]
tech_stack:
  added: []
  patterns: [zod-nullable-optional, tdd-red-green, emotion-arc-analog]
key_files:
  created:
    - src/lib/engine/__tests__/omni-analysis-verbatim.test.ts
  modified:
    - src/lib/engine/qwen/schemas.ts
    - src/lib/engine/qwen/omni-analysis.ts
decisions:
  - "Per-segment verbatim declared on BOTH inline OmniAnalysisZodSchema.segments (parse-time) AND exported SegmentSchema (transport) — prevents the Pitfall 4 / emotion_arc drop"
  - "Fixture uses 5 segments to avoid normalizeSegments fixed-bucket fallback (MIN_BOUNDARY_COUNT=4)"
  - "hook_verbatim threaded onto assembly literal with do-not-remove annotation (mirrors emotion_arc pattern)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-04"
  tasks_completed: 3
  files_modified: 3
  tests_added: 20
---

# Phase 02 Plan 01: Verbatim Contracts Summary

One-liner: Zod verbatim contracts (hook_verbatim + per-segment spoken_text/on_screen_text) on both the inline validator + exported SegmentSchema, fidelity rules in buildSystemPrompt, and 20-case Wave 0 regression test — all 20 GREEN.

## Tasks

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Write verbatim Wave 0 regression test (failing-first) | fc70d9ec (test: changes — prior auto-commit) | done |
| 2 | Extend OmniAnalysisZodSchema + exported SegmentSchema | ff7eec0f | done |
| 3 | Extend buildSystemPrompt with verbatim instructions | f65cdfa7 + a58d769a | done |

## What Was Built

### Task 1 — Wave 0 regression test (RED → GREEN)

`src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` — 20 test cases covering:

- **Schema ACCEPT**: `hook_verbatim` + per-segment `spoken_text`/`on_screen_text` parsed via `OmniAnalysisZodSchema.partial().safeParse` → success
- **Schema BACKWARD-COMPAT**: response without verbatim fields → success (`.optional()`)
- **Schema CAP REJECT**: `spoken_words > 280` or segment `spoken_text > 500` → failure
- **Schema NULLABLE**: `null` values accepted (D-02 silence contract)
- **SegmentSchema ACCEPT**: exported `SegmentSchema.safeParse` with verbatim fields → success (transport type carries fields through `normalizeSegments`)
- **SegmentSchema BACKWARD-COMPAT**: segment without verbatim → success
- **SegmentSchema CAP REJECT**: `spoken_text > 500` → failure
- **Prompt literals**: `buildSystemPrompt` output contains `hook_verbatim`, `spoken_text`, `on_screen_text`, `[inaudible]`, `translate`, `null`
- **Assembly hop regression**: `analyzeVideoWithOmni` with mocked model → `hook_verbatim` lands on `geminiResult.analysis` (exact aggregator access path)
- **Per-segment survival**: `out.segments[0].spoken_text` defined after `normalizeSegments` (5-segment fixture avoids fallback)
- **Assembly backward-compat**: model omits `hook_verbatim` → `undefined`, no crash
- **null-vs-[inaudible] D-02/D-04.2**: silent → `null`; unclear speech → `[inaudible]`, NOT null

### Task 2 — Schema extensions (schemas.ts)

**Exported `SegmentSchema`** (`:67`): added `spoken_text` and `on_screen_text`, each `z.string().max(500).nullable().optional()`. This is the BLOCKER fix — `SegmentGrid = z.infer<SegmentSchema>` is the type `normalizeSegments` returns; fields absent from here are stripped before the aggregator.

**Inline `OmniAnalysisZodSchema.segments`** (`:157`): same two fields added to the validator shape (Pitfall 4 — both shapes must declare fields: inline for parse-time, exported for transport).

**Top-level `hook_verbatim`**: `z.object({ spoken_words: z.string().max(280).nullable().optional(), on_screen_text: z.string().max(280).nullable().optional() }).optional()` added after `emotion_arc` field. `.nullable()` = D-02 silence contract. `.optional()` = backward-compat A3. `.max(280)` = D-04.4 cap.

Additive-only: zero existing fields touched (D-01). `npx tsc --noEmit` clean.

### Task 3 — buildSystemPrompt verbatim instructions (omni-analysis.ts)

**JSON template additions**: `hook_verbatim` block with `spoken_words`/`on_screen_text` keys added after `emotion_arc` block; `spoken_text`/`on_screen_text` keys added to `segments[]` example object.

**"Rules for verbatim" block** (after "Rules for segments"): encodes all four D-04 fidelity rules + D-02 null absence contract:
- D-04.1: transcribe in spoken language; do NOT translate
- D-02/D-04.2: `[inaudible]` ONLY for present-but-unintelligible; `null` when no speech/text — never describe sound
- D-04.3: preserve exact casing, punctuation, emoji in `on_screen_text`
- D-04.4: cap `hook_verbatim` ~280 chars, per-segment ~500 chars

**Assembly literal**: `hook_verbatim: data.hook_verbatim` threaded onto the analysis object with a do-not-remove annotation (identical pattern to `emotion_arc` assembly fix).

**Sampling params**: `temperature: 0` and `seed: QWEN_SEED` at lines 208-209 — unchanged (R8 verified: `grep` returns 2).

## Verification

- `npx vitest run src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` → **PASS 20 / FAIL 0**
- `npx tsc --noEmit` → **no errors**
- R8 guard: sampling params count = **2** (unchanged)
- Additive-only guard: `git diff HEAD~1 src/lib/engine/qwen/schemas.ts` shows **0 removed lines** on existing fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixture used 2 segments, triggering normalizeSegments fixed-bucket fallback**
- **Found during:** Task 3 GREEN verification
- **Issue:** The 2-segment fixture (t=0-3, t=3-30) post-normalization count < MIN_BOUNDARY_COUNT (4) → `buildFixedBuckets` called → synthetic segments strip per-segment `spoken_text` before test can assert it
- **Fix:** Expanded fixture to 5 segments (t=0-3, 3-8, 8-16, 16-24, 24-30) — passes MIN_BOUNDARY_COUNT, preserves `spoken_text` through `...seg` spread in `annotateSegments`
- **Files modified:** `src/lib/engine/__tests__/omni-analysis-verbatim.test.ts`
- **Commit:** a58d769a

**2. [Note] Prior auto-commits (fc70d9ec "test: changes", f65cdfa7 "feat: changes")**

Two auto-commits existed from a prior execution attempt on the same branch. The test file in `fc70d9ec` matched exactly what was needed (same content). The `f65cdfa7` partial `omni-analysis.ts` edit was extended by `a58d769a`. No work was redone; remaining changes were additive on top.

## Known Stubs

None — this plan adds contracts only. No data wiring, no UI rendering, no downstream consumers yet (Plan 02 threads these fields; Plan 03 proves real-run persistence).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Zod caps (`.max(280)`/`.max(500)`) mitigate T-2-01 (token-budget DoS). T-2-02 (null absence contract) enforced via `.nullable()` + D-02 prompt rule. All mitigations from threat model implemented as specified.

## Self-Check

Files exist:
- [x] `src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` — FOUND
- [x] `src/lib/engine/qwen/schemas.ts` — FOUND (modified)
- [x] `src/lib/engine/qwen/omni-analysis.ts` — FOUND (modified)

Commits exist:
- [x] fc70d9ec — test: changes (Task 1 test file, prior auto-commit)
- [x] ff7eec0f — feat(02-01): extend SegmentSchema + OmniAnalysisZodSchema (Task 2)
- [x] f65cdfa7 — feat: changes (partial Task 3 auto-commit)
- [x] a58d769a — feat(02-01): extend buildSystemPrompt with verbatim instructions (Task 3 complete)

## Self-Check: PASSED
