# Handoff — Release readiness (flag flip) + the ProofReceipt cover repair (2026-07-25)

**Status: ✅ SHIPPED on `design/ambient-audience-v2` (3 commits, pushed). NOT yet merged to `main`.**
Gates: full suite **4473 / 0 with the flag ON *and* OFF** · `tsc` 0 · `eslint` 0.

| Commit | What |
|---|---|
| `e61e7872` | Earn the flag flip — corpus cover pipeline wiring, orphaned cast footer, flag-aware tests, drift guard |
| `4f3c795c` | TikTok + YouTube cover backfill · the regional-CDN allowlist bug |
| `73e7ab33` | Instagram cover backfill — 516/532 live |

---

## 1. The headline decision: **ship by flipping the flag, do NOT do the cutover**

`AMBIENT_V2_ENABLED` is a plain `process.env.NEXT_PUBLIC_AMBIENT_V2 === "true"` read with **8 branch
sites** (`composer.tsx` ×5, `home-page-layout.tsx`, `AmbientOverviewRail/Sheet`, `AmbientStartHome`,
`api/tools/test/card`). Releasing v2 = setting one env var in Vercel.

Ripping `AudiencePresence` (the long-tracked "cutover") buys users **nothing** — v2 ships identically
whether the legacy code is deleted or merely unreached — and it costs a week of regression risk plus
your rollback lever. **Deferred deliberately.** Retire the flag a release later, once it's boring.

## 2. Why the flip needed earning (the coverage hole)

The whole lane was built and verified with the flag **forced on in dev**, but the suite's default is
flag-**OFF**. The 4454/0 green was green for the product *not* being shipped. Forcing the flag on
surfaced **6 failures across 3 files** — all correct-by-design divergences, i.e. a pure coverage hole:

- `composer-layout.test.tsx` ×2 — legacy asserts `data-layout="centered"` on an empty home;
  `homeThreadMode` ORs the flag in, so v2 is **always** `"thread"` (that's what docks the composer
  under the Start surface).
- `home-page-layout.test.tsx` ×1 — legacy asserts the serif greeting; v2 Start carries its own, so
  the legacy hero is suppressed.
- `home.test.tsx` ×3 — legacy quick-action chips; v2 Start replaces them with the artifact grid.

**Fix pattern (reuse this):** each file now mocks the flag as a **live binding** so it can be flipped
per-test without a module reset —

```ts
let ambientV2 = false;
vi.mock('@/lib/flags/ambient-v2', () => ({
  get AMBIENT_V2_ENABLED() { return ambientV2; },   // getter ⇒ re-read on every access
}));
// beforeEach: ambientV2 = false;   // legacy pinned explicitly, never inherited from env
```

🔑 **Assert the REPLACEMENT, not the absence.** "no legacy chips" alone passes when a regression
renders *neither* surface. The v2 blocks assert the artifact tiles that must appear.

## 3. Live defects caught by the browser pass (both fixed)

### a. ProofReceipt thumbnails were dead on EVERY skill card

Measured on prod: **532 corpus rows, 532 covers, 21 live.** Root cause: the durable-cover mechanism
(`rehostCover`, shipped 2026-07-10) was wired into the three Discover/`scraped_videos` writers but
**never into the grounding corpus**. `corpus.ts` stored the raw signed CDN URL; `retrieve.ts:291`
read it straight into every receipt.

Compounding: the corpus is **one curated bulk import** (2026-07-14, `source_pool: curated`, zero
live-scraped rows) whose URLs were *already expired at import*. Verified they 403 **server-side**
too, so a proxy could never have saved them — the bytes had to be re-fetched.

**Fixed two ways:**
1. **Pipeline** — `upsertOutlierTeardown` / `upsertPersonalTeardown` now rehost at WRITE time
   (`durableCover()`, key `corpus/<platform>/<videoId>`, degrades to the ephemeral URL on failure).
   Guard: `corpus-durable-cover.test.ts` (verified failing 2/4 against pre-fix code).
2. **Backfill** — `scripts/backfill-corpus-covers.ts` (below).

🔑 **There are NO inline video players in thread** — no `<video>`, no `<iframe>` anywhere in
`src/components/thread`. A receipt is a *thumbnail + outbound link*. "The player doesn't load" was
always "the thumbnail doesn't load."

### b. The "on call" cast footer rendered with ZERO avatars

`deriveCast` maps `audience.segments`; **General carries none** — and General is the default for
every new creator, so a bare "on call" label under a border rule was the first-run desktop
experience (an earlier handoff had noted this only for mobile). No cast ⇒ no footer. We never invent
slices to fill it. Both directions pinned in `AmbientOverviewRail.test.tsx`.

## 4. The cover backfill — `scripts/backfill-corpus-covers.ts`

Dry-run by default · idempotent (skips durable + ytimg rows) · per-row degrade · **Instagram is
opt-in behind `--instagram` so nobody spends by accident**; a dry run reports rows + actor runs it
*would* cost.

```bash
npx tsx scripts/backfill-corpus-covers.ts                                  # dry run, free half
npx tsx scripts/backfill-corpus-covers.ts --platform=tiktok --apply        # free
npx tsx scripts/backfill-corpus-covers.ts --instagram --apply              # SPENDS Apify credit
```

| Path | Mechanism | Cost |
|---|---|---|
| TikTok | public oEmbed re-signs the **same asset** → `rehostCover` | free (96% hit rate) |
| YouTube | `i.ytimg.com/vi/<id>/hqdefault.jpg` — permanent, public, stored directly | free |
| Instagram | `apify/instagram-scraper`, **many `directUrls` per run** (330 posts = 4 runs) → `displayUrl` → rehost | ~$1 |

**Result on prod:** `instagram 325/8` · `tiktok 169/8` · `youtube 22/0` → **516 live / 16 dead
(97%)**, was 21. The 16 are genuinely deleted/private posts — they degrade to the placeholder, which
is the honest outcome. Rehosted URLs verified serving `200 image/jpeg`.

### 🔑 Two traps this cost real time on

1. **The SSRF allowlist rejected TikTok's own CDN.** TikTok serves the same asset from per-region
   image CDNs; the allowlist enumerated `-us` only and oEmbed returned `tiktokcdn-**eu**` — the first
   `--apply` failed **all 10** rows. Now an anchored regional pattern
   (`/(^|\.)tiktokcdn(-[a-z0-9]+)?\.com$/`), still an allowlist: lookalike
   (`tiktokcdn-us.com.evil.com`) and substring (`nottiktokcdn.com`) hosts stay rejected, both pinned
   by tests verified to fail against the old code. **This bug was latent in the Discover ingest
   paths too** — it just never fired because those scrapes landed on US CDNs.
2. **Stored `video_url`s lack `www.`**, which makes TikTok oEmbed return 400. The script
   canonicalizes from `creator_handle` + `platform_video_id`.

Instagram's free path is genuinely closed: public oEmbed is deprecated and the post page returns a
**600KB JS shell with zero `og:` tags** to an unauthenticated fetch. Don't re-litigate it.

## 5. Drift guard — `src/lib/surfaces/__tests__/start-registry-drift.test.ts`

A Start tile can no longer name a door with no room behind it: active ids must resolve in
`SKILL_RUN_META`, `"soon"` ids must **not** (a shipped skill left behind a greyed door is also a
bug), no duplicate ids, and the hand-mirrored `start-fixture.ts` must match the registry
tile-for-tile. The `soon` tiles (`ad`, `compare`) were already honest — `disabled`, 0.45 opacity,
labeled "Soon".

---

## ▶▶ NEXT (ranked)

1. **The Sim surface** — the real product gap. Unblocks the sealed test card's
   `Simulate with your audience →` (still the INTERIM `/analyze/[id]` link) and is the prerequisite
   for dissolving `/analyze`. Multi-session; start it in a fresh context.
2. **Mount the built-but-hidden v2 screens** — `AmbientOverview` (27K), `AmbientDetail`,
   `AmbientSimulate`, `SimulateIntake` render only on the `/ambient-v2` fixture route today. An
   earlier handoff blocked this on a rich `SimSnapshot` store, but Phase-C depth later landed inline
   — **re-derive that blocker before believing it.**
3. **`ad` + `compare` runners** — the two inert Start tiles.
4. Cleanups: dead per-type persisted bucket state · swap-on-switch flicker (~50–150ms) · cutover prep.

### Owner-gated, NOT in this repo
- **Flip `NEXT_PUBLIC_AMBIENT_V2=true` in Vercel Production.** ⚠️ The user reported "Vercel not
  configured at all", which contradicts `docs/PRICING.md` (prod env vars pushed 2026-07-19, crons
  verified firing at `virtuna-v11.vercel.app`). **Reconcile this before trusting either.**
- **Whop** — 6 plans + 8 env vars (`docs/PRICING.md` §74). A missing plan id is the checkout 503 by
  design; a missing *trial* id degrades to full price (never undercharges). Supabase OTP templates
  are **already live in prod**; the Supabase Auth items in §96 (leaked-password ON, min length 8,
  **custom SMTP — required, default is ~2 emails/hour**) still need a human in the dashboard.
  Neither the Supabase MCP (no auth-config tool) nor the Vercel MCP (no env-var tool) can do these.
- 🔑 **Rotate the Apify key** — it was pasted in plaintext into the 2026-07-25 chat transcript. It
  lives only in `.env.local` (gitignored, verified) and nothing depends on that specific value.

## Ops

```bash
rm -rf .next && NODE_OPTIONS="--max-old-space-size=2048" NEXT_PUBLIC_AMBIENT_V2=true PORT=3007 \
  nohup node ./node_modules/next/dist/bin/next dev -p 3007 > /tmp/dev-3007.log 2>&1 &
```
Tests: `node ./node_modules/vitest/vitest.mjs run` (NOT `npm test` — it's a shim).
**Always run the suite BOTH ways now** — `NEXT_PUBLIC_AMBIENT_V2=true` and unset. Verify the flag
**behaviourally** (`form[data-layout]`, the v2 rail), never via `ps`.
Test user: `e2e-test@virtuna.local` / `e2e-test-password-2026`. Prod project `qyxvxleheckijapurisj`.
`git checkout main` FAILS here (main is checked out in the `~/virtuna-v1.1` trunk) — FF via
`git push origin HEAD:main`.
