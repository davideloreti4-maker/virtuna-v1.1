# Phase 02 — Deferred Items (out-of-scope discoveries)

Items logged here were discovered during Phase 02 execution but fall OUTSIDE
this phase's scope (no direct relation to the 9-card creator profile work).
They are tracked here per the executor SCOPE BOUNDARY rule.

## Pre-existing test failures (not introduced by Phase 02)

Discovered during Plan 02-06 plan-level verification (full `pnpm test --run`).
Both failures exist at parent commit `39cadb3` (before Task 3) and at every
prior Phase 02 commit — confirmed via stash-and-checkout reproduction.

### 1. `src/lib/engine/__tests__/video-e2e.test.ts`

- **Failure:** `ENOENT: no such file or directory, open '/Users/davideloreti/virtuna-v1.1/ssstik.io_@agentoflaughter_1771597963788.mp4'`
- **Root cause:** Test file hardcodes an absolute path to a sibling-worktree
  (`/Users/davideloreti/virtuna-v1.1/...`) that doesn't exist in the
  `virtuna-engine-foundation` worktree.
- **Origin commit:** `5827a15 feat(engine): add video E2E test and fix video upload flow`
- **Suggested fix (out of scope for Phase 02):** Make `VIDEO_PATH` env-driven or
  skip the test when the file is missing. Belongs in a Phase 03+ test-infra plan
  or a small chore PR.

### 2. `src/lib/engine/__tests__/cost-benchmark.test.ts`

- **Failure:** "30-second video — full Wave 1 + Wave 2" and "60-second video — full
  Wave 1 + Wave 2" both fail because `test-30s.mp4` / `test-60s.mp4` are not
  present in the worktree.
- **Root cause:** Same as above — fixture files missing.
- **Origin commit:** `5827a15` (same as video-e2e.test.ts).
- **Suggested fix (out of scope for Phase 02):** Move the fixtures into a test-asset
  bundle, or guard the tests with `it.skipIf(!existsSync(fixturePath))`.

**Disposition:** Defer to phase-03+ infrastructure work. Not blocking Phase 02
sign-off — verifier should expect 3 unrelated `pnpm test --run` failures until
the fixture handling is reworked.
