# HANDOFF — Ambient room · remaining P3, 2026-07-18

> ## 🚢 SHIPPED — MILESTONE MERGED TO MAIN (PR #330, 2026-07-18)
> The whole `milestone/ambient-room-v2` (P0·P2·BCD·P1·P3) landed on `main` via **PR #330** (`--no-ff`).
> Net diff 45 files, +2716/−789. **Full suite 4148/0 · tsc 0 · `/home` mounts clean · Vercel preview
> green.** The branch was integration-merged with current main first (2 conflicts resolved:
> `composer.tsx` import union; `BrainView.tsx` convergent caption fix — kept the flex-row superset,
> noted in-code for the card owner). A pre-existing main failure (chat SSE Tests 6/7, stale `uiBlocks`
> mock) was fixed en route so CI is green.
>
> **▶ NEXT SESSION / OTHER LANES:**
> - **Card-polish lane** (active on main, owns `card-primitives`/thread cards): rebase onto the new
>   main. The BrainView caption is the flex-row superset (keeps "N networks"); re-drop it there if the
>   simpler one-caption version is preferred — a one-line change, flagged in the code comment.
> - **`account-read` nits (owner-deferred, cards session owns):** format-mix bars near-invisible
>   (`0.22→0.40α`) + mobile subline `truncate` clips the post count. Card is otherwise well-crafted;
>   verdict was stale. Render: `claude.ai/code/artifact/6adf19a4-7fa0-43bf-9ad9-ce839f6b0ac5`.
> - **Worktree `~/virtuna-ambient-room` is retire-able** once main is confirmed deployed (no stranded
>   work — everything is in PR #330). The local branch/worktree can be removed after the prod deploy.
>
> ---
>
> ## ✅ BOTH REMAINING P3 ITEMS CLOSED — MILESTONE P0·P2·BCD·P1·P3 COMPLETE (2026-07-18)
> **1. `openRoomForCard` dup-concept → FIXED (`eff7b0c7`, pushed).** Resolve a tapped card by its
> LEDGER id, not concept text: threaded the id MessageBlocks already stamps on `[data-card-id]` down
> to ProofUnit via a new **`AmbientCardIdContext`**; `openRoomForCard(conceptText, cardId?)` now calls
> a pure, tested **`resolveFocusDescriptor`** (id-first, concept-text fallback for off-composer). Two
> guards **fail-first** — resolver dup-concept (`ambient-descriptors.test.ts`) + ProofUnit threads the
> id on tap/Enter (`proof-unit-open-room.test.tsx`, RED against old proof-unit). **tsc 0 · 5 regression
> suites green · `/home` mounts clean (no bundle break, `.scratch/verify-openroom-mount.cjs`).**
>
> **2. `account-read` → RE-MEASURED, verdict STALE, OWNER LEFT AS-IS.** Rendered live at `/dev/cards`
> (desktop 728×764 / mobile 324×955). The inherited "worst-rated (STRUCTURAL)" rating **does not hold**
> — 3rd stale inherited verdict this milestone. The card is well-crafted + honest (real profile header,
> cover strip w/ view counts + expired-cover fallback, 2-col Working/Fix, format bars, drop-points,
> track record, "Write to my strengths →"); zero desktop clips/collisions. Only 2 cosmetic nits (faint
> format-mix bars; mobile subline `truncate` clips the post count). **Owner: leave as-is — a separate
> session owns cards design.** No code. Render artifact: `claude.ai/code/artifact/6adf19a4-7fa0-43bf-9ad9-ce839f6b0ac5`.
>
> _Everything below is the pre-close handoff, kept for provenance._

---

Fresh-session handoff. **P0 ✅ · P2 placement ✅ · B·C·D ✅ · P1 panel-craft ✅ · P3 routing ✅ — all
shipped, live-verified, pushed.** What remains: **two separable P3 items** (account-read renderer +
openRoomForCard dup-concept bug). Both un-started; both need measure-first.

- **Worktree** `~/virtuna-ambient-room` · branch `milestone/ambient-room-v2` (clean, pushed, `0/0` vs
  origin). Dev **:3002**. Base = `main` (rebased on `4a648e83`).
- **History (SSOT chain, all in this repo):** `HANDOFF-2026-07-18-ambient-room-P1.md` (P1 detail + a
  top banner recording what shipped) · `HANDOFF-2026-07-18-ambient-room-BCD.md` · the ~575-line
  `HANDOFF-2026-07-17-ambient-room-redesign.md` (P0 §3, plan, what's-built). Memory:
  `ambient-room-redesign.md`.

## THE STANDING RULE (do not skip — it earned its keep every session)
**LOOKING IS NOT MEASURING.** Playwright screenshots HANG (animations never settle). Every real
finding this milestone came from a DOM read / network capture / a real render — **and P0/P1 verdicts
kept going STALE**: P1 nearly coded a `160→184px` fix against a cell that no longer exists, and P0's
"header owns 67%" was measured INVERTED. So **re-measure the live surface before coding**, and **make
every new guard FAIL against the old code first** (stash only the source, rerun RED, restore).

---

## ✅ What shipped this session (P1 + P3 routing — 6 commits)
| Commit | What |
|--------|------|
| `f276fcc0` | **§3.6** dropped the redundant readiness echo (`N ready`) from the OPEN/RAIL switcher bar. Live: the rail was *clipping* it to 39px (`10 read…`, identity owned 78%); the <xl header floated it in ~56% dead space. P0's "owns 67%" was INVERTED. Collapsed tab keeps its live pulse. |
| `9d3998ec` | **§3.2** pinned `toLocaleString('en-US')` on the 3 population-count sites → kills the locale `1.000` that collided with hardcoded `1,000` (#306 family). Guard = source grep for bare `.toLocaleString()`. |
| `8fb508c5` | **§3.8** brain well captions no longer OVERPRINT (two `absolute left-3/right-3` <p>s → one `inset-x-3` flex row). Found by rendering the cortex via **SwiftShader**. |
| `960866d9` | **§3.8 density (owner call B)** 9-signal grid 3→2 col, dropped the ×9 `WHY THIS SCORE` (single `HOW TO READ` covers it; derivation kept as a hover `title`), fixed the `predicted BOLD · vs rest` clip. ⚠️ Owner accepted +128px height (1123→1251). |
| `cdb5c423` | **P3 routing cut** — see below. |
| `553c559d` | docs (P1 handoff banner). |

**Stale on re-measure (NO WORK — confirmed dead):** §3.1 (no 160px cell exists), §3.4 (verdict already
encoded — PeopleView tonal dot + Read roster pill/quote), §3.5 (deleted in P0). §3.7 owner-skipped.

**P3 routing (`cdb5c423`):** new `src/app/(app)/dev/layout.tsx` 404s `/dev/*` in real prod
(`VERCEL_ENV==='production'`; preview+local keep it). `/feed/hooks`·`/feed/channels`·`/competitors/[handle]`·
`/competitors/compare` orphans → `redirect('/home')` (code restorable from git). `/analyze`→`/home` (was
`/start` 2-hop), `/competitors`→`/home` (was `/feed?tab`, dropped tab). 8 guards fails-first
(`src/app/(app)/__tests__/routing-cut.test.ts`); live-verified all 8 land on /home, `/dev/cards` 200 in dev.

---

## ▶ REMAINING P3 — do measure-first, then the survivors

### 1. `account-read` renderer — worst-rated (STRUCTURAL) + the one starter card that RUNS on tap
**What it is:** the "A Read on your own account" skill card — scrapes the creator's OWN TikTok and
renders a STATIC composed card: profile header (avatar/name/verified/follower+post counts) + a
cover-thumbnail strip of top posts + "what's working / to fix" patterns + accuracy track record + a
"Write to my strengths →" CTA (seeds Ideas). Files: `src/components/thread/account-read-block.tsx`
(renderer), `account-read-thread-view.tsx` (surface), schema `src/lib/tools/blocks.ts:741`
(`AccountReadBlockSchema`), route `src/app/api/account-read/route.ts`, fixtures at `/dev/cards`.
- ⚠️ **"worst-rated" is INHERITED from a prior audit — NOT re-measured.** Given this milestone's
  stale-verdict track record, **RE-MEASURE FIRST**: render it live at `/dev/cards` (it's in the
  fixtures + `dev/cards/page.tsx`) and read the real structure/DOM before assuming the rating holds.
- Likely **DESIGN-HEAVY** (a dense fixed card) → surface an ASCII/preview and get the owner's call
  before restyling, same as the brain (§3.8). Don't restyle unilaterally.
- The "runs on tap" concern: confirm what the starter/empty-state tap actually fires (a real scrape +
  engine run) vs a preview — a weak-but-active card is worse than weak-but-passive.

### 2. `openRoomForCard` concept-STRING match (deferred residual from B, family of #306)
`openRoomForCard` (`src/components/app/home/composer.tsx`) matches a tapped card by its concept STRING
(`.find(x => x.conceptText === conceptText)`), so **two cards with an identical concept open the FIRST**.
Scroll-spy is IMMUNE (keys on the positional `data-card-id`). **Proper fix:** thread the descriptor `id`
through `ProofUnit` so the tap resolves by id, not text. Architecture-ish; a real thread has a live dup
to test against (per the memory, idea-15/idea-16 "The Infinite Coffee Loop").

---

## The proven workflow (reuse — this is how every fix this milestone was verified)
- **Launch dev detached:** `node .scratch/start-dev.cjs` (spawns detached + unref; a plain `&`/nohup
  dies on SIGURG). It **can die between runs — re-check + relaunch.** Poll:
  `curl -s -o /dev/null -w "%{http_code}" --retry 40 --retry-delay 2 --retry-all-errors --retry-connrefused http://localhost:3002/`.
- **Mint a session cookie, no interactive login** (`.env.local` has `SUPABASE_SERVICE_ROLE_KEY`):
  `admin.generateLink({type:'magiclink'})` → anon `verifyOtp({token_hash,type:'email'})` → cookie
  `sb-<ref>-auth-token = 'base64-' + base64url(JSON(session))`, chunked @3180. **Working code in
  `.scratch/verify-p1-fix.cjs` / `verify-p3-redirects.cjs` — copy it.** Test user `e2e-test@virtuna.local`.
- **Raw Playwright, headless-shell** at `~/Library/Caches/ms-playwright/chromium_headless_shell-1228/…/chrome-headless-shell`.
  DON'T `waitForLoadState('networkidle')` — `waitForSelector` + `page.evaluate` DOM reads. Redirects:
  `redirect()` renders a **200 doc that client-navigates** (not a 307) → `waitForURL()`, don't read
  `page.url()` immediately.
- **WebGL / the brain:** headless-shell CANNOT render the cortex. Use the FULL Chromium
  (`~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/…`)
  with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` + context
  `reducedMotion:'reduce'` for a static frame. Then `element.screenshot({animations:'disabled'})` and
  Read the PNG. See `.scratch/render-brain.cjs` (renders + saves `brain-render/*.png`).
- **Selectors:** rail `[data-testid="audience-presence"][data-variant="rail"]`; header `…[data-variant="header"]`;
  pulse `[data-testid="audience-pulse"]`; brain `[data-testid="brain-view"]`/`brain-surface`/`brain-readout`.
  Panel body reachable in isolation at `/dev/cards#room`. account-read fixtures at `/dev/cards`.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <files>` (NOT `npm test` — it prints FAKE results).
  Source-guards strip comments (`.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'')`) so a comment
  mentioning the banned string doesn't trip the guard. tsc gate: `npx tsc --noEmit -p tsconfig.json` = 0.
- **Scratch drivers (gitignored):** `verify-p1-measure.cjs` (panel geometry/truncation/restatement),
  `verify-p1-fix.cjs` (rail bar), `render-brain.cjs` (SwiftShader), `verify-p3-redirects.cjs` (authed nav).

## Gotchas
- Accent is `#ff6363` (globals.css SSOT; CLAUDE.md's terracotta is STALE). Near-zero dosage in this panel.
- The brain is INTENTIONALLY tall (1251px) + owner-opinionated (its code is full of "rejected 3×" /
  "owner override") — do NOT restyle it without the owner. Height was accepted.
- `redirect()` pages return HTTP 200 (client nav), so a fetch/curl check shows 200 not 307 — verify in a
  real browser with `waitForURL`.
- After a real `pnpm install` in the worktree, Turbopack runs clean (the `node_modules` symlink hard-fails it).

## Run order (fixed): re-measure account-read → (owner call on restyle) → openRoomForCard id-threading
