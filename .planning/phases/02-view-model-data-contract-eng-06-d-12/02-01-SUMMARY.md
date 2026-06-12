---
phase: 02-view-model-data-contract-eng-06-d-12
plan: 01
subsystem: testing
tags: [vitest, fixtures, view-model, data-contract, smoke-pipeline, supabase]

# Dependency graph
requires:
  - phase: 01-design-system-foundation-brand-migration
    provides: verdict scale tokens (green/amber/clay) informing block shapes
provides:
  - "Smoke script capture step that dumps a REAL (live, persisted) fixture pair for the same analysis id into src/lib/reading/__tests__/fixtures/"
  - "Three RED test scaffolds (identical-render / view-model / verdict) collected by vitest, pending the Wave 2 build modules"
  - "fixtures README documenting the real-capture protocol + regen steps + PII gate"
affects: [02-02, 02-03, 02-04, view-model, from-persisted-row, verdict-bands, Phase-3-GATE]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED-scaffold-before-build: test files reference not-yet-built modules; vitest collects them, they fail on the missing import (Wave-0 state)"
    - "Real-fixture capture via smoke pipeline: settle-the-race poll (variants.apollo) then dump live+persisted pair; never hand-author"

key-files:
  created:
    - src/lib/reading/__tests__/identical-render.test.ts
    - src/lib/reading/__tests__/view-model.test.ts
    - src/lib/reading/__tests__/verdict.test.ts
    - src/lib/reading/__tests__/fixtures/README.md
  modified:
    - scripts/smoke-tiktok-pipeline.ts

key-decisions:
  - "persisted-<id>.json = RAW analysis_results row, not the /api/analysis/[id] enriched output — fromPersistedRow (D-11) consolidates the route shims, so it consumes the raw row"
  - "Capture reuses the user_id-scoped service-client query (route ownership filter NOT weakened); optional SMOKE_SESSION_COOKIE probes the live GET route end-to-end"
  - "Settle-the-race guard polls variants.apollo (Pitfall 2) and ABORTS with a clear message if it never settles — never writes a partial/fabricated fixture"
  - "identical-render.test.ts globs the fixtures dir so no analysis id is hardcoded"

patterns-established:
  - "Pattern: capture gated behind per-video gate_pass (a degraded run is not a faithful contract fixture)"
  - "Pattern: RED scaffold imports the Wave-2 module path; collection-success + import-failure is the intended Wave-0 signal"

requirements-completed: []  # DATA-02 NOT yet satisfied — real fixture pair not captured (Task 2 human-action pending)

# Metrics
duration: ~10min
completed: 2026-06-12
---

# Phase 2 Plan 01: View-Model Wave-0 Prerequisite Summary

**Smoke script extended to capture a REAL (live, persisted) fixture pair (race-guarded) plus three RED view-model test scaffolds collected by vitest — the live capture itself is blocked at a human-action checkpoint pending live infra.**

## Status: PARTIAL — paused at Task 2 (`checkpoint:human-action`)

Tasks 1 and 3 are complete and committed. Task 2 (running the live smoke
pipeline to produce the actual fixture pair) requires live infra + a UI video
upload that cannot be driven headlessly. Per the plan's success criteria and the
sequential-execution mandate, the real fixture pair MUST come from a genuine
captured run — hand-authoring is unacceptable — so this plan is intentionally
left at the checkpoint rather than fabricating a fixture.

## Performance

- **Duration:** ~10 min (executor work; excludes the human-driven live run)
- **Started:** 2026-06-12T06:45:00Z
- **Tasks:** 2 of 3 complete (Task 2 = human-action checkpoint, pending)
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments

- `scripts/smoke-tiktok-pipeline.ts` now captures the `live-<id>.json` +
  `persisted-<id>.json` fixture pair for the SAME analysis id, with a
  settle-the-race poll on `variants.apollo` and a hard abort if it never settles.
- Three RED test scaffolds authored and confirmed COLLECTED by vitest (they fail
  on the not-yet-built `../view-model` / `../from-persisted-row` / `../verdict-bands`
  imports — the expected Wave-0 state, not a parse fault).
- Fixtures README documents that fixtures are real captures, the regen command,
  and the pre-commit PII review gate (T-02-01).

## Task Commits

1. **Task 1: Extend smoke script to capture the persisted row** - `754f6ce4` (feat)
2. **Task 3: Three RED test scaffolds + fixtures README** - `58c9c326` (test)

_Task 2 (live capture) is a human-action checkpoint — no commit; the human runs
the smoke pipeline and the script writes the fixtures._

## Files Created/Modified

- `scripts/smoke-tiktok-pipeline.ts` — added `captureReadingFixtures` +
  `fetchSettledPersistedRow` + `resolveAnalysisId`; wired into `main` behind
  `gate_pass`; carries raw live result / persisted row on the result object.
- `src/lib/reading/__tests__/identical-render.test.ts` — DATA-02/D-12 deep-equal
  contract; globs `./fixtures` for the pair.
- `src/lib/reading/__tests__/view-model.test.ts` — DATA-01/DATA-03/D-14 taxonomy +
  dropped-field prune (no `kind:'audio'` ever) + degradation cases.
- `src/lib/reading/__tests__/verdict.test.ts` — DATA-04 band + grounded why +
  confidence-language + `/100` demotion.
- `src/lib/reading/__tests__/fixtures/README.md` — real-capture protocol.

## Decisions Made

- **Raw row, not enriched route output, for the persisted fixture.** `fromPersistedRow`
  (D-11) absorbs the `[id]/route.ts` reload shims, so it must consume the raw
  `analysis_results` row. The capture dumps the raw row.
- **Service-client user_id-scoped read for capture; ownership filter untouched.**
  Mirrors the route's `.eq("user_id", ...)`. Optional `SMOKE_SESSION_COOKIE`
  exercises the live HTTP reload route without weakening any auth.
- **Abort over fabricate.** If `variants.apollo` never settles, the capture aborts
  with a message rather than writing a partial fixture (Pitfall 2).

## Deviations from Plan

None — plan executed as written. Task 3 was authored ahead of the Task 2
human-action capture because the RED scaffolds are independent of the fixtures at
write-time (the contract test globs the fixtures dir at runtime), and the plan's
success criteria require the scaffolds regardless. No fabrication: the fixtures
themselves are NOT created by the executor.

## Issues Encountered

- **Task 2 is a hard human-action gate.** No dev server is running, no live API
  keys are exercised headlessly, and the smoke pipeline's video upload is
  interactive (UI + `waitForKeypress`). The executor cannot drive it. This is the
  documented single execution prerequisite of the phase (RESEARCH §Environment
  Availability) and is surfaced as a checkpoint, not worked around.

## User Setup Required

**To complete this plan, run the live capture (Task 2):**

1. Bring the dev stack up with live engine API keys + Supabase reachable:
   `pnpm dev` (http://localhost:3000). `.env.local` is present in this worktree.
2. Run the smoke pipeline for ONE real (synthetic) video, uploading via the
   dev-server UI when prompted:
   `pnpm tsx scripts/smoke-tiktok-pipeline.ts urls.txt`
   (project note: a short clip such as `~/Downloads/TikTok Video Downloader.mp4`).
3. Confirm two files exist under `src/lib/reading/__tests__/fixtures/`:
   `live-<id>.json` + `persisted-<id>.json` for the SAME `<id>`.
4. Open `persisted-<id>.json` — confirm `variants.apollo` is present (writes
   settled) and `heatmap` is present-or-null (real, not synthesized). Review for
   secrets/PII before committing (T-02-01).

See `src/lib/reading/__tests__/fixtures/README.md` for the full protocol.

## Next Phase Readiness

- **Blocked on:** the human-action live capture above. Until the real fixture
  pair lands, DATA-02 is unsatisfied and `identical-render.test.ts` will fail its
  "fixture pair exists" assertion (in addition to the missing-module RED).
- **Ready for Wave 2** regardless: the three scaffolds define the contract the
  build plans (`block-types.ts`, `verdict-bands.ts`, `from-persisted-row.ts`,
  `view-model.ts`) must satisfy. They turn green as those modules land + the
  fixtures are captured.
- **No engine edits, ENGINE_VERSION unchanged** (freeze respected).

## Self-Check: PASSED

All created files present on disk; both task commits (`754f6ce4`, `58c9c326`)
exist in git history. Task 2 (live fixture capture) remains a human-action
checkpoint — the `live-<id>.json` / `persisted-<id>.json` pair is intentionally
absent until the human runs the smoke pipeline.

## Task 2 — RESOLVED (2026-06-12)

The real fixture pair was captured. The smoke script's `--direct` mode can't
authenticate (`/api/analyze` requires a Supabase session; the direct POST sends
no cookie) and its UI mode writes the RAW row as the live half — the wrong shape
for `canonicalFromLive`, which reads `result.hero`/`result.apollo_reasoning`
TOP-LEVEL. Resolution: logged in as the e2e test user via Playwright, fired the
analysis through an in-browser authenticated `fetch` to `/api/analyze`
(tiktok_url mode, ~112s / 18 stages) to capture the genuine live `complete` SSE
payload, then `scripts/capture-reading-fixture.ts` paired it with the settled
persisted row (variants.apollo present).

- analysis `WEkihfOzJphv` (overall_score 71); `live-WEkihfOzJphv.json` +
  `persisted-WEkihfOzJphv.json` committed (`4350612f`).
- PII-reviewed: no secrets/tokens/emails; synthetic e2e test user; tiktok_url
  mode (`video_storage_path` null).
- `identical-render.test.ts` (DATA-02/D-12, the crux) GREEN; full
  `src/lib/reading` suite 31/31.

---
*Phase: 02-view-model-data-contract-eng-06-d-12*
*Status: COMPLETE — all 3 tasks done (Task 2 resolved 2026-06-12)*
*Completed: 2026-06-12*
