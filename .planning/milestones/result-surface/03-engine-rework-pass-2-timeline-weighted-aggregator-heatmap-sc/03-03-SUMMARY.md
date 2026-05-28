---
plan: 03-03
phase: 03
status: complete
completed_at: 2026-05-27
---

# Plan 03-03 — DB Schema: Outcomes + Filmstrips + pg_cron

## What was built

Migration `supabase/migrations/20260526000000_outcomes_and_filmstrips.sql` (108 lines) applied to linked Supabase project `virtuna-v1.1` (qyxvxleheckijapurisj).

Three artifacts shipped in one migration:

1. **`outcomes` table** (D-18 locked schema) — empty, forward-compatible. M2-III feedback loop will write rows.
   - FK: `analysis_results(id) ON DELETE CASCADE` (corrected from D-18 draft which referenced non-existent `analyses` table)
   - RLS enabled: authenticated users SELECT own rows via `analysis_results.user_id = auth.uid()`; no client INSERT/UPDATE/DELETE (service role only)
   - Indexes: `outcomes_analysis_id_idx` + `outcomes_posted_at_idx` (partial, M2-III temporal queries)

2. **`filmstrips` Storage bucket** (D-10) — private (`public=false`), 5MB file_size_limit, `image/jpeg` only. Access via signed URLs (Plan 07).

3. **`cleanup_expired_filmstrips()` pg_cron job** — daily `0 3 * * *` UTC sweep deleting filmstrip Storage objects older than 30 days. SECURITY DEFINER, REVOKE from PUBLIC/anon/authenticated, mirrors `niche_post_windows` pattern.

## Verification results

| Check | Result |
|-------|--------|
| `SELECT count(*) FROM outcomes` table exists | 1 ✅ |
| `filmstrips` bucket `public=false` | ✅ |
| `cron.job` `cleanup-expired-filmstrips` schedule `0 3 * * *` | ✅ |

## Deviations

**FK correction:** D-18 referenced `analyses(id)` but no `analyses` table exists in the schema — the correct table is `analysis_results`. RLS policy updated accordingly (`user_id` not `creator_id`). Local migration file patched to match applied SQL. Remote applied via MCP as `outcomes_d18_filmstrips_pg_cron_fixed` (migration tracking diverges from local filename `20260526000000_outcomes_and_filmstrips`; schema is correct).

## key-files

### created
- supabase/migrations/20260526000000_outcomes_and_filmstrips.sql

## Self-Check: PASSED
