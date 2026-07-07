# Handoff — Connected Accounts (multi-account, multi-platform)

**Date:** 2026-07-07
**Status:** PLANNED — ready to execute in a fresh session
**Depends on:** the `refactor/dissolve-grow-hub` branch landing first (this milestone builds on the
`/audience` → "Your account" analytics tab introduced there). Branch off `main` after that merges.

---

## Why (the problem)

Today there is **no first-class "connected account."** Connecting your social profile is a pure
side-effect of calibrating a *personal* audience, and the analytics data lands in `account_snapshots`
keyed `UNIQUE(user_id, snapshot_date)` — **one row per user per day; platform + handle are payload,
not part of the key.**

Consequences (all code-verified):
- **A single creator with TikTok + Instagram already corrupts.** Same-day snapshots for two platforms
  collide on `(user_id, date)` — the second overwrites the first. Not an agency edge case; a normal
  cross-platform creator.
- Calibrating a second `@handle` silently makes it the tracked account (the cron picks "latest handle
  per user"). Old series mixed/overwritten, no discriminator on read.
- Content pillars read **all** of a user's posts across every handle into one merged set.
- Audiences carry no first-class handle — it's buried in the `profile` JSON blob.

## The decision (LOCKED with owner, 2026-07-07)

**Decouple "connect" from "calibrate."** Two distinct objects:

- **Connected account** = a real profile you own (`@you` · TikTok). One connect action gives you two
  things: your **analytics** *and* the raw material to build an audience.
- **Audience** = personas you test content against. Creating one picks a **source**:
  (1) a connected account (calibrate the real crowd), (2) custom (build by hand), or
  (3) a preset/General (exists today).

**Atomic unit = `(platform, handle)` = one connected account. Flat list, per-account analytics with a
switcher.** NOT grouped-under-a-brand (rejected as the atomic unit — a TikTok follower ≠ an IG
follower; auto-aggregating across platforms is dishonest). "Group platform-profiles under a Brand"
is an optional *later* layer on top of the flat list, not now.

Relationships:
- User → **1..N** connected accounts (across platforms)
- Connected account → **0..N** audiences (calibrate `@you` once, spin variant target audiences off it)
- Audience → **optional** `source_account_id` FK (nullable — customs/presets have none)

**The wedge (positioning):** Sandcastles already does multi-account/multi-platform — matching it is
parity. Neither Sandcastles nor Stanley turns a connected account into a *testable synthetic audience*.
So the connect flow must end at "…and here's your calibrated audience, ready to test against," not just
"here's your analytics." Arc = **connect → analytics → audience.** Stanley gates hard at 1 IG account;
we can undercut (1 free) while charging for depth (N on Pro/Studio).

---

## Work plan

### 1. Data model (migration)
- **New table `connected_accounts`**: `id, user_id, platform ('tiktok'|'instagram'|'youtube'),
  handle, display_name, is_primary bool, connection_method ('scrape' now; 'oauth' later — keep
  producer-agnostic, see [[oauth-profile-ingestion]]), created_at, last_synced_at`.
  `UNIQUE(user_id, platform, handle)`. RLS own-rows.
- **`account_snapshots`**: add `account_id` FK → `connected_accounts`. Change uniqueness from
  `UNIQUE(user_id, snapshot_date)` → `UNIQUE(account_id, snapshot_date)`. (Migration:
  `supabase/migrations/20260703120000_account_snapshots.sql` is the origin; +recent_views
  `20260703130000`.)
- **`account_posts`**: add `account_id` FK. Uniqueness `UNIQUE(user_id, platform, post_id)` →
  `UNIQUE(account_id, post_id)`. (Origin: `20260706130000_account_posts.sql`.)
- **`audiences`**: add nullable `source_account_id` FK → `connected_accounts`. (Origin:
  `20260619000000_audiences.sql`; handle currently only in `profile` jsonb, set at
  `src/lib/audience/calibration.ts:~161`.)
- **Backfill**: for each distinct `(user_id, handle, platform)` in `account_snapshots`, create a
  `connected_accounts` row (mark the latest-handle-per-user as `is_primary`), then stamp `account_id`
  onto existing snapshots + posts. Old audiences: best-effort match `profile.handle`+platform →
  `source_account_id`, else leave null.

### 2. Repo / read-path changes (`src/lib/account-metrics/`)
- `account-metrics-repo.ts`:
  - `getAccountSnapshots(supabase, userId, n)` → `getAccountSnapshots(supabase, accountId, n)` (filter
    by `account_id`). Currently `.eq("user_id", userId)` at ~`:71-74`, doesn't even select handle.
  - `upsertAccountSnapshot` onConflict `user_id,snapshot_date` (~`:60`) → `account_id,snapshot_date`.
  - `listTrackedAccounts` (~`:92-114`, "latest handle per user") → replace with
    `listConnectedAccounts(userId)` reading `connected_accounts` directly. (Do NOT touch
    `tracked_accounts` — that's the **competitor watchlist**, a different table.)
- `account-posts-repo.ts`: `listAllPosts` (~`:96-106`) filter by `account_id`.
- `content-pillars/build-pillars.ts` (~`:147`): take `accountId` (or default to primary) so pillars are
  per-account, not merged across handles.

### 3. Cron (`src/app/api/cron/refresh-account-snapshots/route.ts`)
- Loop over `connected_accounts` rows (per account) instead of "latest handle per user" (~`:55`).
- Currently TikTok-only (~`:66`) — keep for now, but the loop shape must be per-account so IG/YT can
  turn on later. Writes snapshots (~`:111`), posts (~`:90`), clusters pillars (~`:127`) — all stamp
  `account_id`.

### 4. Connect flow (decoupled — NEW)
- A reusable "Connect account" action (platform + handle → scrape → create `connected_accounts` row +
  seed first snapshot). Reuse the existing scrape path from
  `src/app/api/audiences/calibrate/route.ts` (~`:108 calibrateFromScrape`, ~`:171-181` seeds snapshot
  today as a side-effect — invert this so *connect* seeds it, and *calibrate* is optional).
- Entry points: (a) the "Your account" tab empty state ("Connect your first account"), (b) `/settings`,
  (c) offered inside audience creation ("calibrate from a connected account, or connect a new one").
- End the connect arc by offering "Calibrate an audience from this account →" (the wedge).

### 5. UI
- **Account switcher** on the `/audience` "Your account" tab (component: analytics lives in
  `src/components/analytics/analytics-view.tsx`; tab shell in
  `src/components/audience/audience-manager.tsx`). A small control like the existing 7/30/90 range
  toggle: `@you·TikTok | @you·IG | + Connect`. Default = primary account.
- **Audience creation source picker** (`src/app/(app)/audience/new/` → `AudienceForm` →
  `CalibrationFlow`): "Calibrate from a connected account" (list them) vs "Custom" vs preset.
- **/start widgets** read own-account stats (`buildAccountStats` / `sumRecentViews`, see
  [[oauth-profile-ingestion]]) — repoint to the **primary** connected account.

### 6. Gating (decision at plan time)
- Natural paid lever: 1 connected account free, N on Pro/Studio (matches [[pricing-strategy]] — Studio
  has seats). Confirm before building the gate.

---

## Edge cases / decisions to lock at plan time
- **Same `@handle` connected by two users** — public data, no ownership verification exists today.
  Probably allow (each user gets their own `connected_accounts` row + series). Confirm.
- **Delete a connected account** → audiences calibrated from it should **orphan gracefully**: keep
  their frozen personas, drop the live `source_account_id` link. Don't cascade-delete audiences.
- **Primary account** — exactly one `is_primary` per user; it's the default analytics view and what
  /start reads. First connected account auto-primary; allow changing it.
- **OAuth future** — [[oauth-profile-ingestion]] may swap the scrape producer for OAuth (Composio,
  TikTok+IG). Keep `connected_accounts.connection_method` + the producer seam so only the capture
  swaps, not the schema.

## Verification plan
- Migration applies + backfill correct (existing single-account users unaffected; snapshots/posts get
  `account_id`; latest handle → `is_primary`).
- tsc 0, `node ./node_modules/vitest/vitest.mjs run` green (watch `account-metrics.test.ts` "no fake
  delta" honesty tests).
- Live browser pass (auth via `e2e/create-test-user.ts`, creds in that file): connect a 2nd account →
  switcher appears → each shows its own series (no collision) → calibrate an audience from a connected
  account → audience carries `source_account_id`.
- Cross-platform smoke: connect TikTok + IG same day → two distinct snapshot series (the bug that
  motivated this — must NOT collide).

## Key file map (from 2026-07-07 audit — verify line numbers, they drift)
- `supabase/migrations/20260703120000_account_snapshots.sql` — the `UNIQUE(user_id, snapshot_date)` origin
- `supabase/migrations/20260706130000_account_posts.sql` — `UNIQUE(user_id, platform, post_id)`
- `supabase/migrations/20260619000000_audiences.sql` — audiences (no handle column)
- `src/lib/account-metrics/account-metrics-repo.ts` — getAccountSnapshots / upsert / listTrackedAccounts
- `src/lib/account-metrics/account-posts-repo.ts` — listAllPosts
- `src/lib/content-pillars/build-pillars.ts` — pillars source
- `src/app/api/audiences/calibrate/route.ts` — scrape + snapshot seed (invert to a connect action)
- `src/app/api/cron/refresh-account-snapshots/route.ts` — daily capture (make per-account)
- `src/components/analytics/analytics-view.tsx` + `src/components/audience/audience-manager.tsx` — the tab + switcher home
- `src/app/(app)/audience/new/` (AudienceForm, CalibrationFlow) — source picker
- NOT this: `supabase/migrations/20260620090000_tracked_accounts.sql` — competitor watchlist, unrelated
