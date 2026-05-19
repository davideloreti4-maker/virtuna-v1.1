---
phase: 06
plan: 05
type: execute
wave: 4
status: complete
completed: 2026-05-19
requirements: [AUDIO-01, AUDIO-05, AUDIO-06, AGG-04]
tags: [audio, pipeline, trends, wiring, types]
commits:
  - 02ce605  # feat(06-05): gate Jaro-Winkler sound loop on audioFingerprintMatched (D-F3)
  - c79e617  # feat(06-05): wire audio_fingerprint stage into Wave 1 + extend PipelineResult
dependency_graph:
  requires:
    - 06-02  # PipelineAudioFingerprintFields → AudioFingerprintResult shape lives next to feeder interface
    - 06-04  # matchAudioFingerprint(audioDescription, supabase) entrypoint
  provides:
    - "PipelineResult.audioFingerprintResult: AudioFingerprintResult | null (canonical field for Plan 06-06 aggregator)"
    - "enrichWithTrends(supabase, input, { audioFingerprintMatched }): TrendEnrichment (D-F3 gating)"
    - "Pipeline emits 'audio_fingerprint' SSE stage_start/stage_end (renamed from 'audio_analysis')"
  affects:
    - 06-06  # aggregator reads pipelineResult.audioFingerprintResult to compute audio_fingerprint_boost + signal_availability.audio_fingerprint
tech_stack:
  added: []  # No new dependencies — wave 4 is wiring only
  patterns:
    - "Feeder interface idiom (PipelineAudioFingerprintFields) — audio types co-located in types.ts while PipelineResult composes via interface extends"
    - "Optional-chaining contract (gemini.audio_signals?.audio_description ?? null) lifted from extended-only schema to base GeminiResponseSchema for type-correctness on text-mode path"
    - "Sub-await inside timed() boundary (RESEARCH Q3 Option A) — visible parallelism preserved for SSE consumers while honoring genuine data dependency"
    - "Optional opts param with back-compat default (enrichWithTrends omits → undefined → ungated)"
key_files:
  created: []
  modified:
    - src/lib/engine/types.ts                            # PipelineAudioFingerprintFields + audio_signals on base GeminiResponseSchema + schema reorder
    - src/lib/engine/pipeline.ts                         # audio_fingerprint stage rename + fill + Wave 1 destructure + PipelineResult extends feeder
    - src/lib/engine/trends.ts                           # enrichWithTrends opts + Jaro-Winkler sound loop gating (hashtag loop UNCHANGED)
    - src/lib/engine/__tests__/trends.test.ts            # +4 D-F3 gating tests (A, B, C, D)
    - src/lib/engine/__tests__/factories.ts              # audioResult: null → audioFingerprintResult: null (fixture migration)
    - src/lib/engine/__tests__/video-e2e.test.ts         # audioResult: null → audioFingerprintResult: null (e2e fixture migration)
decisions:
  - "PipelineResult interface stays in pipeline.ts (where it has always lived) — types.ts hosts the new PipelineAudioFingerprintFields feeder interface, pipeline.ts composes via `extends`. Plan acceptance criteria `grep audioFingerprintResult src/lib/engine/types.ts` satisfied by the feeder interface; aggregator's existing `import type { PipelineResult } from \"./pipeline\"` keeps working unchanged."
  - "audio_signals widened on BASE GeminiResponseSchema (not just GeminiVideoResponseSchema). The Phase 6 BLOCKER 2 comment in types.ts already documented `gemini.audio_signals?.audio_description ?? null` as the canonical access pattern; making it type-safe required the field on the base schema. Text-mode path never populates the field at runtime → type stays undefined → graceful degradation preserved."
  - "GeminiAudioSignalsSchema moved BEFORE GeminiResponseSchema in types.ts (no behavior change — pure declaration-order reorder so the base schema can reference the audio schema directly without z.lazy())."
  - "Pipeline error handling: outer try/catch around timed() is defense-in-depth only. matchAudioFingerprint() is documented as never-throwing (every soft failure returns null). The catch covers unexpected hard failures (e.g., geminiPromise rejecting before yielding) — Sentry-tagged with `stage: audio_fingerprint, requestId`, warning pushed, null returned, stage timing zeroed."
  - "Wave 1 sibling order PRESERVED — [gemini, audio*, creator, rules] is positional; existing pipeline.test.ts asserts work without modification. Only the second slot's name + type changed (audio → audioFingerprintResult / null → AudioFingerprintResult | null)."
  - "trends.ts opts param is optional (back-compat preserved). All 11 existing tests pass unchanged — callers omit opts, the gate stays false, Jaro-Winkler loop runs as before."
  - "Hashtag loop in trends.ts UNCHANGED — per D-F3 only the Jaro-Winkler sound loop is gated; hashtag scoring is orthogonal to audio fingerprint."
metrics:
  duration_minutes: ~10
  tasks_completed: 2
  files_modified: 6
  test_cases_added: 4
  full_suite_status: "819 passing, 4 skipped, 0 failures (engine: 651/3-skipped/0-fail)"
---

# Phase 6 Plan 05: Pipeline Wiring + Trends Gating + PipelineResult Widening Summary

## One-Liner

Connected Plans 06-03 and 06-04 to the live pipeline by renaming the no-op `audio_analysis` stage to `audio_fingerprint` with a real `matchAudioFingerprint()` call, gating the Jaro-Winkler caption fallback on `audioFingerprintMatched` (D-F3), and widening `PipelineResult` with `audioFingerprintResult: AudioFingerprintResult | null` so Plan 06-06's aggregator can consume the result without TypeScript errors.

## What Shipped

### Three integration points (D-A4, D-F3, type widening)

**1. `src/lib/engine/pipeline.ts` — audio_fingerprint stage wiring (D-A4)**

- Imports added: `matchAudioFingerprint` from `./audio-fingerprint`; `AudioFingerprintResult` + `PipelineAudioFingerprintFields` from `./types`.
- Renamed Wave 1 stage at line ~375: `"audio_analysis"` → `"audio_fingerprint"` (zero string literals of the old name remain in `pipeline.ts`).
- No-op body replaced with the real fingerprint call:
  ```typescript
  const audioFingerprintPromise = (async (): Promise<AudioFingerprintResult | null> => {
    try {
      return await timed("audio_fingerprint", timings, async () => {
        const geminiInner = await geminiPromise;
        const audioDescription = geminiInner.analysis.audio_signals?.audio_description ?? null;
        return matchAudioFingerprint(audioDescription, supabase);
      }, { wave: 1, onEvent: onStageEvent });
    } catch (error) {
      Sentry.captureException(error, { tags: { stage: "audio_fingerprint", requestId } });
      warnings.push(`Audio fingerprint unavailable: ${...}`);
      timings.push({ stage: "audio_fingerprint", duration_ms: 0 });
      return null;
    }
  })();
  ```
- Wave 1 Promise.all destructuring updated: `[geminiResult, audioResult, , ruleResult]` → `[geminiResult, audioFingerprintResult, , ruleResult]` (positional slot order PRESERVED, second slot renamed).
- `PipelineResult` interface now extends `PipelineAudioFingerprintFields` — the new field `audioFingerprintResult: AudioFingerprintResult | null` is inherited (replaces the old `audioResult: null` no-op slot).
- Return object updated: includes `audioFingerprintResult` (from destructuring).
- trend_enrichment call passes `{ audioFingerprintMatched: audioFingerprintResult !== null }` through to `enrichWithTrends` (D-F3 wiring).

**2. `src/lib/engine/trends.ts` — D-F3 Jaro-Winkler gating**

- `enrichWithTrends` signature extended with optional third parameter: `opts?: { audioFingerprintMatched?: boolean }`. Back-compat preserved — omitted opts → undefined → loop runs.
- Jaro-Winkler sound match loop wrapped: `if (trendingSounds && !opts?.audioFingerprintMatched)`. When the upstream fingerprint matched a sound, the fallback Jaro-Winkler loop is SKIPPED — the aggregator (Plan 06-06) will synthesize the `matched_trends` entry from the fingerprint result (single source of truth contract per D-F3).
- Hashtag scoring loop (lines 86-156) UNCHANGED — orthogonal to audio fingerprint.

**3. `src/lib/engine/types.ts` — PipelineResult widening + base-schema audio**

- New exported `PipelineAudioFingerprintFields` interface with a single field:
  ```typescript
  export interface PipelineAudioFingerprintFields {
    audioFingerprintResult: AudioFingerprintResult | null;
  }
  ```
  Co-located with `AudioFingerprintResult` (audio types in one place). `pipeline.ts` composes it into `PipelineResult` via `extends`. Plan acceptance criterion `grep audioFingerprintResult src/lib/engine/types.ts` satisfied by the feeder.
- `GeminiAudioSignalsSchema` moved BEFORE `GeminiResponseSchema` in declaration order (pure refactor — Zod is order-sensitive when the parent schema references the child directly without `z.lazy()`).
- `GeminiResponseSchema` (the BASE schema) extended with `audio_signals: GeminiAudioSignalsSchema.optional()`. This satisfies the Phase 6 BLOCKER 2 contract documented in types.ts: `geminiResult.analysis.audio_signals?.audio_description ?? null` is now type-safe on the narrower `GeminiAnalysis` type (the text-mode path's resolved Promise type). The video-mode path still goes through `GeminiVideoResponseSchema` (now superset by inheritance), with `audio_signals` declared explicitly there for readability.

**4. Test coverage — 4 new D-F3 gating tests**

Added to `src/lib/engine/__tests__/trends.test.ts` under `describe("Phase 6 D-F3 audioFingerprintMatched gating")`:

- **Test A:** `audioFingerprintMatched=true` → 5 candidate sounds in `trending_sounds`, caption contains one — Jaro-Winkler loop SKIPPED, `matched_trends` is empty. ✓
- **Test B:** `audioFingerprintMatched=false` → caption matches a sound — Jaro-Winkler loop FIRES, `matched_trends` contains the v2.1-baseline sound. ✓
- **Test C:** opts omitted → back-compat behavior identical to pre-Phase-6 (loop runs). ✓
- **Test D:** Hashtag loop NEVER gated — `hashtag_relevance > 0` even with `audioFingerprintMatched=true` (orthogonality contract per D-F3). ✓

## Verification Summary

| Check | Status | Detail |
|-------|--------|--------|
| pipeline.ts `"audio_fingerprint"` count | ✓ | 4 occurrences (stage name + comments) |
| pipeline.ts `"audio_analysis"` count | ✓ | 0 (old name fully removed) |
| pipeline.ts `matchAudioFingerprint` count | ✓ | 4 (import + usage + comments) |
| pipeline.ts `audioFingerprintMatched` count | ✓ | 1 (passed to enrichWithTrends) |
| trends.ts `audioFingerprintMatched` count | ✓ | 4 |
| trends.ts gating expression | ✓ | `!opts?.audioFingerprintMatched` present |
| types.ts `audioFingerprintResult` count | ✓ | 3 (feeder interface + docs) |
| types.ts `PipelineAudioFingerprintFields` count | ✓ | 1 export |
| trends.test.ts D-F3 describe block | ✓ | 4 new tests A/B/C/D |
| `pnpm tsc --noEmit` plan-owned files | ✓ | pipeline.ts: 1 baseline (DEFAULT_CREATOR_CONTEXT, unrelated); trends.ts: 0; types.ts: 0 |
| `pnpm vitest run src/lib/engine` | ✓ | 651 passed, 3 skipped, 0 failed |
| `pnpm vitest run` (full suite) | ✓ | 819 passed, 4 skipped, 0 failed |
| Aggregator + Gemini source unchanged | ✓ | 0 TS errors in aggregator.ts and gemini.ts (downstream still compiles) |
| No file deletions in commits | ✓ | git diff --diff-filter=D between commits returns empty |

## Note for Plan 06-06 (aggregator + cron)

The canonical accessor in Plan 06-06 is `pipelineResult.audioFingerprintResult` (typed via the new `PipelineAudioFingerprintFields` feeder interface in `types.ts`). Read it for:

1. **`SignalAvailability.audio_fingerprint` flag** — `audioFingerprintResult !== null`.
2. **Phase-aware boost (D-G2)** — read `audioFingerprintResult?.trend_phase` for the boost direction (`emerging` +15, `rising` +10, `peak` +5, `declining` -5, none/null 0).
3. **`audioTrendingMatch` ML feature (D-G4)** — `audioFingerprintResult?.similarity ?? trendEnrichment.matched_trends-derived-score`. Plan 06-06 owns the swap pattern.
4. **`matched_trends` synthesis** — when the fingerprint matched, Plan 06-06's aggregator pushes a synthetic entry into `trendEnrichment.matched_trends` (single source of truth — this plan's `trends.ts` skips its Jaro-Winkler loop in that case).

`geminiResult.analysis.audio_signals` is `GeminiAudioSignals | undefined` (declared `.optional()` on the base schema). Plan 06-06 reads it via optional chaining: `gemini.audio_signals?.<field> ?? <default>`. For the perceptual score formula (D-G3), pass `gemini.audio_signals` to `computeAudioPerceptualScore()` from `src/lib/engine/audio-perceptual.ts` (Plan 06-03 entrypoint).

## Deviations from Plan

### Rule 2 — Auto-added missing critical functionality

**`audio_signals` added to base `GeminiResponseSchema`** (not just to `GeminiVideoResponseSchema`)

- **Found during:** Task 2 (pipeline wiring) — TypeScript reported `Property 'audio_signals' does not exist on type` when reading `geminiResult.analysis.audio_signals?.audio_description` inside the audio_fingerprint stage body. The pipeline's `PipelineResult.geminiResult.analysis` is typed `GeminiAnalysis` (narrower base schema), which previously had `video_signals?` but not `audio_signals?`.
- **Why it's a critical fix:** The Phase 6 BLOCKER 2 contract documented in `types.ts` line 294-298 says `Downstream code reads audio_signals via optional chaining`. That contract requires the field to exist on the base schema; Plan 06-02 only declared it on the extended `GeminiVideoResponseSchema`. The plan body itself (Plan 06-05 action C2) uses the exact `geminiResult.analysis.audio_signals?.audio_description ?? null` access pattern — so the schema needed to honor the documented contract for the wiring to type-check.
- **Fix:** Added `audio_signals: GeminiAudioSignalsSchema.optional()` to `GeminiResponseSchema`. Required moving `GeminiAudioSignalsSchema` declaration BEFORE `GeminiResponseSchema` (pure declaration-order refactor — no runtime change). The video schema still inherits the optional and re-declares it explicitly for readability.
- **Runtime impact:** Zero. The text-mode Gemini path never populates audio_signals at runtime, so the field stays undefined on `GeminiAnalysis` instances — graceful degradation contract preserved (HARD-03 + Phase 3 D-04). The aggregator already reads `gemini.video_signals` (similarly optional) and now reads `gemini.audio_signals` the same way.
- **Files modified:** `src/lib/engine/types.ts` (additive — schema field added, declarations reordered).
- **Commit:** `c79e617` (folded into Task 2 — type fix needed for the wiring to compile).

### Other deviations: None

- Plan 02 had previously declared `PipelineResult` in `pipeline.ts` (not in `types.ts`). The plan's `<action>` template wrote `interface PipelineResult` in `types.ts`, but its `<read_first>` note allowed for the inline-vs-aliased case and recommended widening "conservatively, where it lives." The feeder interface approach satisfies the acceptance criteria string-grep AND keeps the existing import path stable (`aggregator.ts: import type { PipelineResult } from "./pipeline"` keeps working). Not a deviation — interpretation matches the plan's explicit fallback guidance.

## Known Stubs

None. All wiring is functional. The only "stub" is the intentional Wave 5 boundary: the aggregator does not yet read `audioFingerprintResult` — Plan 06-06 owns that wiring.

## Authentication Gates Encountered

None.

## Self-Check: PASSED

- `src/lib/engine/types.ts` exists with `PipelineAudioFingerprintFields` exported.
- `src/lib/engine/pipeline.ts` exists with `audio_fingerprint` stage + `matchAudioFingerprint` import + audioFingerprintMatched passthrough.
- `src/lib/engine/trends.ts` exists with `opts?.audioFingerprintMatched` gating.
- `src/lib/engine/__tests__/trends.test.ts` exists with 4 new D-F3 tests under `Phase 6 D-F3 audioFingerprintMatched gating` describe block.
- Commit `02ce605` (Task 1) found in git log.
- Commit `c79e617` (Task 2) found in git log.
- `pnpm vitest run src/lib/engine` returns 651 passed / 0 failed.
- `pnpm vitest run` (full suite) returns 819 passed / 0 failed.
- `pnpm tsc --noEmit` shows no NEW errors in plan-owned files (`pipeline.ts` 1 baseline, `trends.ts` 0, `types.ts` 0). 13-error increase in `trends.test.ts` is purely the same baseline vitest-globals class (`TS2304: Cannot find name 'vi'` × 4 new test cases).
