# Handoff — Multi-platform connect (Instagram + YouTube) via Apify

**Date:** 2026-07-07
**Status:** READY — start in a fresh session
**Builds on:** Connected Accounts slice 1 (#214) + slice 2 (#215). Branch off `main`
(current tip `05b9c4f6`).

---

## Why

Connected accounts + the connect flow shipped **TikTok-only** (slices 1–2). The whole
motivation for the collision fix was **cross-platform** creators (TikTok + Instagram +
YouTube), but today a user still can't connect an IG or YT account. Composio/OAuth is **not
available**, so multi-platform capture goes through **Apify scrapers** (same rails as the
existing TikTok path), producer-agnostic per [[oauth-profile-ingestion]] — the schema already
carries `platform ∈ {tiktok, instagram, youtube}`; only the capture producer changes.

**Scope of THIS slice = connect → analytics for IG + YT.** i.e. connect an IG/YT account →
its real profile numbers land in the "Your account" tab + daily cron. **Calibration (building
a testable audience) stays TikTok-only** for now — the audience signature pipeline depends on
TikTok video bundles (mp4 + native subtitles); IG/YT audience calibration is a separate, larger
effort. So the connect dialog's wedge CTA ("Calibrate an audience from this account") should be
**TikTok-only**; IG/YT connect ends at analytics.

## Current wiring (verified 2026-07-07)

- **Scraper:** `src/lib/scraping/apify-provider.ts` — `ApifyScrapingProvider` uses
  `clockworks/tiktok-profile-scraper` (⚠️ **Free-plan compatible** — see the actor note at
  L17-26; apidojo rental actors **refuse Free-plan API runs**, which previously broke every
  live pull. Any new actor MUST be verified on the current Apify plan first).
  - `scrapeProfile(handle)` (L257) → `actor(DISCOVER_PROFILE_ACTOR).call({profiles:[handle],
    resultsPerPage:1})` → `remapClockworksProfile(items[0])` (remap at L210). **This is the
    exact method the connect route calls** — light, profile-only, no video download.
  - Token: `APIFY_TOKEN` env (L232).
- **`ProfileData`** (`src/lib/scraping/types.ts`): `handle, displayName, bio, avatarUrl,
  verified, followerCount, followingCount, heartCount, videoCount`. ⚠️ `heartCount` = total
  likes is **TikTok-specific**; IG and YT expose no equivalent at the profile level.
- **Connect route:** `src/app/api/connected-accounts/connect/route.ts` — hardcodes
  `platform: z.enum(["tiktok"])` (L38); calls `new ApifyScrapingProvider().scrapeProfile(handle)`.
- **Connect dialog:** `src/components/connected-accounts/connect-account-dialog.tsx` — posts
  `{ platform: "tiktok", handle }` (L75); copy says "TikTok @handle".
- **Cron:** `src/app/api/cron/refresh-account-snapshots/route.ts` — loops
  `listAllConnectedAccounts` but **skips non-tiktok** (`if (account.platform !== "tiktok")
  continue;` L68). This is the per-account loop; add per-platform producers here.
- **Analytics stat-row:** `src/components/analytics/analytics-view.tsx` +
  `src/lib/account-metrics/account-metrics.ts` (`buildRangeMetrics`) render Followers / Likes /
  Posts / Views — **labels are TikTok-shaped** and will mislead for IG/YT (see §4).

## Work plan

### 1. Per-platform profile scrape (the core)
Give `scrapeProfile` a platform (it only takes `handle` today). Two clean options — pick one:
- **(a)** Add `scrapeProfile(handle, platform)` and branch to the right actor internally, OR
- **(b)** Add `scrapeInstagramProfile` / `scrapeYouTubeChannel` methods + a small dispatch in
  the connect route. (b) keeps TikTok untouched and is lower-risk. **Recommend (b).**

**Apify actors — VERIFY plan-compatibility + field shape with a probe run before coding:**
- Instagram: candidates `apify/instagram-profile-scraper`, `apify/instagram-scraper`
  (usernames mode). Map: `followersCount → followerCount`, `postsCount → videoCount`,
  `followsCount → followingCount`, `verified`, `biography → bio`, `profilePicUrl → avatarUrl`,
  `fullName → displayName`. **No total-likes → `heartCount: 0` (honest, never fabricate).**
- YouTube: candidates `streamers/youtube-scraper`, `apify/youtube-scraper` (channel mode).
  Map: `subscriberCount → followerCount`, `videosCount → videoCount`, channel `viewCount` →
  keep as a separate field or `recentViews`, `verified`, `description → bio`, `title →
  displayName`, avatar → `avatarUrl`. **No per-video-likes total → `heartCount: 0`.**
- Write `remapInstagramProfile` / `remapYouTubeChannel` next to `remapClockworksProfile`, with
  Zod schemas mirroring `apifyProfileSchema` in `src/lib/schemas/competitor.ts`.
- ⚠️ **First task in the session = a throwaway probe** (a tiny script or one MCP call) to run
  each actor on one public handle and confirm (i) it runs on the current Apify plan, (ii) the
  exact field names. Do NOT trust field names from memory — they drift per actor.

### 2. Connect route + dialog
- Widen `connect/route.ts` Zod to `z.enum(["tiktok","instagram","youtube"])`; dispatch to the
  right scrape by platform. Seed snapshot with `heartCount` from the map (0 for IG/YT).
- `connect-account-dialog.tsx`: add a platform selector (TikTok / Instagram / YouTube) before
  the handle input; post the chosen platform. Show the wedge "Calibrate…" CTA **only when
  platform === "tiktok"** (IG/YT end at "Done").

### 3. Cron per-platform
- Replace the `platform !== "tiktok"` skip with a per-platform producer: TikTok keeps its
  current bundle+cluster path; IG/YT do a **profile-only** refresh (snapshot each day, no video
  clustering yet — pillars stay TikTok-only, consistent with calibration staying TikTok-only).
  Keep `touchAccountSynced` per account.

### 4. Honest per-platform analytics labels (don't skip — this is the trap)
- `account_snapshots.heart_count` will be 0 for IG/YT. The "Your account" stat-row must NOT
  show a fake "Likes: 0". Make the metric set **platform-aware**:
  - TikTok: Followers / Likes / Posts / Views (today).
  - Instagram: Followers / Posts (+ Views if reels available). Drop Likes.
  - YouTube: Subscribers / Videos / Views. Relabel "Followers"→"Subscribers".
- Thread the account's `platform` into `AnalyticsView` (it's on `AccountOption` already) and
  into `buildRangeMetrics` (or filter the tiles by platform in the view). Honesty spine: omit a
  metric rather than show 0/— for a platform that has no such number.

### 5. Types + DB
- No migration needed — `account_snapshots` / `connected_accounts` already carry `platform`
  and are account-keyed. Just make sure the `platform` enum in any Zod/TS union includes all
  three everywhere (grep `"tiktok"` unions).

## Verify
- tsc 0 · `node ./node_modules/vitest/vitest.mjs run` (38 pre-existing home/composer/remix/
  sidebar fails are NOT yours; watch account-metrics + scraping schema tests).
- **Probe** each Apify actor once (real handle) — confirm plan-compatible + field shape.
- **Live** (dev `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next
  dev -p 3003`; auth `e2e-test@virtuna.local` / `e2e-test-password-2026`): connect a real IG
  handle → "Your account" switcher shows it with **platform-correct labels** (no fake Likes) →
  connect a YT channel → Subscribers/Videos/Views. TikTok path unchanged (regression check the
  zachking series still renders + calibration wedge still appears only for TikTok).
- 0 app console errors.

## Cost / risk notes
- Each connect = 1 Apify profile run (cheap). The daily cron now runs 1 profile scrape **per
  connected account** — watch total run count as accounts grow.
- Apify actor availability is the #1 risk (Free-plan rental refusals bit us before — see the
  clockworks note). If the best IG/YT actor is rental-only, confirm the account's Apify plan
  covers it BEFORE building the UI.

## Not in scope
IG/YT **audience calibration** (needs video+caption enrichment — separate milestone) · gating ·
per-account content pillars (that's the OTHER handoff: `HANDOFF-2026-07-07-per-account-pillars.md`) ·
brand grouping.
