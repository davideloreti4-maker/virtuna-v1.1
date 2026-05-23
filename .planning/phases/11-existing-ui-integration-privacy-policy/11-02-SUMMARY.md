# 11-02 SUMMARY: API-layer Retention & Analysis Count

**Phase:** 11-existing-ui-integration-privacy-policy  
**Plan:** 02  
**Requirements:** INT-01, INT-05, PROFILE-16  
**Branch:** milestone/engine-foundation  
**Commits:** 97ce678, e9603e8, 25a486c, 33dd33f

## Changes Made

### 1. /api/analyze route.ts — 4 changes

**A) Retention opt-in query** (after subscription tier query, ~line 146):
- Reads `creator_profiles.storage_retention_opted_in` via `maybeSingle()` once at handler start
- Stored in `retentionOptedIn` — gates both JSON and SSE branches
- Defaults to `false` when no profile row exists

**B) `video_storage_path` in `buildInsertRow`** (after `audio_description`):
- Persists `validated.video_storage_path` when `input_mode === "video_upload"`
- Null for `tiktok_url`/text modes
- Enables retention cron to locate 30-day-old videos

**C) JSON branch — gated delete + analysis_count RPC**:
- Storage delete now guarded by `!retentionOptedIn` (opt-out users keep video)
- Added `service.rpc("increment_creator_analysis_count", ...)` fire-and-forget after usage upsert

**D) SSE branch — gated delete + analysis_count RPC**:
- Same opt-in gate on storage delete (mirrors JSON branch)
- `service.rpc(...)` fire-and-forget after `send("complete", finalResult)`

### 2. Retention cron route (new file)
- `src/app/api/cron/delete-retained-videos/route.ts`
- Pattern: `verifyCronAuth` → `createServiceClient` → query 30-day-old rows via `analysis_results` join to `creator_profiles` → batch delete from `videos` bucket
- Returns `{ status: "completed", deleted: N }`
- Follows exact structure of `calibration-audit/route.ts`

### 3. vercel.json
- Appended `delete-retained-videos` cron: `"schedule": "0 3 * * *"` (daily 03:00 UTC)
- 9 total cron entries

### 4. Test mock updates
- `route.test.ts`: added `maybeSingle()` to supabase server mock, `rpc()` to service client mock

## Verification

- **LSP diagnostics:** Clean on all changed files
- **Tests:** 88/90 test files pass (1191/1195 tests), 2 skipped (pre-existing video-e2e + one other)
- **Acceptance criteria:**
  - `increment_creator_analysis_count`: 2 occurrences (JSON + SSE branches) ✓
  - `retentionOptedIn`: 3 occurrences (declaration + both branches) ✓
  - `video_storage_path`: 10 occurrences (existing + new) ✓
  - Cron file contains `verifyCronAuth` + `createServiceClient` + `storage_retention_opted_in` ✓
  - vercel.json has `delete-retained-videos` at `0 3 * * *` ✓

## Not Modified (per plan constraints)

- `ENGINE_VERSION` — Phase 12 owns that
- `aggregator.ts` or `pipeline.ts`
- Existing route functionality — only additions
