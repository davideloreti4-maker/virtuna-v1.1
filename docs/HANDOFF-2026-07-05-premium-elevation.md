# Handoff — Premium design elevation (Hybrid greenlit)

**Date:** 2026-07-04 (for the next fresh session)
**Worktree:** `~/virtuna-surfaces` · **work off `origin/main`** (cut a fresh branch per PR)
**Prev session:** finished **P4** (redesigned the standalone survivors to the `/start` polish bar) → owner then raised the real bar: *"still doesn't feel like something a big company would ship — better UX too."* Diagnosed it, showed options, **owner greenlit "Hybrid."**

---

## 1. Where things stand

### The surfaces-IA rationalization milestone is DONE ✅
9 flat nav destinations → 5 grouped, then every survivor redesigned to the `/start` polish bar (radial backdrop + `rv-in` + strong H1 + main/sticky-rail + matte). All merged to `main`:

| PR | What | Merge |
|----|------|-------|
| #130 | Juno→Maven tab titles | `00a91ca2` |
| #133 | GROW hub (Numbers·Monetize·Referrals) | `a2098dfb` |
| #137 | DISCOVER hub (Watching·Trending·Competitors) | `5d789ace` |
| #138 | Nav sections (Create/Analyze/Assets) | `82eb4e3a` |
| **#143** | **/audience redesign (Direction A: roster + rail)** | `e25c90bd` |
| **#144** | **/library → polish bar (shell-wrap; was already design-grade)** | `c5d98945` |
| **#146** | **/calendar → polish bar (added missing `rv-in`; was already built)** | `ced753fe` |

`main` tip when written: **`ced753fe`**.

---

## 2. NEW MANDATE — premium design elevation (this is the work)

**Owner's critique (verbatim intent):** all the pages still read as *not* something a big company would ship; wants **major UI design refinements, general polish, and better UX** across every surface.

### The diagnosis (grounded, from a critical `/start` pass — see §5)
The surfaces aren't broken — they're **flat**. The design system is *deliberately* austere (matte, no shadow, near-zero accent — the "de-Claude" identity lever, see `docs/DESIGN-SYSTEM.md`). That restraint has tipped into "under-designed." **Restraint and premium are NOT in tension** (Linear/Vercel/Things are austere *and* expensive-feeling). The gap is three things, none of which require bringing back accent:

1. **Depth** — a subtle *matte* elevation scale (soft **dark** shadows — NOT glass, NOT glow, NOT gradient).
2. **Motion** — a considered hover/press/transition language (today there is only a load-in `rv-in` fade).
3. **Precision** — spacing rhythm, type hierarchy, killing placeholder-y states, fixing washed-out contrast.

### DECISION (owner greenlit 2026-07-04): **Hybrid**
> Precision everywhere **+** a matte-depth scale **+** a motion language, **keeping near-zero accent.** The "premium restraint" path — crosses the big-company bar without betraying the de-Claude identity.

(The two alternatives owner did NOT pick: "stay strict / precision-only" = accept the flatness ceiling; "go further / full evolve" = reintroduce selective accent + richer treatment.)

---

## 3. THE PLAN (execute in this order)

1. **Codify the system FIRST.** Add a **depth scale** (e.g. 2–3 matte elevation levels: resting card floor-shadow + hover lift + the existing `--shadow-float` for genuinely floating surfaces) and a **motion language** (durations/easings; hover-lift, press-settle, transition tokens) to `docs/DESIGN-SYSTEM.md`. Update the **guard test** `src/components/reading/__tests__/reskin-matte.test.ts` so matte-depth is *allowed* while glass/glow/coral stay banned (today it asserts "cards are flat" for reading comps — relax to "matte shadow ok, no glass/glow"). Keep the near-zero-accent rule **unchanged**. This is deliberate identity work — do it carefully; the owner may want to eyeball the codified spec.
2. **Sweep all 5 surfaces to the new bar, one reviewable PR each.** Recommended order (owner said "sounds good" to starting here): **`/start` first** (the worst offender — see §5), then `/audience`, `/library`, `/calendar`, `/grow`. **Do NOT merge until the owner is happy with the FIRST one** (it sets the bar; the rest propagate the established patterns).
3. Reuse the **reference implementation** already built on the seed branch (§4) — the /audience card precision + matte-depth is the pattern to codify and propagate.

---

## 4. The seed branch (approved-direction reference, UNMERGED)

**`feat/audience-polish`** (pushed to origin, 2 commits, **not** PR'd/merged) — a preview of the Hybrid pattern on `/audience`:

- **`a7fd12d9`** `polish(audience)` — **precision**: real hover/press micro-interactions on `AudienceCard` (lift −1px + border-brighten + 150ms ease-out, press settles); crisper **constellation motif** in `audience-constellation-thumb.tsx` (star-size + brightness variance + faint connecting **edges** so it reads as an actual constellation, not a faint dot scatter). Audience tests **31/31** + matte guard **14/14** green, `tsc` clean.
- **`4c1dac36`** `demo(audience)` — **matte depth**: resting floor-shadow + soft lift-shadow on hover for the cards. Reversible; goes beyond the current "cards are flat" doc rule → **codify in step 1** before propagating. className-only, renders correctly in dev.

Screenshots captured this session (in the worktree root, gitignored): `audience-polish-1.png` (precision only), `audience-hybrid-hover.png` (+ depth, hovered), `start-current.png` (the critique baseline), plus `audience-AFTER-A-*` / `library-AFTER` / `calendar-*` from P4.

**On pickup:** the fresh session codifies the system (step 1), then either merges/extends this branch when the sweep reaches /audience, or cherry-picks the pattern. Don't let it dangle — fold it into the sweep.

---

## 5. Concrete craft gaps to fix (the punch-list)

**`/start` (worst offender — start here):**
- The **top-center rings** (`5-day`, `3/7`, `84%`) — 3 tiny colored gauges, cryptic labels, no container/context, and they spend **accent** 3× on one screen (violates near-zero-accent). Redesign or remove.
- **Placeholder-y data** — `New followers —`, empty sparkline zones under every stat tile, cryptic `L7D` labels. Reads unfinished. Give real deltas or an honest, designed empty state.
- **Cheap thumbnails** — the tiny gray content-preview boxes on idea cards look like placeholders.
- **Dead space + loose rhythm** — the 2nd idea row leaves a big empty gap; inconsistent vertical spacing.
- **Washed-out contrast** — the radial bg barely renders; constellation thumbs + progress bars are so faint they read low-fidelity, not "quiet."
- ⚠️ **Don't touch the composer/dock or thread** — that's **The Room's** territory (worktree `~/virtuna-the-room`). The /start *sections* (greeting, stat-row, ideas, outliers, pillars, calendar widget, top-chrome) are Surfaces-owned.

**`/audience`:** a real UX contradiction — a card shows a **`Validated`** badge (top) *and* **`no evidence — Directional`** (bottom). They mean different things (tier from `resolveTier(mode)` vs. per-persona evidence grounding) but read contradictory. **Reconciling this needs owner sign-off** — it's the moat's honesty/trust layer, tested (`honesty-render.test.tsx`) and deliberate. Flag, propose, don't rewire unilaterally.

**Cross-surface:** `SURFACE_RADIAL_BG` (`src/components/surfaces/surface-canvas.ts`) is `radial-gradient(120% 80% at 50% -10%, #2c2a27, var(--color-background) 60%)` — `#2c2a27` is barely lighter than the `#262624` bg, so the "lit-from-top" backdrop is nearly invisible. Strengthening it is a shared change (affects `/start·/audience·/grow·/calendar·/library`) — good candidate for the depth pass.

---

## 6. Design system (SSOT) + what changes

- **SSOT:** `src/app/globals.css` (`@theme`, `:42–233`) + `docs/DESIGN-SYSTEM.md`. Every OTHER design doc is STALE (Raycast/coral/glass) — ignore.
- **Tokens:** bg `#262624`; cream `#ece7de` (never `#fff`); accent terracotta `#d97757` **used near-zero** (this rule STAYS); primary actions are neutral cream `--color-action`, not accent; radius 4/6/8/12/16/20/24 (cards 12); Inter chrome, Newsreader serif for voice-moments only.
- **What Hybrid changes:** the "**matte, no shadow, cards are flat**" rule (§Border/depth) becomes a **matte depth SCALE** (soft dark shadows allowed; glass/glow/inset-shine/coral-glow still banned) + a **motion** section (none today). Near-zero accent + no-glass + no-`#fff` all UNCHANGED. Update the guard accordingly.
- **`rv-in`** entrance class + `SURFACE_RADIAL_BG` are the current shared shell primitives; `SurfaceHeader` in `src/components/surfaces/`.

---

## 7. Environment / gotchas (unchanged)

- **Dev server:** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3001` (`npm run dev` OOMs; the `npx next` wrapper breaks dev; `:3000` is The Room's). Next 16.1.5 / Turbopack.
- **Auth for visual verify:** `npx tsx e2e/create-test-user.ts` → `/login` with `e2e-test@virtuna.local` / `e2e-test-password-2026` (has a calibrated **"Fitness Creators"** audience + `test` audience + 9 saved library items + a mock July calendar).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` — **`npm test` / `npx vitest` print a FAKE `PASS(0)`; don't trust them.** Guards: `src/components/audience/__tests__/` (31) + `src/components/reading/__tests__/reskin-matte.test.ts` (14).
- **Typecheck:** `node ./node_modules/typescript/bin/tsc --noEmit` (repo has ~21 pre-existing `Audience.mode` errors in `*.test.ts`, out of build path — filter to touched files). `next build` runs the real typecheck.
- **Prod build (before merge):** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next build` (~80 pages, passes locally).
- **Vercel check FAILS env-wide** (deps drift, same on #130–#146). Merge via `gh pr merge <n> --squash --delete-branch --admin` **after a local build passes**. The `--admin` local-checkout step errors `'main' is used by worktree ~/virtuna-v1.1` — **cosmetic**; the server-side merge still succeeds (verify `gh pr view <n> --json state` == MERGED), then prune the remote branch manually.
- **Deps:** `package-lock.json` is gitignored → pin **exact** versions in `package.json`, never `^` (memory `deps-pinning-gitignored-lockfile`).
- **Auto-wip daemon:** commit your own work promptly; if it grabs your tree, amend on a CLEAN tree + `--force-with-lease` (never reset a dirty tree).
- **Git flow:** cut each PR branch fresh off `origin/main` (`git switch -c <x> origin/main`). `milestone/surfaces` is a stale local branch — ignore it. Screenshots save to the **worktree root** (gitignored).
- **Deferred (leave/flag, don't half-do):** full Numen→Maven rebrand — "Numen" still in `/audience` calibration + profile copy ("not how **Numen** writes", "**Numen**'s universal audience"), marketing, logo (`numen-logo.tsx`). See memory `juno-maven-stale-strings`. Keep `© Numen Machines` (company).

---

## 8. Memory pointers (auto-load next session)

- `premium-design-elevation` — this mandate + Hybrid greenlight + the seed branch + plan (**primary**).
- `surfaces-ia-rationalization` — the (now-complete) IA + P4 history.
- `design-system-current` — flat-warm charcoal system (about to gain depth+motion via Hybrid).
- `ui-ship-design-grade`, `lead-with-recommendation` — the owner's design-grade bar + working style.
- `juno-maven-stale-strings` — the deferred rebrand (overlaps /audience copy).
- `deps-pinning-gitignored-lockfile`, `auto-wip-daemon-hazard`, `vitest-rtk-shim`, `ui-verify-needs-browser-pass`.
