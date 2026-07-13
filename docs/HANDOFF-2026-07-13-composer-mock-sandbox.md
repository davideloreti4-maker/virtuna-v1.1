# Handoff — explore-a: composer/home polish + zero-cost mock skill sandbox

**Date:** 2026-07-13
**Worktree:** `~/virtuna-explore-a` (branch `lane/explore-a`)
**Dev server:** `localhost:3001` (this worktree). Launch: `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev --turbopack -p 3001`
**Status:** all committed on `lane/explore-a`. Tests green (fixtures 2/2, composer-controls 16/16, home 9/9). tsc clean on touched files.

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

1. **Layer 2 — cheap LIVE re-triggering is NOT built yet.** The `Mock skill runs` toggle sets the `numen_mock` cookie but nothing reads it. To finish: in each `/api/tools/*` route (and `/api/account-read`), short-circuit when `isMockSkillsEnabled(cookie)` (see `src/lib/dev/dev-mock.ts`) — stream a canned STAGE→content→done timeline + persist the matching `FIXTURE_BLOCKS_BY_SKILL[skill]` instead of calling the runner. Then clicking a skill + submitting replays for free.
   - ⚠️ Until Layer 2 lands, **submitting a skill still hits the real engine.** During this session an accidental Explore submit fired a **real Apify TikTok scrape** (~$; see dev log). Be careful clicking *Run Explore* / submitting until the routes are mocked.

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
