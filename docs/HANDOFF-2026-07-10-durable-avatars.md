# Handoff / Defense — Durable avatars + cron scaling (2026-07-10)

Follow-on to [HANDOFF-2026-07-10-durable-covers.md](./HANDOFF-2026-07-10-durable-covers.md).
This session closed the media-durability arc end-to-end and cleaned the competitor demo data.

## TL;DR

| PR | What | Merge |
|----|------|-------|
| — (DB only) | Removed 3 fake seed competitors + wrong `chrisbumstead`; added real **@cbum** | prod DB |
| [#222](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/222) | **Durable competitor avatars** (rehost like covers) | `eb074ad6` |
| [#225](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/225) | **Parallelize the refresh cron** so the batch finishes at scale (closes #223) | `e3686f98` |

The full arc: covers durable (#218) → avatars durable (#222) → the daily cron that keeps them fresh actually completes at scale (#225).

---

## 1. Demo data cleanup (prod DB `qyxvxleheckijapurisj`, no code)

**Problem.** The competitor demo held rows that could never show real thumbnails.

- **3 fake seed competitors** — `leanwithliv`, `coachderaldo`, `themobilitymethod` (UUIDs `aaaaaaaa-0000-4000-8000-00000000000{1,2,3}`, fake `/video/seed1` URLs, 0 real covers). **Deleted entirely** (3 profiles + 27 videos + 42 snapshots + 3 watchlist rows). Verified no other FK references first (`user_competitors`, `competitor_snapshots`, `competitor_videos`, `competitor_intelligence`).
- **Wrong `chrisbumstead`** — a 42-follower inactive/impersonator account, not Chris Bumstead's real one. **Deleted**, then re-added his real handle **@cbum** (verified via web search: 5M followers, 6× Classic Physique Olympia) through the *real* add-competitor UI — which exercised the live scrape + `rehostCover` path and produced **30/30 durable covers** (all resolve `200 image/jpeg`).

**Result.** The test user (`e2e-test@virtuna.local`) now tracks 3 real, fully cover-and-avatar-backed competitors: `cbum`, `mrbeast`, `khaby.lame`.

---

## 2. PR #222 — Durable competitor avatars

### The bug (and why it was worse than covers)

Scraped TikTok avatars are short-lived **signed** CDN URLs (`x-expires`) — they 403 within days, and the card drops to initials. Covers had this too (fixed in #218). Avatars were **worse**: the daily `refresh-competitors` cron **re-stamped a fresh ephemeral `avatar_url` on every run**, so an avatar could *never* stay valid. Observed live: `mrbeast`'s avatar 403 in the `/feed` console.

Audit found **100% of competitor avatars ephemeral** (`tiktokcdn` URLs); `mrbeast`'s already dead.

### The fix

- **`src/lib/scraping/rehost-cover.ts`** — extracted a shared `rehostImage(service, sourceUrl, key, bucket)` core (behavior-preserving for covers), and added **`rehostAvatar`** → public `avatars` bucket, key `competitor/<handle>`, same SSRF allowlist (HTTPS + TikTok CDN suffixes only), same total-degrade-to-null contract.
- **Wired into all 4 competitor-avatar writers:**
  - `src/app/api/cron/refresh-competitors/route.ts` — **the source of the re-rot** (critical)
  - `src/app/actions/competitors/add.ts`
  - `src/app/actions/competitors/retry-scrape.ts`
  - `src/lib/channels/ingest.ts` (`upsertChannelProfile`)
  - The apify webhook writes **no** avatars — coverage confirmed complete.
- **No new migration** — the `avatars` bucket already exists (public, from the profile-avatar upload feature).
- **`rehost-cover.test.ts`** (14 tests) — pins the SSRF allowlist (rejects non-HTTPS, non-CDN, and lookalike hosts like `tiktokcdn-us.com.evil.com`), idempotency, extension mapping, batch order, and the avatars bucket/key. This is the first unit test for the module — it guards the **security boundary** for both covers and avatars.

### Design decisions (defense)

- **Reused the existing `avatars` bucket** instead of a new one — already public, no migration, no infra churn.
- **Fallback chain `rehostAvatar(...) ?? ephemeralUrl`** — a rehost failure keeps the (fresh, still-valid) scraped URL; the card's existing `onError` handler drops to initials only if *that* also dies. Never writes a dead null.
- **Key = `competitor/<handle>`** is stable across all 4 paths (they all resolve to the normalized stored handle), so any re-scrape overwrites the same storage object — no drift.
- **Own-profile `creator_profiles` avatars left out of scope** — all-null today, not rendered as ephemeral URLs, different surface.

### Verification

- `tsc` 0 · scraping + channels + matte suites green (89) · new suite 14/14.
- Backfilled the 4 existing rows (cheap, no re-scrape): `cbum`/`khaby.lame`/`zachking` → durable; `mrbeast`'s URL already dead (403) → correctly skipped.
- **Triggered the live cron path** → re-scraped all 4 and rehosted durably, turning `mrbeast` durable too — proving the fix kills the rot *at source*.
- Browser: `/feed` competitors tab **0 console 403s** (was 1); `mrbeast` rendered a real avatar instead of "MR" initials.

---

## 3. PR #225 — Parallelize the refresh cron (closes #223)

### The bug (pre-existing, surfaced during #222)

`refresh-competitors` scraped every competitor profile **serially** (~40s each) under `maxDuration = 60`. A full run over 4 profiles took ~64s locally — on Vercel that's killed mid-loop. In prod only the first ~1 competitor got refreshed each day; everyone else stayed stale (stats, snapshots, and the #222 avatar top-up).

### The fix

- **`src/lib/concurrency.ts`** (new) — `mapWithConcurrency(items, limit, worker)`: a fixed pool of `limit` runners pulling from a shared cursor. Bounded parallelism between "all at once" (hammers upstream) and serial (too slow).
- **Cron rewrite** — `CONCURRENCY = 5`; extracted `refreshOne()` (returns `refreshed`/`failed`, never throws → failure isolation preserved); order **stalest-first** (`last_scraped_at asc, nulls first`) so a partial run still refreshes the most out-of-date profiles; **`maxDuration` 60 → 300** (Pro; the engine functions already rely on 300s).
- **`concurrency.test.ts`** (5 tests) — every item processed once, in-flight never exceeds the limit, pool sizes down to item count, empty no-op, `limit < 1` throws.

### Verification

- `tsc` 0 · full lib suite + matte guard green (2225).
- **Live cron run**: the 3 healthy profiles refreshed within a **5s window** (concurrent, not serial). One profile hit a *transient* TikTok "no profile data" scrape error and was correctly isolated (`failed`, others unaffected) — confirming failure isolation survives parallelization. Not a regression (the change doesn't touch `scrapeProfile`).

### Known ceiling (documented, out of scope)

Even `ceil(N/5)×40s` under 300s tops out around ~37 profiles. Stalest-first makes overrun **graceful** (freshest data is what's left for next run) rather than a hard failure. If the watchlist grows past that, chunk across runs (cursor / least-recently-scraped first) — noted in the PR, not built.

---

## State at session end

- Worktree `~/virtuna-explore-a` on `lane/explore-a`, reset clean to `origin/main` tip `e3686f98`. Both feature branches merged + deleted (local + remote).
- Prod DB: all 4 competitor avatars durable; covers durable; 3 real tracked competitors.
- Auto-wip daemon DISABLED (nothing auto-commits).

## Not worth doing (low value, graceful fallbacks exist)

- Historical `scraped_videos` cover tail (7,334 rows with no cover) — feed falls back to caption poster.
- Own-profile `creator_profiles` avatars — all-null today, not a rot surface.
