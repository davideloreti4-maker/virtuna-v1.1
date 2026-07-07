# Handoff — Per-account content pillars (`content_pillars.account_id`)

**Date:** 2026-07-07
**Status:** READY — start in a fresh session (touches prod DB; keep a clean context)
**Builds on:** Connected Accounts slice 1 (#214) + slice 2 (#215, connect UI + switcher).
Branch off `main` after #215 is on it (it is — squash `05b9c4f6`).

---

## Why

Connected accounts are first-class and the "Your account" tab now switches per account
(slice 2). But **content pillars are still user-scoped** — the cron clusters the *primary*
account only, so every **secondary** account shows real analytics + an **honest-empty**
pillar band. This slice makes pillars per-account so each connected account is fully
first-class (its own themes/mix/cadence, never merged across handles).

The code already flags this as the planned follow-up: `src/lib/content-pillars/cluster.ts:171–174`
("Per-account pillar sets — a `content_pillars.account_id` — is the documented follow-up").

**Good news — most of the work is already account-scoped.** Posts (`account_posts.account_id`)
and pillar assignments (`assignPostsToPillar(supabase, accountId, …)`) are keyed to the account
already. Only the `content_pillars` **rows** are user-scoped. So this is a small, contained slice.

## Current wiring (verified 2026-07-07)

- `content_pillars` table: migration `supabase/migrations/20260706140000_content_pillars.sql`
  (+ `20260706150000_content_pillars_confirmed.sql`). Rows keyed `UNIQUE(user_id, name)`,
  `user_id` FK. No `account_id`.
- `pillars-repo.ts`: `listPillars(supabase, userId)` filters `.eq("user_id", userId)`;
  `createPillars` upserts `onConflict: "user_id,name"`; `anyUnconfirmedPillars(userId)`.
- `cluster.ts`: `clusterPillarsForUser(supabase, userId)` resolves `getPrimaryAccount` →
  `accountId`, reads `listAllPosts(accountId)`, creates pillars (user-scoped), then
  `assignPostsToPillar(accountId, id, postIds)` (account-scoped).
- `build-pillars.ts`: `buildContentPillars(supabase, userId, accountId?)` (slice 2 added
  `accountId`) reads `listPillars(userId)` + account-scoped posts — so a non-primary account's
  posts carry no `pillar_id` → returns `[]` (the honest-empty state we're removing).
- Cron `refresh-account-snapshots/route.ts`: loops `listAllConnectedAccounts`, but **clustering
  is gated to the primary** (find where it calls `clusterPillarsForUser` — only for the primary).

## Work plan

### 1. Migration `2026XXXX_content_pillars_account_id.sql`
- Add `account_id uuid REFERENCES connected_accounts(id) ON DELETE CASCADE` to `content_pillars`.
- **Backfill** existing rows: set `account_id` = the user's primary connected account id
  (one UPDATE joining primary on `is_primary`).
- Make it `NOT NULL` after backfill; change uniqueness `UNIQUE(user_id, name)` →
  `UNIQUE(account_id, name)`. Re-check the `content_pillars_confirmed` migration for any FK/unique
  it added and keep it consistent.
- Apply + backfill on prod `virtuna-v1.1` (qyxvxleheckijapurisj) via Supabase MCP; regenerate
  `database.types.ts` (or keep the cast convention if `content_pillars` isn't typed).

### 2. Repo (`pillars-repo.ts`)
- `listPillars(supabase, accountId)` → filter `.eq("account_id", accountId)` (drop user_id filter;
  RLS still own-rows). `createPillars(supabase, accountId, names)` → rows carry `account_id`,
  `onConflict: "account_id,name"`. `anyUnconfirmedPillars` → by account.
- Update call sites (cluster.ts, build-pillars.ts, plus any /calendar or /start reads —
  grep `listPillars(` and `buildContentPillars(`).

### 3. Cluster per-account (`cluster.ts` + cron)
- `clusterPillarsForUser` → `clusterPillarsForAccount(supabase, accountId)` (or add an
  `accountId` param). It already resolves `accountId`; just take it as input instead of
  re-resolving the primary.
- Cron: cluster **every** connected account in the loop (not just the primary). Watch the
  per-account model cost/latency — clustering is ~15s each; if many accounts, keep it but note it.

### 4. Read path (`build-pillars.ts`)
- `buildContentPillars(supabase, accountId)` reads `listPillars(accountId)` + account posts.
  Now non-primary accounts return real pillars (the honest-empty branch only fires when an account
  genuinely has too few captioned posts). Update `audience/page.tsx` to pass `selected.id`
  (it already passes `selected?.id`; drop the "primary-only pillars" caveat).

## Verify
- tsc 0 · `node ./node_modules/vitest/vitest.mjs run` — watch `content-pillars/__tests__/build-pillars.test.ts`
  (pure builder unaffected) + any cluster/pillars-repo tests. The 38 pre-existing home/composer/
  remix/sidebar failures are NOT yours.
- Migration applies + backfill correct (existing users' pillars keep working, now account-keyed).
- Live: connect a 2nd TikTok account, run the cron (or trigger clustering), switch to it on
  `/audience?tab=account` → it now shows **its own** pillars, not honest-empty. Primary unchanged.
- Dev: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3003`;
  auth `e2e-test@virtuna.local` / `e2e-test-password-2026`.

## Not in scope
IG/YT connect (separate OAuth/Composio milestone) · gating · brand grouping.
