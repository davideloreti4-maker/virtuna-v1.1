# Handoff — Surfaces IA, next: the DISCOVER hub (P3)

**Date:** 2026-07-04 (for the next fresh session)
**Worktree:** `~/virtuna-surfaces` · **work off `origin/main`** (cut a feature branch per PR)
**Prev session:** brand rename + the GROW hub — **both merged to main**

---

## 1. Where things stand

Owner reframed the "UI polish" milestone into a **surface-IA rationalization**: collapse the app's **9 flat nav destinations → 5 grouped**, then **redesign each survivor for best UX** (not light polish). All three collapses are **owner-approved**.

### Ratified target IA (9 → 5)
```
CREATE     Start (glance+compose) · Calendar (month planner, standalone)
GROW       tabs: Numbers | Monetize | Referrals    ← Analytics + Grow + Referrals   ✅ DONE
DISCOVER   tabs: Watching | Trending | Competitors  ← Feed + Competitors             ← NEXT (P3)
AUDIENCE   (the moat, standalone)
LIBRARY    (saved, standalone)
· Settings · New Thread / Threads → The Room's territory (separate worktree)
```

### Shipped to main this session
| PR | What | Merge |
|----|------|-------|
| **#130** | Retire **Juno → Maven**; unify all 17 in-app browser-tab titles to `\| Maven` | `00a91ca2` |
| **#133** | **GROW hub** — Analytics+Grow+Referrals → one `/grow` with tabs Numbers·Monetize·Referrals; `/analytics`+`/referrals` redirect; sidebar collapsed 3→1; funnel + referral cards redesigned | `a2098dfb` |

**main tip:** `a2098dfb` (also carries The Room's #131/#132 — thread-side, unrelated).

---

## 2. NEXT — P3: the DISCOVER hub

**Goal:** fold **`/feed`** + **`/competitors`** into ONE tabbed destination — **Watching · Trending · Competitors** — exactly mirroring the Grow hub.

**The Grow hub is your reference implementation — copy its shape:**
- `src/components/grow/grow-hub.tsx` — the **hub shell** (radial bg + header + segmented tab bar + `rv-in` on switch + `history.replaceState` URL sync). Clone this into `src/components/discover/discover-hub.tsx`.
- `src/app/(app)/grow/page.tsx` — server page: reads `?tab=`, fetches all tabs' data, renders the hub. Model `/feed`'s (or a new `/discover`) page on it.
- `src/app/(app)/analytics/page.tsx` + `referrals/page.tsx` — the **redirect** pattern (`redirect("/grow?tab=…")`). Apply to whichever route becomes the redirect.
- Sidebar collapse: `src/components/sidebar/Sidebar.tsx` — see how the Grow item folded 3→1 (removed NavItems + orphaned icon imports + broadened `isOnGrow`). Do the same: Feed + Competitors → one **Discover** item.

**Key differences / watch-outs for Discover:**
- **Feed** already has internal `Watching | Trending` tabs (`FeedClient`) — decide: reuse its client as the first two hub tabs, or lift its tab state up into the hub bar. Read `src/app/(app)/feed/feed-client.tsx` first.
- **Competitors is the big one — 31 files** (`src/components/competitors/**`, real Supabase, sub-routes `/competitors/[handle]`, `/competitors/compare`). **Re-home it under a tab, do NOT rewrite it.** The competitors sub-routes can stay as-is (deep pages); the hub's Competitors tab renders the competitors list/overview (`CompetitorsClient`).
- Which URL is the hub? Likely **`/feed`** stays the hub (it's the more general "look outward" surface) OR mint `/discover` as the hub and redirect both. `/discover` currently redirects to `/feed` — you could repurpose `/discover` as the hub. **Owner's call if ambiguous — offer an ASCII option.**
- Server data: the hub page must fetch what all tabs need (feed data is client-fetched via `GET /api/feed`; competitors needs the Supabase queries currently in `competitors/page.tsx`).

**Definition of done (match P2's bar):** hub renders all 3 tabs, tab-switch + `?tab=` URL sync, redirects resolve, sidebar collapsed, **verify LIVE** (screenshot each tab), `tsc` clean, tests green, **0 console errors**. One PR off `origin/main`.

---

## 3. After P3

- **P1 — full nav section labels.** Once both hubs exist, group the sidebar into `CREATE / GROW / DISCOVER / AUDIENCE / LIBRARY` sections (the sidebar already has a `SectionLabel` component, used for "Threads").
- **P4 — redesign the standalone survivors for best UX:** `/calendar`, `/audience`, `/library`. Polish bar = **`/start`** (staggered `rv-in`, main + sticky right-rail, ambient dock). Known token drift to fix: sage-green `#8ea68a` is raw hex in **8 files** → add a `--color-positive` token.

---

## 4. Deferred workstreams (not this milestone's core)

- **Full Numen → Maven rebrand** — a separate pass. The app still says "Numen" in **in-app body copy** (composer "Ask Numen anything", audience calibration, etc.), the **marketing site** ("Numen Simulation" ×6, FAQ, testimonials), and the **logo** (`numen-logo.tsx`). Needs brand calls (is the feature "Maven Simulation"? marketing "Maven" vs "Maven by Numen"? new wordmark?) and updates ~4 tests asserting `"Numen"`. Keep `© Numen Machines` (company). Full scope: memory `juno-maven-stale-strings`.
- **Dead-code cleanup** — `ReferralLinkCard` / `ReferralStatsCard` / `ReferralsUpgradeFallback` are now unused (the old `/referrals` page that imported them is a redirect). Safe to delete; `CopyButton` is still used by the new `ReferralsTab`.

---

## 5. Environment / gotchas (READ FIRST)

- **Dev server:** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3001`
  - `npm run dev`'s 768 MB heap **OOMs**; the `npx next` wrapper breaks dev. Use the binary directly. `:3000` is **The Room's** worktree — use **`:3001`**.
- **Auth for visual verify:** `npx tsx e2e/create-test-user.ts` → log in at `/login` with `e2e-test@virtuna.local` / `e2e-test-password-2026` (free tier; has a calibrated "Fitness Creators" audience). To see a Pro-gated view, temporarily `insert into user_subscriptions (id,user_id,virtuna_tier,status) values (gen_random_uuid(),'<uid>','pro','active')` then **delete it after** (Supabase project `qyxvxleheckijapurisj`).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` — **`npm test` / `npx vitest` print a FAKE `PASS(0)`; don't trust them.**
- **Typecheck:** `node ./node_modules/typescript/bin/tsc --noEmit` — repo has pre-existing `Audience.mode` errors in `*.test.ts` (out of build path); filter to your touched files.
- **Prod build (before merge):** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next build` — passes locally.
- **Vercel check FAILS for everyone** — a known environmental deps-drift build issue (same failure URL on #130/#131/#132/#133). Merge via `gh pr merge <n> --squash --delete-branch --admin` **after a local build passes**. Deps: `package-lock.json` is **gitignored** → pin **exact** versions in `package.json`, never `^` (memory `deps-pinning-gitignored-lockfile`).
- **Git flow (daemon-safe):** auto-push hook is ON. The auto-wip daemon can co-opt a live branch. **Cut each PR branch fresh off `origin/main`** (`git switch -c feat/<x> origin/main`), do the work, commit, push, PR — never reset/force-push a shared branch. (`milestone/surfaces` is a stale local integration branch — ignore it; work off `main`.)

---

## 6. Design system (SSOT)

- **SSOT:** `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`. ⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are STALE (dead Raycast system) — ignore.
- **System:** flat-warm charcoal — bg `#262624`, cream `#ece7de` (never `#fff`), accent terracotta `#d97757`, **matte** (no glass/glow/inset-shine).
- **Borders** 6% (`white/[0.06]`), hover 10%. **Radius** cards 12, inputs/buttons 8. **Type:** Inter chrome; Newsreader serif voice-moments only.
- **Canonical H1:** `text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]` (or `<SurfaceHeader>`).
- **Radial backdrop:** `SURFACE_RADIAL_BG` (`src/components/surfaces/surface-canvas.ts`). **rv-in** entrance class in `globals.css`.
- **Guard test (keep green):** `reading/__tests__/reskin-matte.test.ts`.

---

## 7. Memory pointers (auto-load next session)

- `surfaces-ia-rationalization` — the IA plan + roadmap + P2-done state (this doc's source).
- `juno-maven-stale-strings` — rename done + exact deferred-rebrand scope.
- `numen-brand-architecture` — Maven (app) / Numen (company) hard-locked.
- `deps-pinning-gitignored-lockfile`, `auto-wip-daemon-hazard`, `vitest-rtk-shim`, `ui-verify-needs-browser-pass`, `ui-ship-design-grade`.
