# Handoff — Surfaces IA, next: P4 redesign, starting `/audience`

**Date:** 2026-07-04 (for the next fresh session)
**Worktree:** `~/virtuna-surfaces` · **work off `origin/main`** (cut a feature branch per PR)
**Prev session:** DISCOVER hub (#137) + sidebar nav sections (#138) — **both merged to main**

---

## 1. Where things stand

The "UI polish" milestone was reframed into a **surface-IA rationalization**: collapse the app's **9 flat nav destinations → 5 grouped**, then **redesign each survivor for best UX** (not light polish).

### The RATIONALIZE half is now DONE ✅
| PR | What | Merge |
|----|------|-------|
| #130 | Retire **Juno → Maven**; unify 17 in-app tab titles to `\| Maven` | `00a91ca2` |
| #133 | **GROW hub** — Analytics+Grow+Referrals → `/grow` tabs Numbers·Monetize·Referrals; `/analytics`+`/referrals` redirect | `a2098dfb` |
| #137 | **DISCOVER hub** — Feed+Competitors → `/feed` tabs Watching·Trending·Competitors; `/competitors` redirects | `5d789ace` |
| #138 | **Nav sections** — sidebar grouped into `Create` (Start·Calendar) / `Analyze` (Grow·Discover) / `Assets` (Audience·Library) | `82eb4e3a` |

**Resulting IA (9 → 5, made visible in the sidebar):**
```
CREATE     Start · Calendar
ANALYZE    Grow (hub) · Discover (hub)
ASSETS     Audience · Library
· New Thread (CTA) · Threads (history) · Account/Settings (bottom)
```
main tip when this was written: `2e0387d3` (also carries The Room's thread-side #136/#139 — unrelated).

### The REDESIGN half (P4) is NEXT — this session
Redesign the **standalone survivors** to the `/start` polish bar. Recommended order (owner-agreed): **`/audience` first** (it's the moat — good UX compounds across every skill), then `/library`, then `/calendar` (already fairly polished).

---

## 2. NEXT — redesign `/audience` (design-led, not barrel-ahead)

**This is a DESIGN task, not a mechanical one.** The hubs were routing/IA plumbing; this is "make the moat surface excellent." Per the owner's working style + memory `ui-ship-design-grade`:

> **Start by sketching 2–3 distinct redesign DIRECTIONS as ASCII mockups, present them via `AskUserQuestion` with previews, let the owner pick, THEN build.** Do not guess their taste and build blind.

### Current state of `/audience` (what you're redesigning)
- **Route:** `src/app/(app)/audience/page.tsx` — a bare `max-w-4xl mx-auto px-4 py-6` wrapper rendering `<AudienceManager />`. **No radial backdrop, no rv-in entrance, no rich header** — this is the gap vs `/start`.
- **`src/components/audience/audience-manager.tsx`** — client; fetches audiences (`listAudiences`), renders grouped persona **cards** (General baseline + presets + user audiences), a create/search affordance, a delete dialog. Uses `ConstellationMark`, `READING_CARD`.
- **Sub-routes (leave functional, redesign as needed):** `/audience/new` = `calibration-flow.tsx` (create/calibrate an audience); `/audience/[id]` = `audience-profile-view.tsx` (the 10 personas, signature, etc.).
- **16 components** in `src/components/audience/**` (audience-card, audience-reveal, audience-constellation-thumb, audience-temp-bar, trust-badge, persona-edit-form, calibration-flow, audience-profile-view, …) + 4 tests (`__tests__/`: audience-display, audience-form, honesty-render, persona-edit) — **keep green**.

### The polish bar = `/start`
Match its quality: `SURFACE_RADIAL_BG` backdrop, staggered `rv-in` reveals, a strong H1 (`text-[19px] font-semibold tracking-[-0.01em] lg:text-[22px]` or `<SurfaceHeader>`), main column + optional sticky right-rail, matte flat-warm chrome. See the GROW/DISCOVER hub shells (`src/components/grow/grow-hub.tsx`, `src/components/discover/discover-hub.tsx`) for the canonical shell pattern.

### Design context to READ FIRST (memories — but triage engine vs UI)
The audience subsystem has deep prior design thinking. Read these, but note **most describe the ENGINE/model or prior UX specs, not the current surface** — mine them for intent, verify against live code before trusting:
- `audience-3-position-model` — the ambient lens: STEER / REACT / REFINE. Conceptual spine.
- `audience-real-signature-redesign` — "make audience REAL" (1 scrape + 1 Flash, creator + 10 reactor personas). **Design-only, may not be built.**
- `audience-manager-phase7` — calibrated audience = shared substrate/moat across skills.
- `phase9-audiencelens-ux` — LOCKED sketch 005: one AudienceLens spine (Read + Panel·10⇄Population·1000 + scoped chat + sticky Rewrite). Rich UX source.
- `numen-surface-vision-competitive` — the surfaces vision (this milestone's parent).
- `ui-ship-design-grade`, `lead-with-recommendation` — how to run a design-led task.

⚠️ **The moat is REAL** — `/audience` is the calibrated-audience surface that grounds every skill's simulation. The redesign is UI/UX only; **do not touch the audience engine/data model or the calibration logic** unless the owner explicitly scopes it. Reuse the existing data (`listAudiences`, `Audience` types).

**Definition of done:** owner-picked direction built to `/start` quality, `tsc` + local `next build` clean, audience tests green, verified LIVE (screenshot the list + a profile), 0 app-console errors, one PR off `origin/main`.

---

## 3. Environment / gotchas (READ FIRST — unchanged this milestone)

- **Dev server:** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3001`
  - `npm run dev`'s heap **OOMs**; the `npx next` wrapper breaks dev. Use the binary. `:3000` is **The Room's** worktree — use **`:3001`**. (Runs Next 16.1.5 / Turbopack.)
- **Auth for visual verify:** `npx tsx e2e/create-test-user.ts` → log in at `/login` with `e2e-test@virtuna.local` / `e2e-test-password-2026` (free tier; has a calibrated **"Fitness Creators"** audience — good for the /audience redesign).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` — **`npm test` / `npx vitest` print a FAKE `PASS(0)`; don't trust them.**
- **Typecheck:** `node ./node_modules/typescript/bin/tsc --noEmit` — repo has ~21 pre-existing `Audience.mode` errors in `*.test.ts` (out of build path); filter to your touched files. `next build` runs the real typecheck.
- **Prod build (before merge):** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next build` — passes locally (~80 pages).
- **Vercel check FAILS for everyone** — known env deps-drift build issue (same failure on #130–#139). Merge via `gh pr merge <n> --squash --delete-branch --admin` **after a local build passes**. Deps: `package-lock.json` is **gitignored** → pin **exact** versions in `package.json`, never `^` (memory `deps-pinning-gitignored-lockfile`).
- **⚠️ Auto-wip daemon (hit twice this session):** it co-opts the active branch and commits your working tree with a `chore(auto-wip): test …` message. **Mitigation that worked:** commit your own work promptly (beat it); if it already committed, **amend the message on a CLEAN tree + `git push --force-with-lease`** (clean tree = daemon dormant, no race) — never reset/force-push with a dirty tree. Squash-merge discards the branch message anyway, so main stays clean regardless. `gh pr merge --admin`'s local checkout step **errors** (`'main' is used by worktree ~/virtuna-v1.1`) — that's cosmetic; the **server-side merge still succeeds** (verify with `gh pr view <n> --json state`), then delete the remote branch manually if `--delete-branch` didn't.
- **Git flow:** cut each PR branch fresh off `origin/main` (`git switch -c <x> origin/main`). `milestone/surfaces` is a **stale local branch — ignore it**; work off `main`.

---

## 4. Design system (SSOT)

- **SSOT:** `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`. ⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are STALE (dead Raycast system) — ignore.
- **System:** flat-warm charcoal — bg `#262624`, cream `#ece7de` (never `#fff`), accent terracotta `#d97757`, **matte** (no glass/glow/inset-shine).
- **Borders** 6% (`white/[0.06]`), hover 10%. **Radius** cards 12, inputs/buttons 8. **Type:** Inter chrome; Newsreader serif voice-moments only (greeting/hero).
- **Radial backdrop:** `SURFACE_RADIAL_BG` (`src/components/surfaces/surface-canvas.ts`). **rv-in** entrance class in `globals.css`. Canonical H1 / `<SurfaceHeader>` in `src/components/surfaces/`.
- **Guard test (keep green):** `src/components/reading/__tests__/reskin-matte.test.ts` (asserts no coral/glass).
- **Known token drift (fold in opportunistically):** sage-green `#8ea68a` is a raw hex in **8 files** → add a `--color-positive` token.

---

## 5. Deferred workstreams (not this task's core)

- **Full Numen → Maven rebrand** — separate pass. App still says "Numen" in **in-app body copy** (composer "Ask Numen anything", **audience calibration flow** — relevant to /audience! e.g. "Numen reads your public follower data"), the **marketing site**, and the **logo** (`numen-logo.tsx` / `NumenMark` still in the sidebar). Needs brand calls + updates ~4 tests. Keep `© Numen Machines` (company). Full scope: memory `juno-maven-stale-strings`. **If the /audience redesign touches calibration copy, you'll bump into "Numen" strings — leave them or flag, don't half-rename.**
- **Dead-code cleanup** — `ReferralLinkCard` / `ReferralStatsCard` / `ReferralsUpgradeFallback` now unused (old `/referrals` is a redirect). Safe to delete; `CopyButton` still used by the new `ReferralsTab`.

---

## 6. Memory pointers (auto-load next session)

- `surfaces-ia-rationalization` — the IA plan + full P0·P2·P3·P1 shipped state + P4 roadmap (this doc's source).
- `audience-3-position-model`, `audience-real-signature-redesign`, `audience-manager-phase7`, `phase9-audiencelens-ux` — /audience design context (triage engine-vs-UI).
- `juno-maven-stale-strings` — the deferred rebrand scope (calibration copy overlaps /audience).
- `ui-ship-design-grade`, `lead-with-recommendation` — sketch-first, recommend-first working style.
- `deps-pinning-gitignored-lockfile`, `auto-wip-daemon-hazard`, `vitest-rtk-shim`, `ui-verify-needs-browser-pass`.
