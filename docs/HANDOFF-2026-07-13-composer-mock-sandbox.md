# Handoff — explore-a: composer/home polish + zero-cost mock skill sandbox

**Date:** 2026-07-13
**Worktree:** `~/virtuna-explore-a` (branch `lane/explore-a`)
**Dev server:** `localhost:3001` (this worktree). Launch: `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev --turbopack -p 3001`
**Status:** all committed on `lane/explore-a`. Tests green (mock-sse 18/18, fixtures 2/2, composer-controls 16/16, home 9/9). tsc + eslint clean on all touched files.
**Split note (later this session):** the composer/home polish (§1–2) was cherry-picked to `feat/composer-quick-actions` → **PR #269** (base `main`). **Layer 2 (below) is now wired** on `lane/explore-a`.

> ⚠️ The screenshots the owner pasted earlier came from **:3002 = the `~/virtuna-explore-b` worktree** (a *different* working tree). All work below is in **explore-a** and is viewable at **:3001**. explore-b still shows the old UI.

---

## What shipped this session

### 1. Home empty-state layout (`/home`)
- Quick-actions grid moved **above** the composer (was below). Greeting + actions + composer now render as one vertically-centered group with real top breathing room.
- `HomeStarter` split into `HomeQuickActions` (grid, above composer) + `HomeFirstRunDemo` (show-once "See it in action", quiet footer below).
- Files: `src/components/app/home/{home-starter,home-page-layout,composer}.tsx`, `src/app/(app)/home/loading.tsx` (skeleton reordered to match).

### 2. Skill-picker popover restyle (the `/` + pill skill menu)
- Fixed the broken active-row highlight (was `bg-white/[0.06]` on the label span only → a partial gray bar; now a full-row fill).
- Premium pass: subtle MAX badge, muted-mono `/command` that brightens on hover, icon dim→bright progression, hairline divider under the filter hint, tighter section headers.
- **Surface fix:** the popover used a one-off `bg-[#211f1d]` (near-invisible vs the page). Now `bg-surface-elevated` (`#2c2c2b`) — the app's canonical floating-menu tone (matches the audience/sidebar dropdowns). Applied in all 3 skill-menu surfaces.
- Files: `src/components/app/home/{composer-controls,composer,embedded-composer}.tsx`. `SkillRows` is shared by the pill popover AND the `/` slash menu, so both improved at once.

### 3. Zero-cost mock skill sandbox (the main ask)
Goal: iterate on composer / audience / thread rendering + feel **without spending Qwen (+Apify)** tokens.

**Layer 1 — preloaded populated thread (DONE + verified):**
- Dev-only ⚙ panel, **bottom-right** (`src/components/dev/dev-mock-panel.tsx`, mounted in `src/app/(app)/layout.tsx`). Self-gates on `NODE_ENV` → vanishes in prod.
- Buttons: **Seed demo thread** (`POST /api/dev/mock/seed`) · **Clear thread** (`POST /api/dev/mock/clear`) · **Mock skill runs** toggle (sets the `numen_mock` cookie).
- The seed archives→reseeds the open thread with hand-authored, schema-valid fixture blocks (`src/lib/tools/mock/fixtures.ts`) via the **real** `insertMessage`, then repoints the `maven_active_thread` cookie so the seed actually shows.
- Covered skills in the default seed: **hooks · ideas · script · remix · chat · explore** (all cleanly tool-gated — switch the skill pill to view each). Verified rendering through the real production renderers, **0 unsupported blocks**.
- Fixtures validated against `BlockUnionSchema` by `src/lib/tools/mock/__tests__/fixtures.test.ts`.

**How the seed shows up:** `getOpenThread` honors the `maven_active_thread` pointer cookie; a blank `__new__` sentinel returns null (empty home). The seed route + dev panel both repoint the cookie at the seeded thread id — **this is why raw `curl` to the seed route alone won't render; the cookie must point at it** (the panel/route handle this).

---

## Known gaps / next steps

1. **Layer 2 — cheap LIVE re-triggering — ✅ WIRED this session.** SSOT: `src/lib/tools/mock/mock-sse.ts` → `maybeMockSkillRun(skill, userId)`, called right after the auth gate in **all 13** `/api/tools/*` routes. With the `Mock skill runs` toggle armed (`numen_mock=1`, dev-only via `isMockSkillsEnabled`), NO route can hit a paid engine:
   - **5 fixture-streamed skills** — `explore · hooks · ideas · script · remix` — replay `FIXTURE_BLOCKS_BY_SKILL[skill]` over the **exact** client SSE contract (`stage → content{blocks} → per-card score → done`) and persist via the real `insertMessage`. Zero Qwen/Apify. The **accidental Explore→Apify scrape can no longer happen** when armed.
   - **8 skip-guarded routes** — `chat · profile · simulate · predict · read · react · refine · ideas/develop` — return a cheap `503 {mockSkipped:true}` ("not mocked yet — run skipped, no engine call"). The client surfaces the message; nothing fires. Their fixtures are still viewable via the ⚙ seed (Layer 1).
   - Pure frame-builder `buildMockFrames()` is unit-pinned by `src/lib/tools/mock/__tests__/mock-sse.test.ts` (18 tests: content carries all blocks; one score frame per band-bearing card matched by seedHook; explore emits 0 score frames; done counts).
   - **Verification:** tsc 0 / eslint 0 across the helper + 13 routes; all 13 routes 401 unauthed in the live dev server (compile + load clean); 20 mock tests green. ⏳ *Not yet* browser-clicked end-to-end (needs an authed session; the harness kept killing the bg dev server). Manual check: arm the toggle → run Explore → Network shows no `apify` call + the fixture grid renders.
   - **Next (Layer 2 phase 2):** promote `chat` (token-stream fixture) + `profile/simulate/predict` (JSON routes) from skip-guard to real fixture replay, so those skills also live-replay instead of skipping.

2. **Profile / Simulate / Predict deliberately excluded from the default seed.** Their result blocks (`profile-read`/`reaction-distribution`/`prediction-gauge`) render **tool-independently** (pinned to the top of *every* view), so seeding them made the big Read card dominate the Hooks/Chat views (this was the "chat not accurate" bug — fixed by dropping them from `SEED_MESSAGES`). Fixtures still exist in `FIXTURE_BLOCKS_BY_SKILL` for Layer 2. To eyeball them via seed, temporarily add `{ role: "assistant", blocks: PROFILE_BLOCKS }` to `SEED_MESSAGES`.

3. **account-read / multi-audience-read blocks not seeded** — the composer rehydration buckets don't sort those into a per-skill view the same way; they have their own views (`AccountReadThreadView`). Add fixtures + wiring if you want to preview the Account Read / the "Read" surfaces.

4. **Stray threads in the test account** — the accidental Explore scrape left `#tiktok #foryoupage` / `tiktok.com` threads in the sidebar history. Cosmetic; clear via the sidebar or ignore.

---

## Fast resume

```bash
cd ~/virtuna-explore-a && git worktree list   # confirm you're in explore-a
# dev server:
NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev --turbopack -p 3001
# then: open localhost:3001/home → click the ⚙ (bottom-right) → "Seed demo thread"
# switch the skill pill (Make/Test/Ask) to view each skill's rendered output.
```

Tests: `node ./node_modules/vitest/vitest.mjs run src/lib/tools/mock/__tests__/fixtures.test.ts src/components/app/home/__tests__/composer-controls.test.tsx`
