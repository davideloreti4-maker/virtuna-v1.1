# 11-01 SUMMARY: Retention Columns Migration + Types Regen

**Phase:** 11-existing-ui-integration-privacy-policy  
**Plan:** 01  
**Requirements:** INT-05, PROFILE-16  
**Commits:** 5ee7693  

## Changes Made

### 1. Migration (`supabase/migrations/20260520100000_phase11_retention_counter.sql`)
- `creator_profiles.analysis_count INTEGER NOT NULL DEFAULT 0` — lifetime analysis counter for PROFILE-16 re-prompt
- `creator_profiles.storage_retention_opted_in BOOLEAN NOT NULL DEFAULT false` — user opt-in to 30-day video retention (INT-05/D-04)
- `analysis_results.video_storage_path TEXT NULL` — Supabase Storage object path for retention cron deletion (INT-05)
- `increment_creator_analysis_count(p_user_id UUID)` SECURITY DEFINER SQL function — atomic increment helper to avoid read-then-write race condition in /api/analyze
- All statements use `IF NOT EXISTS` / `CREATE OR REPLACE` for idempotent re-runs

### 2. Regenerated Types (`src/types/database.types.ts`)
- Regenerated via `npx supabase gen types typescript` from live DB
- `creator_profiles.Row` includes `analysis_count: number`
- `creator_profiles.Row` includes `storage_retention_opted_in: boolean`
- `analysis_results.Row` includes `video_storage_path: string | null`

## Verification
- Migration file contains all 3 columns + SQL helper function
- `analysis_count` appears in database.types.ts
- No existing functionality modified — additive schema change only
