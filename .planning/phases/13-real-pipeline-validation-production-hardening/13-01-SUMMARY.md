---
phase: 13
plan: "01"
subsystem: engine-validation
tags: [gemini-self-test, caption-audit, phase12-cleanup, cache-invalidation, D-21, D-13, D-23, D-29, D-32]
dependency_graph:
  requires: []
  provides:
    - "Gemini model verdict (BARE vs PREVIEW) for Plan 02 -preview decision"
    - "Caption-less audit verdicts (DISABLE/ACCEPT/DOCUMENT/REBUILD) gating Plan 02-03"
    - "D-23 cache version-invalidation regression test"
    - "trending_sounds population count (0 rows) for audio weight decision"
    - "Phase 12 obsolete env inventory for Plan 02/03 removal tasks"
    - "URL seed file templates for Plans 05-07 E2E"
  affects:
    - "Plan 02 -preview suffix decision (PREVIEW form required)"
    - "Plan 02 signal weights (D-14 rules=0, D-15 retrieval=0, D-16 redistribution)"
    - "Plan 03 Wave 0 niche fold (D-17)"
    - "Plan 08 ENGINE_VERSION flip (D-23 cache gate)"
tech_stack:
  added: []
  patterns:
    - "GoogleGenAI ai.models.generateContent probe pattern (same as smoke-test-gemini-audio.ts)"
    - "response.modelVersion field for model identity assertion (Assumption A3 locked)"
    - "vitest vi.doMock + vi.resetModules pattern for version simulation"
key_files:
  created:
    - scripts/engine-self-test.ts
    - scripts/urls-1.txt
    - scripts/urls-5.txt
    - scripts/urls-10.txt
    - .planning/phases/13-real-pipeline-validation-production-hardening/13-AUDIT-CAPTION-LESS.md
    - .planning/phases/13-real-pipeline-validation-production-hardening/13-PHASE12-CLEANUP.md
  modified:
    - src/lib/engine/__tests__/prediction-cache.test.ts
    - .planning/phases/13-real-pipeline-validation-production-hardening/13-VALIDATION.md
decisions:
  - "Gemini self-test verdict: KEEP -preview suffix — bare forms 404 for hook/body/cta/stage11; only gemini-3.1-flash-lite (wave0) works bare. Plan 02 must NOT drop -preview."
  - "trending_sounds population probe: 0 rows (table empty). Audio weight revised to 0.05 (not 0.07 or 0.10 — user decision); backfill skipped, not a priority."
  - "tiktok_url video-bytes status (doc level): NO — content-type-detector.ts:87 explicitly skips non-video_upload mode. Runtime probe in Plan 05 Task 5.2."
  - "Test infrastructure fixed: installed @testing-library/jest-dom@6.9.1 + happy-dom@20.9.0 into main repo node_modules (pre-existing worktree issue)."
  - "D-23 tests added to existing src/lib/engine/__tests__/prediction-cache.test.ts (not cache/ subdirectory — existing test file location takes precedence)."
metrics:
  duration_minutes: 7
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 4
  files_created: 7
  files_modified: 2
---

# Phase 13 Plan 01: Gemini Self-Test + Caption Audit + D-23 Cache Gate Summary

Phase 13 Plan 01 builds the foundational gates that all other Phase 13 plans depend on: a live Gemini model self-test, a comprehensive caption-less engine audit, Phase 12 archival docs, and a D-23 cache version-invalidation regression test.

---

## Gemini Self-Test Verdict (D-21 — critical for Plan 02)

**Verdict: KEEP `-preview` suffix — bare form NOT usable for hook/body/cta/stage11.**

Live probe results from `pnpm tsx scripts/engine-self-test.ts`:

| Slot | Bare form | Preview form |
|------|-----------|-------------|
| wave0 (`gemini-3.1-flash-lite`) | PASS | FAIL (preview returns bare name — not a match) |
| hook (`gemini-3.1-pro`) | FAIL 404 | PASS |
| body (`gemini-3-flash`) | FAIL 404 | PASS |
| cta (`gemini-3-flash`) | FAIL 404 | PASS |
| stage11 (`gemini-3.1-pro`) | FAIL 404 | PASS |

**Summary: bare-form 1/5 match · preview-form 4/5 match**

- `gemini-3.1-flash-lite` is GA (bare works for wave0)
- `gemini-3.1-pro` and `gemini-3-flash` return 404 without `-preview` suffix
- `gemini-3.1-flash-lite-preview` returns the bare model name in response (no "-preview" in modelVersion)

**Decision for Plan 02:** Do NOT drop `-preview` suffix from hook/body/cta/stage11. Plan 02 D-09 `-preview` drop cannot proceed for these slots. Plan 02 should use:
- `GEMINI_WAVE0_MODEL`: `gemini-3.1-flash-lite` (bare — GA)
- `GEMINI_HOOK_MODEL`: `gemini-3.1-pro-preview` (keep preview)
- `GEMINI_BODY_MODEL`: `gemini-3-flash-preview` (keep preview)
- `GEMINI_CTA_MODEL`: `gemini-3-flash-preview` (keep preview)
- `GEMINI_STAGE11_MODEL`: `gemini-3.1-pro-preview` (keep preview)

**First-response-shape keys (A3 locked):** `["sdkHttpResponse","candidates","modelVersion","responseId","usageMetadata"]`

---

## trending_sounds Count + Audio Weight Decision (D-32)

**Probe result:** 0 rows with `audio_embedding IS NOT NULL` (table is empty)

**Decision (approved 2026-05-22):** Audio weight → **0.05** (revised downward from D-16 plan target of 0.10). trending_sounds is empty; backfill not a priority. `audio_perceptual_score` (Gemini-derived) is real signal but conservative weight reflects zero fingerprint-match contribution. Plan 02 uses `audio: 0.05` in SCORE_WEIGHTS. No backfill before Plan 07 E2E.

---

## tiktok_url Video-Bytes Status (D-31 — doc level)

**Answer: NO — tiktok_url mode does NOT get video bytes into Wave 1 (confirmed + approved as permanent architecture for Phase 13).**

Evidence: `src/lib/engine/wave0/content-type-detector.ts:87`
```typescript
if (payload.input_mode !== "video_upload" || !payload.video_storage_path) {
  // Graceful skip — returns null
  return null;
}
```

TikTok URL mode runs metadata-only analysis (niche from text + DeepSeek reasoning on Gemini text signals). Signal availability: `gemini=false`, `gemini_hook=false`. Full video-download for tiktok_url mode is **deferred to Milestone 2 (Intelligence Surface)** as a backlog item. Plan 05 Task 5.2 runtime verification confirms the metadata-only path behaves correctly end-to-end.

---

## Pre-Existing Test Count (D-24)

**Count: 89 test files** in `src/` directory (captured 2026-05-22). Individual test count estimated ~1000-1500 (consistent with Assumption A7 ~1191).

**Categories most at risk from Plan 02 changes:**
- Aggregator weight assertions (ALL weights change per D-16)
- Rules scoring assertions (D-14: rules weight=0)
- Retrieval contribution assertions (D-15: retrieval weight=0)
- Stage 11 shape tests (D-02: complete rebuild DeepSeek→Gemini)

Expected: 40-60 test failures after Plan 02 ships. These are expected and must be fixed in Plan 02 (CI red blocks milestone merge, D-24).

---

## BLOCKER-2 Attestation (D-11/D-12)

`13-AUDIT-CAPTION-LESS.md` contains:
- D-12 per-mode contract table for video_upload, tiktok_url, text-only
- D-11 SCORE_WEIGHTS cross-reference: caption field appears in 0/8 weight calculations post-Plan-02
- SCORE_WEIGHTS map quoted inline with post-Plan-02 values

BLOCKER-2 resolved by this plan.

---

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1.1 — engine-self-test + URL seeds | `38078a3` | `scripts/engine-self-test.ts`, `scripts/urls-{1,5,10}.txt`, `13-VALIDATION.md` |
| 1.2 — Caption audit + Phase 12 cleanup | `41cd203` | `13-AUDIT-CAPTION-LESS.md`, `13-PHASE12-CLEANUP.md` |
| 1.3 — D-23 cache version test | `e11d337` | `src/lib/engine/__tests__/prediction-cache.test.ts` |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing test infrastructure broken in worktree**
- **Found during:** Task 1.3 (verifying vitest run)
- **Issue:** Worktree vitest suite failing with 0 tests due to missing `@testing-library/jest-dom` and `happy-dom` devDependencies not installed in main repo node_modules
- **Fix:** `pnpm add -D @testing-library/jest-dom happy-dom` from main repo — restores test infrastructure for all engine tests
- **Files modified:** `node_modules` only (package-lock-equivalent in pnpm)
- **Commit:** inline with Task 1.3 (not a separate commit — node_modules not tracked)

**2. [Deviation - Target file] D-23 tests added to existing test file, not cache/ subdirectory**
- **Found during:** Task 1.3 planning
- **Issue:** Plan says `src/lib/engine/cache/__tests__/prediction-cache.test.ts` but existing tests live at `src/lib/engine/__tests__/prediction-cache.test.ts` — no `cache/__tests__/` directory exists
- **Fix:** Added D-23 describe block to the existing test file location; avoids duplicate coverage and respects CLAUDE.md "prefer editing existing files"
- **Files modified:** `src/lib/engine/__tests__/prediction-cache.test.ts`
- **Commit:** e11d337

**3. [Deviation - Self-test exit code] Partial match returns exit(0) not exit(1)**
- **Found during:** Task 1.1 implementation
- **Issue:** Plan spec says exit(1) only if "a slot fully fails in BOTH forms" — the live run produces 1/5 bare + 4/5 preview (partial match). Added a `PARTIAL MATCH` verdict path that exits 0 with a warning rather than blocking Plan 02 entirely
- **Fix:** Added explicit partial-match handling with diagnostic output; Plan 02 still has the information it needs (which slots need -preview)
- **Files modified:** `scripts/engine-self-test.ts`

---

## Known Stubs

None — all artifacts contain real data (live Gemini probe result, actual file:line audit references, real trending_sounds count, actual test file count).

---

## Threat Flags

None — `engine-self-test.ts` logs only `modelVersion` field and top-level response keys (no PII, no API key echo). Audit doc contains no API keys or TikTok user data. Threat model T-13-01 through T-13-05 mitigations verified as implemented.

---

## Self-Check: PASSED

- [x] `scripts/engine-self-test.ts` exists: FOUND
- [x] `scripts/urls-1.txt`, `urls-5.txt`, `urls-10.txt` exist: FOUND
- [x] `13-AUDIT-CAPTION-LESS.md` exists: FOUND
- [x] `13-PHASE12-CLEANUP.md` exists: FOUND
- [x] Commits 38078a3, 41cd203, e11d337 exist in git log: VERIFIED
- [x] 19 prediction-cache tests passing (16 existing + 3 D-23 new)
- [x] Checkpoint 1.4 returned with four decisions documented below

## Checkpoint 1.4 Four Decisions — APPROVED 2026-05-22

**(a) Preview-suffix verdict: KEEP `-preview` on hook/body/cta/stage11.**
`gemini-3.1-flash-lite` stays bare for wave0. Plan 02 must keep `-preview` on the 4 remaining slots. D-09 bare-form drop is blocked for those slots.

**(b) Audio weight: 0.05** (not 0.07 or 0.10).
D-16 revised downward from the 0.10 plan target. trending_sounds table is empty; audio_perceptual_score signal is real but user wants a more conservative weight given no fingerprint match data yet. Plan 02 must use `audio: 0.05` in the D-16 SCORE_WEIGHTS update.

**(c) trending_sounds remediation: SKIP for now.**
Backfill is not a priority at this stage. Plan 07 E2E will proceed with 0 fingerprint match contribution. No remediation action before Plan 07.

**(d) tiktok_url video-bytes: metadata-only confirmed at doc level. Video-download deferred to Milestone 2.**
`content-type-detector.ts:87` skip is the current architecture. tiktok_url will remain metadata-only in Phase 13. Full video-download for tiktok_url mode is a backlog item for the Intelligence Surface milestone (M2). Plan 05 Task 5.2 runtime verification still runs to confirm the metadata-only path behaves correctly end-to-end.
