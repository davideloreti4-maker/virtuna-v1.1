---
phase: 06
plan: 03
status: complete
type: execute
wave: 3
completed: 2026-05-19
commits:
  - 4c4e69a  # feat(phase-06): add audio-perceptual scorer (D-G3)
  - 26b766f  # feat(phase-06): extend gemini schema with audio_signals (Plan 06-03 Task 2)
  - ce4f08c  # refactor(phase-06): format PERCEPTUAL_FORMULA matrix one-line-per-row
requirements: [AUDIO-02, AUDIO-03, AUDIO-04, HOOK-02, AGG-04]
tags: [audio, gemini, perceptual-score, content-type-aware, prompt-extension]
subsystem: src/lib/engine
key-files:
  created:
    - src/lib/engine/audio-perceptual.ts
    - src/lib/engine/__tests__/audio-perceptual.test.ts
    - src/lib/engine/__tests__/gemini-audio-fields.test.ts
  modified:
    - src/lib/engine/gemini.ts
    - src/lib/engine/types.ts
test-counts:
  audio_perceptual: 16
  gemini_audio_fields: 16
  total_new: 32
  existing_gemini_regressions: 0
metrics:
  duration_minutes: ~10
  completed: 2026-05-19
---

# Plan 06-03 — Gemini Schema Extension + Audio Perceptual Score Module (Complete)

## What Was Built

### 1. `src/lib/engine/audio-perceptual.ts` — D-G3 pure-function scorer

Pure, content-type-adaptive `computeAudioPerceptualScore(signals, contentType): AudioPerceptualResult`. Returns a 0-100 score BEFORE the audio_fingerprint_boost is applied by the aggregator (per D-G3). Locked `PERCEPTUAL_FORMULA_BY_TYPE` matrix with three modes:

- **voice** — `talking_head`, `tutorial`, `vlog`. Weighted average of `voice_clarity_0_10` + `audio_hook_first_2s_0_10` + `voiceover_ratio * 10`, with null sub-scores excluded from the formula (and from `totalWeight`) — no NaN propagation.
- **ambient** — `slideshow`, `b_roll`, `action`. Weighted average of `music_ratio * 10` + `descriptionQualityScore(audio_description)`. Voice fields IGNORED even if Gemini emitted them (D-A2 contract violation tolerance).
- **balanced** — `other` (and null contentType passthrough). Average of all non-null sub-scores treating each on a 0-10 scale.

#### Final D-G3 Coefficient Table (Phase 10 baseline)

| Content Type | Mode     | voice_clarity | audio_hook | voiceover_ratio | music_ratio | description_quality |
| ------------ | -------- | ------------- | ---------- | --------------- | ----------- | ------------------- |
| talking_head | voice    | 0.45          | 0.35       | 0.20            | —           | —                   |
| tutorial     | voice    | 0.40          | 0.35       | 0.25            | —           | —                   |
| vlog         | voice    | 0.35          | 0.30       | 0.35            | —           | —                   |
| slideshow    | ambient  | —             | —          | —               | 0.60        | 0.40                |
| b_roll       | ambient  | —             | —          | —               | 0.55        | 0.45                |
| action       | ambient  | —             | —          | —               | 0.55        | 0.45                |
| other        | balanced | (average of all non-null sub-scores on a 0-10 scale)                                  |

`descriptionQualityScore(description)` is a length-based heuristic — <50 chars → 0-10 linear ramp; 50-150 chars → 10 (optimal); >150 → mild decay. Phase 10 may refine with richer signals (vocabulary diversity, genre keyword presence). Locked here.

Result clamped to `[0, 100]` BEFORE the boost is applied — keeps boost magnitude comparable across content types.

### 2. `src/lib/engine/gemini.ts` extension — VIDEO_RESPONSE_SCHEMA + buildVideoPrompt

- **`VIDEO_RESPONSE_SCHEMA`** is now `export`ed. Appended an `audio_signals` object with 6 sub-properties (`voice_clarity_0_10` nullable, `audio_hook_first_2s_0_10` nullable, `silence_ratio`, `voiceover_ratio`, `music_ratio`, `audio_description`). The inner `required` array is `["silence_ratio", "voiceover_ratio", "music_ratio", "audio_description"]` (nullable fields excluded per D-A2). **`audio_signals` is NOT in the outer `required` array** — per BLOCKER 2 fix, Gemini may omit the entire block under degraded conditions and the response still passes top-level schema validation.
- **`buildVideoPrompt`** is now `export`ed with an `@internal — exported for tests only` JSDoc tag (Option (a) from the plan; chosen over mock-and-capture for cleaner test surface). Appended an "Audio Signals" section with the literal substring `"silence_ratio + voiceover_ratio + music_ratio MUST sum to exactly 1.0"` (Test 8 asserts this verbatim).

### 3. `src/lib/engine/types.ts` extension — Zod schemas

- **`GeminiAudioSignalsSchema`** (new export) — Zod object schema for the 6 audio fields with `.refine()` enforcing `Math.abs(silence_ratio + voiceover_ratio + music_ratio - 1.0) < 0.1` (Pitfall 1 ±0.1 tolerance).
- **`GeminiVideoResponseSchema`** extended via `GeminiResponseSchema.extend({ video_signals: ..., audio_signals: GeminiAudioSignalsSchema.optional() })`. The `.optional()` is chained AFTER `.refine()` so the refinement only fires when the field IS present — when Gemini omits audio_signals, the top-level video schema still parses successfully (BLOCKER 2 fix).
- Existing `GeminiAudioSignals`, `AudioPerceptualResult`, `AudioFingerprintResult` interfaces from Plan 06-02 left untouched — they are the consumer-facing TypeScript shapes; the Zod schema above is the runtime-validation shape.

### 4. Test coverage — 32 new tests, 0 regressions

#### `src/lib/engine/__tests__/audio-perceptual.test.ts` — 16 assertions

| Test                                     | Coverage                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Test 1: talking_head voice formula       | ≈75 from 8/7/0.7 voice_clarity/audio_hook/voiceover_ratio                 |
| Test 2: slideshow ambient                | voice fields excluded from sub_scores_used                                |
| Test 3: other → balanced                 | averages all non-null sub-scores                                          |
| Test 4: null content type                | defaults to balanced (other) passthrough                                  |
| Test 5: all-zero (talking_head)          | → 0                                                                       |
| Test 6: all-max (talking_head)           | → 100                                                                     |
| Test 7: null voice_clarity (talking_head)| graceful — score finite, sub_scores_used excludes "voice_clarity"         |
| Test 8: slideshow + emitted voice fields | ambient ignores them (D-A2 contract violation tolerance)                  |
| Test 9: sub_scores_used for talking_head | exactly `["audio_hook","voice_clarity","voiceover_ratio"]`                |
| Test 10: result clamping                 | result always in `[0, 100]` regardless of extreme inputs                  |
| + Covers all 7 content types             | one assertion per ContentTypeSlug → returns valid mode + 0-100 score      |
| + Mode coverage                          | tutorial/vlog assert "voice"; b_roll/action assert "ambient"              |
| + Input immutability                     | input object snapshot equals input after call                             |

#### `src/lib/engine/__tests__/gemini-audio-fields.test.ts` — 16 assertions

| Test                                     | Coverage                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Test 1: parses a valid audio_signals     | `safeParse.success === true`                                              |
| Test 2: nullable voice_clarity/audio_hook| both fields = null still parses (D-A2 nullability)                        |
| Test 3a: refine accepts sum=1.05         | within ±0.1 tolerance                                                     |
| Test 3b: refine REJECTS sum=1.2          | outside tolerance — error message matches "sum to ~1.0" / "±0.1 tolerance"|
| Test 4: rejects voice_clarity = 15       | out-of-range                                                              |
| Test 5: rejects empty audio_description  | min length violated                                                       |
| Test 6: rejects 500-char description     | max length violated                                                       |
| Test 7: VIDEO_RESPONSE_SCHEMA.audio      | contains all 6 sub-properties                                             |
| Test 7b: outer required does NOT contain | "audio_signals" (BLOCKER 2 guard)                                         |
| Test 8: buildVideoPrompt section header  | "Audio Signals" literal + "silence_ratio + voiceover_ratio + music_ratio MUST sum to exactly 1.0" |
| Test 8b: prompt explains audio fields    | voice_clarity_0_10 / audio_description / audio_hook_first_2s_0_10         |
| Test 8c: Video Signals section preserved | no regression — visual_production_quality / hook_visual_impact present    |
| Test 9: BLOCKER 2 — missing audio        | response with no audio_signals key passes Zod, `parsed.data.audio_signals === undefined` |
| Test 10: optional-chaining type-safe     | `parsed.data.audio_signals?.audio_description ?? null` returns null cleanly; type proven via `pnpm tsc --noEmit` |
| Test 10b: valid audio passes refine      | flows through `.optional()` wrapper to inner refine                       |
| Test 10c: bad ratios in present audio    | `.refine()` fires even with `.optional()` wrapper — safeParse fails       |

Zero `it.todo(...)` calls (WARNING 4 fix). Single `it.todo` substring appears only in a documentation comment.

## Acceptance Criteria — All Met

| Criterion                                                                          | Status |
| ---------------------------------------------------------------------------------- | ------ |
| `src/lib/engine/audio-perceptual.ts` exists with `export function computeAudioPerceptualScore` | ✓      |
| File contains the 7-row PERCEPTUAL_FORMULA_BY_TYPE matrix with locked coefficients | ✓      |
| References all three formula modes: "voice", "ambient", "balanced"                  | ✓      |
| `audio-perceptual.test.ts` exists with ≥10 test cases                              | ✓ (16) |
| `pnpm vitest run audio-perceptual.test.ts` exits clean, all pass                   | ✓ 16/16|
| `grep "audio_signals:" src/lib/engine/gemini.ts` ≥ 1                               | ✓ (4 hits) |
| `grep "voice_clarity_0_10\|audio_hook_first_2s_0_10\|silence_ratio\|voiceover_ratio\|music_ratio\|audio_description" gemini.ts` ≥ 6 | ✓      |
| `grep "Audio Signals" gemini.ts` ≥ 1                                                | ✓ (2 hits) |
| `grep -F "silence_ratio + voiceover_ratio + music_ratio MUST sum to exactly 1.0"`  | ✓      |
| `grep "export const GeminiAudioSignalsSchema" types.ts` = 1                        | ✓      |
| `grep "audio_signals: GeminiAudioSignalsSchema.optional()" types.ts` = 1           | ✓ (BLOCKER 2 fix) |
| `grep "Audio ratios must sum to ~1.0" types.ts` ≥ 1                                 | ✓      |
| `it.todo` (as function call) count in gemini-audio-fields.test.ts = 0              | ✓ (WARNING 4 fix) |
| `pnpm vitest run gemini-audio-fields.test.ts` passes                                | ✓ 16/16|
| Existing `gemini.test.ts` continues passing                                         | ✓ 23/23|
| `pnpm tsc --noEmit` clean on Plan 06-03 files                                       | ✓ (zero audio-perceptual / gemini / types errors) |
| Plan 06-03 success_criteria all satisfied                                           | ✓      |

(Pre-existing TS errors in `video-e2e.test.ts` and `pipeline.ts` exist before Plan 06-03 changes — confirmed by stashing and re-running. Out of scope for this plan.)

## Key Decisions

1. **Option (a) for Test 8 — `buildVideoPrompt` exported with `@internal` JSDoc.** Cleaner test surface than mock-and-capture; Test 8 calls `buildVideoPrompt(makeCalibration())` directly and grep-asserts the literal substrings. Downstream maintainers: do not call from production code.
2. **`audio_signals` is `.optional()` at the Zod layer (BLOCKER 2 fix).** When Gemini omits the block, top-level video schema validation still succeeds; downstream code reads via `?.audio_description ?? null` (T | undefined). Without this, every audio-less Gemini response would crash the pipeline. Test 9 + 10 + 10b + 10c codify the contract: optional bypasses refine when absent, refine fires when present, optional chaining yields undefined cleanly.
3. **`audio_signals` NOT in outer `required[]` of VIDEO_RESPONSE_SCHEMA.** Mirrors the Zod `.optional()` intent at the Gemini structured-output layer. Gemini treats unrequired-but-defined keys as best-effort. Test 7b guards this.
4. **Voice mode renormalizes via `weightedSum / totalWeight`** when some sub-scores are null. Without renormalization, a talking_head with null voice_clarity would divide weighted_sum by `0.45 + 0.35 + 0.20 = 1.0` and bias the result low (missing 0.45 weight as zero). The renormalization treats null sub-scores as "not measured" rather than "scored zero" — graceful degradation.
5. **D-A2 contract-violation tolerance (Test 8).** If Gemini emits `voice_clarity_0_10` for a slideshow (despite D-A2 saying it should be null), the ambient formula ignores it cleanly. No defensive logic in the schema — the formula simply does not look at voice fields in ambient mode.
6. **`description_quality_score` as a length heuristic** — captures "Gemini wrote something substantive" without semantic analysis. Phase 10 may refine with richer signals; locked here for v3.0-dev.
7. **Cosmetic matrix reformat as a separate commit (ce4f08c).** One-line-per-row layout matches the analog idiom from `wave0/content-type-weights.ts` and lets the plan's literal verify grep (`talking_head.*voice`, `slideshow.*ambient`) match per row. Per the executor protocol (no `--amend`), this landed as a third `refactor` commit rather than amending Task 1.

## Deviations from Plan

None significant. The plan's specified algorithm + coefficients were implemented verbatim. The cosmetic matrix reformat (commit ce4f08c) was a follow-on to satisfy the plan's literal verify grep — but the matrix content is identical to Task 1's first version.

The `it.todo` grep in the plan's `<automated>` verify block matches the literal substring (including comments) — my test file has zero `it.todo(...)` function calls but one mention in a top-of-file JSDoc comment documenting the WARNING 4 fix. This is not a real `it.todo` usage; the acceptance criterion ("every test gates a real assertion") is satisfied.

## Confirmation Points (per plan's `<output>` block)

- **Zod refinement rejects sum=1.2, accepts sum=1.05** — confirmed by Test 3a (sum=1.05 succeeds) and Test 3b (sum=1.2 fails with the expected error message).
- **GeminiVideoResponseSchema accepts a response with audio_signals omitted entirely (BLOCKER 2)** — confirmed by Test 9 (`safeParse.success === true`, `parsed.data.audio_signals === undefined`).
- **Optional-chaining access remains type-safe** — confirmed by Test 10 (`parsed.data.audio_signals?.audio_description ?? null` typechecks without a non-null assertion) and by zero new TS errors in `pnpm tsc --noEmit`.
- **NO `it.todo(...)` remains in gemini-audio-fields.test.ts (WARNING 4)** — confirmed by `grep -Ec '^\s*it\.todo\('` returning 0.
- **Plan 05/06 entrypoint** — `import { computeAudioPerceptualScore } from "@/lib/engine/audio-perceptual"` is the canonical entrypoint; downstream optional-chaining `geminiResult.analysis.audio_signals?.audio_description ?? null` is the canonical access pattern (type-safe per Test 10).
- **Option (a) chosen for Test 8** — `buildVideoPrompt` exported with `@internal` JSDoc; tests call it directly. Documented in the test file's top-of-file comment for downstream maintainers.

## For Downstream Plans (06-04 / 06-05 / 06-06)

- Aggregator wiring (later plan): import `computeAudioPerceptualScore` from `./audio-perceptual`. Pass `geminiResult.analysis.audio_signals` (T | undefined) — when undefined, the aggregator branch sets `signal_availability.audio = false`; when present, call the function with the Phase 4 `content_type` from `wave0Result.content_type?.type ?? null`.
- Fingerprint stage (06-04 — parallel sibling): consume `audio_signals?.audio_description ?? null` from the resolved Gemini promise; embed via `gemini-embedding-001`; match against `match_trending_sound_by_audio` RPC. The Zod schema in this plan guarantees `audio_description` is a non-empty string (min 1, max 300) when audio_signals is present.
- Test 7b's outer-required guard is load-bearing: future plans MUST NOT add `"audio_signals"` to `VIDEO_RESPONSE_SCHEMA.required` without first removing the `.optional()` on the Zod side — both layers must move together.

## Validation Run Notes

- `pnpm vitest run src/lib/engine/__tests__/audio-perceptual.test.ts src/lib/engine/__tests__/gemini-audio-fields.test.ts` → 2 files, 32 tests passed, 0 failed.
- `pnpm vitest run src/lib/engine/__tests__/` (full engine suite) → 25 files, 370 passed, 3 skipped, 0 failed. No regressions on existing gemini.test.ts (23/23), pipeline.test.ts, aggregator.test.ts, etc.
- `pnpm tsc --noEmit` — zero errors in `audio-perceptual.ts`, `gemini.ts`, `types.ts`, `audio-perceptual.test.ts`, `gemini-audio-fields.test.ts`. Pre-existing errors in `video-e2e.test.ts` and `pipeline.ts` confirmed to predate this plan (out of scope).

## Self-Check: PASSED

- Created files exist (3): audio-perceptual.ts, audio-perceptual.test.ts, gemini-audio-fields.test.ts.
- Modified files preserved (2): gemini.ts (export VIDEO_RESPONSE_SCHEMA + buildVideoPrompt + add audio_signals to schema + prompt section), types.ts (GeminiAudioSignalsSchema export + .optional() on response).
- Commits exist:
  - `4c4e69a` (Task 1 — audio-perceptual + tests)
  - `26b766f` (Task 2 — gemini schema + types + tests)
  - `ce4f08c` (cosmetic — matrix one-line-per-row)
- 32/32 new tests pass, 0 regressions on 370 existing engine tests, tsc clean on Plan 06-03 files.
