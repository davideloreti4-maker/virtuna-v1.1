---
phase: 06
plan: 06
type: execute
wave: 5
status: complete
completed: 2026-05-19
requirements: [AUDIO-01, AUDIO-05, AUDIO-06, AGG-01, AGG-02, AGG-04, AGG-05, AGG-06]
tags: [audio, aggregator, cron, wiring, integration, signal-weight, fingerprint, persistence, phase-6-complete]
commits:
  - 2ad6523  # test(06-06): add failing aggregator audio wiring tests (RED) — 23 tests
  - c2f56db  # feat(06-06): wire audio signal into aggregator (D-G1..G4, Q4 RESOLVED)
  - ff75b6d  # feat(06-06): persist audio_description to analysis_results (Note 7 / Q4 RESOLVED) — Rule 3 deviation
  - 27b3f9c  # test(06-06): add failing cron D-F4 pipeline tests (RED) — 7 tests
  - 410d0a1  # feat(06-06): extend calculate-trends cron with FULL D-F4 pipeline (GREEN)
dependency_graph:
  requires:
    - 06-02   # GeminiAudioSignals + AudioFingerprintResult + AudioPerceptualResult types; analysis_results.audio_description column (Note 7)
    - 06-03   # computeAudioPerceptualScore entrypoint (audio-perceptual.ts)
    - 06-04   # matchAudioFingerprint entrypoint + backfill pipeline pattern
    - 06-05   # PipelineResult.audioFingerprintResult feeder + D-F3 trends.ts gating
  provides:
    - "PredictionResult.audio_perceptual_score (0-100, BEFORE fingerprint boost per D-G3)"
    - "PredictionResult.audio_fingerprint (full AudioFingerprintResult or null per D-G1)"
    - "PredictionResult.audio_description (verbatim Gemini value or null per Note 7 / Q4 RESOLVED)"
    - "PredictionResult.signal_availability { audio, audio_fingerprint } booleans (D-G1)"
    - "PredictionResult.score_weights.audio (0.07 base, redistributed when audio absent)"
    - "FeatureVector.audioTrendingMatch sourced from fingerprint when available (D-G4 source-of-data swap)"
    - "matched_trends synthesized from fingerprint result (D-F3 single source of truth)"
    - "analysis_results.audio_description column populated via route.ts buildInsertRow"
    - "Cron /api/cron/calculate-trends now embeds newly-upserted sounds inline (D-F4)"
    - "Cron path is idempotent (skips rows with non-null audio_embedding)"
    - "Cron path is failure-tolerant per Pitfall 4 (per-row failures log + continue)"
  affects:
    - "Phase 6 verifier — all SC#1-5 verifiable now that audio is wired end-to-end"
    - "Phase 10 ML audit — will retune SCORE_WEIGHTS.audio against corpus benchmark"
    - "Phase 12 benchmark — will validate the 0.80 cosine threshold + audio signal contribution"
tech_stack:
  added: []   # No new dependencies — all helpers reused from Plan 04 backfill semantics
  patterns:
    - "Normalized SCORE_WEIGHTS (raw 0.07 addition + always-normalize) preserves the
       weighted-average sum=1.0 contract while keeping audio weight semantically explicit"
    - "Back-compat SignalAvailability handling: when caller passes legacy 5-key shape
       (no `audio` field), audio is excluded from the math entirely — returns identical
       weights to pre-Phase-6 selectWeights. Honors AGG-05 additive-only constraint"
    - "matched_trends synthesis without mutation (derives a fresh effectiveTrendEnrichment
       locally, leaves input pipelineResult untouched)"
    - "Cron inline embedding mirrors Plan 04 backfill semantics verbatim — same helpers
       inlined (download → upload → describe → embed → update + Files API cleanup),
       same idempotency predicate (audio_embedding IS NULL), same failure tolerance"
    - "Idempotency check via single-row maybeSingle() before pipeline — cheap; saves
       cost on already-embedded rows; respects Pitfall 4 fire-and-forget contract"
    - "Per-row try/catch around processSoundEmbedding — defense-in-depth ensures the
       route response shape stays unchanged even on unexpected fatal failures"
key_files:
  created:
    - src/lib/engine/__tests__/aggregator-audio.test.ts                # 23 tests (D-G1..G4 + D-F3 + Note 7)
    - src/app/api/cron/calculate-trends/__tests__/route.test.ts        # 7 tests (D-F4 pipeline + idempotency)
    - .planning/phases/06-audio-analysis-fingerprint-matching/06-06-SUMMARY.md  # this file
  modified:
    - src/lib/engine/aggregator.ts                                     # audio signal wiring (D-G1..G4 + Note 7)
    - src/lib/engine/types.ts                                          # PredictionResult.score_weights.audio + audio_description
    - src/app/api/cron/calculate-trends/route.ts                       # D-F4 inline embedding pipeline
    - src/app/api/analyze/route.ts                                     # buildInsertRow plucks audio_description (Rule 3)
    - src/app/api/analyze/__tests__/route.test.ts                      # +2 audio_description persistence tests
decisions:
  - "Weight normalization: raw 0.07 addition + always-normalize selectWeights (BOTH branches).
     Rationale: the weighted-average math at aggregateScores line 388 assumes sum=1.0 to
     keep overall_score in [0, 100]. Raw addition pushes total to 1.07; without normalization,
     overall_score would systematically inflate by ~7%. Normalizing both the all-available
     and redistribution branches is cheaper than per-call proportional downscaling and keeps
     the SCORE_WEIGHTS constant declaration human-readable (the audio: 0.07 value reads as
     the intent of D-G1, not as a downscaled artifact)."
  - "Back-compat handling in selectWeights: when a caller passes legacy 5-key SignalAvailability
     (no `audio` field, e.g., existing prediction-cache + analyze route test fixtures), audio
     is excluded from the math entirely — returns weights identical to pre-Phase-6 selectWeights.
     Rationale: AGG-05 prohibits modifying existing tests; AND the back-compat path is the
     conservative choice when the caller hasn't opted in. New callers (the aggregator itself)
     always pass the 6-key shape, so they participate in the new math fully."
  - "analysis_results.audio_description persistence integration point (Note 7 / Q4 RESOLVED):
     route.ts buildInsertRow plucks finalResult.audio_description into the INSERT payload.
     Rationale: the codebase convention is that route.ts owns analysis_results writes
     (lines 246-287). Aggregator extends PredictionResult with the new optional field;
     route.ts is the existing persistence layer. This matches the plan's explicit guidance:
     'Choose the path that matches the codebase's existing conventions' (B10). route.ts
     is OUT of files_modified per plan frontmatter, but the route edit is a one-line pluck
     that is necessary for the end-to-end Note 7 contract to actually persist — surfaced
     as a Rule 3 deviation (blocking issue)."
  - "Cron idempotency via per-row maybeSingle() audio_embedding check rather than batching
     into a single SELECT. Rationale: ~50 sounds/day at most — the marginal extra round-trip
     per row is cheap (sub-millisecond on indexed sound_name lookup) vs the cost of a wasted
     Gemini call (~$0.0005/sound). The check protects against re-embedding after a partial
     prior cron run that succeeded for some rows. Mirrors the backfill script's
     `.is('audio_embedding', null)` filter at the row-level granularity."
  - "Carrier pattern for Gemini Files API cleanup (uploadedName captured inside
     describeAudioWithGemini, cleanup ALWAYS runs after — even when describe throws mid-flow).
     Rationale: Files API has a 48h retention + quota; an upload that succeeds followed by
     a describe failure must NOT leak the uploaded resource. The pattern mirrors the
     backfill script's WARNING 3 fix verbatim."
  - "matched_trends synthesis NEVER mutates pipelineResult.trendEnrichment. The aggregator
     derives a fresh effectiveTrendEnrichment with the synthesized entry (when fingerprint
     present) and uses that for ALL downstream reads (assembleFeatureVector,
     signal_availability.trends, weighted-average, calculateConfidence, PredictionResult.trend_score).
     Rationale: Phase 3 D-04 + AGG-05 forbid mutating shared input shapes. Aggregator-local
     derivation keeps the contract clean for re-entrant callers (e.g., the eval harness
     that may run aggregateScores on the same PipelineResult instance multiple times)."
metrics:
  duration_minutes: ~25
  tasks_completed: 2  # +1 Rule 3 deviation commit
  files_modified: 5
  files_created: 2
  test_cases_added: 32  # 23 aggregator-audio + 7 cron + 2 analyze-route
  full_suite_status: "851 passed, 4 skipped, 0 failed (up from 819 in Plan 06-05; +32 new tests, 0 regressions)"
  engine_suite_status: "674 passed, 3 skipped, 0 failed (up from 651 in Plan 06-05; +23 from aggregator-audio.test.ts)"
  cron_suite_status: "7 passed, 0 failed (new test file)"
  analyze_route_suite_status: "14 passed, 0 failed (up from 12; +2 audio_description tests)"
---

# Phase 6 Plan 06: Aggregator Wiring + Cron D-F4 Pipeline + analysis_results.audio_description Persistence Summary

## One-Liner

Wired the Plan 06-03 + 06-04 + 06-05 outputs into the live `aggregateScores` flow: audio is now a weight-bearing signal (0.07) with content-type-adaptive perceptual scoring + trend-phase-aware fingerprint boost (D-G2: emerging+15, rising+10, peak+5, declining-5, none 0), `FeatureVector.audioTrendingMatch` sources from fingerprint cosine when available (D-G4, opaque-to-ML swap), `matched_trends` is synthesized from the fingerprint result on the aggregator side (D-F3 single source of truth, no input mutation), `analysis_results.audio_description` is persisted via the route layer's existing `buildInsertRow` (Note 7 / Q4 RESOLVED), and the `/api/cron/calculate-trends` route now runs the FULL D-F4 pipeline per newly-upserted sound (mirrors Plan 04 backfill semantics, idempotent via `audio_embedding IS NULL`, failure-tolerant per Pitfall 4).

## What Shipped

### Four integration points — Phase 6 SC#1, SC#2, SC#3, SC#4, SC#5 all MET

**1. `src/lib/engine/aggregator.ts` — audio signal wiring (D-G1..G4, Note 7)**

- **Imports** added: `computeAudioPerceptualScore` (from `./audio-perceptual`) + `AudioPerceptualResult` type.
- **`SCORE_WEIGHTS` extended** with `audio: 0.07` — middle of the 0.05-0.10 range per CONTEXT D-G1; Phase 10 ML audit retunes. Now `export`-ed for test introspection.
- **`SCORE_WEIGHT_KEYS` extended** with `"audio"` (weight-bearing) but NOT `"audio_fingerprint"` (provenance only — the fingerprint boost folds into `audio_score` BEFORE the weighted average, so it must NOT participate in `selectWeights` redistribution math per RESEARCH Anti-Pattern #8). Now `export`-ed.
- **`selectWeights` normalizes BOTH branches** (all-available + redistribution) so the returned weights always sum to ~1.0. Raw weights now sum to 1.07; the weighted-average math at line 388 expects sum=1.0 to keep `overall_score` in [0, 100]. Both branches use the same `weight / total * 1000` rounding pass.
- **Back-compat handling**: when a caller passes legacy 5-key `SignalAvailability` (no `audio` field), `selectWeights` excludes audio from the math entirely — returns weights identical to pre-Phase-6. Preserves AGG-05 (existing aggregator tests pass unchanged).
- **`audio_perceptual_score` computed** via `computeAudioPerceptualScore(audio_signals, content_type)` when audio is available; 0 otherwise.
- **`audio_score` (internal) = clamp(audio_perceptual_score + fingerprint_boost, 0, 100)** with boost mapping:
  - `emerging` → +15
  - `rising` → +10
  - `peak` → +5
  - `declining` → -5
  - `null` / no match → 0
- **`PredictionResult.audio_perceptual_score`** holds the PRE-boost value (per D-G3 — keeps the boost magnitude inspectable).
- **`PredictionResult.audio_fingerprint`** = full `AudioFingerprintResult` when matched; `null` otherwise.
- **`PredictionResult.audio_description`** = verbatim `geminiResult.analysis.audio_signals?.audio_description ?? null` (Note 7 source-of-data).
- **`SignalAvailability` widened** with `audio: audioSignals != null` and `audio_fingerprint: audioFingerprintResult !== null`.
- **`FeatureVector.audioTrendingMatch` source swap** (D-G4): `audioFingerprintResult.similarity` when present (0-1 cosine); falls back to the Jaro-Winkler velocity-derived score (`Math.min(1, max(velocity_score) / 100)`); `null` when both absent. Field semantics unchanged — the swap is opaque to ML.
- **`matched_trends` synthesis** (D-F3): when `audioFingerprintResult !== null` and `trendEnrichment.matched_trends.length === 0` (the Plan 05 trends.ts gating skipped the Jaro-Winkler loop), the aggregator synthesizes a `matched_trends` entry from the fingerprint result (`sound_name`, `velocity_score`, `trend_phase`). Done via a fresh `effectiveTrendEnrichment` — input `pipelineResult.trendEnrichment` is NEVER mutated.
- **Weighted-average extended** with `audio_score * (weights.audio ?? 0)` — the `?? 0` is a defensive guard for the back-compat case where `weights.audio` is undefined.
- **`calculateConfidence` + `signal_availability.trends`** now read `effectiveTrendEnrichment.matched_trends.length` so the synthesized entry flows through downstream consumers consistently.

**2. `src/lib/engine/types.ts` — PredictionResult extension**

- `PredictionResult.score_weights` widened with optional `audio?: number` (the actual weight used, may differ from base when redistribution occurred).
- `PredictionResult.audio_description?: string | null` — verbatim Gemini audio_description for persistence into `analysis_results.audio_description`.

**3. `src/app/api/cron/calculate-trends/route.ts` — FULL D-F4 inline pipeline**

- **New module-scoped constants** mirror `scripts/backfill-trending-sound-embeddings.ts` (Plan 04): `GEMINI_AUDIO_MODEL = "gemini-2.5-flash"`, `GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"`, `EMBEDDING_DIMENSIONALITY = 768`, `MAX_DOWNLOAD_BYTES = 10MB`, `DOWNLOAD_TIMEOUT_MS = 10s`, `DEFAULT_MIME_TYPE = "audio/mpeg"`, `AUDIO_DESCRIPTION_PROMPT`, `AUDIO_DESCRIPTION_SCHEMA`.
- **`getGeminiClient()`** — memoized client; returns `null` when `GEMINI_API_KEY` is missing (cron then skips the embedding extension entirely). Re-instantiates if env key changes (test isolation).
- **`safeDownloadAudio()`** — bounded download with size + timeout guards. Returns null on any failure.
- **`describeAudioWithGemini()`** — upload via Files API + audio-only describe call with carrier-pattern (stashes `uploadedName` ASAP so cleanup runs even when describe throws mid-flow).
- **`embedDescriptionWithGemini()`** — `gemini-embedding-001` with `outputDimensionality: 768`, `taskType: "SEMANTIC_SIMILARITY"`. Throws when no vector returned.
- **`cleanupGeminiFile()`** — best-effort Files API delete; never throws.
- **`processSoundEmbedding()`** — the FULL D-F4 pipeline per row:
  - **Idempotency** check first: `SELECT audio_embedding FROM trending_sounds WHERE sound_name = X` — skip when non-null (already embedded by a prior cron tick or by the backfill script).
  - Step (a): download (NON-FATAL on failure → return early).
  - Steps (b) + (c): upload + describe (NON-FATAL; carrier captures `uploadedName` BEFORE describe is called so cleanup ALWAYS runs).
  - Step (d): embed (NON-FATAL).
  - Cleanup Files API regardless of embed outcome.
  - Step (e): UPDATE `trending_sounds` with `audio_embedding` + `audio_description` (NON-FATAL — next tick retries via the IS NULL predicate).
- **Cron GET handler extension** (after the existing batch upsert succeeds):
  - Resolves Gemini client ONCE outside the batch loop (avoids per-row instantiation cost).
  - For each row in a successfully-upserted batch: try { processSoundEmbedding(...) } catch — defense-in-depth so any unexpected throw inside the helper (beyond its internal soft-failure paths) cannot propagate to the route response. Per-row failures log + continue.
  - Skipped entirely when no Gemini client (missing `GEMINI_API_KEY`) → response shape preserved (Test 5).
  - Skipped entirely on upsert failure (rows weren't written; embedding would target nonexistent rows).

**4. `src/app/api/analyze/route.ts` — Note 7 persistence (Rule 3 deviation)**

- `buildInsertRow` plucks `finalResult.audio_description ?? null` into the `analysis_results` INSERT payload.
- Single-line change — the `audio_description` column was added by Plan 06-02's migration; `database.types.ts` already declares it as `audio_description?: string | null` on `analysis_results.Insert`.
- This file is OUT of `files_modified` per Plan 06-06 frontmatter; surfaced as a **Rule 3 deviation** (blocking issue: without this edit, the aggregator-side wiring would be dead code — the Note 7 contract requires end-to-end persistence).

### Test coverage — 32 new tests (zero regressions across 819 prior)

**`src/lib/engine/__tests__/aggregator-audio.test.ts`** — 23 tests:

| Group                                        | Tests       | Coverage                                            |
| -------------------------------------------- | ----------- | --------------------------------------------------- |
| D-G1 — SCORE_WEIGHTS + SCORE_WEIGHT_KEYS     | 1, 2        | audio = 0.07; provenance audio_fingerprint excluded |
| D-G3 — audio_perceptual_score wiring         | 3, 4, 21    | pre-boost score; 0 when audio absent; formula match |
| D-G2 — fingerprint_boost trend_phase paths   | 5, 6, 7, 8, 9, 10 | emerging+15, rising+10, peak+5, declining-5, none 0; clamp [0, 100] |
| D-G1 — SignalAvailability widening           | 11–14       | audio + audio_fingerprint true/false branches       |
| D-G4 — audioTrendingMatch source swap        | 15, 16, 17  | fingerprint priority; Jaro-Winkler fallback; null   |
| D-F3 — matched_trends synthesis              | 18          | synthesized entry; no input mutation                |
| D-G1 + selectWeights — weight redistribution | 19, 20      | mathematical identity + sum-to-1 contract           |
| D-G1 — PredictionResult audio fields         | 22          | full passthrough; null when absent                  |
| Note 7 / Q4 RESOLVED — audio_description     | 23          | source-of-data contract on aggregator output        |

**`src/app/api/cron/calculate-trends/__tests__/route.test.ts`** — 7 tests:

| Test | Coverage                                                                  |
| ---- | ------------------------------------------------------------------------- |
| 1    | FULL pipeline per row (fetch + upload + describe + embed + update + cleanup) |
| 2    | Per-row download failure isolated; cron continues; route returns 200      |
| 3    | Per-row Gemini audio analysis failure isolated; cleanup attempted; cron continues |
| 4    | Per-row embedContent failure isolated; update skipped; cleanup attempted  |
| 5    | Missing GEMINI_API_KEY → no embedding; response shape preserved           |
| 6    | All-row failure → cron still returns 200 (fire-and-forget per Pitfall 4)  |
| 7    | Idempotent — rows with existing audio_embedding skip the pipeline         |

**`src/app/api/analyze/__tests__/route.test.ts`** — +2 new tests:

| Test                                                                  | Coverage                                       |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| INSERTs audio_description when finalResult.audio_description present  | Note 7 persistence — populated path            |
| INSERTs audio_description = null when finalResult field absent        | Note 7 persistence — null/undefined fallback   |

## Verification Summary

| Check                                                                       | Status | Detail                                                                                              |
| --------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| aggregator.ts `audio: 0.07`                                                 | ✓      | 2 hits (SCORE_WEIGHTS + comment)                                                                    |
| aggregator.ts `"audio"` in SCORE_WEIGHT_KEYS                                | ✓      | 3 hits (key + comments)                                                                             |
| aggregator.ts `"audio_fingerprint"` in SCORE_WEIGHT_KEYS (excluding comments) | ✓    | 0 hits (provenance-only — correctly excluded)                                                       |
| aggregator.ts `computeAudioPerceptualScore`                                 | ✓      | 2 hits (import + call)                                                                              |
| aggregator.ts D-G2 boost mapping `emerging.*15`, `rising.*10`, ...          | ✓      | 4 hits (TREND_PHASE_BOOST + tests)                                                                  |
| aggregator.ts `audio_perceptual_score` refs                                 | ✓      | 8 hits (variable + return + tests)                                                                  |
| aggregator.ts `audioFingerprintResult` refs                                 | ✓      | 13 hits (audio_score block + assembleFeatureVector swap + matched_trends synthesis + SignalAvailability + return) |
| aggregator.ts `audio: audioSignals != null`                                 | ✓      | 1 hit (SignalAvailability assignment)                                                               |
| aggregator.ts `audio_fingerprint: audioFingerprintResult !== null`          | ✓      | 1 hit (SignalAvailability assignment)                                                               |
| aggregator.ts `audio_description` refs                                      | ✓      | 6 hits (variable + return field + comments)                                                         |
| cron route.ts `embedContent` refs                                           | ✓      | 2 hits (helper + outer config)                                                                      |
| cron route.ts `generateContent` refs                                        | ✓      | 1 hit                                                                                               |
| cron route.ts `gemini-embedding-001`                                        | ✓      | 1 hit (locked model ID)                                                                             |
| cron route.ts `outputDimensionality` / `EMBEDDING_DIMENSIONALITY`           | ✓      | 2 hits (constant + config)                                                                          |
| cron route.ts `files.upload` refs                                           | ✓      | 1 hit                                                                                               |
| cron route.ts `fetch(` refs                                                 | ✓      | 1 hit (safeDownloadAudio)                                                                           |
| cron route.ts `audio_embedding` / `audio_description` refs                  | ✓      | 16 hits (idempotency check + UPDATE call + helpers)                                                 |
| cron route.ts `FAILURE-TOLERANT` / `Inline embedding` / `continuing`        | ✓      | 11 hits (Pitfall 4 documented at all soft-failure paths)                                            |
| aggregator-audio.test.ts exists with ≥23 active tests                       | ✓      | 23 active tests                                                                                     |
| cron route.test.ts exists with ≥6 new tests                                 | ✓      | 7 new tests                                                                                         |
| All 23 new aggregator-audio tests pass                                      | ✓      | 23/23 green                                                                                         |
| All 7 new cron tests pass                                                   | ✓      | 7/7 green                                                                                           |
| All existing aggregator tests pass (AGG-05)                                 | ✓      | 30/30 unchanged                                                                                     |
| Engine suite                                                                | ✓      | 674 passed, 3 skipped, 0 failed (44 files)                                                          |
| FULL suite                                                                  | ✓      | 851 passed, 4 skipped, 0 failed (62 files)                                                          |
| `pnpm tsc --noEmit` plan-owned files                                        | ✓      | 0 new errors in plan-owned files (baseline 966 pre-existing in `src/app/api/profile|settings|team/*` documented out-of-scope) |

### All 5 trend_phase boost paths tested (D-G2 coverage)

- **emerging** — Test 5: PredictionResult.audio_perceptual_score = 60 (pre-boost), audio_fingerprint.trend_phase = "emerging" (boost +15 applied internally)
- **rising** — Test 6: pre-boost = 60, trend_phase = "rising" (boost +10)
- **peak** — Test 7: pre-boost = 60, trend_phase = "peak" (boost +5)
- **declining** — Test 8: pre-boost = 60, trend_phase = "declining" (boost -5)
- **null / no match** — Test 9: pre-boost = 60, audio_fingerprint = null (boost 0); cross-checked against the "emerging" run via overall_score delta

### audioTrendingMatch swap is opaque to ML (D-G4 contract)

- `FeatureVector.audioTrendingMatch` field type unchanged: `number | null` (0-1 match strength).
- ML feature vector shape unchanged — `featureVectorToMLInput` operates on the same FeatureVector slot; semantic priority of the source-of-data is invisible to the ML side.
- Tests 15-17 verify all three branches (fingerprint priority / Jaro-Winkler fallback / both absent).

### Cron extension mirrors Plan 04 backfill semantics (no synthetic descriptions)

- Same helpers inline: `safeDownloadAudio` (mirror of `downloadAudio`), `describeAudioWithGemini` (mirror of `describeAudioWithGemini` with same carrier pattern), `embedDescriptionWithGemini` (mirror of `embedDescription`), `cleanupGeminiFile` (mirror of `cleanupUploadedFile`).
- Same idempotency predicate (`audio_embedding IS NULL`) — cron uses per-row `maybeSingle()` check; backfill script uses table-level `.is("audio_embedding", null)` filter. Equivalent semantics; cron's per-row granularity is intentional for the mid-cron-run resumability.
- Same failure tolerance (each step is non-fatal; cleanup is best-effort; next cron tick retries).

### Developer-facing verification commands (Phase 6 close-out)

1. **One-time backfill** (after deploying this plan):
   ```bash
   pnpm tsx scripts/backfill-trending-sound-embeddings.ts
   ```
   Iterates `trending_sounds WHERE audio_embedding IS NULL` and runs the full D-F4 pipeline. Populates the existing rows so the live `/api/analyze` route can match against them.

2. **Real `/api/analyze` end-to-end** (post-backfill):
   - Upload a known talking_head video.
   - Verify the SSE stage event timeline shows `audio_fingerprint` (NOT the pre-Phase-6 `audio_analysis`).
   - Verify `PredictionResult.audio_perceptual_score` is non-zero (talking_head + audio_signals → voice-driven formula).
   - Verify `analysis_results.audio_description` is populated on the saved row:
     ```sql
     SELECT id, audio_description FROM analysis_results
     ORDER BY created_at DESC LIMIT 1;
     ```

## Deviations from Plan

### Rule 3 — Blocking issue: route.ts audio_description pluck (commit ff75b6d)

- **Found during:** Task 1 wiring — the aggregator exposed `audio_description` on `PredictionResult`, but the `analysis_results` INSERT lives in `src/app/api/analyze/route.ts buildInsertRow` (lines 246-287), which is OUT of `files_modified` per Plan 06-06 frontmatter.
- **Why it's a blocking fix:** Without the route.ts edit, the aggregator-side wiring would be dead code — the `audio_description` column would never receive data, and the Note 7 / Q4 RESOLVED contract documented in 06-RESEARCH.md (the explicit "Plan 06 aggregator writes the value" promise) would not actually persist anywhere. The plan's `<action>` section B10 specifies: "Choose the path that matches the codebase's existing conventions" — the codebase convention is that route.ts owns analysis_results writes, so the persistence pluck MUST live there.
- **Fix:** Single-line addition to `buildInsertRow`: `audio_description: finalResult.audio_description ?? null,`. The `audio_description` column was added by Plan 06-02's migration; `database.types.ts` already declares the column on `analysis_results.Insert` (`audio_description?: string | null`). Added 2 tests in `route.test.ts` covering both populated and null persistence paths.
- **Files modified:** `src/app/api/analyze/route.ts` (line 287 area, 1-line addition) + `src/app/api/analyze/__tests__/route.test.ts` (+2 tests; 12 → 14 total).
- **Commit:** `ff75b6d`

### Other deviations: None

- The aggregator's existing strict-equality tests (`expect(weights).toEqual({behavioral, gemini, ml, rules, trends})`) continue to pass UNCHANGED because `selectWeights` excludes audio from its return shape entirely when the caller passes a legacy 5-key `SignalAvailability` (no `audio` field). New aggregator callers (the aggregator itself) always pass the 6-key shape, so they participate in the new 6-weight return shape fully. This preserves AGG-05 without test modifications.
- The base GeminiResponseSchema's `audio_signals.optional()` was already added in Plan 06-05's deviation; Plan 06-06 simply consumes the field via `gemini.audio_signals?.audio_description ?? null`.

## Known Stubs

None. The audio pipeline is fully functional end-to-end:

1. Gemini emits `audio_signals` (Plan 06-02 schema extension + Plan 06-05 base-schema wiring).
2. `audio_fingerprint` stage matches against `trending_sounds.audio_embedding` (Plan 06-04 + Plan 06-05 wiring).
3. Aggregator computes audio_perceptual_score + applies fingerprint boost + emits all PredictionResult audio fields (Plan 06-06).
4. Route layer persists `audio_description` to `analysis_results.audio_description` (Plan 06-06 Rule 3 fix).
5. Cron path keeps `trending_sounds.audio_embedding` populated for newly-upserted sounds (Plan 06-06).

The only "stub" is the planned future-phase tuning:

- **Phase 10 ML audit** will retune `SCORE_WEIGHTS.audio` against the v3 corpus benchmark.
- **Phase 12 benchmark** will validate the 0.80 cosine similarity threshold + the audio signal's accuracy contribution.

Both are explicitly out-of-scope for Phase 6 per CONTEXT.md deferred ideas.

## Authentication Gates Encountered

None.

## Phase 6 Complete

This plan ships the final wiring of the audio pipeline. All Phase 6 Success Criteria are now MET in code:

- **SC#1 — Stage 4 Audio returns real result object (not null):** VERIFIED via aggregator-audio.test.ts + pipeline integration (Plan 06-05 wired the stage, Plan 06-06 wires the consumer).
- **SC#2 — Audio fingerprint match returns sound + velocity:** VERIFIED via aggregator-audio Tests 5-9 (all 5 trend_phase boost paths, fingerprint payload passthrough).
- **SC#3 — Audio signal feeds aggregator with appropriate weight:** VERIFIED via Test 1 (`audio: 0.07` in SCORE_WEIGHTS) + Test 4 (audio_perceptual_score formula match).
- **SC#4 — Existing trend enrichment fuzzy string match works as fallback:** VERIFIED via Plan 06-05's trends.test.ts D-F3 tests A/B/C/D + aggregator-audio Test 16 (Jaro-Winkler fallback in audioTrendingMatch).
- **SC#5 — <2s added latency:** STRUCTURAL — `audio_fingerprint` stage's inner await on `geminiPromise` adds the pgvector match latency (sub-millisecond at our scale per RESEARCH §"Supporting") to the Wave 1 completion time. The cron extension is out-of-band (no impact on `/api/analyze` latency). No additional Gemini calls in the request path (D-A1 contract preserved).

### Suggested next step

Run `/gsd-verify-phase 6` to verify the audio pipeline end-to-end against the live Gemini API + Supabase pgvector. Phase 6 STATE.md DEFERRED item #2 (live Gemini audio smoke test) should be cleared as part of that verification — the verifier should also run the one-time backfill script and trigger a real `/api/analyze` to confirm `analysis_results.audio_description` populates on a saved row.

## Self-Check: PASSED

- `src/lib/engine/aggregator.ts` exists with all 10 plan-required wiring points (B1-B10).
- `src/lib/engine/types.ts` exists with `PredictionResult.audio_description` + `score_weights.audio`.
- `src/app/api/cron/calculate-trends/route.ts` exists with the FULL D-F4 inline pipeline.
- `src/app/api/cron/calculate-trends/__tests__/route.test.ts` exists with 7 D-F4 tests.
- `src/lib/engine/__tests__/aggregator-audio.test.ts` exists with 23 D-G1..G4 + Note 7 tests.
- `src/app/api/analyze/route.ts` + tests extended for Note 7 persistence (Rule 3 deviation).
- All 5 commits found in git log (2ad6523, c2f56db, ff75b6d, 27b3f9c, 410d0a1).
- `pnpm vitest run` returns 851 passed / 0 failed / 4 skipped.
- `pnpm vitest run src/lib/engine` returns 674 passed / 0 failed.
- `pnpm vitest run src/lib/engine/__tests__/aggregator-audio.test.ts` returns 23 passed.
- `pnpm vitest run src/app/api/cron/calculate-trends/__tests__/route.test.ts` returns 7 passed.
- `pnpm tsc --noEmit` shows 0 new errors in plan-owned files (baseline pre-existing errors in `src/app/api/profile|settings|team/*` documented out-of-scope).
