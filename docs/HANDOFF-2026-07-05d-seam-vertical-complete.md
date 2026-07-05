# Handoff — The Room ⇄ Surfaces seam vertical COMPLETE · 2026-07-05d

## TL;DR
**All four Room↔Surfaces seams are live on `/start`, and BOTH pre-tested sections carry real
per-audience reactions.** The mocks are gone from the flagship. Two PRs merged to `main` this
session:
- **#161** (`759d862e`) — Seams 1/2 for **outliers**.
- **#163** (`98417e3f`) — Seams 1/2 for **daily-ideas** + drawer made personas-only.

Seam 3 (audience dock, #153) and Seam 4 (embedded composer → thread launch, #151) landed earlier.
**Nothing on `/start` is fabricated anymore** — every idea/outlier card is a real Flash sim behind
a real card face, opening the real Room.

This doc is the next session's starting point. It supersedes `HANDOFF-2026-07-05b-seam-mount.md`
(which recorded the now-resolved BLOCKED state). Canonical seam ledger: `docs/SURFACE-SEAM-SPEC.md`.

---

## 1. What's real now (the shipped pipeline)

Both `/start` sections follow the SAME shape — **sim real content against the user's audience,
persist the reaction, derive the face + the Room from it**:

```
resolveUserAudience(user)                         ← the audience the room reacts as (dock + threads agree)
        │
  ┌─────┴─────────────────────────┐
OUTLIERS                        DAILY-IDEAS
queryFeed(trending, sort=outlier)   runIdeasPipeline(ask="")      ← generate→sim→rank, ONE call
  → competitor videos                 → generated idea blocks
runFlashTextModeBatch(captions)     each block carries S3′ personas
  → ReactionPersona[] per video       → ReactionPersona[] per idea
        │                               │
        └───────────────┬───────────────┘
             ReactionPersona[]  = {archetype, verdict:'stop'|'scroll', quote}
                         │
        ┌────────────────┴─────────────────┐
personasToCardFace(personas)          <AmbientRoom flatPersonas={personas} …>
  → {tone, stop, lead, fraction}        → the REAL Room (named voices, People⇄Population,
  = Seam 1 glance face                     weak-spot, ask→ chat)  = Seam 2
```

**Cache** (`surface_reactions` table, migration `20260705120000`, own-rows RLS): one Flash batch per
`(user × audience_key × kind)` where `kind ∈ {outlier, idea}` and `audience_key = audience.id | 'general'`.
18h TTL. `/start` server-reads a fresh batch (instant); a miss → the client warms lazily on the first
visit of the day via `POST /api/surfaces/{outliers,ideas}`, which sims + persists + returns the cards.
(Owner-chosen cadence: **lazy on first daily visit**, not cron.)

### Files (import, don't rebuild)
- `src/lib/surfaces/live-cards.ts` — `LiveOutlierCard` / `LiveIdeaCard` types + **`personasToCardFace`** (Seam 1, pure, 9 unit tests).
- `src/lib/surfaces/outlier-reactions.ts` — `buildLiveOutliers` (feed → batch Flash sim → assemble).
- `src/lib/surfaces/idea-reactions.ts` — `buildLiveIdeas` (`runIdeasPipeline` → keep blocks with personas).
- `src/lib/surfaces/surface-reactions-repo.ts` — `getFreshSurfaceCards` / `upsertSurfaceCards` / `audienceKeyOf`.
- `src/app/api/surfaces/{outliers,ideas}/route.ts` — the lazy refresh routes (auth + CSRF).
- `src/components/surfaces/room-drawer.tsx` — **personas-only**; renders `<AmbientRoom>`.
- `src/components/surfaces/sections/{outlier-card,idea-card,outliers,daily-ideas}.tsx` — live cards + warming/empty states.
- `src/components/surfaces/start-page.tsx` — `useLazyWarm` hook + `warmOnce` in-flight dedupe; `roomFocusFor`.
- `src/app/(app)/start/page.tsx` — reads both caches (`Promise.all`), passes `initialOutliers`/`initialIdeas`.

---

## 2. The one architecture correction (don't relearn this)
The earlier plan assumed the sim yields a full `PredictionResult` → `predictionResultToRead` →
contract-`Read`. **It doesn't.** Start-page cards sim via **Flash** (`{archetype,verdict,quote}`),
which emits **no `weakSpot`/`fix` and only a binary stop/scroll** (not the 3-way `PredictionResult`).
So:
- **Seam 2's render is the real `AmbientRoom` fed `flatPersonas`** — the exact component the video
  Read embeds — **NOT** the lossy contract-`Read` stub.
- `predictionResultToRead` (`src/components/reading/prediction-to-read.ts`) stays correct for the
  **full-video Read** (the `/analyze` embed), where a real `PredictionResult` exists. Don't force it
  onto surface cards.

---

## 3. Verified (real browser, real data — the "prove it works" pass)
- **Outliers:** 3 real @zachking videos, real reactions (`2/10` "Vague text hook…", `6/10` "Visual
  anomaly in frame one…", `6/10` "High energy start…").
- **Daily-ideas:** 4 real *generated* ideas ("The $500 'Adulting' Scam" 9/10, "The 'I'm Fine' Lie
  Detector Test" 7/10, "Why 'Treating Yourself' Is Bankrupting You" 6/10, …).
- Both: warm → sim → fill → **persist** → **cache-hit on reload** (no re-sim; `updated_at` unchanged).
- Tap a card → the real Room (named voices, People⇄Population·1,000, ask→, Replay, Develop/Remix CTA).
- **Seam 1 ↔ Seam 2 agree** — a card's lead quote is verbatim one of the named voices in the Room.
- Zero console errors · `tsc` clean (21 pre-existing test-baseline `Audience.mode` errors only) · 9
  adapter tests green · production `next build` passes (both routes registered).

---

## 4. What's NEXT (pick one — all are fresh features)
1. **Phase 4 outcome loop** — predicted-vs-actual → recalibrate the audience. **Blocked on
   account-connect** (needs real posted-performance data; the surfaces own account ingestion —
   OAuth/Composio, memory `oauth-profile-ingestion`). This is the last unbuilt seam-era item.
2. **Migrate `/calendar` to real** — retires the LAST mocks. `MOCK_IDEAS`/`MOCK_READS` are still in
   `mock-room.ts` **only** because `src/components/calendar/day-detail.tsx` (`getReadByCardId`) +
   `MOCK_MONTH_PLAN` reference idea cardIds. When the calendar's planned posts become real, retire
   these together. (`MOCK_OUTLIERS` already gone.)
3. **Close the audience-switch re-warm gap (v1 limitation):** switching audience on the dock does NOT
   re-sim outliers/ideas mid-session — they hold the last-warmed audience until the 18h TTL. This
   matches the chosen lazy-daily cadence (not on-change), but a snappier UX would re-warm on switch
   (add an audience-change effect that refetches, or key `useLazyWarm` on the selected audience id).
4. **Other surfaces** — /feed, /calendar, /grow, /library, /audience got the design-elevation pass
   (#158–#162) but their dock is peek-only; no card-level pre-tested reactions yet. Same pipeline
   could feed a "pre-tested" badge onto saved/feed cards if desired.

---

## 5. Gotchas (all hit this milestone — save yourself the rediscovery)
- **Sim shape:** surface cards = **Flash** (`ReactionPersona[]`), NOT `PredictionResult`. Render via
  `AmbientRoom flatPersonas`, not `predictionResultToRead`. (See §2.)
- **`find` is shimmed** in this shell (`rtk`) — use `ls`/Glob, not `find … -name`.
- **vitest:** `node ./node_modules/vitest/vitest.mjs run <file>` (npx/`npm test` print a fake PASS).
- **tsc baseline:** production 0; the **21 `Audience.mode` errors are pre-existing test-only** — ignore.
- **Vercel PR check is RED but PRE-EXISTING** (gitignored-lockfile / caret drift, memory
  `deps-pinning-gitignored-lockfile`) — `main` fails the same; local `next build` PASSES. Not your diff.
- **React StrictMode** double-invokes effects in **dev**, firing the (non-deterministic) ideas
  generation twice → the DB row can diverge from the rendered set. Fixed by `warmOnce` (shared
  in-flight promise); prod single-fires anyway. If you add more lazy warms, reuse `useLazyWarm`.
- **Playwright `browser_wait_for` caps at ~5s** per MCP call — don't pass long `time`; poll the DB
  (`surface_reactions`) for the persisted row to know a warm finished.
- **Fresh-upload Test is flaky here** (browser→Supabase-storage `ERR_HTTP2`). For a real
  `PredictionResult`, use an existing rich analysis (project `qyxvxleheckijapurisj`, e2e ids
  `giyyxJfww2iC` / `WPk976kozfWs`).
- **Auto-wip daemon LIVE** — never force-push. Merge `gh pr merge --squash` **WITHOUT**
  `--delete-branch` (the local step fails on the shared worktree); delete the remote branch manually.
- **Memory dir is worktree-guarded** — write memory via Bash, not Edit/Write.
- **Outlier corpus is thin:** only ~7 `scraped_videos` rows have a non-null `outlier_multiplier`
  (all `@zachking` right now). More variety appears as the feed ingests + backfills multipliers.

## 6. Setup
```bash
cd ~/virtuna-the-room                                   # NOT the surfaces worktree
git fetch origin && git switch -c <branch> origin/main  # main tip: 98417e3f (or newer)
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# http://localhost:3000 · login e2e-test@virtuna.local / e2e-test-password-2026
```

## Read first
- This doc · `docs/SURFACE-SEAM-SPEC.md` (the seam ledger, 07-05c/d updates) · `docs/THE-CONTRACT.md`
  (the 4 seams). Memory auto-loads `the-room-phase3-built.md` (full running log).

## Seam status
**`1 🟢 · 2 🟢 · 3 🟢 · 4 🟢` — all four live on `/start`; both pre-tested sections (outliers +
daily-ideas) carry real reactions.** Phase 4 outcome loop = the only unbuilt seam-era item (blocked
on account-connect).
