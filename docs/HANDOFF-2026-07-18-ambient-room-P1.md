# HANDOFF — Ambient room · P1 (panel craft) → P3, 2026-07-18

> ## ✅ UPDATE 2026-07-18 (later session) — P1 COMPLETE + P3 ROUTING SHIPPED
> **P1 is done.** The re-measurement pass (below) confirmed the handoff's warning: most of P0 §3 was
> STALE. Only the survivors were coded, all fails-first-guarded + live-verified, tsc=0. Commits:
> - **`f276fcc0` §3.6** — dropped the redundant readiness echo from the OPEN/RAIL bar. P0's "10 ready
>   owns 67%" was **INVERTED**: live, the rail *clipped* it to 39px ("10 read…", identity owned 78%),
>   the <xl header floated it in ~56% dead space. Collapsed tab keeps its live pulse.
> - **`9d3998ec` §3.2** — pinned `en-US` on the population counts (`toLocaleString('en-US')`), killing
>   the locale-dependent `1.000` that collided with the hardcoded `1,000` (#306 family). Guard = source
>   grep for bare `.toLocaleString()`.
> - **`8fb508c5` §3.8** — brain well captions no longer OVERPRINT at rail width (two `absolute
>   left-3/right-3` <p>s → one `inset-x-3` flex row). Found by rendering the cortex via **SwiftShader**
>   (full Chromium + `--use-angle=swiftshader`) — the WebGL unblock the handoff said needed a real machine.
> - **`960866d9` §3.8 density (owner call B)** — 9-signal grid 3→2 col (labels stop wrapping), dropped
>   the ×9 `WHY THIS SCORE` (the single `HOW TO READ` covers it; derivation kept as a hover title),
>   fixed the `predicted BOLD · vs rest` clip. ⚠️ Owner kept it despite +128px height (1123→1251).
> - **STALE (no work):** §3.1 (no 160px cell exists), §3.4 (verdict already encoded both renderers),
>   §3.5 (deleted in P0). §3.7 owner-skipped.
>
> **P3 routing SHIPPED — `cdb5c423`:** `/dev/*` 404s in real prod (new `dev/layout.tsx`, `VERCEL_ENV`),
> `/feed/hooks`·`/feed/channels`·`/competitors/[handle]`·`/competitors/compare` orphans → `redirect('/home')`,
> `/analyze`→`/home` (was `/start` dead 2-hop), `/competitors`→`/home` (was `/feed?tab` dropped-tab 2-hop).
> 8 guards fails-first; live-verified (authed browser nav — all 8 land on /home; /dev/cards still 200 in dev).
>
> **▶ REMAINING P3 (bigger, un-started):** (1) `account-read` — worst-rated renderer (STRUCTURAL) +
> the one starter card that RUNS on tap → measure-first, likely DESIGN-HEAVY (owner eye, like the brain).
> (2) `openRoomForCard` concept-STRING match → two identical-concept cards open the FIRST; thread the
> descriptor `id` through `ProofUnit` (architecture, family of #306). Scratch drivers: `.scratch/verify-p1-measure.cjs`,
> `verify-p1-fix.cjs`, `render-brain.cjs` (SwiftShader), `verify-p3-redirects.cjs`.
>
> *(Original P1 handoff preserved below for context — its re-measurement recipe still applies to the remaining P3.)*

---

Fresh-session handoff. **P0 ✅ · P2 placement ✅ · B·C·D cleanups ✅ — all shipped + live-verified.**
What remains: **P1 (panel craft, in the final container) → P3 (separable bugs).**

- **Prior handoffs (history, in this repo):** `docs/HANDOFF-2026-07-18-ambient-room-BCD.md` (B·C·D, now
  DONE) · `docs/HANDOFF-2026-07-17-ambient-room-redesign.md` (the ~575-line SSOT: P0 findings §3/§5,
  the plan §4, what's-built §7, design system §8). Memory: `ambient-room-redesign.md`.
- **Worktree** `~/virtuna-ambient-room` · branch `milestone/ambient-room-v2` (clean, pushed). Dev **:3002**.
- **Setup:** a real `pnpm install` in the worktree → Turbopack runs clean (the `node_modules` symlink
  hard-fails it). Launch detached: `node .scratch/start-dev.cjs`, then poll
  `curl -s --retry 40 --retry-delay 2 --retry-all-errors --retry-connrefused -o /dev/null -w "%{http_code}" http://localhost:3002/`.

## THE STANDING RULE (do not skip)
**LOOKING IS NOT MEASURING.** Every real finding this milestone came from `getBoundingClientRect` /
`getComputedStyle` / a DOM read + a network capture. Playwright screenshots HANG (animations never
settle). Drive it raw + read the DOM. **Make every new guard FAIL against the old code before you
trust it green** (stash only the source, rerun, confirm RED, restore).

---

## ✅ What shipped last session — B · C · D (all live-verified)
| Fix | Commit | What landed |
|-----|--------|-------------|
| **B** | `af2db4b8` | `audienceOpen` MODE killed (19 sites). `Ask the room` is a VERB now (`activeTool === "ask"` → `askAudience` → `/api/tools/react`), a real skill under the Ask group next to Chat. Visual expand split to `roomExpanded` (dock bloom + `<xl` header sheet; the rail ignores it) — tapping the header no longer arms ask-mode. Chip stays visible in every mode (escape hatch); `+` attach hides in Ask; `/` always opens the skill switcher. |
| **C** | `910d0351` | Idle copy `Type a thought below…` → `Type a thought and watch the whole room react.` (placement-neutral). |
| **D** | `4b18253f` | Ranked view: serif rank numerals dropped; a true top tie is NAMED (`Your top N are tied at X/10 — the room can't separate them`), counted on stop-count ONLY (never population — PR #306). |
| docs | `e2997534` | B·C·D SHIPPED recorded in the BCD SSOT. |

Guards live in `composer.test.tsx` (B), `audience-presence.test.tsx` (C), `ambient-room-compare.test.tsx`
(D) — all proven fails-first. Live driver: `.scratch/verify-bcd.cjs` (gitignored; mints a cookie, drives
`/home`, captures the real react POST → 200 → room verdict). Copy + adapt it for P1.

---

## 🔑 CRITICAL — the P0 §3 verdicts are PARTLY STALE. MEASURE THE CURRENT PANEL FIRST.
The redesign handoff's §3 was measured 2026-07-17, but **at least one verdict no longer describes the
code**, and I caught it only by reading the source before building (the milestone's own rule paying off):

- **§3.4 "the row never encodes its verdict — all ten rows byte-identical" — NOT TRUE of the ROOM.**
  `AmbientRoom.tsx` `PeopleView` (line ~621) ALREADY encodes it: a per-row **tonal dot** —
  `bounced ? bg-[var(--color-accent)] (coral) : bg-[var(--color-positive)] opacity-70 (green)`. This dot
  was added in `87785ef6` + refined in `a561111b` (#257), both PREDATING the P0 measurement. So P0's
  "4/10 card, ten byte-identical rows" was measured on a **DIFFERENT renderer** — the analyze **Read
  card** persona roster (`src/components/thread/multi-audience-read-block.tsx` and/or the Read's own
  roster), NOT the ambient room. **Before doing §3.4 work, measure BOTH surfaces live** and decide which
  (if either) still reads as a wall of identical rows. Don't code §3.4 against the room — it's done there.

**⇒ P1 STARTS WITH A LIVE RE-MEASUREMENT PASS, NOT CODE.** Re-run §3.1–§3.8 against the panel as it
stands today (the room moved since P0). Only the items that survive measurement are real work.

---

## ▶ P1 — panel craft (do the re-measurement, then the survivors). Each below carries its P0 claim +
##      what to re-check. Take the ranked view's grammar as the bar (§3: it's a *document*; the other
##      views are *forms*).

1. **§3.1 truncation** — P0: the at-rest trait cell is a fixed 160px; worst overflow 181px (the 5th row
   by 3px). Decided fix: **160→184px** (five rows fit, no copy rewrite). RE-CHECK the cell is still 160px.
2. **§3.2 de-dup the split** — P0: one stop/total split stated 5× + a `1.000` **locale bug** (`toLocaleString()`
   at `AmbientRoom.tsx:~859` vs hardcoded en-US commas at `:~132`/`:~797`). Killing the restatements kills
   the locale bug for free; any survivor must share ONE formatter. (Family of PR #306.)
3. **§3.3 repeated CTAs** — P0: `say hi →` ×10, `ask →` ×10, **and `WHY THIS SCORE →` ×9 in the brain**.
   Make the row the target; drop the per-row button. NOTE the room's PeopleView already routes the whole
   row to `onAsk` (the button IS the row) — re-measure where the ×N buttons actually still are (likely the
   brain grid + the Read roster, not PeopleView).
4. **§3.4 encode the verdict per row** — ⚠️ **DONE in the room's PeopleView (see CRITICAL above).**
   Re-measure the **Read card roster** (`multi-audience-read-block.tsx`) — that's where "byte-identical
   rows" was actually measured. Do it there if it still holds.
5. ~~§3.5 dead wells~~ — ❌ DELETED by P0 (never existed) AND the composer placeholder side is gone with
   B. No work.
6. **§3.6 rebuild the header** — P0: 5 elements (not 7); the real prize is **`10 ready` is `flex-1` and
   owns 489px of the 726px header = 67%**. ⚠️ **Design-heavy — get the owner's eye.** The header was also
   reshaped by P2 (a header in a rail vs on a band). Re-measure the CURRENT header at ≥xl (rail) AND <xl
   (the P2 header bar) — they differ.
7. **§3.7 add a `not`-line to the people view** — the population view has one (`1,000 MODELED FROM YOUR
   10`); steal Sapient's move (*every card states what it is NOT*).
8. **§3.8 the BRAIN is the DEFAULT view and P0 never opened it** — give it the same pass. ⚠️ Design-heavy;
   owner eye. (Headless can't render it — WebGL context fails without a GPU; measure structurally / on a
   real machine.)

**Owner-input items:** §3.6 (header rebuild) + §3.8 (brain pass) are subjective — surface an ASCII/preview
and get a call before building. §3.1/§3.2/§3.4-Read/§3.7 are mechanical + honesty-driven → same
fails-first + live-DOM shape as B·C·D.

## ▶ P3 — separable bugs (static-source finds, un-rechecked; some one-liners)
- **`/dev/cards` ships to PRODUCTION** — auth-gated only, no `NODE_ENV` gate, despite its "dev" header.
- 4 orphaned live pages (`/feed/hooks`, `/feed/channels`, `/competitors/[handle]`, `/competitors/compare`)
  — the launch cut redirected parents; Next sub-routes don't inherit.
- `/analyze` → `/start` → `/home` stale 2-hop; `/competitors` redirect drops its `?tab`.
- `account-read` = worst-rated renderer (STRUCTURAL) **and** the one starter card that RUNS on tap.
- **Residual from B (DEFERRED):** `openRoomForCard` (`composer.tsx`) matches a tapped card by concept
  STRING → two cards with an identical concept open the FIRST. Own task: thread the descriptor `id`
  through `ProofUnit`. Scroll-spy is immune (keys on positional `data-card-id`). Family of PR #306.

---

## Measure-first recipe (reuse — this is how every fix this milestone was proven)
1. **Mint a session cookie, no interactive login** (`.env.local` has `SUPABASE_SERVICE_ROLE_KEY`):
   `admin.generateLink({type:'magiclink'})` → anon `verifyOtp({token_hash,type:'email'})` → session →
   cookie `sb-<ref>-auth-token` = `base64-` + base64url(JSON(session)), chunked @3180 (@supabase/ssr).
   **Exact working code is in `.scratch/verify-bcd.cjs` / `verify-a2a.cjs` — copy it.**
2. **Test data exists:** user `e2e-test@virtuna.local`, a chat thread of ~20 idea-cards; `/home`
   auto-loads the most-recent open thread. The room is calibrated? — check; a General audience gives 10
   named personas.
3. **Raw Playwright** (`@playwright/test` installed; the bundled browser mismatches → pass
   `executablePath: ~/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`).
   Do NOT `waitForLoadState('networkidle')` — `waitForSelector` then `page.evaluate` DOM reads.
4. **Selectors:** scroll region `[data-testid="composer-thread-region"]`; rail
   `[data-testid="audience-presence"][data-variant="rail"]` in `aside[aria-label="Your audience"]`;
   header `[data-testid="audience-presence"][data-variant="header"]`; pulse `[data-testid="audience-pulse"]`;
   dock `[data-testid="composer-dock"]`. The panel body = `AmbientRoom` (`PeopleView` / `PopulationSwarm`
   / `BrainView`), reachable in isolation at **`/dev/cards#room`** (ranked + brain-drill boxes).

## Gotchas
- Dev server dies (SIGURG) if launched with a plain `&`/nohup when a foreground command runs. Use
  `.scratch/start-dev.cjs` (spawn detached + unref). It can still die between runs — re-check + relaunch.
- `npm test` prints FAKE results — use `node ./node_modules/vitest/vitest.mjs run <files>`.
- Accent is `#ff6363` (globals.css SSOT; CLAUDE.md's terracotta is STALE). Near-zero dosage in this panel
  — the only sanctioned accent is the settling dots + the bounce dot.
- tsc gate: `npx tsc --noEmit -p tsconfig.json` must stay 0.
- Headless can't render the brain (WebGL context fails, no GPU) — those pageerrors are environment noise,
  not a regression. Measure the brain structurally or on a real machine.

## Run order (fixed): P1 re-measure → P1 survivors (mechanical first, owner-input items after) → P3
