# Handoff — Premium elevation: propagate the locked `/start` bar to the other surfaces

**Date:** 2026-07-05 · **Worktree:** `~/virtuna-surfaces` · **work off `origin/main`** (cut a fresh branch per PR)
**Prev session:** codified the depth+motion system, audited all surfaces first-hand, elevated `/start`, iterated with the owner to a **locked bar**, merged it to `main`.

---

## 1. Where things stand

**The design system is codified + `/start` is DONE and owner-approved.** Both merged to `main` in the premium-elevation PR (depth/motion tokens + `.elev-*` utilities + tone-zone sectioning + the relaxed guard + the whole `/start` sweep). Just `git fetch origin && git switch -c <branch> origin/main` — main has everything.

The mandate (unchanged): the surfaces shipped functional but **FLAT** — owner wants them to feel like "something a big company would ship." Greenlit direction = **Hybrid**: precision + a matte-depth scale + a motion language + **spatial sectioning**, keeping **near-zero accent**. `/start` now embodies that bar. **Your job: propagate the exact same language to the other 5 surfaces, one reviewable PR each.**

---

## 2. The LOCKED patterns (this is the bar — apply verbatim)

Codified in `docs/DESIGN-SYSTEM.md` (SSOT) + `src/app/globals.css`. The reference impl is `src/components/surfaces/start-page.tsx` + its `sections/`.

1. **Matte depth scale** (`globals.css` `@theme`): `--shadow-rest` / `--shadow-lift` / `--shadow-press` (soft DARK drops, non-zero offset — never glow/glass/inset-shine/coral). Consume via utilities:
   - `.elev-rest` — resting floor on **static** elevated cards (stat tiles, calendar cells, rail widgets).
   - `.elev-lift` — **interactive** cards: rest → −1px + `--shadow-lift` on hover → settle on press. Ships the shared 150ms `--ease-out` transition (also animates hover border/bg). Pair with `hover:border-white/[0.10] hover:bg-white/[0.02]`.
2. **Spatial sectioning = matte tone-zones, NOT a background glow.** Wrap each loose content section in a subtle panel: `rounded-2xl bg-[#252320] px-4 py-4`, **no border, no shadow**, `mt-4` between zones. Inner cards keep their borders/depth and pop against the zone. The human header (greeting) floats above, unzoned. `SURFACE_RADIAL_BG` was **dropped from `/start`** (owner disliked the diffuse glow) — for each surface, prefer zones over the radial. (The `SURFACE_RADIAL_BG` constant is untouched/original so the not-yet-swept surfaces still render; drop its usage per-surface as you sweep.)
3. **Precision moves proven on `/start`:**
   - Kill placeholder-y states — **adaptive** rendering: rich state when data exists, a clean designed state when it doesn't (e.g. stat tiles → "trend builds daily" instead of an empty sparkline + bare "—"; guard on `value !== "—" && delta !== "—"`).
   - Drop fake/placeholder visuals (the fake idea video-thumbnail → title-forward). Real media keeps cover-forward.
   - Anchor at-a-glance chrome to its content (rings → beside the greeting, not a floating top band).
   - Strengthen faint elements (pillar bars: `h-1.5` + `bg-white/[0.06]` track).
   - Fill dead space (added a 4th idea → clean 2×2).
4. **Near-zero accent UNCHANGED.** Only the one live signal (accuracy ring, presence dot) gets terracotta. Everything else neutral cream. Depth is monochrome.
5. **Guard:** `src/components/reading/__tests__/reskin-matte.test.ts` — matte-drop ALLOWED, glow-halo BANNED, and it scans the `HYBRID_DEPTH_SURFACES` set. **Add each surface's touched files to that set as you sweep.** Keep 23/23+ green.

---

## 3. The plan — propagate, one PR each (do NOT merge until owner signs each)

Recommended order (severity + shared-fix leverage, from the first-hand audit): **`/grow` → `/feed` → `/calendar` → `/audience` → `/library`.** `/library` is the strongest already (lightest touch); `/audience` carries the one open decision (below). Cut each branch fresh off `origin/main`.

### Per-surface audit notes (first-hand, 2026-07-05)
- **`/grow`** (`src/components/grow/grow-hub.tsx`, tabs Numbers·Monetize·Referrals): reuses the SAME stat tiles as `/start` (apply the adaptive fix — likely shared component work), only 4 tiles + 2 rec cards → **huge empty bottom half**. Zone the sections; add depth; fill/rebalance. Check the Monetize + Referrals tabs too.
- **`/feed`** (Discover, `src/components/discover/discover-hub.tsx` + `FeedClient`, tabs Watching·Trending·Competitors): dense v1 filters rail; a visible "Filtering by status — coming soon" label; **undesigned gray cover-fallback** when TikTok covers 403 (the console errors are expired-CDN-signature 403s, a DATA issue — but design a real cover-less fallback). Most "v1 tool" of the set.
- **`/calendar`** (`src/components/calendar/calendar-workspace.tsx`): dead space (empty first week + big gap under the grid + an empty "Select a day" rail card — consider defaulting to today's plan); repetitive pillar chips on every cell; faint dots; flat. Reuses Content pillars (already improved on `/start`).
- **`/audience`** (`src/components/audience/audience-manager.tsx` + `audience-card.tsx`): flat cards, faint constellation thumbs, busy badge vocab. **⚠️ Fold in the seed branch `feat/audience-polish`** (2 commits — the AudienceCard precision/depth micro-interactions + crisper constellation motif) — it's the pre-approved reference for /audience; cherry-pick or rebuild the pattern, don't let it dangle. **Open decision below.**
- **`/library`** (`src/components/saved/saved-shelf.tsx`): strongest surface — masonry, typed filters, forward-chain footers, meaningful green/amber/red signal dots. Only needs `.elev-lift` on cards + stronger signal-bars. Lightest PR.

### ⚠️ `/audience` open decision (needs owner sign-off — do NOT rewire unilaterally)
Every audience card shows a `Validated` badge (top, tier from `resolveTier(mode)`) AND `no evidence — Directional` (bottom, per-persona grounding) — reads contradictory. It's the moat's honesty/trust layer, tested (`honesty-render.test.tsx`). Propose a reconciliation (e.g. merge into one coherent trust chip, or clearly separate "tier" from "evidence"), get the owner's OK, then implement.

---

## 4. Environment / gotchas

- **Dev server:** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3001` (`npm run dev` OOMs; the `npx next` wrapper breaks dev; `:3000` is The Room's). It occasionally dies — restart it. Next 16 / Turbopack.
- **Auth for visual verify:** `npx tsx e2e/create-test-user.ts` → `/login` with `e2e-test@virtuna.local` / `e2e-test-password-2026` (calibrated "Fitness Creators" audience + `test` audience + 9 library items + mock July calendar). Then drive Playwright; screenshot each surface before + after (screenshots save to the worktree root, gitignored).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` — **`npm test` / `npx vitest` print a FAKE `PASS(0)`.** Guards: `reskin-matte.test.ts` (23) + `audience/__tests__/` (31).
- **Typecheck:** `node ./node_modules/typescript/bin/tsc --noEmit` (repo has ~21 pre-existing `Audience.mode` errors in `*.test.ts`, out of build path — filter to touched files). `next build` runs the real typecheck.
- **Prod build (before each merge):** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next build` (~80 pages). **Kill the dev server first** (port + `.next` conflict).
- **Vercel check FAILS env-wide** (deps drift). Merge via `gh pr merge <n> --squash --delete-branch --admin` **after a local build passes**. The `--admin` local-checkout step errors `'main' is used by worktree ~/virtuna-v1.1` — **cosmetic**; the server merge still succeeds (verify `gh pr view <n> --json state` == MERGED), then prune the remote branch.
- **Deps:** `package-lock.json` is gitignored → pin **exact** versions, never `^`.
- **Auto-wip daemon:** commit your work promptly; if it grabs a dirty tree, amend on a CLEAN tree + `--force-with-lease` (never reset a dirty tree).
- **Deferred (leave/flag, don't half-do):** full Numen→Maven rebrand (still in `/audience` copy, logo, marketing); the sage-green `#8ea68a` raw hex (9 files) → tokenize to `--color-positive` as a separate cleanup.

---

## 5. Design SSOT + memory

- **SSOT:** `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md` (now includes the matte-depth scale, Motion, and Surface-sectioning sections). Every other design doc is STALE.
- **Memory:** `premium-design-elevation` (primary — this mandate + progress), `surfaces-ia-rationalization`, `design-system-current`, `ui-ship-design-grade`, `juno-maven-stale-strings`, `deps-pinning-gitignored-lockfile`, `auto-wip-daemon-hazard`, `vitest-rtk-shim`, `ui-verify-needs-browser-pass`.
