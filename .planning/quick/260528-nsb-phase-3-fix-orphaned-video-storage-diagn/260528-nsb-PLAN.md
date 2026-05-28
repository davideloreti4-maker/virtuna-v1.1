---
quick_task: 260528-nsb
phase: 3
title: Fix orphaned video storage + dangling DB references
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/analyze/route.ts
  - src/app/api/cron/delete-retained-videos/route.ts
  - src/app/api/cron/sweep-orphan-videos/route.ts
  - vercel.json
  - src/app/api/analyze/__tests__/route.test.ts
  - src/app/api/cron/delete-retained-videos/__tests__/route.test.ts
  - scripts/backfill-orphan-storage.ts
autonomous: true
requirements:
  - ROADMAP-PHASE-3
must_haves:
  truths:
    - "Cache-hit branch in /api/analyze cleans up uploaded storage object for opted-out users"
    - "All early-return branches in /api/analyze (auth/413/rate-limit/validation/pipeline-throw) clean up uploaded storage object for opted-out users"
    - "Retention cron nulls video_storage_path on analysis_results rows after successfully deleting storage objects"
    - "Weekly orphan-sweeper cron deletes storage objects in videos/ bucket older than 24h with no matching analysis_results row"
    - "Backfill script remediates the 18 existing orphan storage objects and 9 dangling DB references"
    - "Regression tests fail before the fix lands and pass after; assert storage<->DB consistency on cache-hit + retention-cron paths"
  artifacts:
    - path: "src/app/api/analyze/route.ts"
      provides: "Cleanup on every early-return + cache-hit branch"
      contains: "service.storage.from(\"videos\").remove"
    - path: "src/app/api/cron/delete-retained-videos/route.ts"
      provides: "Atomic storage-delete + video_storage_path null-out"
      contains: "video_storage_path"
    - path: "src/app/api/cron/sweep-orphan-videos/route.ts"
      provides: "Weekly orphan-sweeper cron"
      exports: ["GET"]
    - path: "vercel.json"
      provides: "Cron schedule for sweep-orphan-videos"
      contains: "sweep-orphan-videos"
    - path: "src/app/api/analyze/__tests__/route.test.ts"
      provides: "Regression coverage for cache-hit + early-return cleanup"
    - path: "src/app/api/cron/delete-retained-videos/__tests__/route.test.ts"
      provides: "Regression coverage for retention cron null-out"
    - path: "scripts/backfill-orphan-storage.ts"
      provides: "One-shot remediation of 18 orphans + 9 dangling refs"
  key_links:
    - from: "src/app/api/analyze/route.ts (cache-hit branch line ~232-264)"
      to: "Supabase Storage videos/ bucket"
      via: "service.storage.from(\"videos\").remove([validated.video_storage_path])"
      pattern: "cache_hit.*storage.*remove"
    - from: "src/app/api/cron/delete-retained-videos/route.ts (post-delete)"
      to: "analysis_results.video_storage_path"
      via: "UPDATE analysis_results SET video_storage_path = NULL WHERE id = ANY(...)"
      pattern: "video_storage_path.*null"
    - from: "src/app/api/cron/sweep-orphan-videos/route.ts"
      to: "storage.objects videos/ bucket"
      via: "anti-join analysis_results.video_storage_path, remove objects older than 24h"
      pattern: "NOT EXISTS.*video_storage_path"
---

<objective>
Fix BOTH failure modes confirmed by live Supabase diagnostics on project `qyxvxleheckijapurisj`:

- **Mode A** (18 orphan storage objects): `/api/analyze/route.ts` fails fast on auth/413/rate-limit/validation/cache-hit/pipeline-throw without cleaning up the storage object the client already uploaded. Cache-hit branch (lines 232-264) is the single highest-leverage source.
- **Mode B** (9 dangling DB references — includes the user-visible repro `-I4GtlGVCQKO`): retention cron `delete-retained-videos/route.ts:61-63` removes storage objects but never nulls `analysis_results.video_storage_path`, so `/api/videos/sign` returns 404 instead of "retained-then-deleted".

Purpose: ROADMAP Phase 3 ships with a regression test that would have caught either mode, plus a sweeper cron that prevents future drift and a one-shot backfill that zeroes both populations today.

Output: hardened `/api/analyze` early-return paths, transactional retention cron, new weekly sweeper cron, regression tests, backfill script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/260528-nsb-phase-3-fix-orphaned-video-storage-diagn/260528-nsb-RESEARCH.md
@CLAUDE.md
@src/app/api/analyze/route.ts
@src/app/api/cron/delete-retained-videos/route.ts
@src/app/api/videos/sign/route.ts
@vercel.json

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

Cleanup call pattern (already correct at route.ts:381-387 and 572-578 — replicate):
```typescript
if (
  validated.input_mode === "video_upload" &&
  validated.video_storage_path &&
  !retentionOptedIn
) {
  service.storage
    .from("videos")
    .remove([validated.video_storage_path])
    .catch((err) => {
      log.warn("storage_cleanup_failed", { err, path: validated.video_storage_path });
    });
}
```

Cron-auth pattern (reuse for sweeper):
```typescript
import { verifyCronAuth } from "@/lib/cron-auth";
// At top of GET handler:
const authError = verifyCronAuth(request);
if (authError) return authError as NextResponse;
```

Service-client pattern (reuse for sweeper):
```typescript
import { createServiceClient } from "@/lib/supabase/service";
const supabase = createServiceClient();
```

Logger pattern (reuse for sweeper):
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "cron/sweep-orphan-videos" });
```

Existing test mock surface (route.test.ts:68 already mocks storage.retention):
- `mocks.profile` controls `storage_retention_opted_in`
- `mocks.cache` controls cache-hit branch
- Spy on `service.storage.from().remove()` to assert cleanup
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add cleanup to ALL /api/analyze early-return branches (Mode A fix)</name>
  <files>src/app/api/analyze/route.ts</files>
  <behavior>
    Cleanup invariant: every code path in POST /api/analyze that returns BEFORE the placeholder INSERT at line ~413 MUST call `service.storage.from("videos").remove([validated.video_storage_path])` when `validated.input_mode === "video_upload"`, `validated.video_storage_path` is truthy, and `!retentionOptedIn`.

    Branches to harden (referencing RESEARCH.md code-path map):
    - **Cache-hit branch (lines ~232-264)** — HIGHEST LEVERAGE. Both `wantsJSON` and SSE sub-branches must clean up before returning. This is the steady-state orphan source.
    - **Rate-limit branch (lines ~175-186)** — 429 return path.
    - **Zod validation throw (lines ~207-215)** — caught in outer catch; outer catch must clean up.
    - **JSON-branch pipeline throw (outer catch at line ~607)** — must clean up before returning 500.
    - **SSE-branch pipeline throw (inner catch at line ~587)** — must clean up before sending `event: error`.

    NOT in scope (already correct or no orphan risk):
    - Auth fail at lines 48-73 — at that point `validated` doesn't exist yet, so `validated.video_storage_path` is unavailable. Auth fail produces an orphan but client-side `try/finally` would be needed; defer to client-side fix in a future phase if Sentry shows this in the wild. Document in code comment.
    - 413 content-length reject at line 48-73 — same reason. Document.
    - Successful response paths (lines 381-387 and 572-578) — already correct.

    Note `retentionOptedIn` is resolved at the top of the handler from `creator_profiles.storage_retention_opted_in`. Reuse that variable; do NOT re-query.

    Use the cleanup helper pattern from `<interfaces>` above. Extract to a local helper `void cleanupUploadedStorage(service, validated, retentionOptedIn, log)` to avoid duplicating the 8-line block 5+ times. Helper logs `storage_cleanup_failed` on `.catch` (do NOT swallow silently per RESEARCH pitfall #9).

    Reference RESEARCH.md "Failure Mode A" — this task closes the producer side. Mode B is closed in Task 2.
  </behavior>
  <action>
    1. Read full `/Users/davideloreti/virtuna-mvp-cut/src/app/api/analyze/route.ts` in one pass.
    2. At top of file (after existing imports), add a local helper:
       ```typescript
       function cleanupUploadedStorage(
         service: SupabaseServiceClient,
         validated: AnalysisInput,
         retentionOptedIn: boolean,
         log: ReturnType<typeof createLogger>
       ): void {
         if (
           validated.input_mode === "video_upload" &&
           validated.video_storage_path &&
           !retentionOptedIn
         ) {
           service.storage
             .from("videos")
             .remove([validated.video_storage_path])
             .catch((err) => {
               log.warn("storage_cleanup_failed", {
                 err: err instanceof Error ? err.message : String(err),
                 path: validated.video_storage_path,
               });
             });
         }
       }
       ```
       Use the existing `validated` type (look up at top of handler — likely `z.infer<typeof AnalysisInputSchema>` or similar). If type is awkward to extract, accept `validated: { input_mode: string; video_storage_path?: string | null }`.
    3. **Cache-hit branch (line ~232-264):** Insert `cleanupUploadedStorage(service, validated, retentionOptedIn, log)` immediately after the `log.info("cache_hit ...")` call and BEFORE both the `wantsJSON` return and the SSE return. Single call covers both sub-branches.
    4. **Rate-limit branch (~175-186):** `retentionOptedIn` and `validated` likely not yet resolved at this point. Move the rate-limit check below the `retentionOptedIn` resolution + `AnalysisInputSchema.parse` (Zod), OR if reordering is risky, accept that rate-limit-branch orphans require client-side cleanup. Decision: **reorder rate-limit to AFTER validation + retentionOptedIn resolution** so the helper can run. Confirm tests at task end.
    5. **Zod validation throw (~207-215):** Wrap the `AnalysisInputSchema.parse` call. If it throws AND `body.video_storage_path` is present AND `body.input_mode === "video_upload"`, call cleanup using `body` (not yet validated). Add a narrower helper variant `cleanupRawUpload(service, body, retentionOptedIn, log)` if needed. If `retentionOptedIn` isn't resolved yet at this branch, resolve it eagerly before parse OR default to performing cleanup (better to over-clean than orphan).
    6. **JSON-branch outer catch (~line 607):** In the catch block, before `return Response.json({ error: ... }, { status: 500 })`, call `cleanupUploadedStorage(...)`.
    7. **SSE-branch inner catch (~line 587-606):** Before `send("error", ...)` and `controller.close()`, call cleanup.
    8. After every change, run `pnpm exec tsc --noEmit` to confirm zero type errors.
    9. Run `pnpm test src/app/api/analyze` to confirm no regressions in existing tests. New tests added in Task 4 will exercise the new branches.

    Specificity note: do NOT remove or change the existing successful-response cleanup at lines 381-387 / 572-578. Those work today.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && pnpm exec tsc --noEmit 2>&1 | grep -E "error" | head -20 || echo "TSC OK"; grep -n "cleanupUploadedStorage\|storage_cleanup_failed" src/app/api/analyze/route.ts | head -20</automated>
  </verify>
  <done>
    - Helper `cleanupUploadedStorage` exists at top of `route.ts`.
    - Cache-hit branch (lines ~232-264) invokes helper before BOTH `Response.json` and SSE return paths.
    - Rate-limit branch invokes helper (reorder if necessary; document in commit message).
    - JSON-branch outer catch invokes helper before 500 return.
    - SSE-branch inner catch invokes helper before `send("error", ...)`.
    - Zod-parse throw path invokes cleanup (via outer catch or pre-parse helper).
    - `pnpm exec tsc --noEmit` returns 0 errors.
    - `pnpm test src/app/api/analyze` passes (existing tests still green).
    - All five `cleanupUploadedStorage` call sites visible via grep.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Retention cron nulls video_storage_path after delete (Mode B fix)</name>
  <files>src/app/api/cron/delete-retained-videos/route.ts</files>
  <behavior>
    Invariant: after `storage.from("videos").remove(paths)` returns success, the matching `analysis_results` rows MUST have `video_storage_path = NULL`. If the storage delete fails, do NOT null the column (preserve current behavior of returning 500 so the cron retries tomorrow).

    Specifically, the new flow is:
    1. Query expired rows (existing logic, unchanged).
    2. Extract `paths` AND `ids` from the result set.
    3. Batch delete storage objects (existing logic, unchanged).
    4. **NEW:** If storage delete succeeded, run `UPDATE analysis_results SET video_storage_path = NULL WHERE id = ANY($1::text[])` with the matching ids. This is idempotent (re-running on already-nulled rows is a no-op).
    5. Log `deleted` and `nulled` counts separately for observability.

    Edge case: if the UPDATE fails AFTER the storage delete succeeded, log it as `retention_null_failed` at ERROR level (data drift), but still return 200 — the storage delete is the user-visible action and re-running the cron will re-null on the next pass (idempotent because the rows still have non-null `video_storage_path`).

    This closes the source of the 9 dangling references including `-I4GtlGVCQKO`. Backfill (Task 5) closes the existing population.
  </behavior>
  <action>
    1. Read `src/app/api/cron/delete-retained-videos/route.ts` (already in context).
    2. After the `select(...)` at line 37-44, also extract `ids`:
       ```typescript
       const ids = (expiredRows ?? []).map((r) => r.id as string).filter(Boolean);
       const paths = (expiredRows ?? [])
         .map((r) => r.video_storage_path as string)
         .filter(Boolean);
       ```
       (Keep existing `paths` derivation but capture `ids` alongside.)
    3. After the existing storage delete block (lines 60-71), AFTER confirming `deleteError` is falsy, run:
       ```typescript
       const { error: nullError } = await supabase
         .from("analysis_results")
         .update({ video_storage_path: null })
         .in("id", ids);

       if (nullError) {
         log.error("retention_null_failed", {
           error: nullError.message,
           ids_count: ids.length,
         });
         // Don't return 500 — storage delete succeeded. Next cron run will re-null.
       }
       ```
    4. Update the final success log + response to include both counts:
       ```typescript
       log.info("Retention cron completed", {
         deleted: paths.length,
         nulled: nullError ? 0 : ids.length,
       });
       return NextResponse.json({
         status: "completed",
         deleted: paths.length,
         nulled: nullError ? 0 : ids.length,
       });
       ```
    5. Run `pnpm exec tsc --noEmit`. Fix any type issues (likely none — `update().in()` is standard PostgREST).
    6. Run `pnpm test src/app/api/cron/delete-retained-videos` (new tests added in Task 4).

    Do NOT change the existing query, the `!inner` join, the 30-day window, or the auth check.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && pnpm exec tsc --noEmit 2>&1 | grep "delete-retained-videos" | head -5 || echo "TSC OK"; grep -nE "video_storage_path.*null|update.*video_storage_path" src/app/api/cron/delete-retained-videos/route.ts</automated>
  </verify>
  <done>
    - `delete-retained-videos/route.ts` extracts both `ids` and `paths` from the query.
    - After successful storage delete, runs `update({ video_storage_path: null }).in("id", ids)`.
    - Null-update failure is logged at ERROR but does not return 500.
    - Final response includes both `deleted` and `nulled` counts.
    - `pnpm exec tsc --noEmit` returns 0 errors.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add weekly orphan-sweeper cron (safety net for future drift)</name>
  <files>src/app/api/cron/sweep-orphan-videos/route.ts, vercel.json</files>
  <behavior>
    New cron at `/api/cron/sweep-orphan-videos`:
    - List storage objects in `videos/` bucket older than 24 hours (cushion to avoid racing in-flight uploads).
    - Anti-join against `analysis_results.video_storage_path`.
    - Delete objects with no DB referent.
    - Log count BEFORE and AFTER for observability (Sentry breadcrumb via `log.info`).
    - Idempotent: re-running cleans residual orphans; no-op when none exist.
    - Returns JSON `{ status, listed, orphaned, deleted }`.

    Scheduled weekly at `0 4 * * 0` (Sunday 04:00 UTC) — offset from existing 03:00 retention cron to avoid contention.

    Auth: `verifyCronAuth` (CRON_SECRET header), same as existing crons.

    Edge cases:
    - Empty bucket → return `{ status: "completed", listed: 0, orphaned: 0, deleted: 0 }`.
    - Storage list pagination: Supabase Storage list() default limit is 100. Loop with `offset` until result is shorter than limit. Set hard max of 10,000 objects per run as safety stop; log if hit.
    - Delete failure: log error, return 500.
  </behavior>
  <action>
    1. Create `src/app/api/cron/sweep-orphan-videos/route.ts`:
       ```typescript
       import { NextResponse } from "next/server";
       import { verifyCronAuth } from "@/lib/cron-auth";
       import { createServiceClient } from "@/lib/supabase/service";
       import { createLogger } from "@/lib/logger";

       const log = createLogger({ module: "cron/sweep-orphan-videos" });
       const PAGE_SIZE = 100;
       const MAX_OBJECTS_PER_RUN = 10_000;
       const MIN_AGE_HOURS = 24;

       export async function GET(request: Request): Promise<NextResponse> {
         const authError = verifyCronAuth(request);
         if (authError) return authError as NextResponse;

         const supabase = createServiceClient();
         const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000);

         try {
           // 1. List all storage objects across users (paginated).
           const allObjects: { name: string; created_at: string }[] = [];
           let offset = 0;
           while (allObjects.length < MAX_OBJECTS_PER_RUN) {
             const { data, error } = await supabase.storage
               .from("videos")
               .list("", {
                 limit: PAGE_SIZE,
                 offset,
                 sortBy: { column: "created_at", order: "asc" },
               });
             if (error) {
               log.error("sweep_list_failed", { error: error.message, offset });
               return NextResponse.json({ error: "List failed" }, { status: 500 });
             }
             if (!data || data.length === 0) break;
             allObjects.push(
               ...data.map((o) => ({
                 name: o.name,
                 created_at: o.created_at ?? new Date().toISOString(),
               }))
             );
             if (data.length < PAGE_SIZE) break;
             offset += PAGE_SIZE;
           }

           // NOTE: Supabase storage.list("") returns top-level entries.
           // Video paths are `{user_id}/{nanoid}.mp4` — top-level is the user_id folder.
           // To get actual video files, list each user folder. For simplicity at MVP scale,
           // use a SQL query against storage.objects directly via .from("storage.objects")
           // OR loop per top-level folder. Pick the SQL path:
           const { data: storageRows, error: sqlError } = await supabase
             .schema("storage")
             .from("objects")
             .select("name, created_at")
             .eq("bucket_id", "videos")
             .lt("created_at", cutoff.toISOString())
             .limit(MAX_OBJECTS_PER_RUN);

           if (sqlError) {
             log.error("sweep_sql_failed", { error: sqlError.message });
             return NextResponse.json({ error: "Query failed" }, { status: 500 });
           }

           const candidatePaths = (storageRows ?? []).map((r) => r.name as string);
           const listed = candidatePaths.length;

           if (listed === 0) {
             log.info("sweep_completed_empty", { listed: 0 });
             return NextResponse.json({
               status: "completed",
               listed: 0,
               orphaned: 0,
               deleted: 0,
             });
           }

           // 2. Anti-join: find which candidates have NO matching analysis_results row.
           const { data: matchedRows, error: matchError } = await supabase
             .from("analysis_results")
             .select("video_storage_path")
             .in("video_storage_path", candidatePaths);

           if (matchError) {
             log.error("sweep_match_failed", { error: matchError.message });
             return NextResponse.json({ error: "Match query failed" }, { status: 500 });
           }

           const matched = new Set(
             (matchedRows ?? [])
               .map((r) => r.video_storage_path as string | null)
               .filter((p): p is string => p !== null)
           );

           const orphans = candidatePaths.filter((p) => !matched.has(p));

           log.info("sweep_orphans_found", {
             listed,
             orphaned: orphans.length,
           });

           if (orphans.length === 0) {
             return NextResponse.json({
               status: "completed",
               listed,
               orphaned: 0,
               deleted: 0,
             });
           }

           // 3. Delete orphans from storage.
           const { error: deleteError } = await supabase.storage
             .from("videos")
             .remove(orphans);

           if (deleteError) {
             log.error("sweep_delete_failed", {
               error: deleteError.message,
               orphans_count: orphans.length,
             });
             return NextResponse.json(
               { error: "Storage delete failed" },
               { status: 500 }
             );
           }

           log.info("sweep_completed", {
             listed,
             orphaned: orphans.length,
             deleted: orphans.length,
           });
           return NextResponse.json({
             status: "completed",
             listed,
             orphaned: orphans.length,
             deleted: orphans.length,
           });
         } catch (error) {
           log.error("sweep_cron_failed", {
             error: error instanceof Error ? error.message : String(error),
           });
           return NextResponse.json(
             { error: "Sweep cron failed" },
             { status: 500 }
           );
         }
       }
       ```

       **Simplification note:** The `supabase.storage.list("")` block above is dead-pathed by the immediate `storageRows` query that uses the `storage` schema directly. Remove the dead pagination block before committing — keep only the `.schema("storage").from("objects")` query. The two were both shown for the executor to understand intent; pick the SQL path.

    2. Update `vercel.json` to add the new cron entry after the existing `delete-retained-videos` block:
       ```json
       {
         "path": "/api/cron/sweep-orphan-videos",
         "schedule": "0 4 * * 0"
       }
       ```

    3. Verify the supabase service client has access to `storage.objects` via `.schema("storage")`. If `.schema()` is unavailable on this client version, fall back to a plain SQL RPC: create a Supabase RPC function `list_orphan_video_paths(min_age_hours int)` in a migration. **For MVP scale (~few hundred objects), the `.schema("storage").from("objects")` path is preferred — Supabase JS v2+ supports it.** Verify with `npx --yes ctx7@latest library supabase-js` if uncertain.

    4. Run `pnpm exec tsc --noEmit` to confirm zero type errors.
    5. Run `pnpm build` to confirm the new route compiles.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && pnpm exec tsc --noEmit 2>&1 | grep "sweep-orphan-videos" | head -5 || echo "TSC OK"; test -f src/app/api/cron/sweep-orphan-videos/route.ts && echo "ROUTE EXISTS"; grep -c "sweep-orphan-videos" vercel.json</automated>
  </verify>
  <done>
    - `src/app/api/cron/sweep-orphan-videos/route.ts` exists, exports `GET`.
    - Uses `verifyCronAuth`, `createServiceClient`, `createLogger`.
    - Queries `storage.objects` (via `.schema("storage")` or fallback RPC), anti-joins `analysis_results`, deletes orphans older than 24h.
    - Returns `{ status, listed, orphaned, deleted }` JSON.
    - `vercel.json` has new cron entry `/api/cron/sweep-orphan-videos` at `0 4 * * 0`.
    - `pnpm exec tsc --noEmit` returns 0 errors.
    - `pnpm build` succeeds.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Regression tests — cache-hit cleanup + retention cron null-out</name>
  <files>src/app/api/analyze/__tests__/route.test.ts, src/app/api/cron/delete-retained-videos/__tests__/route.test.ts</files>
  <behavior>
    Two test files must each contain at least one test that FAILS before the corresponding fix lands and PASSES after.

    **/api/analyze tests (Task 1 coverage):**
    1. `cache-hit-cleans-up-uploaded-storage`: POST with `input_mode: "video_upload"`, `video_storage_path: "user-x/abc.mp4"`, mock `lookupPredictionCache` to return a hit, mock `creator_profiles.storage_retention_opted_in = false`. Assert `service.storage.from("videos").remove` was called with `["user-x/abc.mp4"]` before the response returns.
    2. `cache-hit-skips-cleanup-for-opted-in-user`: same but `storage_retention_opted_in = true`. Assert `.remove` was NOT called.
    3. `rate-limit-cleans-up-uploaded-storage`: force rate-limit, opted-out user. Assert `.remove` called. (Depends on Task 1 reorder of rate-limit check.)
    4. `pipeline-throw-cleans-up-uploaded-storage` (JSON branch): mock `runPredictionPipeline` to throw, opted-out user. Assert `.remove` called in the outer catch.

    **/api/cron/delete-retained-videos tests (Task 2 coverage):**
    5. `nulls-video-storage-path-after-successful-delete`: mock query returning 2 expired rows `[{id: "row-a", video_storage_path: "a/v1.mp4"}, {id: "row-b", video_storage_path: "b/v2.mp4"}]`, mock storage.remove to succeed. Assert `supabase.from("analysis_results").update({ video_storage_path: null }).in("id", ["row-a", "row-b"])` was invoked.
    6. `does-not-null-when-storage-delete-fails`: mock storage.remove to return an error. Assert `.update` was NOT invoked. Asserts return 500.
    7. `logs-but-does-not-throw-when-null-update-fails`: mock storage.remove success, mock update to return an error. Assert response is still 200 with `deleted: 2, nulled: 0`. Assert error logged.

    Each test must be runnable with `pnpm test <file>` and complete in < 5 seconds.
  </behavior>
  <action>
    1. Read existing `src/app/api/analyze/__tests__/route.test.ts` (line 68 already has the storage-retention mock per RESEARCH). Identify the mock surface for `service.storage.from().remove()` and `lookupPredictionCache`.
    2. Add four new test blocks to `route.test.ts` matching tests 1-4 above. Use the existing `describe`/`it` structure and mocks. Use `vi.spyOn` (Vitest) on the storage `.remove` to capture call args.

       Example skeleton (adapt to existing harness):
       ```typescript
       it("cache-hit cleans up uploaded storage for opted-out users", async () => {
         const removeSpy = vi.fn().mockResolvedValue({ data: null, error: null });
         mocks.service.storage.from.mockReturnValue({ remove: removeSpy, /* ... */ });
         mocks.profile.storage_retention_opted_in = false;
         mocks.cache.lookupPredictionCache.mockResolvedValueOnce({ /* cached result */ });

         const req = mockPostRequest({
           input_mode: "video_upload",
           video_storage_path: "user-x/abc.mp4",
           content_text: "x".repeat(20),
         });

         const res = await POST(req);
         expect(res.status).toBe(200);
         expect(removeSpy).toHaveBeenCalledWith(["user-x/abc.mp4"]);
       });
       ```

    3. Read `src/app/api/cron/delete-retained-videos/__tests__/route.test.ts` if it exists; if not, create it. Use the pattern from existing cron tests (look for any existing cron test as scaffolding):
       ```bash
       ls src/app/api/cron/*/__tests__/ 2>/dev/null
       ```
       If no existing cron test exists to copy from, scaffold with `vi.mock("@/lib/supabase/service")` and `vi.mock("@/lib/cron-auth")` returning `null` (auth pass).

    4. Add three test blocks (5-7) to the new file. Each test must mock the `from("analysis_results").select(...)` chain to return controlled `expiredRows`, mock storage `.remove`, and (for test 7) mock `.update().in()` to return an error.

    5. Run BEFORE Task 1 and Task 2 changes to confirm tests fail. (If executor runs Tasks 1+2+4 in order, run tests after task 2 lands; they should now pass.)

    6. Run `pnpm test src/app/api/analyze src/app/api/cron/delete-retained-videos` — all green.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && pnpm test src/app/api/analyze src/app/api/cron/delete-retained-videos -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|✗|cache-hit|nulls-video-storage-path|pipeline-throw)" | head -20</automated>
  </verify>
  <done>
    - 4 new tests in `route.test.ts` covering cache-hit cleanup, opt-in skip, rate-limit cleanup, pipeline-throw cleanup.
    - 3 new tests in `delete-retained-videos/__tests__/route.test.ts` covering null-after-delete, no-null-on-delete-failure, no-throw-on-null-failure.
    - All 7 tests pass after Tasks 1+2 land.
    - `pnpm test` (full suite) remains green.
  </done>
</task>

<task type="auto">
  <name>Task 5: Backfill script — remediate existing 18 orphans + 9 dangling refs</name>
  <files>scripts/backfill-orphan-storage.ts</files>
  <action>
    1. Create `scripts/backfill-orphan-storage.ts`:
       ```typescript
       /**
        * One-shot backfill script for Phase 3 (quick task 260528-nsb).
        *
        * Remediates two populations confirmed on 2026-05-28 by Supabase diagnostics
        * on project qyxvxleheckijapurisj:
        *
        * Mode A — 18 orphan storage objects in videos/ bucket with no DB referent.
        *           → Delete them.
        * Mode B — 9 analysis_results rows with video_storage_path set but storage gone.
        *           → Null out video_storage_path.
        *
        * Usage:
        *   pnpm tsx scripts/backfill-orphan-storage.ts --dry-run
        *   pnpm tsx scripts/backfill-orphan-storage.ts --apply
        *
        * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
        */

       import { createClient } from "@supabase/supabase-js";

       const apply = process.argv.includes("--apply");
       const dryRun = !apply;

       const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
       const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

       if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
         console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
         process.exit(1);
       }

       const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
         auth: { persistSession: false },
       });

       async function findOrphans(): Promise<string[]> {
         // Mode A: storage objects without a matching analysis_results row.
         const { data, error } = await supabase
           .schema("storage")
           .from("objects")
           .select("name")
           .eq("bucket_id", "videos");
         if (error) throw new Error(`List storage failed: ${error.message}`);

         const allPaths = (data ?? []).map((r) => r.name as string);
         if (allPaths.length === 0) return [];

         const { data: matched, error: matchErr } = await supabase
           .from("analysis_results")
           .select("video_storage_path")
           .in("video_storage_path", allPaths);
         if (matchErr) throw new Error(`Match query failed: ${matchErr.message}`);

         const matchedSet = new Set(
           (matched ?? [])
             .map((r) => r.video_storage_path as string | null)
             .filter((p): p is string => p !== null)
         );
         return allPaths.filter((p) => !matchedSet.has(p));
       }

       async function findDanglingRefs(): Promise<{ id: string; path: string }[]> {
         // Mode B: analysis_results rows with video_storage_path but missing storage object.
         const { data: rows, error } = await supabase
           .from("analysis_results")
           .select("id, video_storage_path")
           .not("video_storage_path", "is", null);
         if (error) throw new Error(`Query analysis_results failed: ${error.message}`);

         if (!rows || rows.length === 0) return [];

         const paths = rows.map((r) => r.video_storage_path as string);
         const { data: existing, error: storErr } = await supabase
           .schema("storage")
           .from("objects")
           .select("name")
           .eq("bucket_id", "videos")
           .in("name", paths);
         if (storErr) throw new Error(`Storage check failed: ${storErr.message}`);

         const existingSet = new Set(
           (existing ?? []).map((r) => r.name as string)
         );
         return rows
           .filter((r) => !existingSet.has(r.video_storage_path as string))
           .map((r) => ({
             id: r.id as string,
             path: r.video_storage_path as string,
           }));
       }

       async function main() {
         console.log(`[backfill] mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);

         const orphans = await findOrphans();
         console.log(`[backfill] Mode A — orphan storage objects: ${orphans.length}`);
         orphans.slice(0, 30).forEach((p) => console.log(`  ${p}`));

         const dangling = await findDanglingRefs();
         console.log(`[backfill] Mode B — dangling DB references: ${dangling.length}`);
         dangling.slice(0, 30).forEach((d) => console.log(`  ${d.id} → ${d.path}`));

         if (dryRun) {
           console.log("[backfill] Dry run complete. Re-run with --apply to remediate.");
           return;
         }

         if (orphans.length > 0) {
           const { error: delErr } = await supabase.storage
             .from("videos")
             .remove(orphans);
           if (delErr) {
             console.error(`[backfill] Storage delete failed: ${delErr.message}`);
             process.exit(1);
           }
           console.log(`[backfill] Deleted ${orphans.length} orphan storage objects.`);
         }

         if (dangling.length > 0) {
           const ids = dangling.map((d) => d.id);
           const { error: updErr } = await supabase
             .from("analysis_results")
             .update({ video_storage_path: null })
             .in("id", ids);
           if (updErr) {
             console.error(`[backfill] Update failed: ${updErr.message}`);
             process.exit(1);
           }
           console.log(`[backfill] Nulled video_storage_path on ${ids.length} rows.`);
         }

         console.log("[backfill] Done.");
       }

       main().catch((err) => {
         console.error("[backfill] Fatal:", err);
         process.exit(1);
       });
       ```

    2. Run dry-run to confirm output matches RESEARCH diagnostics (18 + 9):
       ```bash
       cd /Users/davideloreti/virtuna-mvp-cut && pnpm tsx scripts/backfill-orphan-storage.ts --dry-run
       ```
       Expected output (approx, may have drifted since 2026-05-28):
       ```
       [backfill] Mode A — orphan storage objects: 18
       [backfill] Mode B — dangling DB references: 9
       ```

    3. DO NOT auto-apply. Surface to user in PR description: "Run `pnpm tsx scripts/backfill-orphan-storage.ts --apply` after merge to remediate the 18 + 9 production records. Idempotent; safe to re-run."

    4. Confirm script is in `.gitignore` exclusion list (scripts/ is tracked per CLAUDE.md). It is — leave it.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && test -f scripts/backfill-orphan-storage.ts && echo "SCRIPT EXISTS" && pnpm exec tsc --noEmit scripts/backfill-orphan-storage.ts 2>&1 | head -5 || true; grep -E "Mode A|Mode B|--apply|--dry-run" scripts/backfill-orphan-storage.ts | head -10</automated>
  </verify>
  <done>
    - `scripts/backfill-orphan-storage.ts` exists.
    - Supports `--dry-run` (default) and `--apply` flags.
    - Dry-run output reports counts for both Mode A and Mode B.
    - `--apply` deletes orphans + nulls dangling refs in a single run.
    - TypeScript compiles cleanly.
    - Script is idempotent (re-runnable, no state).
  </done>
</task>

</tasks>

<verification>
After all 5 tasks complete:

1. **Code path coverage:**
   ```bash
   cd /Users/davideloreti/virtuna-mvp-cut
   # All cleanup call sites in /api/analyze
   grep -nE "cleanupUploadedStorage|storage_cleanup_failed" src/app/api/analyze/route.ts
   # Retention cron null-out
   grep -nE "update.*video_storage_path.*null" src/app/api/cron/delete-retained-videos/route.ts
   # New sweeper cron route
   test -f src/app/api/cron/sweep-orphan-videos/route.ts && echo "SWEEPER OK"
   # Vercel cron registry
   grep -c "sweep-orphan-videos" vercel.json
   # Backfill script
   test -f scripts/backfill-orphan-storage.ts && echo "BACKFILL OK"
   ```

2. **Build + type + test green:**
   ```bash
   pnpm exec tsc --noEmit
   pnpm build
   pnpm test src/app/api/analyze src/app/api/cron
   ```

3. **Post-merge production remediation (manual, not in CI):**
   ```bash
   pnpm tsx scripts/backfill-orphan-storage.ts --dry-run    # confirm counts
   pnpm tsx scripts/backfill-orphan-storage.ts --apply       # remediate
   ```
   Then re-run the diagnostic queries from RESEARCH.md and confirm both return 0.
</verification>

<success_criteria>
ROADMAP Phase 3 success criteria — all met:

1. **Root cause documented** ✓ — `260528-nsb-RESEARCH.md` (Failure Mode A + Mode B with mechanisms and live counts).

2. **Fix lands with a test that fails before and passes after** ✓ — Task 4 adds 7 tests: cache-hit cleanup (Mode A), retention cron null-out (Mode B), plus negative cases (opt-in skip, delete-failure preservation).

3. **Re-run of original orphan repro produces zero orphaned objects** ✓ — Tasks 1+2 close the producers; Task 3 adds weekly safety net; Task 5 remediates the existing 18+9 population. Post-apply, the verification queries from RESEARCH.md return 0/0.

Additional invariants beyond ROADMAP minimum:
- Sweeper cron deployed to Vercel via `vercel.json` (auto-discovered on next deploy).
- Backfill script is idempotent and safe to re-run.
- All cleanup uses logging (no silent `.catch(() => {})`).
</success_criteria>

<output>
After completion, create `.planning/quick/260528-nsb-phase-3-fix-orphaned-video-storage-diagn/260528-nsb-SUMMARY.md` summarizing:
- Failure modes addressed (A + B)
- Files changed
- Test count delta
- Post-merge backfill instruction
- Remaining follow-ups (e.g., if auth-fail / 413 branch orphans observed in Sentry, add client-side `try/finally` cleanup in a future quick task)
</output>
