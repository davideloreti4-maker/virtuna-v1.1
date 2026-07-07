# Handoff — Connected Accounts, Slice 2 (Connect UI + Account Switcher)

**Date:** 2026-07-07
**Status:** READY — start in a fresh session
**Builds on:** Slice 1 (data model + read-path) — **PR #214** (`feat/connected-accounts`, commit `8ac95017`).
Merge #214 **first**, then branch off `main`.

---

## Where slice 1 left off (don't re-do this)

Slice 1 shipped the whole backend + read-path and is on PR #214:

- **`connected_accounts` table + `account_id` FKs are live on prod** (migration `20260707140000`, applied + backfilled via MCP). `account_snapshots`/`account_posts` are account-scoped (`NOT NULL account_id`, uniques flipped); `audiences.source_account_id` exists.
- **`src/lib/connected-accounts/connected-accounts-repo.ts`** exists with everything the UI needs:
  `listConnectedAccounts(supabase, userId)`, `getPrimaryAccount(supabase, userId)`,
  `getOrCreateConnectedAccount(supabase, {userId, platform, handle, displayName})`,
  `listAllConnectedAccounts` (cron), `touchAccountSynced`.
- All reads (`/start`, `/audience`, cron, calibrate, pillars) already resolve to the **primary** account.
- Verified: tsc 0, 243/243 changed-module tests, cross-platform collision smoke, live browser pass.

**So this slice is UI + one new connect endpoint. The data layer is done.**

---

## What this slice delivers

The arc **connect → analytics → testable audience**. Three pieces, in priority order:

### 1. Account switcher on the "Your account" tab  ← highest value
Today `/audience?tab=account` shows only the primary account. Add a switcher so a user can
see each connected account's own series (this is what makes the collision fix *visible*).

- **Data wiring** — `src/app/(app)/audience/page.tsx` (currently ~L42–53): it resolves the
  primary and passes `snapshots` + `pillars` to `AudienceManager`. Change to:
  - `const accounts = await listConnectedAccounts(supabase, user.id)`
  - pick the selected account from a `?account=<id>` search param, default to the primary
    (the `is_primary` row, or `accounts[0]`)
  - read `getAccountSnapshots(supabase, selected.id, 100)` + `buildContentPillars` for the
    selected account (⚠️ `buildContentPillars(supabase, userId)` resolves primary internally
    today — to make pillars follow the switcher you'll want an `accountId` overload; see note ▼)
  - pass `accounts` + `selectedAccountId` down.
- **The control** — lives with the analytics band: `src/components/analytics/analytics-view.tsx`
  (the stat-row + pillars) and the tab shell `src/components/audience/audience-manager.tsx`
  (current call site: `<AudienceManager snapshots pillars initialTab />`). Model it on the
  existing **7/30/90 range toggle** already in analytics-view — a small segmented control:
  `@you·TikTok | @you·IG | + Connect`. Switching sets `?account=<id>` (server re-reads) or
  lifts state; default = primary.
- **▼ pillars-follow-switcher note:** `buildContentPillars` + `clusterPillarsForUser` currently
  hard-resolve the primary (content_pillars are user-scoped). For the switcher to show the
  *selected* account's pillars you must either (a) add an `accountId` param to
  `buildContentPillars` and pass `selected.id`, and accept that non-primary accounts have no
  clustered pillars yet (cron only clusters primary) → they'd render the honest empty state; or
  (b) do the full `content_pillars.account_id` migration (bigger — see slice 3). Recommend (a)
  for now: switch **stats** per account, pillars show for primary + honest empty for others.

### 2. Decoupled "Connect account" action  ← the actual unlock
Right now nothing lets a user connect account #2 — calibrate is still the only way in. Build a
reusable connect action: **platform + handle → scrape → `getOrCreateConnectedAccount` + seed first snapshot.**

- New route, e.g. `POST /api/connected-accounts/connect` (mirror the scrape half of
  `src/app/api/audiences/calibrate/route.ts` — reuse `calibrateFromScrape`'s scrape or the
  scraping provider directly, then `getOrCreateConnectedAccount` + `upsertAccountSnapshot`
  with the new `accountId`). Auth-first, Zod `{platform, handle}`, `sanitizeText`, generic errors —
  copy the calibrate route's security spine verbatim.
- **End the arc with the wedge:** after connect, offer "Calibrate an audience from this account →"
  (deep-link into audience creation with the account preselected — ties into piece 3).
- **Entry points:** (a) the "Your account" tab empty state ("Connect your first account") + the
  switcher's "+ Connect"; (b) `src/app/(app)/settings/page.tsx` (a "Connected accounts" section);
  optionally (c) inside audience creation.

### 3. Audience-creation source picker
When creating an audience, pick a **source**: a connected account (calibrate the real crowd) /
custom / preset. `audiences.source_account_id` already persists (calibrate sets it for personal
audiences); this exposes the choice in the UI.

- `src/app/(app)/audience/new/page.tsx` → `src/components/audience/audience-form.tsx` →
  `src/components/audience/calibration-flow.tsx`.
- "Calibrate from a connected account" lists `listConnectedAccounts`; selecting one prefills the
  handle/platform and calibrates. "Custom" / preset paths stay as-is.

---

## Decision to lock BEFORE building (owner)

**Gating** — 1 connected account free, N on Pro/Studio (matches pricing: Studio has seats).
The switcher's "+ Connect" and the connect route are where the gate lives. Decide: ship
ungated now (add gate later) **or** gate from day one. The handoff plan flagged "confirm before
building the gate." → **Ask the owner at plan time.**

---

## Edge cases (mostly already handled in the data layer)

- **Delete a connected account** → cascades its snapshots/posts (FK), and `audiences.source_account_id`
  goes NULL (ON DELETE SET NULL) — audiences keep frozen personas. Build a delete affordance +
  a confirm ("this removes its analytics history; audiences calibrated from it stay, unlinked").
- **Primary** — exactly one per user (partial-unique index). First connect auto-primary. Add
  "Make primary" (flip `is_primary`; must clear the old primary in the same txn or the index
  rejects — do it in one SQL update or a tiny RPC).
- **Same @handle, two users** — allowed today (public data, each gets own row). No change needed.
- **OAuth later** — `connection_method` column already carries `'scrape'|'oauth'`; only the
  capture producer swaps ([[oauth-profile-ingestion]]).

---

## Verify (same bar as slice 1)

- tsc 0 · `node ./node_modules/vitest/vitest.mjs run` (changed-module green; the 38 pre-existing
  home/composer/remix/sidebar failures are NOT yours)
- Live browser pass (auth `e2e-test@virtuna.local` / `e2e-test-password-2026`, which **is** the
  zachking data owner `31c5a91c`): connect a 2nd account → switcher appears → each account shows
  its own series (no collision) → calibrate an audience from a connected account → it carries
  `source_account_id`.
- Dev server: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3003`

## Key file map

- `src/lib/connected-accounts/connected-accounts-repo.ts` — the repo (done, slice 1)
- `src/app/(app)/audience/page.tsx` — resolve accounts + `?account` param, pass down
- `src/components/analytics/analytics-view.tsx` — stat-row + pillars + the new switcher control
- `src/components/audience/audience-manager.tsx` — tab shell / prop passthrough
- `src/app/api/audiences/calibrate/route.ts` — the security/scrape template to mirror for connect
- (new) `src/app/api/connected-accounts/connect/route.ts` — the connect action
- `src/app/(app)/audience/new/page.tsx` + `audience-form.tsx` + `calibration-flow.tsx` — source picker
- `src/app/(app)/settings/page.tsx` — a "Connected accounts" management section
- Original plan (slice 1 context): `docs/HANDOFF-2026-07-07-connected-accounts.md` §5 (UI) + §6 (gating)
