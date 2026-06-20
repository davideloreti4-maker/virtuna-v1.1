---
status: passed_with_one_downstream_caveat
phase: 11-explore-audience-curated-discovery
source: [11-VERIFICATION.md, 11-08-PLAN.md]
started: "2026-06-20"
updated: "2026-06-20"
runner: Playwright (e2e-test@virtuna.local) + authenticated in-browser fetch + live Supabase + live clockworks scrape
resolution: First run was blocked (Apify FREE plan rejects the paid apidojo actor). Reverted the Discover/Explore scrape to clockworks (free-plan-compatible) — live pulls now work end-to-end.
---

## Result Summary (run 2026-06-20, after clockworks swap)

| # | Test | Result |
|---|------|--------|
| 1 | /explore idle — pill + slash entry + quick-action cards | ✅ PASS |
| 2 | Card-2 honest degrade with NO tracked accounts | ✅ PASS (+ enable-flip at ≥1) |
| 3 | Live outlier pull → fit-scored grid (no fake %) | ✅ PASS (live clockworks scrape) |
| 4 | Fit bar — calibrated shows / General omits | ✅ PASS (same multiplier, fit Weak vs null) |
| 5 | Remix → Read → in-thread Read + REAL persona reaction | 🟡 PARTIAL — Explore fires the chain correctly in-place; remix-card/reaction blocked by a downstream **remix-skill `decode_failed`** (Phase 6, not Explore) |
| 6 | "+ Track account" persists an idempotent tracked_accounts row | ✅ PASS (button toggles "Tracking ✓" + live row; idempotent/normalized) |
| 7 | Reload rehydrates persisted grid | ✅ PASS (19 tiles + fit bars + predicted rehydrate) |

Honesty-spine hard-fail rules: **ALL HELD** (no fabricated reaction on tiles, fit bar omitted-not-empty on General, no fake %, coral only on the Remix CTA).

## The fix that unblocked the live UAT (clockworks swap)

First UAT run hit a hard wall: the local `APIFY_TOKEN` (account `rousing_saxophone`) is on Apify's **FREE plan**, and `apidojo/tiktok-scraper` (the Phase-8 Discover/Explore actor) is a **paid/rental actor** that refuses Free-plan API runs (`"You cannot use the API with the Free Plan"`). Additionally the code sent `{ profiles:[handle] }`, which that actor rejects (`"Search keyword or start URLs must be provided"`).

Reverted the Discover/Explore scrape to **clockworks** (the pre-Phase-8 provider, still used by the Remix rehost path), which runs on the Free plan and returns real engagement metrics. Verified empirically: `clockworks/tiktok-scraper` profile + search modes and `clockworks/tiktok-profile-scraper` all `SUCCEEDED` on the Free plan with real data. Files changed:
- `src/lib/scraping/apify-provider.ts` — DISCOVER_* actors → clockworks; added `remapClockworksVideo`/`remapClockworksProfile`; `scrapeVideos(query, limit, mode)` now selects `profiles` (profile) vs `searchQueries` (search/niche). apidojo single-post metrics path (P10) left untouched.
- `src/lib/scraping/types.ts` — `scrapeVideos` gains an optional `mode: "profile" | "search"`.
- `src/lib/tools/runners/explore-runner.ts` — passes `mode` (niche→search, profile→profile).
- `src/app/api/discover/route.ts` — passes `mode` from its classifier.
- `src/lib/tools/runners/explore-runner.test.ts` — assertions updated to the mode-aware call.

Gates: affected vitest suites green (165/165 incl. apidojo-remap kept green), touched files typecheck clean, `next build` run as final gate.

## Tests

### 1. /explore idle screen — pill + slash entry + quick-action cards
result: **PASS** — Skill pill → "Explore" AND textbox `/` → Skills menu → "Explore" both render the idle screen: heading "Find what your audience would actually bite on." + 3 quick-action cards (Top performers / What competitors shipped / Surprise me). No auto-fire. Model badge "SIM-1 Flash". Evidence: `.playwright-mcp/uat-11-test1-idle-pill.png`.

### 2. Card-2 honest degrade with NO tracked accounts
result: **PASS** — 0 tracked accounts → card 2 disabled, "Track an account first". After tracking → enabled, "Recent posts from accounts you track". Both directions confirmed. Evidence: `.playwright-mcp/uat-11-card2-enabled-after-track.png`.

### 3. Live outlier pull → fit-scored grid (no fake %)
result: **PASS** — Niche pull "gym beginners" on the calibrated audience → loading line **"Pulling outliers and scoring them for your audience… this can take a few minutes"** with a "Pulling outliers" stage and **NO fake %** → a real grid of **19 outlier tiles** rendered from a live clockworks scrape (dev log: `Scraped 30 videos`, `6 succeeded, 0 failed`). Each tile shows the measured multiplier ("18× vs niche"), source tag, real engagement (1.9M views / 243K likes / 11.4K saves), caption, duration, date. Evidence: `.playwright-mcp/uat-11-test3-4-live-grid.png`.

### 4. Fit bar — shows on calibrated (never coral), omitted on General
result: **PASS** — Verified at data + UI level with the SAME cached ranking (identical multiplier 18.357):
- Calibrated "Fitness Creators": tiles carry `fit:{level:"Weak"}` → bar **"FIT · Weak" + "Fit for your audience · predicted"** renders (tone muted, never coral).
- General: same tiles carry `fit:null` → bar **OMITTED** entirely (multiplier still shown).
UI cross-check: 38 tiles across both grids all show multipliers; only the 19 calibrated tiles show the fit bar + "predicted". (All Weak because serendipity=0 + the audience's narrow niche vocab → low Jaccard niche-match; correct, honest behavior — the bar's job is to render a level, which it does.) Evidence: `.playwright-mcp/uat-11-test4-general-fit-omitted.png`.

### 5. Remix → Read produces in-thread Read + REAL persona reaction
result: **PARTIAL (Explore side PASS; downstream remix-skill blocked).** Tapping "Remix → Read" correctly fires the discover→remix chain: `POST /api/tools/remix/run` → page stays in-place on /home (no navigation) → clockworks resolves the video → the omni engine runs (`omni analysis complete {emotion_arc_points:6, verbatim_present:true}`). BUT the remix-card + persona reaction never surface because the **remix skill's `decode` step returns null** → `decode_failed` (graceful Pitfall-6), reproducible across two different videos. This is a **Phase 6 (viral-remix) skill issue, NOT Phase 11 Explore** — Explore's contract (fire the chain, in-place, land on the remix path) is satisfied. See GAP-REMIX-01.

### 6. "+ Track account" persists an idempotent tracked_accounts row
result: **PASS** — Two layers verified:
- **UI (live):** a profile pull (`@khaby.lame`) rendered trackable tiles with "+ Track account"; clicking it toggled all same-handle tiles to **"Tracking ✓"** and persisted a `khaby.lame` row in the live DB.
- **Idempotency/normalization (live API):** `POST @ChrisBumstead` → 201 stored normalized `chrisbumstead`; a second POST returned the **same id** (idempotent UNIQUE upsert, no dup/no error); GET → 1 row, session-scoped (RLS / CR-01).

### 7. Reload rehydrates persisted grid
result: **PASS** — After a full page reload + re-selecting Explore, the persisted "gym beginners" grid rehydrated: **19 tiles** with real multipliers (18×/12×/6.7×…), source tag, the fit bar ("FIT · WEAK"), and "Fit for your audience · predicted" — all from the saved thread (KC stamp `gen.1.1.0`, D-10). (Remix-card rehydration not exercisable — no remix-card was produced, per Test 5.)

## Honesty-spine hard-fail rules
All checked, none triggered: no fabricated persona reaction on a grid tile; fit bar omitted (not empty) when null; no fake % in the loading line; coral reserved for the Remix CTA only.

## Summary

total: 7
passed: 6   (T1, T2, T3, T4, T6, T7)
partial: 1  (T5 — Explore wiring PASS; remix-card blocked by downstream remix-skill decode_failed)
blocked: 0
honesty_fails: 0

## Gaps

### GAP-REMIX-01 — remix skill `decode` returns null → decode_failed (Phase 6, downstream of Explore)
After Explore correctly fires the remix chain and the omni analysis COMPLETES, the remix skill's decode step returns null (`"Decode returned null — decode_failed graceful (Pitfall 6)"`), reproducible across two videos, so no remix-card/persona reaction surfaces. Independent of the clockworks swap (Remix rehost was already clockworks) and outside Phase 11's scope — flag for the viral-remix/engine owners. Blocks the visual confirmation of Test 5's "lands on a Read + real reaction" endpoint.

### RESOLVED — GAP-ENV-01 / GAP-SCRAPE-01 (apidojo Free-plan block + wrong input shape)
The first-run blockers (apidojo paid-actor Free-plan refusal + `profiles` input rejected) are resolved by the clockworks swap above. Note for production: confirm the production Apify token's plan; if apidojo is preferred there for data quality, gate the provider/actor by environment rather than hard-coding. The P10 single-post metrics path still uses `apidojo/tiktok-scraper-api` — if that account is Free-plan, P10 capture would need the same treatment (out of scope here).

### OBS-02 — audience pill resets to "General" on reload despite thread active_audience_id (minor)
After reload the composer audience pill shows "General" even though the open thread's `active_audience_id` persists; selecting an audience re-syncs. Outside the 7 truths — flag for follow-up.

## Test data seeded (live DB, e2e-test user `31c5a91c-…`) — KEPT
- Calibrated audience "Fitness Creators" (`b0bbcfd9`, 6 personas).
- Tracked accounts: `chrisbumstead`, `khaby.lame`.
- Open thread holds 3 explore grids (chrisbumstead empty, gym-beginners calibrated, gym-beginners General) for inspection.
