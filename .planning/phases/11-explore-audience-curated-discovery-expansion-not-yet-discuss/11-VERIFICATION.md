---
phase: 11-explore-audience-curated-discovery
verified: 2026-06-20T13:40:00Z
status: human_needed
score: 17/17 code-level must-haves verified (4 live-data truths routed to human verification)
overrides_applied: 0
human_verification:
  - test: "Live Explore pull renders a fit-scored grid in the browser"
    expected: "Pick /explore → tap a quick-action or set params + Run Explore → after the apidojo pull (minutes, no fake %), a grid of ~20-30 outlier tiles renders in-thread, each tile showing the measured multiplier + a 3-segment fit bar (FIT · Strong|Fair|Weak) on a calibrated audience"
    why_human: "Requires a live apidojo scrape against real TikTok data + a real calibrated audience; the SSE pull is genuinely minutes and cannot be exercised by a unit test without hitting the live provider"
  - test: "A real persona reaction surfaces via the reused remix-card LensTrigger after Remix → Read"
    expected: "Tap a tile's 'Remix → Read' → the open thread reloads in place (no navigation away from /home) → a remix-card appears with its P9 LensTrigger; tapping it produces a REAL persona reaction (not a fabricated quote on the grid)"
    why_human: "The on-tap reaction is produced lazily by the downstream remix-card's live LensTrigger against the live engine; requires the full discover→remix chain to run against real data and a human to confirm the reaction is genuine, not stubbed"
  - test: "An idempotent tracked_accounts row persists against the live DB"
    expected: "Tap '+ Track account' on a profile-mode tile → the button toggles to 'Tracking ✓' → a row appears in the live tracked_accounts table; tracking the same account again does NOT create a duplicate (UNIQUE upsert) and does NOT error"
    why_human: "Requires an authenticated session writing to the live Supabase tracked_accounts table and a human to confirm the row persists + the second track is idempotent (RLS-scoped, real auth)"
  - test: "Reload rehydration restores the persisted grid + remix-card against live data"
    expected: "After a real Explore pull + Remix, refresh the page → the persisted outlier-grid block(s) and the remix-card rehydrate from the open thread (filter b.type === 'outlier-grid' / 'remix-card') and render with live CTAs intact"
    why_human: "Requires a real persisted thread in the live DB and a browser reload to confirm the rehydration path restores both block types with working handlers"
---

# Phase 11: Explore (Audience-Curated Discovery) Verification Report

**Phase Goal:** THE flagship adopt. Turn one-shot Discover into the daily-habit entry door — but as an in-thread SKILL, NOT a feed dashboard. Explore is audience-curated outlier/competitor discovery rendered in-thread; each result tile carries an audience-relative fit signal and lands on a Read via "Remix → Read"; tracked-accounts watchlist is durable input State.
**Verified:** 2026-06-20T13:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All architectural and code-level must-haves for Phase 11 are VERIFIED in the codebase. The phase is **code-complete and structurally sound**: every artifact exists, is substantive, is wired end-to-end, and real data flows through the typed contract. 36/36 unit tests pass, `npm run build` compiles clean, and `ENGINE_VERSION` is unchanged at 3.19.0 (Pitfall 6 honored).

The phase routes to **human_needed** — not because anything is broken, but because Plan 11-08 Task 4 is an explicit human-verified end-to-end UAT against LIVE data. Four truths depend on a live apidojo scrape, the live engine (real persona reaction), and the live Supabase DB (persistence round-trip). These are deliberately deferred to end-of-phase human verification (`human_verify_mode = end-of-phase`) and cannot be auto-confirmed without exercising the live provider/engine/DB.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | `rankWithAudienceFit` is pure deterministic math — no SIM/engine/scraping/Supabase import, no network, no fabricated quote (EXPLORE-03 / D-02/D-03) | ✓ VERIFIED | `src/lib/discover/explore-rank.ts` imports only `RankedOutlier`/`Audience` types; purity grep returns nothing; level WORD only (no number/quote) |
| 2 | On General/preset/thin/no-persona audiences every tile returns `fit:null` (honest degrade gate), preserving P8 order | ✓ VERIFIED | `hasFitSignal()` gate (lines 54-62); degrade returns `ranked.map(t => ({...t, fit:null}))`; 13 unit tests lock this incl. General/preset/thin/empty-personas |
| 3 | Exact thresholds 0.66/0.4 and exact enum `Strong\|Fair\|Weak` (Pitfall 4); serendipity widens; deterministic | ✓ VERIFIED | `STRONG_THRESHOLD=0.66`, `FAIR_THRESHOLD=0.4`; quantize at lines 191-196; serendipity clamp + niche-weight (184-185); determinism test green |
| 4 | `OutlierGridBlockSchema` tiles carry optional `fit`/`trackable`/`trackHandle`; legacy persisted blocks still validate (no migration) | ✓ VERIFIED | `src/lib/tools/blocks.ts` lines 281/284/288 — nullable-optional; no-band/no-score honesty comment intact (line 241) |
| 5 | `tracked_accounts` migration: flat-typed, RLS own-rows, idempotent UNIQUE(user_id,platform,handle), FK CASCADE, no folder_id/tags (EXPLORE-05 / D-08) | ✓ VERIFIED | `supabase/migrations/20260620090000_tracked_accounts.sql` — CREATE TABLE + `auth.uid()=user_id` RLS + UNIQUE + CASCADE |
| 6 | Live `tracked_accounts` table applied + types regenerated (typed Row/Insert/Update) | ✓ VERIFIED | `src/types/database.types.ts` line 1800 — full `tracked_accounts` shape matching the migration |
| 7 | `tracked-accounts-repo` session-derives user_id (CR-01), idempotent upsert, NO `(supabase as any)` casts remain | ✓ VERIFIED | `tracked-accounts-repo.ts` — `auth.getUser()` (line 100-103), `upsert({onConflict})` (115); only "as any" match is a comment describing casts were dropped |
| 8 | `/api/tracked-accounts` POST/GET/DELETE auth-first (401) + csrfGuard on mutating methods | ✓ VERIFIED | `route.ts` — every method gates on `getUser()` 401; csrfGuard on POST (74) + DELETE (117) |
| 9 | `explore-runner` pull→rankOutliers→rankWithAudienceFit→safeParse block; NO SIM/video-scoring call | ✓ VERIFIED | `explore-runner.ts` — only network is `provider.scrapeVideos`; no engine import (purity grep clean); `OutlierGridBlockSchema.safeParse` (124) |
| 10 | Profile-mode tiles trackable:true (normalized handle), niche-mode trackable:false (RESEARCH Q3) | ✓ VERIFIED | runner lines 89-92; 2 unit tests lock profile vs niche trackability |
| 11 | `/api/tools/explore` SSE: auth→csrf→openThread→audience from `active_audience_id` (NEVER body, CR-01)→stream→persist+KC stamp; no SIM call | ✓ VERIFIED | `route.ts` — audience loaded from `openThread.active_audience_id` (206-214); General/preset/thin degrade; `insertMessage(...kcStamp().kcGenVersion)` (296); purity grep clean |
| 12 | `use-explore-stream` consumes POST via fetch+getReader (NOT EventSource), parses stage/content/done/error, exposes start/stop/reset/toBlocks | ✓ VERIFIED | `use-explore-stream.ts` — `res.body.getReader()` (151), frame parsing (181-221), `toBlocks` (243) |
| 13 | OutlierTile renders fit bar ("FIT · {level}" + "Fit for your audience · predicted"), omitted entirely when fit==null; bar tones success/warning/muted NEVER coral; coral reserved for single "Remix → Read" CTA (one-accent law) | ✓ VERIFIED | `outlier-tile.tsx` — fit bar gated `tile.fit != null` (140); FIT_BAR tones (68-72) are var(--color-success/warning/foreground-muted); only FF7F50 code is the Remix CTA (217-219) |
| 14 | "+ Track account" appears only when trackable, POSTs handle, toggles to "Tracking ✓" | ✓ VERIFIED | `outlier-tile.tsx` gated `tile.trackable` (187); handleTrack POSTs /api/tracked-accounts (184) + sets trackedIds |
| 15 | OutlierGridBlockRenderer forwards onRemix/onTrack/pending/tracked through DiscoverGrid→OutlierTile (no longer static, Pitfall 2) | ✓ VERIFIED | `outlier-grid-block.tsx` forwards all CTAs; DiscoverGrid wires them to `<OutlierTile>` (lines 151-155) |
| 16 | ExploreThreadView: 3 idle quick-actions (locked copy), card-2 honest degrade, handleRemix reuses discover→remix + in-place reload (NO router.push), handleTrack POSTs | ✓ VERIFIED | `explore-thread-view.tsx` — 3 QuickActionCards (231-266), card-2 degrade (242-256), `handoffsFor('discover').find(h=>h.to==='remix')` (149) + `onThreadReload?.()` (166); no useRouter/router.push code |
| 17 | Composer: explore pill enabled, mounts ExploreThreadView unconditionally when activeTool==='explore', submit branch never arms pendingNavRef/never navigates (Pitfall 1), params popover (niche/accounts/window/serendipity), rehydrates outlier-grid on mount | ✓ VERIFIED | `composer-controls.tsx` explore `enabled:true` (64) + 4-param popover (560-674); `composer.tsx` explore submit branch (655-661) returns w/o pendingNavRef, mount (900-914), rehydrate filter `b.type==='outlier-grid'` (323/329) |

**Code-level score:** 17/17 truths verified

### Live-Data Truths (Routed to Human Verification)

These four truths are the Plan 11-08 Task 4 end-to-end UAT. They are NOT marked auto-PASS (cannot exercise live provider/engine/DB) and NOT FAILED (all supporting code is verified). They route the phase to `human_needed`.

| # | Truth | Status | Routing |
| - | ----- | ------ | ------- |
| L1 | Live Explore pull renders a fit-scored grid in the browser | ⏳ HUMAN | apidojo live scrape (minutes) + real calibrated audience |
| L2 | A real persona reaction surfaces via the reused remix-card LensTrigger after Remix → Read | ⏳ HUMAN | live engine reaction via downstream remix-card |
| L3 | An idempotent tracked_accounts row persists against the live DB | ⏳ HUMAN | authenticated write to live Supabase + idempotency confirm |
| L4 | Reload rehydration restores the persisted grid + remix-card against live data | ⏳ HUMAN | real persisted thread + browser reload |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/discover/explore-rank.ts` | Pure audience-fit re-rank | ✓ VERIFIED | 209 lines; exports rankWithAudienceFit/FitLevel/FitRankedOutlier; pure |
| `src/lib/discover/explore-rank.test.ts` | Behavior proof | ✓ VERIFIED | 13 tests green (degrade/quantize/serendipity/determinism/honesty) |
| `src/lib/tools/blocks.ts` | Extended OutlierGridBlockSchema | ✓ VERIFIED | fit/trackable/trackHandle nullable-optional; honesty comment intact |
| `supabase/migrations/20260620090000_tracked_accounts.sql` | Watchlist table | ✓ VERIFIED | flat, RLS own-rows, idempotent UNIQUE, CASCADE |
| `src/types/database.types.ts` | Regenerated types | ✓ VERIFIED | tracked_accounts at line 1800 (NOTE: 11-08 plan frontmatter wrongly references `src/lib/database.types.ts` — that path does not exist; real path is `src/types/`) |
| `src/lib/tracked-accounts/tracked-accounts-repo.ts` | Flat-typed repo | ✓ VERIFIED | session-derived user_id, idempotent upsert, no `as any` casts |
| `src/app/api/tracked-accounts/route.ts` | CRUD route | ✓ VERIFIED | POST/GET/DELETE auth-first + csrfGuard |
| `src/lib/tools/runners/explore-runner.ts` | Explore pipeline | ✓ VERIFIED | 131 lines; pull→rank→fit→safeParse; no SIM call |
| `src/app/api/tools/explore/route.ts` | SSE route | ✓ VERIFIED | auth/csrf/audience-from-thread/stream/persist+KC; no SIM call |
| `src/hooks/queries/use-explore-stream.ts` | SSE consumer | ✓ VERIFIED | 259 lines; fetch+getReader; start/stop/reset/toBlocks |
| `src/components/discover/outlier-tile.tsx` | Fit bar + Track button | ✓ VERIFIED | fit bar omitted on null; never coral; trackable-gated Track |
| `src/components/thread/outlier-grid-block.tsx` | CTA-wiring renderer | ✓ VERIFIED | forwards onRemix/onTrack (Pitfall 2) |
| `src/components/thread/explore-thread-view.tsx` | Idle + grid + handlers | ✓ VERIFIED | 3 quick-actions, card-2 degrade, in-place reload, no router |
| `src/components/thread/explore-thread-view.test.tsx` | Behavior proof | ✓ VERIFIED | 9 tests green |
| `src/components/app/home/composer.tsx` | Explore mount + submit + rehydrate | ✓ VERIFIED | Pitfall 1 compliant submit; mount + reload + rehydrate |
| `src/components/app/home/composer-controls.tsx` | Explore pill + params popover | ✓ VERIFIED | enabled:true; 4-param popover |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| explore-rank.ts | outlier-compute.ts | imports RankedOutlier | ✓ WIRED | type import line 23 |
| blocks.ts | OutlierGridBlockSchema.tiles | fit enum Strong/Fair/Weak | ✓ WIRED | line 281 |
| tracked-accounts-repo.ts | tracked_accounts table | session user_id + UNIQUE upsert | ✓ WIRED | auth.getUser + onConflict |
| /api/tracked-accounts | tracked-accounts-repo.ts | create/list/delete | ✓ WIRED | imports all three (20-24) |
| explore-runner.ts | explore-rank.ts | rankWithAudienceFit | ✓ WIRED | line 83 |
| explore-runner.ts | blocks.ts | OutlierGridBlockSchema.safeParse | ✓ WIRED | line 124 |
| /api/tools/explore | openThread.active_audience_id | getAudience (never body) | ✓ WIRED | lines 206-214 |
| use-explore-stream.ts | /api/tools/explore | fetch POST + getReader | ✓ WIRED | lines 136/151 |
| outlier-tile.tsx | tile.fit.level | fit bar tone, omitted when null | ✓ WIRED | lines 140/149 |
| explore-thread-view.tsx | chain-handoff.ts | handoffsFor('discover')→remix | ✓ WIRED | line 149; endpoint /api/tools/remix/run (LIVE) |
| explore-thread-view.tsx | outlier-grid-block.tsx | renders grid + supplies onRemix/onTrack | ✓ WIRED | lines 298-307 |
| composer.tsx | explore-thread-view.tsx | mounts + supplies all props | ✓ WIRED | lines 900-914 |
| composer.tsx | explore.start | submit branch start() then return | ✓ WIRED | lines 655-661 (NO pendingNavRef) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| OutlierTile | tile.fit / tile.multiplier | block.props.tiles ← /api/tools/explore (apidojo pull → rankOutliers → rankWithAudienceFit) | Yes (live scrape; degrade to null is honest, not empty) | ✓ FLOWING |
| ExploreThreadView | persistedBlocks/streamingBlocks | composer (GET /api/threads/open filter outlier-grid + useExploreStream.toBlocks) | Yes (real persisted thread + live SSE) | ✓ FLOWING |
| ExploreThreadView card-2 | hasTrackedAccounts | composer GET /api/tracked-accounts → accounts.length>0 | Yes (live DB read) | ✓ FLOWING |
| DiscoverGrid | tiles (with fit) | block.props.tiles passthrough | Yes | ✓ FLOWING |

No HOLLOW props found: every prop passed to a child is sourced from a real fetch/SSE/state, not hardcoded empty. The `fit:null` degrade is an intentional honesty signal (renderer omits the bar), not a stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 11 unit suites pass | `node ./node_modules/vitest/vitest.mjs run <4 paths>` | 4 files / 36 tests passed | ✓ PASS |
| Production build compiles | `npm run build` | exit 0, compiled 10.4s, 74/74 static pages | ✓ PASS |
| Explore + tracked-accounts routes registered | build manifest grep | `ƒ /api/tools/explore`, `ƒ /api/tracked-accounts` present | ✓ PASS |
| ENGINE_VERSION unchanged (Pitfall 6) | grep version.ts | `ENGINE_VERSION = "3.19.0"` | ✓ PASS |
| explore-rank purity | grep engine/scraping/supabase imports | none | ✓ PASS |
| explore-runner purity | grep engine/SIM imports | none | ✓ PASS |
| no `(supabase as any)` casts remain | grep tracked-accounts-repo | only a comment reference | ✓ PASS |
| Live Explore pull renders grid (browser) | — | requires live apidojo scrape | ? SKIP → human (L1) |
| Real persona reaction after Remix | — | requires live engine | ? SKIP → human (L2) |
| Live tracked_accounts persistence + idempotency | — | requires authed live DB write | ? SKIP → human (L3) |
| Reload rehydration vs live data | — | requires real persisted thread | ? SKIP → human (L4) |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared or implied by this phase. Plan 11-08 declares an explicit human-verified end-to-end UAT (Task 4) rather than a scriptable probe. N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| EXPLORE-01 | 04, 06, 07 | Explore skill in-thread, customizable params | ✓ SATISFIED (code) | runner+route+ExploreThreadView+composer pill+4-param popover; live pull = human L1 |
| EXPLORE-02 | 04, 05, 06, 07 | Each card carries ambient reaction + lands on Read; CTA "Remix → Read" | ✓ SATISFIED (code) | "Remix → Read" CTA (never "rewrite for me"); discover→remix reuse + in-place reload; real reaction via remix-card LensTrigger = human L2 |
| EXPLORE-03 | 01, 04, 05 | Audience-relative outlier scoring relative to YOUR audience | ✓ SATISFIED | rankWithAudienceFit pure re-rank; fit bar; degrade gate; 13 tests |
| EXPLORE-04 | 06, 07 | Start-screen set-actions (audience-aware quick-actions) | ✓ SATISFIED | 3 idle quick-actions w/ locked copy; card-2 honest degrade; 9 tests |
| EXPLORE-05 | 01, 02, 03, 05, 06, 08 | Tracked-accounts/watchlist as input State (Library, P12 consumes) | ✓ SATISFIED (code) | migration + live table (types L1800) + repo + route + Track button; live persistence round-trip = human L3 |
| EXPLORE-06 | (none — DEFERRED D-09) | Comment seeding | ✓ CORRECTLY ABSENT | grep confirms no comment-seeding implementation; must NOT be implemented — verified not present |

No ORPHANED requirements: REQUIREMENTS.md maps EXPLORE-01..06 to Phase 11; all 5 active IDs are claimed by ≥1 plan and EXPLORE-06 is the documented deferral.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| explore-rank.ts | 27 | `[ASSUMED A2 — tune in UAT]` on tunable constants | ℹ️ Info | Intentional, planned ("tune in UAT like the Flash thresholds") — not a stub; constants are real defaults |
| explore-rank.ts | 107 | `return null` | ℹ️ Info | Legitimate divide-by-zero guard in `normalize()` for an empty temperature vector — correct behavior, not an empty impl |
| (all 13 modified files) | — | TBD/FIXME/XXX debt markers | — | NONE found (debt-marker gate clean) |
| (all 13 modified files) | — | TODO/HACK/PLACEHOLDER | — | NONE found |

No blocker or warning anti-patterns. The honesty spine is consistently enforced (no fabricated reactions/quotes/scores on the grid; degrade returns null not empty).

### Human Verification Required

The following 4 items are the Plan 11-08 Task 4 live-data end-to-end UAT. All supporting code is verified; these confirm the live flow works against the real apidojo provider, the live engine, and the live Supabase DB.

#### 1. Live Explore pull renders a fit-scored grid

**Test:** In the running app, select `/explore`. Tap a quick-action ("Top performers in my niche today") or open the Search popover, set a niche + serendipity, tap "Run Explore". Use a CALIBRATED audience (non-General, ≥1 persona).
**Expected:** After the apidojo pull (genuinely minutes, no fake %), a grid of ~20-30 outlier tiles renders in-thread. Each tile shows the measured multiplier (neutral) AND a 3-segment fit bar with "FIT · Strong|Fair|Weak" + "Fit for your audience · predicted". On a General audience, the fit bar is OMITTED entirely (no empty/zero bar).
**Why human:** Requires a live apidojo scrape against real TikTok data + a real calibrated audience; the SSE pull cannot be exercised by a unit test without hitting the live provider.

#### 2. Real persona reaction via the remix-card LensTrigger after Remix → Read

**Test:** On a rendered tile, tap "Remix → Read". Confirm the page does NOT navigate away from /home. After the open thread reloads in place, find the new remix-card and tap its LensTrigger.
**Expected:** A REAL persona reaction surfaces (from the downstream remix-card's P9 LensTrigger) — not a fabricated quote on the grid itself. The grid never showed a persona quote; the reaction is lazy/on-tap.
**Why human:** The reaction is produced by the live engine via the downstream remix-card; requires the full discover→remix chain against real data and human judgment that the reaction is genuine.

#### 3. Idempotent tracked_accounts persistence (live DB)

**Test:** On a profile-mode tile (trackable), tap "+ Track account". Confirm it toggles to "Tracking ✓". Check the live tracked_accounts table for the row. Then track the SAME account again.
**Expected:** One row persists (user_id = session user, handle normalized lowercased/no @). The second track does NOT create a duplicate and does NOT error (UNIQUE upsert). RLS scopes the row to the user.
**Why human:** Requires an authenticated session writing to the live Supabase tracked_accounts table; human confirms persistence + idempotency under real auth/RLS.

#### 4. Reload rehydration (live data)

**Test:** After a real Explore pull + a Remix, refresh the browser page.
**Expected:** The persisted outlier-grid block(s) and the remix-card rehydrate from the open thread and render with working CTAs (Remix / Track) intact.
**Why human:** Requires a real persisted thread in the live DB + a browser reload to confirm the rehydration path restores both block types with live handlers.

### Gaps Summary

**No code-level gaps.** All 17 architectural/code must-haves are verified: pure deterministic fit re-rank with an honest degrade gate, the extended typed block contract, the live tracked_accounts table + typed repo + auth/csrf route, the SSE Explore runner/route with audience loaded from the thread (never body) and zero SIM calls, the client hook + fit-bar tile (one-accent law) + CTA-wiring renderer, the ExploreThreadView with idle quick-actions and in-place reload (no navigation), and the composer wiring that never arms navigation (Pitfall 1). 36/36 unit tests pass, the build compiles, ENGINE_VERSION is untouched, and EXPLORE-06 is correctly absent.

**Notable documentation discrepancy (not a gap):** Plan 11-08 frontmatter references `src/lib/database.types.ts`, which does not exist. The actual generated types live at `src/types/database.types.ts` (tracked_accounts confirmed at line 1800). The work was done correctly at the real path; only the plan's path string is wrong.

**Why human_needed (not passed):** The phase contract includes a live-data end-to-end UAT (Plan 11-08 Task 4). Four truths require exercising the live apidojo provider, the live engine (real persona reaction), and the live Supabase DB (persistence round-trip + reload rehydration). Per `human_verify_mode = end-of-phase`, these are routed to human verification rather than auto-passed. The codebase is ready for that UAT.

---

_Verified: 2026-06-20T13:40:00Z_
_Verifier: Claude (gsd-verifier)_
