# HANDOFF — Card refinement pass (#353 shipped) · next: continue step-by-step

> **Date:** 2026-07-21 · **From:** the card-refinement session ·
> **Branch/worktree:** `lane/skill-cards-prod` @ `~/virtuna-skill-cards-prod` (reset clean to
> `origin/main` @ `806d9d67` = **#353 merged**) ·
> **Supersedes its own prior version** (the read-family "open and wait" handoff — that phase is DONE).

---

## 0. ⚠️ FRESH SESSION: OPEN AND WAIT

**Do NOT auto-start work.** The owner drives this lane **one card at a time, interactively**. On start:

1. Load context (this doc + memory `skill-cards-prod-lane`).
2. Confirm the world: `git log --oneline -5` (tip should be `806d9d67` #353), dev server up on **:3011**.
3. **Then stop and wait for the owner's instruction.** No planning, no edits, no shooting until asked.

---

## 1. What shipped this session — PR #353 (`806d9d67`, squash-merged to main)

Four owner-driven refinements to the thread-render surface. All render identically live and in
`/dev/cards` (same components). **14 files, net −68 lines · tsc 0 · 343/343 tests.**

| # | Change | Files |
|---|---|---|
| 1 | **Explore de-box + 9:16 thumbnails** — killed the `<VideoCard>` box-in-a-box; covers are now native **9:16 portrait** (was a cropped 176px landscape banner); caption + one inline counts row + hairline before Remix. | `discover/outlier-tile.tsx` |
| 2 | **Account Read: full-scrape post FEED** — shows **every** scraped post (dropped the top-8 `.slice`) as a **9:16 grid feed** (3-up mobile / 5-up sm+), was a horizontal strip; **hero headline removed** (owner: "didn't match the UI") → opens on the real scrape identity. | `account-read-block.tsx`, `lib/account-read/account-read.ts`, `dev/cards/fixtures.ts` (5→15) |
| 3 | **Card surface unified** to `bg-surface-sunken` (`#1a1a19`) — Account was `bg-transparent` (invisible box), Explore was the lighter `bg-surface-thread` (`#252524`). | `account-read-block.tsx`, `skill-result-card.tsx` |
| 4 | **Eyebrow swept off ALL 8 card types** — the run capsule above each card already names the skill + audience, so the grey kicker was pure restatement. **Signals preserved, not dropped** (see below). | hook/idea/script/remix/`multi-audience-read`/`video-test-card` blocks + `skill-result-card` + `explore-thread-view` |

**Eyebrow sweep — what was PRESERVED (the rule: drop restatement chrome, keep grounding/functional signal):**
- **Test + Text Read** → `TrustBadge` (SIM tier) folded into the card body (Test: on the verdict line; Text Read: top-right row).
- **Idea** → `your take` flag → chip beside the title (functional: idea needs your perspective).
- **Remix** → `Borrowed · {format}` technique chip kept (content, not chrome); only the `as your {audience}` restatement removed.
- **Hook / Script** → band + stop-rate already read from the `ProofUnit` below; only the kicker + rank/beats meta dropped.

## 2. Guards (fail-first-verified)

- **NEW** `src/components/thread/__tests__/card-surface-consistency.test.ts` (17) — every in-thread card uses `bg-surface-sunken`; bans `bg-surface-thread` + account's old `bg-transparent`. Proven to fail **4×** against pre-fix code (stash the two files → guard fails → restore → green). Note: it **strips comments** before scanning, so a doc-comment naming a banned token doesn't self-trip (the repo's tailwind-scans-comments hazard, run on our own guard).
- `account-read-write-strengths.test.tsx` — the two hero-assertion tests were **removed** (feature intentionally gone) and replaced with a **"renders NO hero"** guard that locks the decision.
- `idea-card-block.test.tsx` — KCQ-09 "made for you" test updated: asserts the `whyItFits` rationale survives but the `Made for your audience` eyebrow label is gone.
- `outlier-tile-standard.test.tsx` (from #352) still green — the de-box didn't touch the Remix/Save/FIT contract.

## 3. Verification — visual, both breakpoints

Live headless Chromium against `:3011`, eyeballed at **1440 + 390** (shots in `.scratch/shots/`, gitignored):
Explore, Account Read, Hook, Idea, Remix, Video Test — all clean. Account feed reads as a proper account grid; Video Test keeps the `Directional` trust badge on the verdict line.

## 4. Open / deferred items (candidates for the next asks)

- **Text Read compare summary strip** (`CompareVerdictRow`) is still a light box, wraps tight @390 — deferred since #352, still there. First candidate if the owner wants full de-box consistency.
- **`corpus-references-block` renders duplicate React keys** (`…/reel/AAA/`) — surfaces as a React key warning in its test; can drop/duplicate a citation row. Untouched this session.
- **Account feed on mobile is tall** — 9:16 at full width ≈ 640px per cover; owner moved on before deciding whether to cap mobile cover height. Left native. Flag if it feels heavy in the real thread.
- **Verify the eyebrow removal in the REAL product flow** (not just `/dev/cards`) — confirm the run capsule (`MAVEN` agent label + `✓ Ran your audience` receipt) genuinely covers what the eyebrow restated for every skill. `/dev/cards` shows the capsule, but double-check a live run.
- Script's model tag (`SIM-1 Flash`) was dropped with its eyebrow; other cards still surface the model in a disclosure. If the owner wants provenance on every card, re-add minimally.

## 5. Pointers

- **The spine SSOT:** `docs/subsystems/ui-skill-cards.md` §0.5. ⚠️ Note the **eyebrow is now removed from card faces** (§0.5.1 CardEyebrow no longer rendered on the main path — still used by Account's thin-history fallback only). Update the SSOT if you touch it.
- **The bar to match:** `hook-card-block.tsx` + `video-test-card-block.tsx` (current-language exemplars).
- **`/dev/cards` IS the real renderer** (HMR-live). Tabbed page: Overview / Skills / Loading / Inputs / Reading / The Room / Blocks / Hidden. Cards: **Skills** tab (`#explore`, `#account`, `#ideas`, `#hooks`, `#script`, `#remix`, `#video-test-card`) · **Blocks** tab (`#multi-audience-read`, `#multi-audience-read--single`).
- **Primitives (never hand-roll):** `card-primitives.tsx` — `CardPrimaryAction` / `CardActionBar` / `SECTION_LABEL` (and `CardEyebrow`, now near-unused).
- **Canonical card fill:** `bg-surface-sunken` (`#1a1a19`). Covers use `aspect-[9/16]` (native vertical video).

## 6. Tooling (all live-verified today)

- **Dev server (:3011):** detached double-fork + setsid (a plain background gets SIGKILLed by later
  commands — it died twice this session, relaunched via `python3` `os.fork()`/`os.setsid()`; script at
  `/tmp/launch-virtuna-dev.py`). Wait ready: `curl --retry 40 --retry-delay 2 --retry-all-errors http://localhost:3011/`.
  See memory `dev-server-launch`.
- **Screenshots:** raw Playwright chromium, `animations:'disabled'` + `caret:'hide'`; tabs are client
  state → **click the tab, then element-screenshot `[id="…"]`**. Harnesses in `.scratch/shoot-*.mjs`
  (gitignored). **Write the script INSIDE the worktree** (`.scratch/`), not `/tmp` — `@playwright/test`
  won't resolve from `/tmp`. `browser_take_screenshot` (MCP) HANGS on this app — do not use it.
- **Measure, don't eyeball, for tokens/color:** `getComputedStyle(el).backgroundColor` via
  `page.evaluate` (that's how the surface mismatch was pinned: app `rgb(31,31,30)` vs cards).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` (NEVER `npm test` — rtk shim fakes
  results). `npx tsc --noEmit` for types. `npx eslint <files>` before commit.
- **Auth:** `e2e-test@virtuna.local` / `e2e-test-password-2026`. `.env.local` is per-worktree
  (gitignored) — present here.
- **Fail-first is mandatory** (memory `green-test-is-the-accomplice`): stash the component, run the new
  guard, confirm it FAILS, restore, confirm green.
- **⚠️ Tailwind scans TEST COMMENTS** — a class-shaped literal anywhere (comments included) 500s every
  route while tests stay green. The surface guard strips comments for exactly this reason.

## 7. Process that worked (repeat per refinement)

1. **LOOK first** — shoot the card at 1440 + 390 before touching code; the "wrong design system"
   complaint was a measured surface-token mismatch, not a vibe.
2. **Find the canonical, don't invent** — the fix was "match what the other cards already do"
   (`bg-surface-sunken`), found by grepping sibling cards, not by picking a new value.
3. **Lock the direction with the owner** on anything broad (ASCII before→after + explicit either/or via
   a question) BEFORE sweeping siblings — the eyebrow sweep was confirmed on 2 cards first.
4. **Preserve signal when removing chrome** — trust badges / functional flags get relocated, never
   silently dropped; say what you kept and why.
5. **Fail-first guard** per behavior change; **verify both breakpoints** in-browser before committing.
