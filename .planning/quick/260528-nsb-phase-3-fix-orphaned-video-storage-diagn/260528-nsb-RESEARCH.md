# Quick Task 260528-nsb — Phase 3: Fix Orphaned Video Storage

**Researched:** 2026-05-28
**Confidence:** HIGH on code-path map, HIGH on root-cause ranking (Supabase remote diagnostics confirmed below)
**Scope:** Diagnose orphan on analysis `-I4GtlGVCQKO`, fix matching root cause, add regression coverage.

---

## Live Diagnostic Findings (2026-05-28, project `qyxvxleheckijapurisj`)

Confirmed on the production Supabase instance. **Two distinct failure modes coexist:**

### Failure Mode A — True orphan storage (storage object, no DB row pointing at it)
- **Count:** 18 objects in `videos/` bucket with no matching `analysis_results.video_storage_path`
- **Mechanism:** Hypothesis A from the code-path map below — fail-fast points #1–#5 in `/api/analyze/route.ts` leak the uploaded object. Cache hit (line 232-264) is the single highest-leverage source.

### Failure Mode B — Dangling DB reference (row references a storage path that no longer exists)
- **Count:** 9 rows where `analysis_results.video_storage_path IS NOT NULL` but the storage object is gone.
- **This is the actual symptom on `-I4GtlGVCQKO`** — the row exists (`video_storage_path = '31c5a91c-31e1-45fd-ae67-e75c21a49df1/N1oTDbvyY-3EvpS1AQqw5.mp4'`, `created_at = 2026-05-28 12:08:03+00`), but no storage object with that name exists in the `videos` bucket. The user's `creator_profiles.storage_retention_opted_in` controls retention.
- **Mechanism (most likely):** Retention cron `delete-retained-videos/route.ts:61-63` removes storage objects but does NOT null out `video_storage_path` on the row, so playback endpoints (`/api/videos/sign`) return 404 instead of "video already deleted by retention policy".
- **Alternative mechanism:** Best-effort cleanup in `/api/analyze/route.ts:376-387` and `567-578` deletes the storage but the row's `video_storage_path` was already persisted at line 499-504 with the (now stale) path.

### Why scope must cover BOTH modes
- ROADMAP describes orphan storage (Mode A). The user's repro `-I4GtlGVCQKO` is actually Mode B. Both populations are non-trivial (18 + 9). A scoped fix that only addresses Mode A leaves the visible symptom alive; fixing only Mode B leaves disk waste growing.
- The two fixes are independent and small: Mode A = cleanup-on-failure-paths + sweeper; Mode B = retention cron updates the column (or sets a `video_deleted_at` sentinel), playback endpoints distinguish "retained-then-deleted" from "404 corrupt".

### Verification queries (reuse for the regression test / observability hook)
```sql
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

---

---

## TL;DR

The codebase has **two** independent paths from "storage upload succeeded" to "DB row exists":

1. **Board.tsx happy path** (`src/components/board/Board.tsx:250-280`) — uploads to `videos/` bucket, **then** calls `stream.start()` which POSTs `/api/analyze`. If anything between upload completion and the placeholder INSERT in the route (auth/rate-limit failures, network abort, validation error, request body parse error) bombs out → **orphan**.
2. **Retention cron** (`src/app/api/cron/delete-retained-videos/route.ts`) — joins `analysis_results → creator_profiles` via `!inner` and only deletes storage objects when a matching row exists and user is non-opted-in. **Cron cannot orphan; cron cannot clean up orphans either** (because orphan = storage object with no `analysis_results.video_storage_path` row pointing at it).

**Most likely root cause:** Upload → insert race / abandonment (Hypothesis A below). The cron is structurally incapable of creating an orphan as defined, and structurally incapable of cleaning one up.

**Recommended fix direction:** Make storage cleanup explicit on every failure path between upload and placeholder INSERT, AND add a weekly orphan-sweeper cron that compares bucket listing to `analysis_results.video_storage_path` (last-resort safety net). Diagnose first via Supabase Storage object metadata for `-I4GtlGVCQKO`.

---

## Code-Path Map

### Upload path (client)

| File:Line | Function |
|-----------|----------|
| `src/components/board/Board.tsx:250-280` | `handleContentSubmit` — uploads to `videos/<userId>/<nanoid>.<ext>`, then calls `stream.start({ video_storage_path })`. On upload error: `return;` (no orphan — upload failed). |
| `src/hooks/use-video-upload.ts:33-85` | `useVideoUpload.upload` — alternative hook with same `videos/<userId>/<nanoid>.<ext>` convention. Aborts call `storage.from("videos").remove([path])` (good). Hook appears unused by Board (Board inlines its own upload at line 259) — verify with `grep "useVideoUpload"`. |
| `src/components/app/test-creation-flow.tsx:74` | Test flow uses sentinel `video_storage_path = "pending-upload"` — no real upload, no orphan risk. |

### POST /api/analyze (server)

| File:Line | What happens |
|-----------|--------------|
| `src/app/api/analyze/route.ts:48-73` | Auth check (`getUser`), `content-length > 287MB` early reject (**fail-fast point #1** — no orphan cleanup**). |
| `src/app/api/analyze/route.ts:82-138` | Input validation, TikTok URL format, `video_storage_path` non-empty (**fail-fast point #2 — no orphan cleanup**). |
| `src/app/api/analyze/route.ts:175-186` | Rate limit check — returns 429 (**fail-fast point #3 — no orphan cleanup**). |
| `src/app/api/analyze/route.ts:207-215` | Zod `AnalysisInputSchema.parse` (**fail-fast point #4 — no orphan cleanup**). |
| `src/app/api/analyze/route.ts:229-263` | Cache lookup — on cache hit, returns cached payload (**fail-fast point #5 — orphan WILL occur because the upload happened, but `analysis_results.video_storage_path` is never written for the new upload**). |
| `src/app/api/analyze/route.ts:413-431` | Placeholder INSERT (SSE branch). After this point, `video_storage_path` is persisted on the upsert at line 499-504. |
| `src/app/api/analyze/route.ts:351-353` (JSON branch) | INSERT happens AFTER pipeline runs. If pipeline throws, INSERT never runs, but pipeline-throw goes to the outer catch at line 607 — **storage cleanup not performed.** |
| `src/app/api/analyze/route.ts:376-387` and `567-578` | Best-effort `service.storage.from("videos").remove([path])` AFTER successful response, only when `!retentionOptedIn`. `.catch(()=>{})` swallows failure (acceptable — opted-out users get cleanup; opted-in users keep video for cron). |

### Retention cron

| File:Line | What happens |
|-----------|--------------|
| `src/app/api/cron/delete-retained-videos/route.ts:37-44` | Query joins `analysis_results → creator_profiles!inner` filtered to rows older than 30 days where `storage_retention_opted_in = false`. |
| `src/app/api/cron/delete-retained-videos/route.ts:61-63` | `storage.from("videos").remove(paths)` for matched DB rows only. |
| `vercel.json:38-41` | Schedule: `0 3 * * *` (daily 03:00 UTC). |

**Critical property of cron:** It deletes storage objects ONLY when an `analysis_results` row exists pointing at them. It cannot delete an object that has no DB referent. It cannot create an orphan.

### Sign route (orphan detection surface)

| File:Line | Behavior |
|-----------|----------|
| `src/app/api/videos/sign/route.ts:39-54` | When storage object is missing, returns 404 `{ error: "video_missing" }` and logs at `info` level. **No surface today returns "DB row exists but storage object missing" vs. "storage object exists but no DB row".** |

---

## Root-Cause Hypothesis Ranking

### Hypothesis A: Upload → Insert race / abandonment (RANKED #1 — MOST LIKELY)

**Evidence in code:**

- `Board.tsx:259-265` uploads BEFORE calling `stream.start()`. Any of these can leave a storage object with no `analysis_results.video_storage_path` row:
  - User closes tab / navigates away between upload completion and POST initiation
  - POST body abort (`AbortController`) after upload but before placeholder INSERT
  - Server returns 401 (session expired between upload + POST) → orphan
  - Server returns 413 (oversized) → orphan
  - Server returns 400 (Zod failure on `content_text < 10 chars`) → orphan
  - Server returns 429 (rate limit) → orphan
  - Cache hit (route returns cached result without writing `video_storage_path` for the NEW upload) → **definite orphan**
  - JSON branch pipeline throw → catch at line 607 returns 500, but storage object exists with no DB referent → orphan

**Why this matches `-I4GtlGVCQKO`:** The nanoid analysisId `-I4GtlGVCQKO` (12 chars, leading `-`) implies the placeholder INSERT path ran (`nanoid(12)` at `route.ts:412`). So a row WAS written. If the row exists and the storage object also exists but the row has `video_storage_path = null`, that's a different bug. **Must check Supabase remote to confirm whether the row for `-I4GtlGVCQKO` has `video_storage_path` set.**

Two sub-cases:
- **A1:** Row exists, `video_storage_path` is set, storage object missing → user opted out, route's best-effort cleanup ran. **Not an orphan — expected behavior.** Sign route correctly returns 404.
- **A2:** Storage object exists, but no row references it (orphan in the literal sense — storage object that no DB row points at). This is the actual carryover bug.

### Hypothesis B: Retention cron timing (RANKED #2 — UNLIKELY based on code structure)

**Why unlikely:**
- Cron uses `!inner` join so it cannot operate on orphaned objects (no matching `analysis_results` row → row not in query result).
- Cron deletion is idempotent (Storage `remove([])` accepts missing paths without error).
- Schedule is daily; no "tighten the window" knob exists in code.
- 30-day window is hardcoded at `route.ts:30-32`.

**Possible cron-related cause:** Cron deletes a storage object, but then the same `analysis_results.video_storage_path` column is NOT cleared post-deletion → DB row still has `video_storage_path` pointing at a deleted object. The sign route correctly handles this (404 `video_missing`), but it's "data integrity smell" rather than an orphan. **If the bug report is "DB says video exists but storage doesn't"**, this is the explanation — the cron does not null out `video_storage_path` after deletion.

### Hypothesis C: Best-effort cleanup race on opted-out users (RANKED #3)

**Evidence:** `route.ts:381-387` and `572-578` — fire-and-forget `.catch(()=>{})` on `storage.remove()`. If the remove fails (Supabase transient error, network flap), the row keeps `video_storage_path` but the cron will pick it up on the next 30-day expiry — wait, no, opted-OUT users have `storage_retention_opted_in = false`, so the cron WILL catch them. But the 30-day window is wrong here — opted-out users were supposed to have video deleted immediately. So a transient `.remove()` failure → 30-day "orphan" (storage object exists but should have been deleted at analysis time).

---

## Recommended Fix Direction

**Phase opens with diagnosis (1 day per ROADMAP).** Concrete steps:

### Diagnosis experiments

1. **Inspect Supabase remote for `-I4GtlGVCQKO`** (use `mcp__supabase__execute_sql`, read-only):
   ```sql
   SELECT id, user_id, video_storage_path, has_video, input_mode, created_at, engine_version
   FROM analysis_results WHERE id = '-I4GtlGVCQKO';
   ```
   - If `video_storage_path` is set → check storage bucket for that path (orphan sub-case A2 or cron-deleted sub-case B).
   - If `video_storage_path` is null but `has_video = true` → upload succeeded but cache-hit branch or sentinel `pending-upload` ate the path → **bug confirmed in Hypothesis A**.

2. **Bucket-vs-table reconciliation query** (one-shot, scoped to last 7 days to bound result size):
   ```sql
   -- Pseudocode: list bucket via storage.objects, anti-join analysis_results.video_storage_path
   SELECT o.name, o.created_at
   FROM storage.objects o
   WHERE o.bucket_id = 'videos'
     AND o.created_at > NOW() - INTERVAL '7 days'
     AND NOT EXISTS (
       SELECT 1 FROM analysis_results a
       WHERE a.video_storage_path = o.name
     );
   ```
   Count of orphans tells us frequency; pattern of `user_id` prefix tells us whether single-user or systemic.

3. **Search Sentry / Vercel logs** for `403 / 401 / 413 / 429` responses on `/api/analyze` POSTs in the window before `-I4GtlGVCQKO` was created — these correspond to fail-fast paths #1-3 in the map above.

### Fix candidates by root cause

| If diagnosis confirms... | Fix |
|--------------------------|-----|
| **A: Upload-then-insert abandonment** | Insert placeholder `analysis_results` row BEFORE allowing upload (or: client-side `try/finally` that deletes uploaded storage object on any non-2xx response from `/api/analyze`). Cache-hit branch must `service.storage.from("videos").remove([path])` for opted-out users. JSON-branch catch at `route.ts:607` must do the same. |
| **A2 specifically (cache hit eats path)** | At `route.ts:232-264` (cache hit), if `validated.input_mode === "video_upload" && validated.video_storage_path && !retentionOptedIn` → fire-and-forget `service.storage.from("videos").remove(...)` BEFORE returning cached payload. |
| **B: Cron leaves DB pointer after deletion** | After successful `storage.remove(paths)` at `delete-retained-videos:61-63`, run `UPDATE analysis_results SET video_storage_path = NULL WHERE id = ANY(...)`. Idempotent. |
| **C: Best-effort cleanup transient fail** | Convert fire-and-forget at `route.ts:381-387` / `567-578` to: try → on failure, leave the row alone so the cron picks it up at 30 days (current behavior is fine for this case as long as opted-out users' rows survive the response, which they do). |

### Last-resort safety net (recommended regardless of root cause)

Add a **weekly orphan-sweeper cron** at `/api/cron/sweep-orphan-videos`:

- List `storage.objects WHERE bucket_id = 'videos' AND created_at < NOW() - INTERVAL '24 hours'`
- Anti-join `analysis_results.video_storage_path`
- Delete objects with no DB referent (older than 24h to avoid racing with in-flight uploads)
- Log count via structured logger

This makes the cron capable of cleaning orphans (today's cron structurally cannot).

---

## Regression Test Strategy

### Unit / integration tests (preferred — fast, deterministic)

In `src/app/api/analyze/__tests__/route.test.ts` add cases that prove the cleanup paths run on every failure:

1. **Cache-hit cleanup test:** POST with `video_storage_path = "user-x/foo.mp4"`, mock cache to return a hit, assert `storage.remove([...])` was called for opted-out user.
2. **Auth failure cleanup test:** POST with valid storage path but unauthenticated → assert cleanup is invoked (or: assert response carries header signaling client must clean up — depends on fix direction).
3. **Rate-limit cleanup test:** Same, force `currentCount >= limit`.
4. **Pipeline-throw cleanup test:** Mock `runPredictionPipeline` to throw, assert storage cleanup in catch.

Use the existing mock surface at `route.test.ts:68` (storage retention mock already in place).

### Bucket-vs-table reconciliation test (observability hook)

Add a script at `scripts/audit-orphan-videos.ts` that runs the anti-join query above and writes the count to stdout + Sentry breadcrumb. Wire to CI as a non-blocking nightly job (or: invoke from the new orphan-sweeper cron itself, reporting count to logger before deletion).

### E2E (Playwright)

Phase 6 owns the happy-path E2E. For Phase 3, a Playwright-driven failure-path test would be flaky (depends on hitting rate-limit or 413). Skip Playwright for this phase; rely on integration coverage.

---

## Pitfalls / Gotchas

1. **Two upload code paths exist.** `Board.tsx:259` inlines the upload directly; `useVideoUpload` hook also exists but appears unused by the live board. Verify with `grep -rn "useVideoUpload(" src/` before fixing — if both are live, fix both. If hook is dead code, delete it (avoid future drift).

2. **`pending-upload` sentinel.** `test-creation-flow.tsx:74` ships `video_storage_path = "pending-upload"`. Route validation at `route.ts:131` rejects this sentinel — good, no orphan from this path. Do not regress that check.

3. **`upsert: false` on storage upload.** `Board.tsx:263` and `use-video-upload.ts:62` both pass `upsert: false` — re-uploading same path errors. Fine for nanoid paths (collisions effectively zero), but means a retry by client must generate a new nanoid (it does).

4. **`!inner` join + opt-in flip.** Cron at `delete-retained-videos:40-44` uses `creator_profiles!inner`. If a user has never visited `/profile` (no `creator_profiles` row), their videos are never cleaned by cron — they're treated as "no matching profile" and excluded. The orphan-sweeper would catch these eventually. Verify whether the user behind `-I4GtlGVCQKO` had a `creator_profiles` row at the time.

5. **Cache hit ≠ orphan-safe.** Cache hit branch at `route.ts:232-264` returns immediately without writing `video_storage_path` for the NEW upload. The cache stores a finished `PredictionResult` keyed by content hash, NOT by upload path. So when user A uploads a clip that hits user B's cached result, A's upload is orphaned by definition. This is almost certainly the most common cause of orphans in steady state — every cache-hit-with-upload produces one.

6. **Two cleanup call sites in route.ts** (lines 381 and 572) — fix must touch both branches (JSON + SSE).

7. **Engine version `pending` in placeholder row.** `route.ts:423` writes `engine_version: "pending"` as sentinel. If the upsert path silently fails to overwrite (per Fix 1 at line 530-562 already mitigating this), `analysis_results` rows can stick at `pending` with `video_storage_path` set. The retention cron would still pick these up at 30 days (it filters on `created_at`, not on `engine_version`). Not an orphan source, but a related data-integrity smell.

8. **Vercel cron 03:00 UTC for `delete-retained-videos`** runs nightly. If a phase fix involves changing the cron behavior, redeploy to Vercel is required for the cron registry to pick up route changes — there's no in-place edit.

9. **Best-effort `.catch(()=>{})` swallows everything.** When converting to fix C, prefer `.catch((err) => log.warn('storage_cleanup_failed', { err, path }))` so observability covers transient failures.

10. **Filmstrip storage (separate bucket) is out of scope.** `src/lib/engine/filmstrip/storage.ts` uploads keyframes to a different bucket. Orphan model for filmstrips is separate and not covered by this phase.

---

## Files Likely to Change

| File | Change |
|------|--------|
| `src/app/api/analyze/route.ts` | Add storage cleanup to all early-return branches (cache hit, auth fail, rate limit, validation fail, pipeline throw). |
| `src/app/api/cron/delete-retained-videos/route.ts` | (If Hypothesis B) null out `video_storage_path` after successful delete. |
| `src/app/api/cron/sweep-orphan-videos/route.ts` (NEW) | Last-resort sweeper. |
| `vercel.json` | Add new cron entry (weekly, `0 4 * * 0` or similar — offset from existing 03:00 retention cron). |
| `src/app/api/analyze/__tests__/route.test.ts` | Regression tests for each cleanup path. |
| `scripts/audit-orphan-videos.ts` (NEW, optional) | One-shot CLI for diagnosis re-runs. |

---

## Sources

- Code paths verified by reading: `Board.tsx`, `use-video-upload.ts`, `api/analyze/route.ts`, `api/cron/delete-retained-videos/route.ts`, `api/videos/sign/route.ts`, `supabase/migrations/20260520100000_phase11_retention_counter.sql`, `vercel.json`. [VERIFIED: codebase grep]
- Roadmap scope: `.planning/ROADMAP.md:98-116`. [VERIFIED]
- Carryover context: `.planning/MILESTONE.md:52`, `.planning/MILESTONES.md:25`. [VERIFIED]
- Supabase Storage idempotency on `.remove([])` for missing paths. [CITED: Supabase Storage docs — confirm via mcp__context7__ if uncertain]
- Specific root-cause for `-I4GtlGVCQKO` (DB row state, storage object presence). [ASSUMED — requires Supabase remote read; planner should trigger this via `mcp__supabase__execute_sql` as diagnosis step #1]

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Cache-hit branch produces orphans for every cache hit on a `video_upload` mode call | Low — if false, narrows fix scope but doesn't invalidate cleanup-on-failure-path fix |
| A2 | `useVideoUpload` hook is dead code (Board inlines the upload) | Medium — if hook is live, fix must touch both call sites |
| A3 | `-I4GtlGVCQKO`'s `analysis_results` row exists (placeholder INSERT ran) | Medium — if row doesn't exist, root cause shifts toward "POST never reached placeholder INSERT" which is still in Hypothesis A but narrows the failure window |
| A4 | Retention cron has not silently raced anything in production | Low — Vercel cron logs would surface this; diagnosis step #3 covers it |
