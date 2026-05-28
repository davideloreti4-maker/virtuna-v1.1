---
status: complete
quick_task: 260528-nsb
phase: 3
title: Fix orphaned video storage + dangling DB references
completed: "2026-05-28T15:27:27Z"
duration_approx: "~30 min"
commits:
  - 4e074de: fix(phase-3): add storage cleanup to all early-return branches in /api/analyze (Mode A)
  - b0d38f3: fix(phase-3): retention cron nulls video_storage_path after storage delete (Mode B)
  - 79518a2: feat(phase-3): add weekly orphan-sweeper cron at /api/cron/sweep-orphan-videos
  - 70ed338: test(phase-3): add regression tests for Mode A + Mode B storage fixes (7 new tests)
  - bf27eb3: feat(phase-3): add backfill script for 18 orphan storage objects + 9 dangling DB refs
tags: [storage, cron, orphan, cleanup, regression-test, backfill]
---

# Phase 3 Quick Task 260528-nsb: Fix Orphaned Video Storage + Dangling DB References Summary

One-liner: Adds storage cleanup to all 5 early-return paths in `/api/analyze` (Mode A), nulls `video_storage_path` after retention-cron delete (Mode B), deploys weekly sweeper cron, and provides a one-shot backfill script for the existing 18+9 production records.

## Failure Modes Addressed

### Mode A — 18 orphan storage objects
Root cause: `/api/analyze/route.ts` returns early (cache-hit, rate-limit, Zod validation throw, SSE pipeline throw, JSON pipeline throw) without cleaning up the storage object already uploaded by the client.

Fix: `cleanupUploadedStorage()` helper inserted at all 5 failure branches. Cache-hit is the highest-leverage path (every cache hit on a `video_upload` request produces one orphan in steady state).

### Mode B — 9 dangling DB references (including repro `-I4GtlGVCQKO`)
Root cause: `delete-retained-videos/route.ts` removes storage objects but never nulls `analysis_results.video_storage_path`, so `/api/videos/sign` returns 404 indefinitely for retained-then-deleted videos.

Fix: After successful `storage.remove(paths)`, run `UPDATE analysis_results SET video_storage_path = NULL WHERE id = ANY(ids)`. UPDATE failure is logged at ERROR but does not return 500 (storage delete succeeded; cron retries tomorrow, idempotent).

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/analyze/route.ts` | +`cleanupUploadedStorage` + `cleanupRawUpload` helpers; cleanup on cache-hit, rate-limit, Zod-throw, JSON-pipeline-throw, SSE-pipeline-throw branches |
| `src/app/api/cron/delete-retained-videos/route.ts` | Extract `ids`, add `UPDATE video_storage_path=NULL` post-delete, return `{ deleted, nulled }` |
| `src/app/api/cron/sweep-orphan-videos/route.ts` | New file — weekly orphan sweeper |
| `vercel.json` | Add cron entry `0 4 * * 0` for sweep-orphan-videos |
| `src/app/api/analyze/__tests__/route.test.ts` | +4 regression tests for Mode A |
| `src/app/api/cron/delete-retained-videos/__tests__/route.test.ts` | New file — +3 regression tests for Mode B |
| `scripts/backfill-orphan-storage.ts` | New file — one-shot remediation script |

## Test Count Delta

| Test file | Before | After |
|-----------|--------|-------|
| `analyze/__tests__/route.test.ts` | 17 | 21 (+4) |
| `delete-retained-videos/__tests__/route.test.ts` | 0 | 3 (+3) |
| **Total new** | | **+7** |

All 61 tests pass. TSC clean.

## Deviations from Plan

### Auto-added: JSON-branch pipeline try/catch (Rule 2)

The plan described adding cleanup to the "JSON-branch outer catch (~line 607)". However, the JSON pipeline throw actually propagates to the outer handler catch, where `validated` is not in scope (it's declared inside the try block). Rather than hoisting variables (risky refactor), I added a targeted `try/catch` around `runPredictionPipeline` inside the `if (wantsJSON)` block. This is cleaner and mirrors the SSE path's inner catch. The test for `pipeline-throw (JSON branch)` required this change to pass.

### Auth fail + 413 + INFRA-04-before-service deferred (as planned)

These branches return before `service` (Supabase service client) is initialized, so cleanup cannot run server-side. Documented in code comments. Client-side `try/finally` in `Board.tsx` deferred to a future quick task if Sentry shows these in the wild.

### Supabase `.schema("storage")` type cast (Rule 1 — type system limitation)

The generated TypeScript types for the Supabase client don't expose the `storage` schema, but the JS runtime supports `.schema("storage")` in Supabase JS v2+. Used `as any` cast with ESLint disable comment in both `sweep-orphan-videos/route.ts` and `backfill-orphan-storage.ts`. Same pattern is safe and used by the backfill script.

## Diagnostic Re-run

The diagnostic SQL queries from RESEARCH.md could not be run via `pnpm tsx` (no local `.env` with Supabase credentials). The Supabase MCP tool was unavailable from Bash context. Counts remain at 18+9 since the backfill was NOT applied (as specified) and the sweeper hasn't run yet.

Post-merge verification steps:
```bash
# 1. Confirm dry-run counts
pnpm tsx scripts/backfill-orphan-storage.ts --dry-run

# 2. Apply remediation
pnpm tsx scripts/backfill-orphan-storage.ts --apply

# 3. Re-run diagnostics (expect both to return 0 after --apply)
-- Mode A: orphan storage
SELECT COUNT(*) FROM storage.objects so
WHERE so.bucket_id = 'videos'
  AND NOT EXISTS (SELECT 1 FROM analysis_results ar WHERE ar.video_storage_path = so.name);

-- Mode B: dangling DB reference
SELECT COUNT(*) FROM analysis_results ar
WHERE ar.video_storage_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects so
    WHERE so.bucket_id = 'videos' AND so.name = ar.video_storage_path
  );
```

## Post-Merge Backfill Instructions

**IMPORTANT: Run after merge to main, before next cron cycle.**

```bash
# Dry-run first (safe, no mutations)
pnpm tsx scripts/backfill-orphan-storage.ts --dry-run

# Then apply
pnpm tsx scripts/backfill-orphan-storage.ts --apply
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in env. Idempotent — safe to re-run.

## Remaining Follow-ups

1. **Auth-fail branch orphans** (deferred): If Sentry shows `401` responses on `/api/analyze` POSTs where storage objects were already uploaded, add client-side `try/finally` in `Board.tsx` to delete the uploaded storage object on non-2xx responses. Low priority until Sentry confirms frequency.

2. **413 body-too-large branch** (deferred): Same as above — storage object exists on client before POST reaches server. Client-side fix needed.

3. **INFRA-04 validation returns before `service`** (deferred): Content-text min/max length, TikTok URL format, and video-path validation returns all happen before the service client is created. Orphan risk is low (these fail immediately, client likely hasn't uploaded yet for text/URL modes; for video mode, the path validation would fail only on malformed paths which is unusual). Defer.

## Self-Check

### Files exist
- `src/app/api/analyze/route.ts` — FOUND
- `src/app/api/cron/delete-retained-videos/route.ts` — FOUND
- `src/app/api/cron/sweep-orphan-videos/route.ts` — FOUND
- `vercel.json` (with sweep-orphan-videos entry) — FOUND
- `src/app/api/analyze/__tests__/route.test.ts` (21 tests) — FOUND
- `src/app/api/cron/delete-retained-videos/__tests__/route.test.ts` (3 tests) — FOUND
- `scripts/backfill-orphan-storage.ts` — FOUND

### Commits exist
- 4e074de — FOUND
- b0d38f3 — FOUND
- 79518a2 — FOUND
- 70ed338 — FOUND
- bf27eb3 — FOUND

### Test results
- 61 tests pass, 0 failures
- TSC: No errors

## Self-Check: PASSED
