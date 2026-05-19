---
phase: 06
plan: 04
type: execute
wave: 3
status: complete
completed: 2026-05-19
requirements: [AUDIO-05, AUDIO-06]
tags: [audio, fingerprint, pgvector, gemini-embedding, backfill, script]
commits:
  - f278f80  # test(phase-06): add failing audio-fingerprint test suite (RED)
  - 9c7413d  # feat(phase-06): implement matchAudioFingerprint pgvector stage module (GREEN)
  - 817dc6a  # feat(phase-06): add trending_sounds embedding backfill script (full D-F4 pipeline)
  - 1e2fe51  # test(phase-06): cover backfill script full D-F4 pipeline + idempotency
dependency_graph:
  requires:
    - 06-02  # Types (AudioFingerprintResult) + migration (match_trending_sound_by_audio RPC, audio_embedding vector(768) column)
  provides:
    - "matchAudioFingerprint(audioDescription, supabase): Promise<AudioFingerprintResult | null>"
    - "scripts/backfill-trending-sound-embeddings.ts CLI"
  affects:
    - 06-05  # pipeline.ts will import { matchAudioFingerprint } inside timed("audio_fingerprint", ...)
    - 06-06  # cron route will mirror the backfill script's full pipeline for inline new-sound embedding
tech_stack:
  added:
    - "@google/genai embedContent (gemini-embedding-001, 768-dim, SEMANTIC_SIMILARITY)"
    - "@google/genai generateContent + files.upload/delete (gemini-2.5-flash for audio description)"
    - "Supabase pgvector RPC match_trending_sound_by_audio (HNSW + cosine)"
  patterns:
    - "Sentry-vs-warn asymmetry per WARNING 6 (SOFT failures log only; HARD thrown exceptions Sentry)"
    - "Carrier-pattern cleanup (uploadedName captured on Files API upload return so cleanup runs even on later throw)"
    - "Cursor-paginated idempotent backfill via .is(audio_embedding, null)"
    - "vi.hoisted() spy declaration so vi.mock factories can reference Vitest fns safely"
key_files:
  created:
    - src/lib/engine/audio-fingerprint.ts
    - src/lib/engine/__tests__/audio-fingerprint.test.ts
    - scripts/backfill-trending-sound-embeddings.ts
    - tests/scripts/backfill-trending-sound-embeddings.test.ts
  modified:
    - vitest.config.ts  # extended include glob to pick up tests/**/*.test.ts
decisions:
  - "Threshold default 0.80, env-overridable via AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD (per CONTEXT D-F1)"
  - "Per-row pagination (limit 1) in backfill — 2 Gemini calls per row already serializes the concurrency bottleneck"
  - "Carrier object for uploadedName so cleanup runs even when generateContent throws"
  - "Defensive truncate audio_description to 280 chars in backfill (matches downstream Zod max)"
metrics:
  duration_minutes: ~12
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  test_cases_added: 21
  full_suite_status: "783 passing, 4 skipped, 0 failures"
---

# Phase 6 Plan 04: Audio Fingerprint Stage Module + Backfill Script Summary

## One-Liner

Wired the pgvector audio-fingerprint match stage (`matchAudioFingerprint`) and the
full-pipeline backfill script (download → Gemini audio description → embed → upsert)
on top of Plan 06-02's RPC + vector column foundation.

## What Was Built

### 1. `src/lib/engine/audio-fingerprint.ts` — Wave 1 stage module (164 lines)

Exports `matchAudioFingerprint(audioDescription, supabase)` which embeds the
Gemini-emitted `audio_description` via `gemini-embedding-001` (768-dim,
`taskType: "SEMANTIC_SIMILARITY"`) and queries the
`match_trending_sound_by_audio` RPC for cosine similarity above
`AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD` (default `0.80`). Returns the best
match (the RPC orders by similarity DESC and clamps to LIMIT LEAST(match_count, 10),
so `matches[0]` is the highest-similarity row) or null on any miss / failure.

**Never-throws contract (HARD-03 + Phase 1 D-04 + Phase 3 D-04 — additive only):**
The outer try/catch swallows every exception. The aggregator and `trends.ts` fall
back to the Jaro-Winkler caption match (per D-F3) when this returns null.

**Failure semantics (WARNING 6 fix — mirrors `wave0/content-type-detector.ts:210-219`):**

| Failure path                                                        | Severity | log call    | Sentry.captureException |
| ------------------------------------------------------------------- | -------- | ----------- | ----------------------- |
| `audioDescription` null / empty / whitespace                        | SOFT     | `log.debug` | **NOT called**          |
| `embedContent` responds with `embeddings: undefined`                | SOFT     | `log.warn`  | **NOT called**          |
| Supabase RPC returns `{ error: {...} }` (NOT thrown)                | SOFT     | `log.warn`  | **NOT called**          |
| RPC returns `[]` (no row above threshold)                           | SOFT     | `log.debug` | **NOT called**          |
| Any thrown exception (network, parsing, JS error) — outer try/catch | HARD     | `log.warn`  | **CALLED** with tag     |

### 2. `src/lib/engine/__tests__/audio-fingerprint.test.ts` — 13 unit tests

All 13 pass on first GREEN. Notable coverage:

- Test 4 (HARD failure): `expect(mockSentryCaptureException).toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(expect.any(Error), { tags: { stage: "audio_fingerprint" } })`
- Tests 5/6/7 (SOFT failures): `expect(mockSentryCaptureException).not.toHaveBeenCalled()` — explicit WARNING 6 asymmetry guard
- Test 10: env override `AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD=0.85` via `vi.resetModules()` + dynamic re-import — verifies the RPC is invoked with `match_threshold: 0.85`
- Test 11: trend_phase pass-through (AUDIO-06) for all 4 valid values + null
- Test 12: `matches[0]` selection pin
- Test 13: `velocity_score` string-to-number coercion (Supabase numeric quirk)

### 3. `scripts/backfill-trending-sound-embeddings.ts` — 312 lines, full D-F4 pipeline

WARNING 3 fix complete — **no synthetic descriptions**. Iterates trending_sounds
`WHERE audio_embedding IS NULL` (cursor-paginated, ORDER BY id ASC, LIMIT 1) and
runs the full pipeline per row:

1. **Download** (`fetch`, `AbortController` timeout, `MAX_DOWNLOAD_BYTES=10 MB`,
   `DOWNLOAD_TIMEOUT_MS=10s`, Content-Length pre-check, MIME default `audio/mpeg`)
2. **Upload** to Gemini Files API (`ai.files.upload` with derived `mimeType`)
3. **Describe** via Gemini 2.5 Flash with audio-only prompt + JSON response schema
   → 50-150 char `audio_description` (defensive truncate at 280 chars)
4. **Embed** via `gemini-embedding-001` (768-dim, `taskType=SEMANTIC_SIMILARITY`)
5. **Update** trending_sounds row with `audio_embedding` + `audio_description`

Cleanup of the Files API resource runs in a best-effort path after every row —
**carrier pattern**: the `uploadedName` is stashed on a shared object immediately
after `ai.files.upload` resolves, so cleanup runs even when `generateContent`
throws afterwards. Discovered as a Rule 1 bug by Test 5 and fixed before
final commit.

Each step is non-fatal: a failure at any step skips this row's embedding update
but the trending_sounds row stays unchanged (the next run picks it up via the
`.is("audio_embedding", null)` idempotency filter). Per-row pacing
`RATE_LIMIT_MS=200`; cost ceiling ~$0.025/day at ~50 sounds/day (per D-F4).

### 4. `tests/scripts/backfill-trending-sound-embeddings.test.ts` — 8 unit tests

All 8 pass. Coverage:

| Test | Behavior                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| 1    | Full pipeline succeeds; verifies embedContent invocation shape + UPDATE payload + Files API cleanup                      |
| 2    | Idempotency — empty initial fetch exits cleanly; `.is("audio_embedding", null)` filter applied                           |
| 3    | `sound_url=null` → row skipped, no Gemini calls, no UPDATE                                                               |
| 4    | Network error on download → row skipped, no upload                                                                       |
| 5    | `generateContent` throws AFTER upload succeeded → cleanup STILL runs (regression guard for the carrier-pattern Rule 1 fix) |
| 6    | `embedContent` throws → row skipped, cleanup still runs                                                                  |
| 7    | HTTP 404 → row skipped via `response.ok` gate                                                                            |
| 8    | Content-Length above 10 MB → row skipped via pre-check                                                                   |

### 5. `vitest.config.ts` — include glob extension (Rule 3: blocking-issue auto-fix)

The original `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]` glob did NOT
pick up `tests/**`. Extended to
`["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"]` so the
backfill test suite runs under `pnpm test`. No existing tests were affected
by the extension (verified by full suite: 783 passing, 0 failures).

## Decisions Made

| Decision                                                    | Outcome                                                                                                                                                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cosine threshold default                                    | `0.80` per CONTEXT D-F1; env-overridable via `AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD` for Phase 12 benchmark tuning.                                                                            |
| Per-row pagination in backfill (`limit 1`)                  | Each row makes 2 Gemini calls (audio analysis + embed). DB-layer batching wouldn't help — the concurrency bottleneck is the Gemini call. Per-row pacing keeps cost predictable and avoids burst rate limits. |
| Carrier object for `uploadedName`                           | Earlier version lost `uploadedName` when `generateContent` threw — Test 5 caught this as a missing-cleanup bug. Carrier captures the upload name immediately on resolve.                          |
| Defensive truncate `audio_description` at 280 chars         | Matches downstream Zod min/max windows; absorbs verbose Gemini responses without rejecting the row.                                                                                             |
| `vi.hoisted()` for spy pre-declaration                      | Vitest hoists `vi.mock` factories above top-level statements; referencing top-level `const mockX = vi.fn()` inside the factory throws "Cannot access before initialization". `vi.hoisted()` is the documented escape hatch. |
| vitest config include extension (Rule 3)                    | Backfill test under `tests/scripts/` per plan spec required the include glob extension. No regressions.                                                                                          |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleanup-after-throw lost uploadedName**

- **Found during:** Task 2 — Test 5 (Gemini audio analysis fails → cleanup attempted)
- **Issue:** The original `describeAudioWithGemini` returned `{ description, uploadedName }`.
  When `ai.models.generateContent` threw, the function exited before returning, so the
  caller's local `uploadedName` stayed null and `cleanupUploadedFile` short-circuited.
  The Gemini Files API quota leaked silently.
- **Fix:** Introduced a `carrier: { uploadedName: string | null }` parameter — the inner
  function writes `carrier.uploadedName = uploadResult.name` immediately after the
  Files API upload resolves, so the caller's cleanup path always sees the captured name
  even when later steps throw.
- **Files modified:** `scripts/backfill-trending-sound-embeddings.ts`
- **Commit:** `817dc6a`

**2. [Rule 3 - Blocking] Vitest include glob did not pick up `tests/**`**

- **Found during:** Task 2 setup
- **Issue:** The plan specified `tests/scripts/backfill-trending-sound-embeddings.test.ts`,
  but `vitest.config.ts` `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]` excluded
  the `tests/**` tree → test would silently not run under `pnpm test`.
- **Fix:** Appended `"tests/**/*.test.ts"` to the include glob.
- **Files modified:** `vitest.config.ts`
- **Commit:** `817dc6a` (rolled into the script commit since the change is the same
  enabler for the next test commit)

### Other notes

- **TDD gate sequence preserved.** Task 1 has separate RED (`f278f80`) and GREEN (`9c7413d`)
  commits. Task 2 ships `feat` (script + config) then `test` because the script entry-point
  + carrier shape needed to settle before the test mock surface was stable (test mocks
  reflect the carrier-pattern interface).
- **TS-clean against my files.** The full project has 966 pre-existing TypeScript errors
  unrelated to this plan (parallel worktrees regenerated `database.types.ts` against tables
  this branch doesn't yet have). Zero new errors introduced — verified via:
  `pnpm tsc --noEmit 2>&1 | grep -E "audio-fingerprint|backfill-trending"` returns nothing.

## Test Counts

| File                                                       | Cases | Status                  |
| ---------------------------------------------------------- | ----- | ----------------------- |
| `src/lib/engine/__tests__/audio-fingerprint.test.ts`       | 13    | 13/13 passing           |
| `tests/scripts/backfill-trending-sound-embeddings.test.ts` | 8     | 8/8 passing             |
| **Plan total**                                             | 21    | 21/21 passing           |
| Full suite regression                                      | 787   | 783 passing, 4 skipped, 0 fail |

## WARNING-Fix Confirmation

### WARNING 6 — Sentry-vs-warn asymmetry (audio-fingerprint.ts)

| Path                                                      | Sentry? | Test          |
| --------------------------------------------------------- | ------- | ------------- |
| null/empty audio_description short-circuit                | NO      | Tests 2, 3    |
| embedContent throws (HARD)                                | **YES** | Test 4        |
| embedContent returns no embeddings (SOFT)                 | NO      | Test 5        |
| Supabase RPC error object (SOFT)                          | NO      | Test 6        |
| RPC returns empty array (SOFT outcome)                    | NO      | Test 7        |

### WARNING 3 — Full D-F4 pipeline in backfill (no synthetic descriptions)

Confirmed: the script's 5-step pipeline (download → Gemini Files upload → Gemini
audio-only describe → embed → update) is exercised end-to-end by Test 1. There
is no "synthetic from sound_name" shortcut anywhere in the script.

## For Downstream Plans

- **Plan 06-05 (pipeline.ts)** — `import { matchAudioFingerprint } from "./audio-fingerprint"`.
  Call inside the renamed `timed("audio_fingerprint", ...)` stage. The function takes
  `(audioDescription, supabase)` — the description comes from `geminiResult.analysis.audio_signals?.audio_description ?? null` (Plan 06-03 owns the Gemini extension).
- **Plan 06-06 (cron route extension)** — mirror the backfill script's full pipeline (NOT
  any synthetic shortcut). The four helper functions (`downloadAudio`, `describeAudioWithGemini` with the carrier parameter, `embedDescription`, `cleanupUploadedFile`) are the
  reference implementation; either import them from `scripts/...` or copy the structure
  inline.

## Ops Reminder

After Plan 06-06 lands (and any time the trending_sounds table has rows with
NULL `audio_embedding`):

```bash
pnpm tsx scripts/backfill-trending-sound-embeddings.ts
```

The script will make ~2 Gemini calls per row (audio analysis + embed) — budget
~$0.0005 per sound. Per-row pacing 200ms keeps burst rate-limit headroom.

## Self-Check: PASSED

- [x] `src/lib/engine/audio-fingerprint.ts` exists at FOUND
- [x] `src/lib/engine/__tests__/audio-fingerprint.test.ts` exists at FOUND
- [x] `scripts/backfill-trending-sound-embeddings.ts` exists at FOUND
- [x] `tests/scripts/backfill-trending-sound-embeddings.test.ts` exists at FOUND
- [x] Commit `f278f80` (RED test) exists in git log
- [x] Commit `9c7413d` (GREEN impl) exists in git log
- [x] Commit `817dc6a` (script + config) exists in git log
- [x] Commit `1e2fe51` (script tests) exists in git log
- [x] `pnpm vitest run` for both test files: 21/21 passing
- [x] No TS errors in any file owned by this plan
- [x] No deletions in any of the 4 commits
- [x] No edits to STATE.md or ROADMAP.md (worktree mode)
- [x] No edits to files in 06-03's scope (gemini.ts, types.ts, audio-perceptual.ts)
