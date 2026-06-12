---
phase: 03-honesty-moat-gallery-proof-conversion
plan: 04
subsystem: database
tags: [supabase, postgres, rls, security-definer, waitlist, type-generation]

# Dependency graph
requires:
  - phase: pre-existing
    provides: "compute_niche_percentiles SECURITY DEFINER aggregate-RPC idiom; insert-only RLS policy idiom (referral_clicks)"
provides:
  - "Live public.waitlist table on remote virtuna-v1.1 (insert-only RLS, UNIQUE email, source CHECK)"
  - "waitlist_count() SECURITY DEFINER RPC granted to anon (RLS-safe count)"
  - "Regenerated database.types.ts with waitlist table + waitlist_count function (Wave 3 type-checks .from('waitlist') and .rpc('waitlist_count'))"
  - "db:types convenience script for one-command type regen"
affects: [wave-3-waitlist-server-action, proof-strip-live-count, cta-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER aggregate-only count over RLS-hidden rows (mirrors compute_niche_percentiles)"
    - "Insert-only RLS (single FOR INSERT policy, no SELECT/UPDATE/DELETE → default-deny hides rows)"
    - "Supabase MCP apply_migration for remote (non-locally-linked) schema push"

key-files:
  created:
    - supabase/migrations/20260612000000_waitlist.sql
  modified:
    - src/types/database.types.ts
    - package.json

key-decisions:
  - "D-01: CTA backed by a real net-new waitlist table, not a link-out"
  - "D-02: insert-only RLS + source column + UNIQUE email (dup-as-success no-leak backstop)"
  - "D-08: live count read via SECURITY DEFINER waitlist_count() RPC — one privacy-safe source"
  - "Applied via Supabase MCP apply_migration (project not locally linked); CLI db push not used"

patterns-established:
  - "Schema-push gate: build/type checks pass from the committed types file, so remote apply + regen must happen in this plan BEFORE any code consumes the table"
  - "Email-harvest mitigation: count is only exposed via the definer RPC, never an anon SELECT"

requirements-completed: [CTA-02, PROOF-01]

# Metrics
duration: ~8min
completed: 2026-06-12
---

# Phase 03 Plan 04: Waitlist Persistence Backbone Summary

**Net-new public.waitlist table applied live to remote virtuna-v1.1 with insert-only RLS + a SECURITY DEFINER waitlist_count() RPC, with regenerated types so Wave 3 server actions type-check.**

## Performance

- **Duration:** ~8 min (continuation agent for Tasks 2-3; Task 1 + remote apply done earlier)
- **Completed:** 2026-06-12
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `public.waitlist` table live on remote virtuna-v1.1 (ref `qyxvxleheckijapurisj`): `id` uuid PK, `email` text UNIQUE, `source` text with CHECK, `created_at` timestamptz
- Insert-only RLS: single anon/authenticated INSERT policy, zero SELECT policies (default-deny hides emails from harvesting)
- `waitlist_count()` SECURITY DEFINER RPC returning bare `count(*)`, granted to anon — RLS-safe live count
- `database.types.ts` regenerated from live schema (waitlist Tables entry + waitlist_count Functions entry)
- `db:types` one-command regen script added to package.json

## Task Commits

1. **Task 1: Write the waitlist migration** - `786ad9d7` (feat) — _completed in prior agent run_
2. **Task 2: Apply migration to remote + regenerate types** - `8b970d1c` (feat) — migration applied via Supabase MCP apply_migration; types regenerated
3. **Task 3: Add db:types convenience script** - `35b6c8a6` (feat)

**Plan metadata:** docs commit follows (docs: complete plan)

## Self-Check: PASSED
- `supabase/migrations/20260612000000_waitlist.sql` — FOUND
- `src/types/database.types.ts` (waitlist + waitlist_count) — FOUND
- `package.json` db:types script — FOUND
- `03-04-SUMMARY.md` — FOUND
- Commits `786ad9d7`, `8b970d1c`, `35b6c8a6` — all present in git log

## Files Created/Modified
- `supabase/migrations/20260612000000_waitlist.sql` - Table + insert-only RLS + SECURITY DEFINER count RPC + grant (created Task 1)
- `src/types/database.types.ts` - Regenerated from live remote schema; now includes waitlist + waitlist_count
- `package.json` - Added `db:types` script for one-command type regen

## Apply Path (recorded per plan requirement)
- **Method:** Supabase MCP `apply_migration` (preferred — project is REMOTE, not locally linked)
- **Project:** virtuna-v1.1 (ref `qyxvxleheckijapurisj`)
- **CLI `db push` NOT used** (no linked project / interactive auth avoided)

## Live Verification Results
- `waitlist_count()` returns `0` (bigint) — table + RPC are live
- RLS ENABLED on `public.waitlist`
- 0 SELECT policies (anon cannot read rows — emails not harvestable)
- 1 INSERT policy for `anon, authenticated` WITH CHECK (true)
- `npx tsc --noEmit`: 0 errors originating in `database.types.ts` — regen is valid TS

## Decisions Made
- Applied via Supabase MCP `apply_migration` rather than CLI `db push` (project not locally linked, no access-token roundtrip needed)
- `database.types.ts` treated as generated — not hand-edited; regen is the single source

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- `npx tsc --noEmit` reports 33 pre-existing/Wave-3-pending errors (e.g., `@/components/numen-landing/proof-strip`, `@/lib/waitlist-count` module-not-found in tests; engine fold-adapter type mismatches). NONE are attributable to the types regen — 0 errors originate in `database.types.ts`. These reference not-yet-built Wave-3 files and pre-existing engine tests, out of scope for this plan.

## User Setup Required
The landing deploy env must have `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (Supabase Dashboard → Project Settings → API) for the Wave-3 insert + count read to run against virtuna-v1.1.

## Next Phase Readiness
- Schema-push gate satisfied: the waitlist table + RPC are live and typed BEFORE any code consumes them
- Wave 3 can now type-check and run `.from("waitlist").insert(...)` (CTA-02) and `.rpc("waitlist_count")` (PROOF-01)

---
*Phase: 03-honesty-moat-gallery-proof-conversion*
*Completed: 2026-06-12*
