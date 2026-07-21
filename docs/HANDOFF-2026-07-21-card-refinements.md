# HANDOFF — Read-family cards landed on the spine · next: step-by-step card refinements

> **Date:** 2026-07-21 · **From:** the read-family calibration session ·
> **Branch/worktree:** `lane/skill-cards-prod` @ `~/virtuna-skill-cards-prod` (off `origin/main`) ·
> **Supersedes:** `docs/HANDOFF-2026-07-19-read-family-cards.md` (that mission is now DONE).

---

## 0. ⚠️ FRESH SESSION: OPEN AND WAIT

**Do NOT auto-start work.** The owner wants to drive the next phase — **step-by-step UI card
refinements, one card at a time** — interactively. On session start:

1. Load context (this doc + the pointers in §4).
2. Confirm the world is as described (`git log --oneline -5`, dev server up on :3011).
3. **Then stop and wait for the owner's instruction.** No planning, no edits, no shooting until asked.

---

## 1. What shipped this session

The three drifted read-family cards were brought onto the card spine
(`docs/subsystems/ui-skill-cards.md` §0.5). They were the last result cards still carrying the
pre-#327/#329 language. **They render identically on the live platform and in `/dev/cards`** (same
components), so this fixed both at once.

The one rule under all three fixes: **color is a data mark (a dot / a value), never a label or a
bar fill.**

| Card | Renderer | Moves landed |
|---|---|---|
| **Text Read** | `multi-audience-read-block.tsx` · `verbatim-wall.tsx` | band word stated **once** (verdict row in single / compare header in compare), interpretation goes cream (killed the doubled `"{band} Read."` lead) · `THE ROOM` **de-boxed** → hairline section, stop/scroll tone on a **dot** not the label · provenance demoted to a faint `· SIM-1 Flash` footer |
| **Account Read** | `account-read-block.tsx` | added a **hero** (§0.5.2) — a deterministic templated read `working[0], but fix[0]` (degrades honestly) · section labels (`What's working` / `What to fix`) → **muted**, success/warning tone moved onto the bullet **dots** |
| **Explore** | `discover/outlier-tile.tsx` | CTA `Remix → Read` → single-verb **`Remix →`** (one cream primary per tile) · FIT magnitude bar → **neutral cream** (width = level), tone on a **dot** · Save + Track demoted **below** the primary |

**Commits (atomic, on `lane/skill-cards-prod`):**
- `84c44b88` Text Read · `380f7e4c` Account Read · `2cf7c05f` Explore
- (merge SHA / PR# recorded in memory `skill-cards-prod-lane`.)

## 2. Guards (all fail-first-verified — failed against the OLD code first, then green)

- `src/components/thread/__tests__/read-card-standard.test.tsx` (NEW, 3) — band-once + de-boxed room + no-green-label.
- `src/components/thread/__tests__/account-read-write-strengths.test.tsx` (+3) — hero present + degrade + labels-muted/dot-colored.
- `src/components/discover/__tests__/outlier-tile-standard.test.tsx` (NEW, 3) — single-verb primary + Save/Track-below + neutral-bar/dot.
- Sanity: touched + design guards (`reskin-matte`, `section-label-scale`, `radius-scale`) = **234/234**, `tsc --noEmit` clean, routes 200/307 (no Tailwind-scan 500).

## 3. Verification — visual, both breakpoints

Rendered in a real headless Chromium against the live dev server and **eyeballed** each card at
**desktop 1440 + mobile 390** (shots in `.scratch/shots/`, gitignored — local to this worktree):
- Text Read (compare + single), Account Read, Explore — all hold on both breakpoints.

**Known nit, deliberately deferred (owner said leave it):** the Text Read **compare summary strip**
(`CompareVerdictRow`) is still a light box and wraps a touch tight at 390px. It was out of the
flagged scope (only `THE ROOM` was flagged). First candidate if the next pass wants full de-box
consistency.

## 4. Pointers for the refinement work

- **The spine SSOT:** `docs/subsystems/ui-skill-cards.md` §0.5 (eyebrow → hero → why-teaser →
  proof → one disclosure → one action bar) · §0.5.6 (band color once) · §0.9 (primitives).
- **The bar to match:** `hook-card-block.tsx` + `video-test-card` (the current-language exemplars).
- **`/dev/cards` IS the real renderer** — editing a card updates the gallery live (HMR). The gallery
  is a tabbed page (Overview / Skills / Loading / Inputs / Reading / The Room / Blocks / Hidden).
  Cards live under: Skills tab (`#explore`, `#account`, skill views) · Blocks tab
  (`#multi-audience-read`, `#multi-audience-read--single`).
- **Primitives (mandatory, never hand-roll):** `card-primitives.tsx` — `CardEyebrow` /
  `CardPrimaryAction` / `CardActionBar` / `SECTION_LABEL`.

## 5. Tooling (all live-verified today)

- **Dev server (:3011):** detached double-fork + setsid launch (a plain background gets SIGKILLed
  by later commands — it died twice this session and was relaunched). Pattern:
  `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev -p 3011 --turbopack`
  via a `python3` `os.fork()`/`os.setsid()` double-fork (see memory `dev-server-launch`). Wait for
  ready with `curl --retry 40 --retry-delay 2 --retry-all-errors http://localhost:3011/login`.
- **Screenshots:** raw Playwright (`@playwright/test` chromium) with `animations:'disabled'` +
  `caret:'hide'`; the page tabs are client state, so **click the tab, then element-screenshot the
  `[id="…"]` section** (don't rely on anchor scroll). Harness scripts in `.scratch/shoot-*.mjs`
  (gitignored). `browser_take_screenshot` (MCP) HANGS on this app — do not use it.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <file>` (NEVER `npm test` — rtk shim prints
  fake results). `npx tsc --noEmit` for types.
- **Auth:** test user `e2e-test@virtuna.local` / `e2e-test-password-2026`. `.env.local` is
  per-worktree (gitignored) — present here, copied from trunk.
- **Fail-first is mandatory** (memory `green-test-is-the-accomplice`): stash the component, run the
  new guard, confirm it FAILS, restore, confirm it passes.
- **⚠️ Tailwind scans TEST COMMENTS** — a class-shaped wildcard literal anywhere (comments included)
  500s every route while tests stay green. After adding class-like strings, `curl :3011/login` once.

## 6. Process that worked (repeat it for each refinement)

1. **LOOK first** — shoot the card at 1440 + 390 before touching code.
2. **Calibrate on the worst card, lock the direction with the owner** (ASCII before→after +
   explicit either/or decisions via a question), THEN roll the same language to the siblings.
3. **Fail-first guard** per behavior change; run affected + design guards per commit.
4. **Verify both breakpoints** in-browser before committing — desktop is not enough (mobile was a
   real gap this session until re-shot).
