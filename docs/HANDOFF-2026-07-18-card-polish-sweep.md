# Handoff — Card-Polish Sweep (flagship craft pass)

**Date:** 2026-07-18
**Shipped this session:** PR **#327** (`d44447b7`) — merged to `main`.
**Owner goal:** get the thread/reading cards to a bar you'd expect from ChatGPT / Claude / Perplexity.

---

## TL;DR for the next session

1. The live cards are **NOT broken.** A full visual audit (desktop + mobile, real renderers) found them already past "clean" — shared spine, honest empty states, correct mobile collapse, test-guarded. The gap the owner is chasing is **flagship *craft*** (rhythm, hierarchy, restraint), not bugs.
2. Work **calibration-first**: rework ONE surface to a defensible bar, show the owner rendered variants, lock a direction, then roll the *language* out. Don't blast changes across N cards on a guess.
3. **Reading (Test) is DONE** (PR #327). Your job: carry the same craft language to the remaining focus surfaces.
4. ⚠️ **Account Read is owned by ANOTHER session — do NOT touch `account-read-block.tsx` / `account-read-thread-view.tsx`.** Coordinate; leave it alone.
5. **Remaining sweep:** **Explore** (`explore-thread-view.tsx` / `outlier-grid-block.tsx`) and the **Make cards** (`hook-card-block` / `idea-card-block` / `script-card-block` / `remix-card-block` + shared `card-primitives.tsx`).

---

## What shipped in #327

**Reading (Test) — the `/analyze` surface — de-boxed to "variant B + tweak, quieter".**
Owner named four gaps: *too heavy/boxy · cramped rhythm · spec-sheet · flat hierarchy.* Root cause: the page was **6 stacked bordered `ReadingSection` cards**, hero chopped by `border-t`/`border-l` dividers, drivers as name+bar+number settings-panel rows.

- `reading-hero.tsx` — hero card holds ONLY the score cluster (poster + gauge + 3 stats); `AudienceBreakout` ("How far it gets pushed") pulled OUT to a borderless sibling **below** the card (`ReadingSection card={false}` + manual `READING_CARD` wrap). The score is now the single focal moment.
- `reading-accordion.tsx` — Score drivers + The audience → `card={false}` (borderless). `TRIGGER_CLASS` `px-5`→`px-0.5` (column-aligned). Driver bars slimmed `6px`→`4px`. Colour reserved for the single weakest driver.
- `audience-breakout.tsx` — bare column block (dropped leading `border-t` + card padding). Tube fills desaturated green/rust → **cream** (`rgba(236,231,222,0.34)` cleared / `0.13` stalled). **Green + amber now appear ONLY on the score gauge + weakest driver.** Dashed promotion line + darkened connector still mark breakout.
- `fix-first-list.tsx` — fix chips → borderless bullet rows.
- `deeper-read.tsx` — bordered panel → borderless top-hairline row.

**Also in #327:**
- `audience-lens/BrainView.tsx` — **real bug fixed:** the cortex caption collision. Two absolutely-positioned captions (`bottom-2.5 left-3` + `right-3`) with nothing between them overlapped into garbled text on any narrow well — the Room ships in a 640px sheet that's **full-width on a phone** (mobile-first), so it was **live on mobile**. Dropped the redundant right caption (its scan-time duplicated the top-right clock).
- `dev/cards/fixtures.ts` — labelled the 3 horizontal blocks (`profile-read` / `reaction-distribution` / `prediction-gauge`) **HIDDEN** (skills behind `HORIZONTAL_ENABLED`, off; renderers kept so persisted history still renders).

**Verified:** Complete / Partial / Apollo-null / Empty-personas / Empty-heatmap / No-behavioral + mobile 390px all render clean; empty states borderless with no orphan boxes; reach drops out with no gap. `tsc` clean; 236 reading/brain/fixtures tests + matte/labels/radius/breakout guards green.

---

## The reusable craft language (roll this to Explore + Make)

These cards are legitimately **cards** (chat messages), so "de-box" does NOT transfer literally — a chat card SHOULD have a container. Carry the **principles**:

1. **One focal point per card** — a single clear hero (the hook line / the outlier tile / the score). Everything else is subordinate and quieter.
2. **Reserve colour** — near-zero accent DOSAGE is LOCKED. Green/amber/terracotta only where they carry meaning (a band, the weakest lever). Default everything else to cream. (The reach-tube desaturation is the reference move.)
3. **Slim the instruments** — thin bars (`4px`), hairline dividers, tabular-nums. No settings-panel density.
4. **Calm, even rhythm** — consistent vertical gaps; don't chop content with internal `border-t`/`border-l` dividers where whitespace will do.
5. **Fewer nested containers** — inside a card, prefer whitespace + type hierarchy over boxes-within-boxes.

Whether Explore/Make need this at all is an **open question** — audit says they're already strong. Recommend: screenshot each through the real renderer first (below), show the owner, and only rework what has a real craft gap. Calibration-first, same as Reading.

---

## How to work (the harness)

- **`/dev/cards`** renders EVERY card through the REAL renderer (`src/app/(app)/dev/cards/page.tsx`). Look there first — it can't drift from prod. Reading has a state switcher (Complete / Partial / degraded…).
- **Screenshots** — Playwright MCP hangs on this app (ambient rooms never settle). Use raw Playwright with `reducedMotion:'reduce'` + `animations:'disabled'` + `caret:'hide'`. Reusable scripts were in `.scratch/` (gitignored) — recreate as needed. Chromium + Playwright live at `/Users/davideloreti/virtuna-brain/node_modules/playwright/index.mjs`.
- **Auth** — `/dev/cards` needs login (307 → /login). Seeded e2e user: `e2e-test@virtuna.local` / `e2e-test-password-2026`. Log in, then goto `/dev/cards`.
- **Dev server** — this worktree (`~/virtuna-prod`) runs on **:3000** (pid was 26687). Other ports are other worktrees (:3002 ambient-room, :3005 explore-c).
- **Tests** — `node ./node_modules/vitest/vitest.mjs run <paths>` (NOT `npm test` — it prints fake results). Guards to keep green: `reskin-matte`, `reading-labels`, `section-label-scale`, `radius-scale`, `audience-breakout`.
- **⚠️ Radius tokens are remapped** in `@theme`: `rounded-md` = **8px** (not Tailwind's 6px), `rounded-lg` = 12px. So `rounded-md` and `rounded-[8px]` are identical — don't "fix" one to the other.
- **⚠️ GOTCHA:** the vendored `ui/accordion.tsx` `AccordionItem` ships a default `rounded`+`border`. To de-box it you MUST prefix `rounded-none border-0` before your `border-t` (the driver `ITEM_CLASS` does; I missed it the first pass and the box survived a screenshot).

---

## Branch / git state

- Shipped via `polish/reading-redesign` → squash-merged as #327, remote branch deleted.
- ⚠️ The old `polish/thread-cards` branch (was `63dbc701`, the pre-squash of #324) was **stale — 3 behind main**. Deleted. **Always `git fetch origin main` and branch off `origin/main`**, never off a lingering local branch (this repo's recurring trap).
- This worktree is now on merged-main content. Start the next card off a fresh branch from `origin/main`.

## Open follow-ups (owner call, low priority)
- Deeper-read's per-dim band words stay green ("Strong" ×3) — it's a hidden-by-default detail, not the calm face. Quiet to cream if the owner wants strict consistency.
- Hook-rewrite "Copy" cards keep their border — they're copyable action cards (correct), distinct from the diagnostic list.
