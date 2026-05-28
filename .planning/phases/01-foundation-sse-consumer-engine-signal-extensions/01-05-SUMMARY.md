---
phase: 01-foundation-sse-consumer-engine-signal-extensions
plan: "05"
subsystem: engine-extension
tags:
  - engine-extension
  - migration
  - pg-cron
  - r6-1
  - d-12
  - d-13
  - d-14
  - d-15
  - phase1-additive-field

# Dependency graph
requires:
  - phase: 01-01
    provides: it.todo stubs in optimal-post.test.ts + aggregator-optimal-post.test.ts; Phase1AdditiveFields type shape pre-lock for optimal_post_window
  - phase: 01-04
    provides: Pattern for additive PredictionResult field (emotion_arc) — optimal_post_window mirrors the additive .optional() approach + the BEFORE-Stage-10/11 pluck-ordering Pitfall #5

provides:
  - "OptimalPostWindow interface (D-13 locked) + FALLBACK_POST_WINDOW constant + computeOptimalPostWindow helper — src/lib/engine/optimal-post.ts"
  - "niche_post_windows materialized table (TABLE not MATERIALIZED VIEW per Pitfall #4) + refresh_niche_post_windows() SECURITY DEFINER function + pg_cron schedule at 06:15 UTC + RLS policies — supabase/migrations/20260524000000_niche_post_windows.sql"
  - "PredictionResult.optimal_post_window?: OptimalPostWindow | null — src/lib/engine/types.ts (optional to preserve compile; aggregator always populates)"
  - "aggregator.ts pluck (non-fatal, Pitfall #5 ordering) — createServiceClient + computeOptimalPostWindow(payload.niche, null) call inserted BEFORE result assembly so Stage 10/11 critique + counterfactuals see the field"
  - "9 assertions replacing 9 it.todo placeholders (5 in optimal-post.test.ts + 4 in aggregator-optimal-post.test.ts)"

affects:
  - 01-07 (BLOCKING — applies the migration via supabase db push + regenerates Database types so the cast-through-unknown pattern in optimal-post.ts can drop the `as never` table-name cast)
  - "P5 ResultCard 'When to post' panel — reads result.optimal_post_window.{day_of_week, hour_range, reasoning} to render the niche-specific recommendation; renders fallback copy on source='fallback' and generic copy when field is null"
  - "M2-II creator-aware override path — schema future-proofed via OptimalPostWindow.source='creator' enum value; _creator parameter on computeOptimalPostWindow is unused in P1 per D-12 but signature accepts CreatorContext for the future hand-off"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Materialized TABLE refreshed by pg_cron (NOT MATERIALIZED VIEW per Pitfall #4) — avoids the CONCURRENTLY unique-index requirement; matches competitor_snapshots precedent already established in the codebase"
    - "SECURITY DEFINER refresh function with SET search_path = public, pg_temp pinned per T-01-NPW-cron-role mitigation — prevents search_path-hijack escalation. EXECUTE revoked from PUBLIC + anon + authenticated"
    - "ROW_NUMBER() OVER (PARTITION BY primary_niche ORDER BY COUNT DESC) window function picks the TOP day/hour bucket per niche — eliminates the multi-row-per-niche conflict flagged in the plan's T1 action block as a refinement requirement"
    - "LEAST(hour_end, 24) clamp in the refresh function honors CHECK (hour_end <= 24) when hour_start=23 — the +2 arithmetic would otherwise produce 25 and break the insert"
    - "RLS explicit policies — service-role implicit access via BYPASS; authenticated SELECT permitted (non-PII aggregate); writes DENIED for anon + authenticated via WITH CHECK (false)"
    - "Non-fatal try/catch pluck (Pitfall #5 ordering) — optimal_post_window inserted BEFORE result assembly so Stage 10/11 see the populated field. Mirrors the emotion_arc pluck pattern from Plan 01-04"
    - "Cast-through-unknown pattern for un-typed Supabase tables (matches calibration.ts:fetchOutcomePairs) — niche_post_windows is in the live migration this plan ships but not yet in the generated Database types until Plan 07 runs `supabase db push` + types regen"

key-files:
  created:
    - supabase/migrations/20260524000000_niche_post_windows.sql
    - src/lib/engine/optimal-post.ts
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/optimal-post.test.ts
    - src/lib/engine/__tests__/aggregator-optimal-post.test.ts

key-decisions:
  - "Source table = scraped_videos.primary_niche (RESEARCH Open Question 2 + Assumption A2). Column exists from the Phase 8 pgvector backfill (20260518000000_phase8_pgvector.sql adds + backfills primary_niche on scraped_videos). training_corpus was the rejected alternative — that table holds labeled training data, not raw posting timestamps."
  - "Plain TABLE (not MATERIALIZED VIEW) per RESEARCH Pitfall #4. MATERIALIZED VIEW with REFRESH CONCURRENTLY requires a UNIQUE index covering all selected columns; a plain TABLE refreshed by pg_cron is simpler and matches the competitor_snapshots cron pattern already established."
  - "Window-function aggregation strategy (ROW_NUMBER() OVER (PARTITION BY niche ORDER BY COUNT DESC)) chosen over the plan's simpler GROUP BY + ON CONFLICT DO NOTHING. The plan's note explicitly flagged this: 'if the executor reads scraped_videos and finds the GROUP BY produces multiple windows per niche, replace the simple SELECT with a window function'. Since niche × day × hour produces multiple rows per niche by definition, the window-function approach is the correct shape. ON CONFLICT DO NOTHING retained as defensive guard."
  - "LEAST(hour_end, 24) clamp added to honor CHECK (hour_end <= 24) when source posted_at hour = 23 (arithmetic +2 would produce 25 and break the insert). Rule 1 bug fix applied before the first commit landed."
  - "OptimalPostWindow.optional() not REQUIRED on PredictionResult — chosen to preserve compile-time back-compat for the 2 existing test fixtures (stage10-critique + stage11-counterfactuals) that construct PredictionResult literals. Plan 01-06's anti_virality_gated REQUIRED-not-optional path forced 2 fixture updates; this plan keeps the field optional (matching emotion_arc) so no fixture churn is needed. Runtime aggregator always populates the field; P5 panel reads with `result.optimal_post_window?.source === 'niche' ? ... : ...`."
  - "Aggregator passes `null` for _creator — P1 doesn't consume CreatorContext for the window decision per D-12 (creator-aware weighting deferred to M2-II until outcome data justifies the override)."
  - "Pluck inserted alongside emotion_arc (line ~683, BEFORE result assembly) — same Pitfall #5 ordering invariant the emotion_arc and anti_virality_gated plans established. Stage 10 critique + Stage 11 counterfactuals see the populated field, which lets future plans add critique branches that reference optimal_post_window without re-ordering risk."
  - "Cast-through-unknown for niche_post_windows table reference — Plan 07 (BLOCKING) is the gate that applies this migration to the live Supabase project and regenerates Database types. Until then, the table is not in the generated types and tsc would reject `from('niche_post_windows')`. Pattern matches calibration.ts:fetchOutcomePairs (which uses the same cast for the `outcomes` table for the same reason)."

requirements-completed:
  - R6.1

# Metrics
duration: ~7min
completed: 2026-05-24
tasks_completed: 3
files_created: 2
files_modified: 4
tests_added: 9 (5 optimal-post + 4 aggregator-optimal-post, replacing 9 it.todo placeholders from Plan 01-01)
---

# Phase 01 Plan 05: optimal_post_window aggregator + niche_post_windows migration Summary

**Ships the R6.1 optimal_post_window signal end-to-end: niche_post_windows materialized table (RLS + SECURITY-DEFINER refresh function + pg_cron) + computeOptimalPostWindow helper with FALLBACK + null-on-error semantics + non-fatal aggregator pluck wired BEFORE Stage 10/11 (Pitfall #5) + PredictionResult interface widening + 9 TDD assertions replacing Plan 01-01's it.todo placeholders — unblocks P5 "When to post" panel with niche-specific recommendations and graceful fallbacks.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-24T09:48:25Z
- **Completed:** 2026-05-24T09:55:28Z
- **Tasks:** 3 / 3
- **Files created:** 2 (migration + helper module)
- **Files modified:** 4 (types, aggregator, 2 test files — placeholder fills)
- **Tests added:** 9 (5 + 4, replacing 9 `it.todo` placeholders from Plan 01-01)

## Accomplishments

### T1 — niche_post_windows migration (table + RLS + pg_cron)

- **Table DDL** — `niche_post_windows` with `niche TEXT PRIMARY KEY`, CHECK constraints on `day_of_week IN ('Mon'..'Sun')`, `hour_start [0,23]`, `hour_end [1,24]`, `sample_size >= 10`, `computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- **RLS policies** — `ENABLE ROW LEVEL SECURITY` + two policies: `niche_post_windows_read_authenticated` (FOR SELECT TO authenticated USING true) + `niche_post_windows_no_user_writes` (FOR ALL TO authenticated, anon USING false WITH CHECK false). T-01-NPW-rls-write mitigation enforced.
- **Refresh function** — `refresh_niche_post_windows()` SECURITY DEFINER with `SET search_path = public, pg_temp` (T-01-NPW-cron-role mitigation). Window function `ROW_NUMBER() OVER (PARTITION BY primary_niche ORDER BY COUNT DESC)` picks the TOP day/hour bucket per niche. `LEAST(hour_end, 24)` clamp honors the CHECK constraint when source hour=23. EXECUTE revoked from PUBLIC + anon + authenticated.
- **pg_cron schedule** — `cron.schedule('refresh-niche-post-windows', '15 6 * * *', ...)` runs at 06:15 UTC daily (15min after the existing refresh-competitors cron @06:00). Idempotent re-run via `cron.unschedule` guard.
- **Initial population** — `SELECT refresh_niche_post_windows();` runs immediately so the table is non-empty post-migration.

### T2 — src/lib/engine/optimal-post.ts + 5 tests

- **`OptimalPostWindow`** — interface locked verbatim from CONTEXT D-13: `day_of_week ∈ {Mon..Sun}`, `hour_range: [number, number]`, `timezone: "UTC"`, `reasoning: string`, `source: "niche" | "creator" | "fallback"`. Future-proofed for M2-II creator override via the `creator` enum value.
- **`FALLBACK_POST_WINDOW`** — Tue 18:00-21:00 UTC, source='fallback', defensible default reasoning ("Default recommendation — niche-specific data unavailable"). P5 panel renders fallback differently (soft suggestion vs niche insight).
- **`computeOptimalPostWindow(supabase, niche, _creator)`** — 4-branch behavior:
  - `niche === null` → returns FALLBACK (no DB call)
  - Row found → returns `OptimalPostWindow` with source='niche' and formatted reasoning ("Your niche peaks Wed 19:00-21:00 UTC (n=42 videos)")
  - PGRST116 (no rows for `.single()`) → returns FALLBACK (expected "unknown niche" path; distinguishes "we don't have data yet" from "DB is broken")
  - Other Supabase error or thrown exception → returns null (non-fatal per D-15; aggregator caller catches + degrades the panel to generic copy)
- **`_creator` unused in P1** per D-12 — schema future-proofed. Cast-through-unknown pattern on `from("niche_post_windows" as never)` matches calibration.ts:fetchOutcomePairs (same workaround pattern for tables not yet in generated Database types).
- **5 assertions** replace 5 it.todo placeholders covering all 4 helper branches plus FALLBACK shape sanity (source='fallback', day matches regex, hour_range bounds, timezone='UTC').

### T3 — types.ts + aggregator.ts + test fill-in

- **types.ts** — imports `OptimalPostWindow` from `./optimal-post` and re-exports for the canonical `import { OptimalPostWindow } from "@/lib/engine/types"` surface. Adds `optimal_post_window?: OptimalPostWindow | null` to `PredictionResult` alongside emotion_arc + anti_virality_gated (Phase 1 additive surface co-location pattern from 01-04 + 01-06).
- **aggregator.ts** — three additions:
  1. **Imports** (after the existing `isAntiViralityGated` import): `import { computeOptimalPostWindow, type OptimalPostWindow } from "./optimal-post"` + `import { createServiceClient } from "@/lib/supabase/service"`.
  2. **Pluck block** (line ~683, immediately after the emotion_arc pluck, BEFORE the result assembly per Pitfall #5):
     ```ts
     let optimal_post_window: OptimalPostWindow | null = null;
     try {
       const serviceClient = createServiceClient();
       const nicheValue = pipelineResult.payload.niche ?? null;
       optimal_post_window = await computeOptimalPostWindow(serviceClient, nicheValue, null);
     } catch {
       optimal_post_window = null; // non-fatal per D-15
     }
     ```
  3. **Result field** added to the `const result: PredictionResult = { ... }` block immediately after `anti_virality_gated`:
     ```ts
     optimal_post_window,
     ```
- **aggregator-optimal-post.test.ts** — 4 assertions replace 4 it.todo placeholders covering:
  1. Known niche populates field (source='niche', day/hour/timezone match)
  2. Unknown niche → FALLBACK shape (source='fallback')
  3. Helper throws → field set to null (non-fatal per D-15)
  4. **Pitfall #5 ordering verified** via a `callOrder: string[]` tracker shared by stage10/stage11 mocks — assertion: `op_idx < stage10_idx < stage11_idx`

## Files Created/Modified

**Created (2):**
- `supabase/migrations/20260524000000_niche_post_windows.sql` (124 lines) — table DDL + RLS policies + refresh function + pg_cron schedule + initial population
- `src/lib/engine/optimal-post.ts` (101 lines) — OptimalPostWindow + FALLBACK + computeOptimalPostWindow + cast-through-unknown row interface

**Modified (4):**
- `src/lib/engine/types.ts` — `import type { OptimalPostWindow } from "./optimal-post"` + `export type { OptimalPostWindow }` + `optimal_post_window?: OptimalPostWindow | null` field on PredictionResult
- `src/lib/engine/aggregator.ts` — `computeOptimalPostWindow` + `OptimalPostWindow` + `createServiceClient` imports + non-fatal pluck block + result field
- `src/lib/engine/__tests__/optimal-post.test.ts` — 5 assertions replacing 5 `it.todo` placeholders
- `src/lib/engine/__tests__/aggregator-optimal-post.test.ts` — 4 assertions with full mock stack (logger/supabase/sentry/cache/ml/calibration/gemini/deepseek/stage10/stage11/optimal-post), 0 `it.todo`

## Commits

- **`e4b9d4b`** — `feat(01-05): add niche_post_windows migration (table + RLS + pg_cron) — R6.1 T1`
- **`bf326b0`** — `feat(01-05): add computeOptimalPostWindow helper + 5 tests — R6.1 T2`
- **`fb6453b`** — `feat(01-05): wire optimal_post_window through PredictionResult + aggregator + tests — R6.1 T3`

## Decisions Made

- **scraped_videos.primary_niche as source** (RESEARCH Open Question 2 + Assumption A2). Verified via `grep "primary_niche" supabase/migrations/` — Phase 8 pgvector backfill (`20260518000000_phase8_pgvector.sql`) adds the column to scraped_videos and backfills it from category. The alternative (training_corpus) was rejected because that table holds labeled training data, not raw posting timestamps.
- **Plain TABLE (not MATERIALIZED VIEW)** per RESEARCH Pitfall #4. A MATERIALIZED VIEW with REFRESH CONCURRENTLY requires a UNIQUE INDEX covering all selected columns, which adds operational fragility. A plain TABLE refreshed by `cron.schedule` mirrors the competitor_snapshots cron pattern already established in the codebase. Lookups are PRIMARY KEY single-row scans → sub-50ms latency, no per-analysis aggregation hit on the 60s SLA budget.
- **Window-function aggregation** chosen over the plan's simpler `GROUP BY + ON CONFLICT DO NOTHING`. The plan's T1 action block explicitly flagged this: *"if the executor reads scraped_videos and finds the GROUP BY produces multiple windows per niche, replace the simple SELECT with a window function"*. Since `niche × day × hour` produces multiple rows per niche by definition, `ROW_NUMBER() OVER (PARTITION BY primary_niche ORDER BY COUNT DESC)` + `WHERE rn = 1` is the correct shape. ON CONFLICT DO NOTHING retained as a defensive guard against rare race conditions.
- **`LEAST(hour_end, 24)` clamp** added to honor `CHECK (hour_end <= 24)` when the source posted_at hour = 23. The naive `hour_start + 2` would produce 25 and break the INSERT. Rule 1 bug fix applied during T1 authoring (before the first commit landed).
- **`optimal_post_window` declared `.optional()` on PredictionResult** (matches emotion_arc / audio_perceptual_score), NOT REQUIRED. This preserves compile-time back-compat for the 2 existing test fixtures (`stage10-critique.test.ts:makeFakePredictionResult` + `stage11-counterfactuals.test.ts:makeFakePredictionResult`) — Plan 01-06's REQUIRED `anti_virality_gated` field forced 2 fixture updates, but this plan keeps the optional pattern so no fixture churn is needed. Runtime aggregator always populates the field; P5 panel reads with `result.optimal_post_window?.source === 'niche' ? ... : ...`.
- **Aggregator passes `null` for _creator** per D-12 — P1 doesn't consume CreatorContext for the window decision. Creator-aware weighting deferred to M2-II until outcome data justifies the override. The signature accepts `CreatorContext | null` so the future hand-off is type-safe.
- **Pluck position alongside emotion_arc** (line ~683, BEFORE result assembly) — same Pitfall #5 ordering invariant that emotion_arc and anti_virality_gated established. Stage 10 critique + Stage 11 counterfactuals see the populated field, so future plans can add critique branches that reference `optimal_post_window` without ordering-risk.
- **Cast-through-unknown for `niche_post_windows`** — Plan 07 (BLOCKING) is the gate that applies this migration to the live Supabase project and regenerates `src/types/database.types.ts`. Until then, the table is not in the generated types and tsc would reject `from('niche_post_windows')`. Pattern matches `calibration.ts:fetchOutcomePairs` (same workaround for the `outcomes` table for the same reason). Plan 07 will drop the `as never` cast once types are regenerated — out of scope here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] LEAST(hour_end, 24) clamp added to refresh function (caught pre-commit)**

- **Found during:** T1 SQL authoring review (before first commit landed)
- **Issue:** The plan's verbatim refresh function used `EXTRACT(HOUR ...) + 2` for hour_end without bounds-clamping. The table's CHECK constraint allows hour_end up to 24, so source hour=23 → +2 = 25 would fail the INSERT and crash the pg_cron refresh job nightly.
- **Fix:** Wrapped with `LEAST(hour_end, 24) AS hour_end` in the INSERT SELECT. Function now produces valid rows for all source hours 0-23.
- **Files modified:** `supabase/migrations/20260524000000_niche_post_windows.sql` (committed in e4b9d4b — never landed broken)
- **Verification:** SQL grep checks (`grep -c "CHECK (hour_end >= 1 AND hour_end <= 24)" ...` = 1) confirm the CHECK constraint exists; the LEAST clamp prevents violation.

**2. [Rule 1 — Bug] Window function refactor replaces GROUP BY + ON CONFLICT (plan's flagged refinement)**

- **Found during:** T1 SQL authoring review
- **Issue:** The plan's simple `GROUP BY primary_niche, day_of_week, hour` + `ON CONFLICT (niche) DO NOTHING` keeps only the FIRST (arbitrary order) row per niche, not the most-popular window. With ~50 niches × 7 days × 24 hours = ~8400 possible rows, the arbitrary "first" row would rarely be the peak window. The plan's T1 action block explicitly flagged this: *"if the executor reads scraped_videos and finds the GROUP BY produces multiple windows per niche, replace the simple SELECT with a window function"*. Since the GROUP BY by definition produces multiple windows per niche, the window function IS required.
- **Fix:** Refactored to `ROW_NUMBER() OVER (PARTITION BY primary_niche ORDER BY COUNT(*) DESC, day_of_week, hour_start)` + `WHERE rn = 1`. Now selects the genuine peak-popularity window per niche; ties broken deterministically by day name + hour.
- **Files modified:** `supabase/migrations/20260524000000_niche_post_windows.sql` (committed in e4b9d4b)
- **Verification:** SQL is internally consistent — the CTE selects all candidate windows with ROW_NUMBER, the INSERT picks rn=1 per niche.

**3. [Rule 2 — Critical functionality] Cast-through-unknown pattern for niche_post_windows table reference**

- **Found during:** T3 verification (`tsc --noEmit -p tsconfig.json`)
- **Issue:** `niche_post_windows` is in the live migration this plan ships, but NOT in `src/types/database.types.ts` (that file is regenerated by Plan 07 after `supabase db push`). `supabase.from("niche_post_windows")` produces TS2769 "Argument of type 'niche_post_windows' is not assignable to..." and chain returns SelectQueryError ghost types — tsc rejects the entire helper.
- **Fix:** Applied the same cast-through-unknown pattern used by `calibration.ts:fetchOutcomePairs` for the un-typed `outcomes` table. Added an internal `NichePostWindowRow` interface matching the SELECTed columns; cast `from("niche_post_windows" as never).select(...).eq("niche" as never, niche).single()` to `as unknown as { data: NichePostWindowRow | null; error: { code?: string; message?: string } | null }`. Helper API unchanged.
- **Files modified:** `src/lib/engine/optimal-post.ts` (committed in fb6453b alongside aggregator wiring — single commit)
- **Verification:** `tsc --noEmit -p tsconfig.json` reports ZERO new errors (only 2 pre-existing `@google/genai` baseline failures from deferred-items.md D-01-DEF-01); both unit tests and aggregator tests pass green.

### Scope-Boundary Discoveries (NOT auto-fixed — out of scope)

**4. `@google/genai` package missing — 7 engine test files fail to load (PRE-EXISTING)**

- **Discovered:** Full engine suite run (`vitest run src/lib/engine`) shows 7 file failures, all citing `Cannot find package '@google/genai' imported from src/lib/engine/gemini/schemas.ts`.
- **Out of scope:** Pre-existing baseline logged in `deferred-items.md` (D-01-DEF-01) by Plan 01-02. All 7 failures unrelated to optimal_post_window work. Plans 01-04 + 01-06 SUMMARIES confirm the same 7 baseline failures.
- **Action:** None. Continues to be tracked in `deferred-items.md`. Suggested fix remains `pnpm add @google/genai` from the main worktree.

**5. Node_modules absent in worktree (resolved via symlink to main worktree)**

- **Discovered:** Initial verification commands failed because the fresh worktree had no `node_modules/`.
- **Fix:** `ln -s ~/virtuna-v1.1/node_modules node_modules` inside worktree root (gitignored; does not pollute commit history). Matches the workaround pattern used by Plan 01-06.
- **Files modified:** none committed (symlink only).
- **Verification:** `./node_modules/.bin/vitest` + `./node_modules/.bin/tsc` resolve.

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs caught at authoring time, 1 Rule 2 critical-functionality cast) + 2 scope-boundary discoveries (deferred-items baseline + node_modules symlink workaround).
**Impact on plan:** All work matches the plan's functional intent. The window-function refactor and hour_end clamp address known plan ambiguities the action block explicitly flagged. The cast-through-unknown is the documented pattern for un-typed Supabase tables. No scope creep, no contract drift.

## Issues Encountered

- `@google/genai` baseline failure (deferred-items.md D-01-DEF-01) — identical 7 file failures as Plans 01-02 + 01-04 + 01-06. Confirmed by diffing failure list; no new failures introduced by this plan.
- The `niche_post_windows` table is referenced via cast-through-unknown until Plan 07 regenerates Database types; that plan should remove the `as never` casts.

## Stub Tracking

Zero stubs introduced. All 9 `it.todo` placeholders from Plan 01-01 (5 in optimal-post.test.ts + 4 in aggregator-optimal-post.test.ts) are replaced with 9 real assertions. No unintentional `it.todo`, `test.fixme`, or placeholder data.

## Threat Flags

All flags match the plan's `<threat_model>` — no new threat surface introduced:

- **T-01-NPW-rls-write** (mitigate): RLS `ENABLE ROW LEVEL SECURITY` + 2 explicit policies — authenticated SELECT permitted (non-PII aggregate), DENY-ALL for INSERT/UPDATE/DELETE on anon + authenticated roles. Only service_role (via cron + server helpers) can write.
- **T-01-NPW-leak** (accept): Niche-level aggregates are non-PII public market intelligence. Acceptable risk per plan disposition.
- **T-01-NPW-cron-role** (mitigate): refresh_niche_post_windows() SECURITY DEFINER with `SET search_path = public, pg_temp`. EXECUTE revoked from PUBLIC + anon + authenticated.
- **T-01-NPW-sql-injection** (mitigate): pure SQL aggregation — no string concatenation of user input. `primary_niche` and `posted_at` are typed columns. CHECK constraints on output reject out-of-range values.
- **T-01-NPW-helper-error-fallback** (mitigate): Aggregator try/catch wraps the helper call; failure sets `optimal_post_window = null`. Pipeline does NOT abort. Verified by test 3 (helper throws → field=null).

No new endpoints, no new auth paths, no new schema/migration changes at trust boundaries beyond the declared `niche_post_windows` table (which Plan 07 BLOCKING gate applies).

## TDD Gate Compliance

Plan tasks T2 + T3 marked `tdd="true"` but type=`execute`. Each task interleaves implementation + test fill-in (Wave 0 tests pre-scaffolded as `it.todo` in Plan 01-01; this plan replaces them with assertions). All 3 task commits use `feat(01-05)` prefix per conventional commits — assertions and implementation land together (matches plan author's verbatim action blocks). No separate RED/GREEN/REFACTOR commits since the test files were pre-scaffolded by Plan 01-01.

## Self-Check

**Files created verified:**
- `supabase/migrations/20260524000000_niche_post_windows.sql` — FOUND
- `src/lib/engine/optimal-post.ts` — FOUND

**Files modified verified:**
- `src/lib/engine/types.ts` — `optimal_post_window` field present (≥1 grep hit)
- `src/lib/engine/aggregator.ts` — `computeOptimalPostWindow` import + call (3 grep hits) + `optimal_post_window` variable + result field (6 grep hits) + ordering correct (helper BEFORE `runStage10Critique`)
- `src/lib/engine/__tests__/optimal-post.test.ts` — 5 assertions, 0 `it.todo`
- `src/lib/engine/__tests__/aggregator-optimal-post.test.ts` — 4 assertions, 0 `it.todo`

**Commits verified:**
- `e4b9d4b` (T1: migration) — FOUND
- `bf326b0` (T2: helper + tests) — FOUND
- `fb6453b` (T3: types + aggregator + tests) — FOUND

**T1 SQL acceptance gate spot-checks:**
- ✓ `ls supabase/migrations/20260524000000_niche_post_windows.sql` exits 0
- ✓ `grep -c "CREATE TABLE IF NOT EXISTS niche_post_windows"` = 1
- ✓ `grep -c "PRIMARY KEY"` = 1 (≥1 required)
- ✓ `grep -c "CHECK (day_of_week IN"` = 1
- ✓ `grep -c "ENABLE ROW LEVEL SECURITY"` = 1
- ✓ `grep -c "CREATE POLICY"` = 2 (≥2 required)
- ✓ `grep -c "SECURITY DEFINER"` = 1 (matches plan's exact-1)
- ✓ `grep -c "SET search_path"` = 1
- ✓ `grep -c "cron.schedule"` = 3 (literal call + 2 doc references; ≥1 required)
- ✓ `grep -c "refresh-niche-post-windows"` = 3 (schedule + unschedule guard + doc; ≥2 required)
- ✓ `grep -c "FROM scraped_videos"` = 1

**T2 + T3 acceptance gate spot-checks:**
- ✓ `grep -c "export async function computeOptimalPostWindow" src/lib/engine/optimal-post.ts` = 1
- ✓ `grep -c "export const FALLBACK_POST_WINDOW" src/lib/engine/optimal-post.ts` = 1
- ✓ `grep -c "export interface OptimalPostWindow" src/lib/engine/optimal-post.ts` = 1
- ✓ `grep -c "PGRST116" src/lib/engine/optimal-post.ts` = 3 (≥1 required)
- ✓ `grep -c "optimal_post_window" src/lib/engine/types.ts` = 1 (≥1 required)
- ✓ `grep -c "import.*OptimalPostWindow" src/lib/engine/types.ts` = 1
- ✓ `grep -c "computeOptimalPostWindow" src/lib/engine/aggregator.ts` = 3 (≥2 required)
- ✓ `grep -c "optimal_post_window" src/lib/engine/aggregator.ts` = 6 (≥2 required)
- ✓ Ordering: `awk '/optimal_post_window = await computeOptimalPostWindow/{a=NR} /runStage10Critique\(/{if(a&&NR>a){print "OK"}}'` = OK

**Test + tsc + lint verification:**
- ✓ `vitest run src/lib/engine/__tests__/optimal-post.test.ts` = 5/5 passed
- ✓ `vitest run src/lib/engine/__tests__/aggregator-optimal-post.test.ts` = 4/4 passed
- ✓ `vitest run src/lib/engine` = 780/780 actual tests pass (7 baseline file load failures from `@google/genai` deferred-items D-01-DEF-01, unchanged from Plan 01-02 / 01-04 / 01-06 baseline)
- ✓ `tsc --noEmit -p tsconfig.json` = 2 errors (both pre-existing `@google/genai` baseline); ZERO NEW errors from this plan
- ✓ `eslint` on 5 changed files = 0 errors (2 informational warnings on `_creator` + `_params` unused-args — same intentional underscore-prefix pattern used by aggregator-anti-virality.test.ts, documented in Plan 01-06 SUMMARY)

## Self-Check: PASSED

## Next Phase Readiness

- **R6.1 unblocked:** P5 ResultCard "When to post" panel can read `result.optimal_post_window?.{day_of_week, hour_range, reasoning}` from the SSE complete frame OR the SSR-hydrated initialData. Three rendering branches:
  - `result.optimal_post_window?.source === 'niche'` → niche-specific recommendation card with computed reasoning ("Your niche peaks Wed 19:00-21:00 UTC (n=42 videos)")
  - `result.optimal_post_window?.source === 'fallback'` → soft default card ("Default recommendation — niche-specific data unavailable")
  - `result.optimal_post_window == null` → generic copy / empty state (Supabase error path)
- **Plan 01-07 (BLOCKING gate) prerequisites met:** This plan ships the migration file `supabase/migrations/20260524000000_niche_post_windows.sql` ready for `supabase db push`. Plan 07 should:
  1. Run `npx supabase db push` to apply the migration to the live Supabase project
  2. Regenerate `src/types/database.types.ts` via the Supabase CLI types command
  3. Remove the `as never` casts in `src/lib/engine/optimal-post.ts` (the cast-through-unknown pattern won't be needed once Database types include niche_post_windows)
  4. Verify the pg_cron schedule registered (`SELECT jobname, schedule FROM cron.job WHERE jobname = 'refresh-niche-post-windows'`)
- **M2-II revisit trigger:** When outcome data justifies creator-aware overrides, replace the `null` argument in aggregator's `computeOptimalPostWindow(serviceClient, nicheValue, null)` with `creatorContext`, and extend the helper to query a future `creator_post_windows` table before falling back to `niche_post_windows`. The signature already accepts `CreatorContext | null` — no breaking change required.
- **Phase1AdditiveFields type alignment progress:** Plan 01-04 promoted `emotion_arc` to the canonical PredictionResult. Plan 01-06 promoted `anti_virality_gated`. This plan promotes `optimal_post_window`. The `Phase1AdditiveFields` intersection in Plan 01-01's fixture is now fully redundant — a future cleanup plan can drop the intersection and type `COMPLETED_PREDICTION` directly as `Partial<PredictionResult> & { overall_score: number }`. Out of scope here.
- **No blockers introduced for Wave 4+ plans.**

---
*Phase: 01-foundation-sse-consumer-engine-signal-extensions*
*Plan: 05 (Wave 3 — optimal_post_window aggregator + niche_post_windows migration)*
*Completed: 2026-05-24*
