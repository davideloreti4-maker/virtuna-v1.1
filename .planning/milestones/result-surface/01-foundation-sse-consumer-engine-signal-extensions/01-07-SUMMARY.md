---
phase: 01-foundation-sse-consumer-engine-signal-extensions
plan: "07"
subsystem: schema-push + types-regen
tags:
  - schema-push
  - supabase
  - migration-apply
  - types-regen
  - blocking
  - r6-1

# Dependency graph
requires:
  - phase: 01-05
    provides: supabase/migrations/20260524000000_niche_post_windows.sql + cast-through-unknown pattern in optimal-post.ts pending types regen

provides:
  - "niche_post_windows table LIVE in Supabase project qyxvxleheckijapurisj (virtuna-v1.1, eu-west-1) — table + RLS + pg_cron all verified"
  - "src/types/database.types.ts regenerated from live schema — niche_post_windows Row/Insert/Update present under Database['public']['Tables']"
  - "src/lib/engine/optimal-post.ts — cast-through-unknown (as never) pattern replaced with typed query using Database-derived NichePostWindowRow"
  - "Wave 2 test gate passed: 54 tests passed, 7 todo (result-card.test.tsx Plan 08 stubs), 0 failed"

affects:
  - 01-08 (Wave 3 — route + ResultCard + e2e now unblocked; niche_post_windows is LIVE)
  - "P5 ResultCard 'When to post' panel — reads result.optimal_post_window from typed PredictionResult (no cast workaround)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase CLI gen types --project-id (API-based, no local link required) — outputs to stdout; strip update-banner appended to stdout before writing to disk"
    - "Database type-derived row shape: `type NichePostWindowRow = Database['public']['Tables']['niche_post_windows']['Row']` — replaces hand-written interface + cast-through-unknown"
    - ".single<Pick<NichePostWindowRow, ...>>() generic on PostgREST chain — typed single-row result without .returns() chaining"

key-files:
  created: []
  modified:
    - src/types/database.types.ts
    - src/lib/engine/optimal-post.ts

key-decisions:
  - "Used supabase gen types --project-id (not --linked) because no .supabase/ link directory existed in the worktree. Project ref qyxvxleheckijapurisj confirmed from human schema-pushed signal."
  - "CLI update-banner was appended to stdout and landed in database.types.ts (Rule 1 fix: stripped 2 trailing lines before committing). Re-run via `$CLI gen types ... 2>/dev/null` in future."
  - ".single<Pick<NichePostWindowRow, ...>>() used instead of .returns<...>().single() — the latter produces `never` return type in @supabase/postgrest-js 2.94.0 on single-row builders."
  - "strip.ts prefer-const ESLint error confirmed pre-existing (present on base 1de9740); logged to deferred-items.md D-01-DEF-02; not fixed (scope boundary)."

requirements-completed:
  - R6.1

# Metrics
duration: ~5min
completed: 2026-05-24
tasks_completed: 3
files_created: 0
files_modified: 2
---

# Phase 01 Plan 07: supabase db push + types regen + Wave 2 gate Summary

**Applied niche_post_windows migration to live Supabase project (qyxvxleheckijapurisj) via MCP, regenerated database.types.ts (1852 lines, niche_post_windows Row/Insert/Update present), dropped cast-through-unknown pattern in optimal-post.ts, and passed the full Wave 2 test gate (54 passed, 7 todo, 0 failed) — Wave 3 (Plan 08) is unblocked.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-24T10:38:57Z
- **Completed:** 2026-05-24T10:44:16Z
- **Tasks:** 3 / 3
- **Files created:** 0
- **Files modified:** 2 (database.types.ts + optimal-post.ts)

## Accomplishments

### T1 — Schema push (human-action checkpoint)

Migration applied to live Supabase project by developer via `mcp__supabase__apply_migration` (Supabase MCP). Two migrations applied in sequence:

1. `enable_pg_cron` — `CREATE EXTENSION IF NOT EXISTS pg_cron;` (pg_cron was not installed; the original migration's `cron.job` reference failed atomically on the first attempt — clean retry via separate migration)
2. `niche_post_windows` — full migration body from `supabase/migrations/20260524000000_niche_post_windows.sql`

**Target project:** `qyxvxleheckijapurisj` (virtuna-v1.1, ACTIVE_HEALTHY, eu-west-1)

**All 7 verification gates confirmed by developer:**

| Gate | Result |
|------|--------|
| 1. Linked project | qyxvxleheckijapurisj (virtuna-v1.1, ACTIVE_HEALTHY, eu-west-1) |
| 2. db diff preview | n/a — MCP path applied direct (no CLI diff) |
| 3. Migration applied | success=true (both migrations) |
| 4. `\d niche_post_windows` | 6 columns: niche/day_of_week/hour_start/hour_end/sample_size/computed_at; RLS enabled |
| 5. pg_cron job | jobname=`refresh-niche-post-windows`, schedule=`15 6 * * *` |
| 6. RLS policies | `niche_post_windows_read_authenticated` + `niche_post_windows_no_user_writes` |
| 7. Row count | 0 (expected — no `scraped_videos` rows with `primary_niche IS NOT NULL` yet) |

**niche_post_windows initial row count: 0** — acceptable; `scraped_videos.primary_niche` has no data yet. pg_cron will populate nightly as scrapes accumulate.

**Note on local migration state:** The migration file `supabase/migrations/20260524000000_niche_post_windows.sql` is unchanged on the branch (commit `e4b9d4b` from Plan 05). If the worktree is later linked via `supabase link`, run `supabase migration repair --status applied 20260524000000` to sync local migration history with the remote state.

### T2 — Regenerate src/types/database.types.ts

- **Command used:** `supabase gen types typescript --project-id qyxvxleheckijapurisj > src/types/database.types.ts`
- **Output:** 1852-line types file (33 more lines than pre-regen 1820-line file — new niche_post_windows entry + refresh_niche_post_windows function entry)
- **niche_post_windows entry confirmed:**
  ```typescript
  niche_post_windows: {
    Row: { computed_at: string; day_of_week: string; hour_end: number; hour_start: number; niche: string; sample_size: number }
    Insert: { computed_at?: string; day_of_week: string; hour_end: number; hour_start: number; niche: string; sample_size: number }
    Update: { computed_at?: string; day_of_week?: string; hour_end?: number; hour_start?: number; niche?: string; sample_size?: number }
    Relationships: []
  }
  ```
- **Rule 1 fix:** Supabase CLI 2.75.1 appended its update-banner ("A new version of Supabase CLI is available...") to stdout, which landed as 2 garbage lines at the end of the types file causing 20+ tsc parse errors. Stripped before committing. Future regen: redirect stderr with `2>/dev/null` or use `--no-update-check` flag.
- **optimal-post.ts cast removal:** Replaced cast-through-unknown pattern with Database-derived type:
  - Added `import type { Database } from "@/types/database.types"` + `type NichePostWindowRow = Database["public"]["Tables"]["niche_post_windows"]["Row"]`
  - Replaced `supabase.from("niche_post_windows" as never).eq("niche" as never, niche) as unknown as {...}` with `supabase.from("niche_post_windows").eq("niche", niche).single<Pick<NichePostWindowRow, ...>>()`
  - Removed internal `interface NichePostWindowRow` (was a hand-written duplicate, now derived from generated types)
- **tsc --noEmit:** 2 errors (both pre-existing `@google/genai` baseline D-01-DEF-01); ZERO new errors from this plan
- **vitest optimal-post.test.ts:** 5/5 passed

### T3 — Full Wave 2 test gate (blocking)

All Wave 2 plan tests confirmed green:

| Test file | Tests | Result |
|-----------|-------|--------|
| `optimal-post.test.ts` | 5 | PASS |
| `aggregator-optimal-post.test.ts` | 4 | PASS |
| `omni-analysis-emotion-arc.test.ts` | 8 | PASS |
| `anti-virality.test.ts` | 5 | PASS |
| `panel-mapping.test.ts` | 10 | PASS |
| `use-analysis-stream.test.tsx` | 7 | PASS |
| `use-analysis-stream-reconnect.test.tsx` | 6 | PASS |
| `stream-route.test.ts` | 6 | PASS |
| `route-started-event.test.ts` | 3 | PASS |
| `result-card.test.tsx` | 7 todo | SKIPPED (Plan 08 stubs — expected) |

**Total: 54 passed, 7 todo (skipped), 0 failed. Wave 2 gate: GREEN.**

**8 pre-existing failures confirmed (all `@google/genai` baseline D-01-DEF-01):**
- `route.test.ts`, `wave3.test.ts`, `wave3-cost-budget.test.ts`, `wave4/platform-fit.test.ts`, `stage10-critique.test.ts`, `aggregator-phase10.test.ts`, `aggregator-platform-fit.test.ts`, `corpus/eval-harness.test.ts`
- All fail with `Cannot find package '@google/genai'` — identical to Plans 01-02/01-04/01-05/01-06 baseline; no new failures from this plan.

**ESLint (Plan 07 files):** 0 errors, 1 warning (`_creator` unused-var — intentional underscore prefix, same pattern as `_params` in Plan 06).

**ESLint (full engine scope):** 1 pre-existing error in `src/lib/engine/utils/strip.ts` (`prefer-const`) — confirmed present on base commit `1de9740`, not introduced by this plan; logged to deferred-items.md D-01-DEF-02.

## Files Created/Modified

**Modified (2):**
- `src/types/database.types.ts` — regenerated from live schema; 1820 → 1852 lines; niche_post_windows + refresh_niche_post_windows entries added
- `src/lib/engine/optimal-post.ts` — added `Database` type import + `NichePostWindowRow` type alias; replaced cast-through-unknown query with typed `.from("niche_post_windows").eq("niche", niche).single<Pick<NichePostWindowRow, ...>>()`; removed hand-written `NichePostWindowRow` interface

**Also updated:**
- `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/deferred-items.md` — added D-01-DEF-02 (strip.ts prefer-const pre-existing lint error)

## Commits

- **`963b65d`** — `feat(01-07): regenerate Database types + drop as-never casts in optimal-post.ts — R6.1 T2`

## Decisions Made

- **supabase gen types --project-id (not --linked):** No `.supabase/` link directory in the worktree; `--project-id` flag hits the Supabase Management API directly using the cached credentials from the CLI's global config. Project ref `qyxvxleheckijapurisj` confirmed from developer's schema-pushed signal.
- **CLI banner stripping (Rule 1):** The Supabase CLI 2.75.1 writes its update advisory to stdout, not stderr, so it contaminated the TypeScript file. Fixed by editing the 2 trailing lines before committing. Recommended fix for future: `supabase gen types typescript ... 2>/dev/null` or upgrade to 2.101.0 (update advisory may go to stderr in newer versions).
- **`.single<Pick<NichePostWindowRow, ...>>()` over `.returns<...>().single()`:** The `.returns<T>()` method on a PostgREST builder that is then `.single()`'d returns `never` in @supabase/postgrest-js 2.94.0 — the generic is overridden by the single-row narrowing. Passing the Pick generic directly to `.single<T>()` is the correct pattern for typed single-row queries.
- **strip.ts ESLint error not fixed:** Confirmed pre-existing on base `1de9740`; not caused by this plan; logged to deferred-items.md D-01-DEF-02 per scope-boundary rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Supabase CLI update-banner contaminated database.types.ts**

- **Found during:** T2 tsc verification (`node_modules/.bin/tsc --noEmit`)
- **Issue:** `supabase gen types typescript` 2.75.1 writes its version-update advisory to stdout, not stderr. Redirecting stdout to the types file captured the 2-line banner as trailing content, producing 20+ tsc parse errors.
- **Fix:** Removed the 2 trailing lines ("A new version of Supabase CLI is available...") from `database.types.ts` before committing.
- **Files modified:** `src/types/database.types.ts`
- **Commit:** `963b65d`

**2. [Rule 1 — Bug] `.returns<T>().single()` produces `never` in postgrest-js 2.94.0**

- **Found during:** T2 tsc verification
- **Issue:** The initial refactor used `.returns<Pick<NichePostWindowRow, ...>>().single()`, which produces `data: never` at the TypeScript level — properties on `data` were flagged as TS2339.
- **Fix:** Moved the generic to `.single<Pick<NichePostWindowRow, ...>>()` directly. This is the documented pattern for typed single-row results in @supabase/postgrest-js 2.94.x.
- **Files modified:** `src/lib/engine/optimal-post.ts`
- **Commit:** `963b65d`

### Scope-Boundary Discoveries (NOT auto-fixed)

**3. `src/lib/engine/utils/strip.ts` prefer-const lint error (PRE-EXISTING)**

- **Discovered:** T3 ESLint gate run on full `src/lib/engine` directory
- **Pre-existing:** Confirmed present on base commit `1de9740` (before this plan)
- **Action:** Logged to `deferred-items.md` D-01-DEF-02. Not fixed — scope boundary.

## Issues Encountered

- `@google/genai` baseline failures (D-01-DEF-01) — 8 file failures, identical to Plans 01-02 / 01-04 / 01-05 / 01-06 baseline. No new failures.
- `strip.ts` prefer-const ESLint error (D-01-DEF-02) — pre-existing, logged.
- Supabase CLI binary not in worktree `node_modules/.bin/` (broken symlink to missing `bin/supabase` in the npm wrapper). Binary found at `/Users/davideloreti/virtuna-v1.1/node_modules/.ignored/supabase/bin/supabase` (2.75.1 — placed there by pnpm's `.ignored/` isolation). Used directly for the gen types command.

## Stub Tracking

Zero stubs introduced. The `database.types.ts` is a generated file — no hand-written stubs. `optimal-post.ts` internal `NichePostWindowRow` interface removed and replaced with the canonical Database-derived type. No `it.todo`, no placeholder data, no hardcoded empty values.

## Threat Flags

All flags match the plan's `<threat_model>` — no new threat surface:

- **T-01-PUSH-wrong-project** (mitigated): Developer confirmed project ref `qyxvxleheckijapurisj` via `mcp__supabase__get_project_url` before apply. `autonomous=false` checkpoint ensured human in the loop.
- **T-01-NPW-rls-write** (mitigated, LIVE): RLS policies confirmed LIVE via developer's Gate 6 psql query (`niche_post_windows_read_authenticated` + `niche_post_windows_no_user_writes`).
- **T-01-NPW-cron-role** (mitigated, LIVE): pg_cron job confirmed LIVE via developer's Gate 5 psql query (jobname=`refresh-niche-post-windows`, schedule=`15 6 * * *`).
- **T-01-TYPES-drift** (mitigated): Backup created before regen; no hand-edits existed in the pre-regen file; regen succeeded cleanly (after CLI banner strip); backup deleted.

## Self-Check

**Files modified verified:**
- `src/types/database.types.ts` — FOUND; `grep "niche_post_windows"` = 2 hits (table entry at L827 + function at L1719); Row/Insert/Update all present within the table entry block
- `src/lib/engine/optimal-post.ts` — FOUND; `grep "as never"` = 0 (casts removed); `grep "Database\[" ` = 1 (NichePostWindowRow type alias); `grep "niche_post_windows"` = 2 (from() + type alias)

**Commits verified:**
- `963b65d` — FOUND (`git log --oneline | grep 963b65d`)

**Test gate verified:**
- `vitest run [9 Wave-2 files]` = 54 passed, 7 todo, 0 failed — CONFIRMED
- `tsc --noEmit` = 2 errors (both pre-existing @google/genai D-01-DEF-01); 0 new errors — CONFIRMED
- `eslint src/lib/engine/optimal-post.ts src/types/database.types.ts` = 0 errors — CONFIRMED

## Self-Check: PASSED

## Next Phase Readiness

**Wave 3 is unblocked.** Plan 08 prerequisites now fully met:

- `niche_post_windows` table is LIVE in production Supabase (qyxvxleheckijapurisj)
- `src/types/database.types.ts` contains the correct Row/Insert/Update types
- `src/lib/engine/optimal-post.ts` queries the table with full type safety
- All Wave 2 engine/hooks/api tests are green
- `result-card.test.tsx` has 7 `it.todo` entries (Plan 08's fill-in target)
- `PredictionResult.optimal_post_window` is fully typed and aggregator-populated

**M2-II future path:** Once outcome data justifies creator-aware override, replace `computeOptimalPostWindow(serviceClient, nicheValue, null)` with `computeOptimalPostWindow(serviceClient, nicheValue, creatorContext)`. The `NichePostWindowRow` type now derives from the live schema, so any future column additions to `niche_post_windows` will surface automatically on next types regen.

---
*Phase: 01-foundation-sse-consumer-engine-signal-extensions*
*Plan: 07 (Wave 4 — BLOCKING schema push + types regen + Wave 2 gate)*
*Completed: 2026-05-24*
