---
phase: 11-explore-audience-curated-discovery
plan: 08
subsystem: database
tags: [supabase, migration, database-types, tracked-accounts, engine-regression-gate, explore]

# Dependency graph
requires:
  - phase: 11-02
    provides: tracked_accounts migration (20260620090000_tracked_accounts.sql) + tracked-accounts-repo + GET/POST /api/tracked-accounts
  - phase: 11-03
    provides: tracked-accounts-repo with interim (supabase as any) casts pending the regen
  - phase: 11-04
    provides: runExplorePipeline + POST /api/tools/explore (the non-scoring SSE route this gate proves compiles end-to-end)
  - phase: 11-07
    provides: Explore wired into composer (now reachable → must compile in the full build)
provides:
  - "Live tracked_accounts table + tracked_all_own RLS policy on Supabase project qyxvxleheckijapurisj (applied via MCP apply_migration in Task 1 by the orchestrator)"
  - "src/types/database.types.ts regenerated from the live schema — tracked_accounts now typed (Row/Insert/Update at line ~1800)"
  - "tracked-accounts-repo uses the typed client directly — the 3 interim (supabase as any) casts dropped, behavior byte-identical"
  - "BLOCKING regression gate GREEN: ENGINE_VERSION frozen at 3.19.0, engine+KC 1191 green, full suite 2941 green, build OK"
affects: [12-library-acts-state-ia, 13-proactive-numen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live schema push + database.types.ts regen + cast cleanup in a final BLOCKING wave (mirrors 07-05, 10-07) — types come from the generated file, so the phase cannot pass verification without this push"
    - "Post-regen typed-query convention: from(\"table\") on the typed client with no cast; DB string columns narrowed to domain unions on the boundary return cast (shelf-repo idiom)"
    - "Phase-scoped lint convention (from 11-05): lint the touched file(s), not the pre-existing repo-wide baseline"

key-files:
  created: []
  modified:
    - src/lib/tracked-accounts/tracked-accounts-repo.ts
    - src/types/database.types.ts  # Task 1 (orchestrator, commit 63375675) — listed for provenance
    - .planning/phases/11-explore-audience-curated-discovery-expansion-not-yet-discuss/deferred-items.md

key-decisions:
  - "Types path correction: the regenerated types live at src/types/database.types.ts, NOT the plan frontmatter's src/lib/database.types.ts (that path does not exist in this repo) — real path used everywhere"
  - "All 3 (supabase as any) casts (list/upsert/delete) dropped — the regenerated tracked_accounts type resolves every from() call; no residual cast was needed (the upsert onConflict typed cleanly)"
  - "DB types platform as `string`; domain TrackedAccountPlatform union narrowing kept on the boundary return cast (data as TrackedAccount[] / as TrackedAccount), matching shelf-repo"
  - "ENGINE_VERSION stays 3.19.0 — Explore made zero video-scoring changes (Pitfall 6); version.ts last touched 2026-06-11, pre-Phase-11, no revert needed"
  - "Repo-wide eslint baseline (63 errors / 98 warnings, all pre-existing in Phase-07-and-earlier files) NOT fixed — out-of-scope per SCOPE BOUNDARY + explicit task instruction; logged to deferred-items.md (mirrors the 46 pre-existing tsc errors already there)"

patterns-established:
  - "Final-wave cast cleanup: once a table lands in database.types.ts, drop the interim (supabase as any) casts AND their now-unused eslint-disable comments together (the disable itself trips lint if left)"

requirements-completed: [EXPLORE-05]

# Metrics
duration: 12min
completed: 2026-06-20
---

# Phase 11 Plan 08: Live tracked_accounts Push + Types Regen + Engine Regression Gate Summary

**tracked_accounts is live + typed in src/types/database.types.ts, the interim (supabase as any) casts are dropped from the watchlist repo, and the BLOCKING regression gate is green (ENGINE_VERSION frozen at 3.19.0, 2941 tests green, build OK) — closing Phase 11's code path; only the human end-to-end UAT (Task 4) remains.**

## Performance

- **Duration:** ~12 min (Tasks 2 + 3; Task 1 done earlier by the orchestrator)
- **Started:** 2026-06-20T13:14:00Z (Task 2)
- **Completed:** 2026-06-20T13:25:00Z
- **Tasks:** 2 of 4 executed here (Task 1 = orchestrator; Task 4 = PENDING human UAT)
- **Files modified:** 2 source/types + 1 deferred-items log (this wave)

## Accomplishments

- **Task 2 — cast cleanup:** dropped all 3 interim `(supabase as any)` casts in `tracked-accounts-repo.ts` (`listTrackedAccounts` / `createTrackedAccount` upsert / `deleteTrackedAccount`). The typed client now resolves every `from("tracked_accounts")` call. Behavior byte-identical: same session-derived `user_id` (CR-01), same idempotent `upsert({ onConflict: "user_id,platform,handle" })`, same normalize-handle + zod validation. Repo unit test **8/8 green**; repo `tsc` **clean**; eslint **clean**.
- **Task 3 — BLOCKING regression gate GREEN:**
  - `ENGINE_VERSION === "3.19.0"` **unchanged** (Explore touched no video-scoring bytes, Pitfall 6).
  - Engine + KC suites: **93 files, 1191 passing / 20 skipped** (incl. `version.test.ts` + `audience-regression-gate.test.ts`).
  - Full suite: **289 files, 2941 passing / 28 skipped** — exactly the authoritative baseline.
  - `npm run build`: **✓ Compiled successfully** (regenerated types compile end-to-end; `/api/tracked-accounts` + `/home` Explore reachable in the route tree).
  - Lint: touched file clean; repo-wide pre-existing baseline noted (not fixed, out-of-scope).

## Task Commits

1. **Task 1: Apply tracked_accounts migration to live Supabase + regenerate types** — `63375675` (feat) — *done by the orchestrator before this agent ran.* Applied `20260620090000_tracked_accounts.sql` to live project `qyxvxleheckijapurisj` via MCP `apply_migration`; verified table + `tracked_all_own` RLS exist (0 rows); regenerated `src/types/database.types.ts` (tracked_accounts typed).
2. **Task 2: Drop interim (supabase as any) casts in tracked-accounts-repo post-regen** — `93bbd57f` (feat)
3. **Task 3: BLOCKING regression gate (ENGINE_VERSION 3.19.0, engine+KC + full suite, build, lint)** — no source commit (gate only; the lone non-code artifact is the deferred-items.md lint note, folded into the plan-metadata commit).
4. **Task 4: End-to-end Explore UAT** — **PENDING human verification** (see below). Not attempted by this agent.

**Plan metadata:** (docs commit — includes 11-08-SUMMARY.md, STATE.md, ROADMAP.md, deferred-items.md)

## Files Created/Modified

- `src/lib/tracked-accounts/tracked-accounts-repo.ts` — dropped 3 `(supabase as any)` casts + their now-unused `eslint-disable` comments; updated the header doc block (interim-cast note → post-regen note); kept the boundary return casts that narrow DB `platform: string` to `TrackedAccountPlatform`.
- `src/types/database.types.ts` — (Task 1 / orchestrator, commit `63375675`) regenerated from live schema; `tracked_accounts` Row/Insert/Update added at line ~1800. Listed here for provenance; not re-committed in this agent's run.
- `.planning/phases/11-.../deferred-items.md` — appended the pre-existing repo-wide eslint baseline (63 errors / 98 warnings) as an out-of-scope discovery.

## Decisions Made

- **Types path correction (deviation, see below):** real path is `src/types/database.types.ts`; the plan frontmatter's `src/lib/database.types.ts` does not exist.
- **No residual cast needed:** all 3 casts removed cleanly — the regenerated type resolved the `.upsert(...).select().single()` chain without an onConflict typing gap, so no `(supabase as any)` was left behind.
- **Domain-union narrowing on the boundary:** DB types `platform` as `string`; kept `as TrackedAccount[]` / `as TrackedAccount` on the return values (shelf-repo convention) rather than widening the domain type.
- **ENGINE_VERSION frozen at 3.19.0:** confirmed unchanged + clean; no revert needed.
- **Lint scope:** lint the touched file (clean), not the repo-wide pre-existing baseline (logged, not fixed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the regenerated-types file path**
- **Found during:** Tasks 2 + 3 (every reference to the regenerated types)
- **Issue:** The plan frontmatter + task bodies reference `src/lib/database.types.ts`, which does not exist in this repo. The actual generated types file is `src/types/database.types.ts` (where Task 1's regen committed `tracked_accounts`).
- **Fix:** Used the real path `src/types/database.types.ts` throughout. No code change needed in the repo (it imports types transitively via `@supabase/supabase-js` generics, not a direct import of the path), so the cast cleanup + build simply resolve against the correct generated file.
- **Files modified:** none beyond the planned `tracked-accounts-repo.ts` (path correction is documentary/verification only).
- **Verification:** `grep "tracked_accounts" src/types/database.types.ts` → present at line 1800; repo `tsc` clean; build OK.
- **Committed in:** n/a (no extra code change; recorded here + already noted in Task 1's commit `63375675`).

---

**Total deviations:** 1 (Rule 3 — blocking path correction; documentary, no extra code change).
**Impact on plan:** None on scope. The path correction is the only divergence; all planned work (cast cleanup + regression gate) executed as written.

## Issues Encountered

- **Broken `rtk` tee shim on test/lint runners (known):** `npm test` / `vitest` / `npm run lint` route through a shim that prints stale/cached results. Used the authoritative binary `node ./node_modules/vitest/vitest.mjs run --reporter=default` for all test runs and `./node_modules/.bin/eslint` directly for the true lint exit code. Full suite reproduced the documented 2941 passing / 28 skipped baseline.
- **Repo-wide lint baseline (pre-existing, out-of-scope):** `eslint .` exits 1 with **161 problems (63 errors, 98 warnings)** across ~80 files, all in Phase-07-and-earlier code (spot-checked: `api/audiences/route.ts` → 07-03; `board/__tests__/Board.test.tsx`; `app/error.tsx` → phase-7). My touched file is clean (EXIT 0). `npm run build` succeeds regardless (these eslint findings do not gate `next build` in this project's `next.config.ts`). Per SCOPE BOUNDARY + the explicit task instruction, NOT fixed — logged to `deferred-items.md` alongside the 46 pre-existing tsc errors. Recommend a dedicated lint/test-fixture-typing cleanup pass (does not block Explore).

## User Setup Required

None — no new external service configuration. The live Supabase migration (Task 1) was already applied by the orchestrator via MCP.

## Task 4 — PENDING Human UAT (end-of-phase, human-verified)

**Do NOT mark Phase 11 complete until a human runs this.** The project runs `human_verify_mode = end-of-phase`, so the full Explore flow is verified by a human against live data. Record PASS/PARTIAL/FAIL per step; any honesty-spine violation (fabricated reaction on a grid tile, an empty/zero fit bar, a fake %, coral on the fit bar) is a hard FAIL → file a gap.

The 7 UAT steps (verbatim from 11-08-PLAN.md Task 4):

1. Select `/explore` (pill + `/` slash menu both work) → the idle screen shows the heading + 3 quick-action cards.
2. With NO tracked accounts: card 2 "What competitors shipped" shows the quiet "Track an account first" disabled sub-state (no pull fires, no fabricated feed).
3. Tap "Top performers in my niche today" (or open the params popover, set a niche + serendipity, "Run Explore") → the loading line shows "Pulling outliers and scoring them for your audience… this can take a few minutes" with NO fake % → a fit-scored grid renders.
4. With a CALIBRATED audience active: tiles show the 3-segment fit bar + "FIT · {Strong|Fair|Weak}" + "predicted" (never coral). With General active: the fit bar is OMITTED entirely (no empty bar), only the measured multiplier shows.
5. Tap "Remix → Read" on a profile-mode tile → the existing remix chain runs → a remix-card persists and surfaces in-thread (in place, no jump to /analyze) → the remix-card's "See how the room reacted" LensTrigger shows a REAL persona reaction (D-02 — first persona voice in the flow, not fabricated on the grid).
6. Tap "+ Track account" on a profile-mode tile → it toggles to "Tracking ✓" → confirm a row exists in `tracked_accounts` (live DB) → re-running Explore + tapping Track again does NOT duplicate (idempotent). Re-load card 2 now offers the competitors pull (hasTrackedAccounts true).
7. Reload the page → the persisted outlier-grid + remix-card rehydrate (THREAD-07).

## Next Phase Readiness

- **Code path closed for Phase 11:** tracked_accounts is live + typed, casts dropped, the regression gate is green, the build compiles end-to-end. The Track→Explore loop persists against a real table.
- **Blocker before phase-complete:** Task 4 human UAT must pass (or gaps filed). Phase 11 is NOT marked complete by this agent.
- **Carry-forward (unchanged):** FLYWHEEL-02 predicted-pin runner wiring still dormant (owner-accepted, belongs with KCQ-05 / P13). EXPLORE-06 comment-seeding stays DEFERRED (D-09).

## Self-Check: PASSED

- Files: `tracked-accounts-repo.ts`, `src/types/database.types.ts`, `11-08-SUMMARY.md`, `deferred-items.md` all present.
- Commits: `63375675` (Task 1, orchestrator), `93bbd57f` (Task 2) both in history.
- Cast removal: 0 live-code `(supabase as any)` casts remain (the lone match is the header doc-block note recording the removal); eslint `no-explicit-any` clean on the file.
- Gate: ENGINE_VERSION 3.19.0, engine+KC 1191 green, full suite 2941 green, build OK.

---
*Phase: 11-explore-audience-curated-discovery-expansion-not-yet-discuss*
*Completed (code path): 2026-06-20 — Task 4 UAT pending human verification*
