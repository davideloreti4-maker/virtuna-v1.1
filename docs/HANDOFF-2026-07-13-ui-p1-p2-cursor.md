# Handoff — UI/UX P1–P2 elevation (Calendar · Discover · Audience · Library)

**Date:** 2026-07-13
**From:** Claude Code session (hit usage limit mid-P1)
**To:** Cursor Composer 2.5 agent
**Worktree:** `~/virtuna-explore-b` · **Dev server:** `:3002` (may still be running; relaunch recipe below)

> **Read first:** `docs/audit-2026-07-13/AUDIT-calendar-discover-audience-library.md` — the full audit that motivates all this work (systemic issues, per-page findings, prioritized P0→P2 roadmap, evidence screenshots in `docs/audit-2026-07-13/screenshots/`). This handoff assumes you've read it.

---

## Mission
Elevate four surfaces from "AI-produced" to billion-dollar polish. The core disease (per audit): the app **narrates itself** (marketing subtitles, instructional microcopy), **repeats copy**, and **leaks internal taxonomy** into the UI. The cure is mostly **subtraction + hierarchy**, not new features.

---

## Git state (as of handoff)

| Branch | Tip | Status |
|---|---|---|
| `fix/p0-ui-copy-hygiene` | `312a4c12` | **P0 complete → PR #273 (open):** https://github.com/davideloreti4-maker/virtuna-v1.1/pull/273 |
| `feat/p1-calendar-grid` | (this branch, after handoff commit) | **P1 calendar grid done + pushed. No PR yet.** Stacked on P0 tip. |

`main` tip = `e88f376c`. Both feature branches are pushed to `origin`. Auto-push hook (`.githooks/post-commit`) pushes on commit **only if the branch has an upstream** — after any `git switch -c newbranch`, do `git push -u origin newbranch` once or the hook silently no-ops (known gotcha).

**Stacking note:** `feat/p1-calendar-grid` was branched off P0's tip because they share `calendar-workspace.tsx` / `month-grid.tsx`. When you open its PR, **base it on `fix/p0-ui-copy-hygiene`** (not `main`) so the diff shows only calendar changes; GitHub auto-retargets to `main` when P0 merges. Or just merge P0 first, then rebase.

---

## DONE

### P0 — copy & bug hygiene (PR #273, 8 files, net −13 lines)
- **Calendar** (`calendar-workspace.tsx`, `month-grid.tsx`, `backlog-rail.tsx`): dropped `· pre-tested on your people` from header subtitle + grid legend; removed the "Tap a card to place it" caption; per-card `tap to place` is now hover-reveal.
- **Discover** (`discover-hub.tsx`): removed the `outliers, trends, and rivals — remix…` subtitle.
- **Audience** (`audience-manager.tsx`): removed the `Who's in the room…` subtitle + the in-app marketing paragraph in the right rail.
- **Account** (`analytics-view.tsx`): removed `trend builds daily` ×4 + the duplicate caption; kept one factual disclaimer.
- **Library** (`saved-shelf.tsx`): removed the two-line subtitle that re-listed the tabs.
- **Bug D1** (`saved-item-card.tsx`): `7/10 stop stopped` → `7/10 stopped` (added `fracNM()` normalizer, used at both the chip render `~L245` and the aria label `~L373`).
- **Bug D2** (`audience-manager.tsx`): Account-tab H1 now follows the tab (`Your account` vs `Your audiences`).

### P1 — Calendar grid (branch `feat/p1-calendar-grid`, `month-grid.tsx`)
De-voided the month grid: in-month cells were `border-transparent` (structure only on hover). Now every in-month cell has a visible 6% border + faint fill (weekday `bg-white/[0.012]`, weekend `bg-white/[0.028]` for rhythm), and today's whole cell is ringed in `--color-action`. Verified live at 1440×900.

---

## REMAINING WORK

### P1 · Discover — toolbar + metric key  *(objective; do this next, lowest risk)*
Files: **`src/components/feed/feed-toolbar.tsx`** (the `Showing X of Y` + Filters + `Sort:` + `Add video URL` + `Export` row) and **`src/components/feed/feed-card.tsx`** (the `↗ 12× · 👁 106.1K · ⚡ 4%` metric row).
1. **Add a one-line key** for the metric icons — users can't decode `↗ / 👁 / ⚡` (outlier-multiplier / views / engagement). Either a tiny legend under the toolbar or `title`/`aria-label` tooltips on each metric. The outlier multiplier is the hero metric; give it more weight than views/engagement.
2. **Demote power-tool actions:** `Add video URL` and `Export` sit at equal prominence with core browsing. Group them into a secondary cluster or an overflow (`⋯`) menu so Filters/Sort lead. (Check if a Menu/Dropdown primitive already exists in `src/components/ui` before building one.)
- Lane note: Discover is nominally "lane c." These are surgical layout/copy edits; fine, but keep them contained.

### P1 · Library — card anatomy standardization  *(needs ONE design decision)*
File: **`src/components/saved/saved-item-card.tsx`**.
- **DECISION NEEDED — the eyebrow slot.** Today the ALL-CAPS colored kicker mixes two different meanings: audience **segments** ("STOPS THE SKEPTIC", "ASPIRING FOUNDERS", "THE LOYALIST") and content **types** ("SCRIPT · OPENER ONLY", "MADE FOR YOUR AUDIENCE"). Pick ONE meaning for that slot and move the other to a different affordance (e.g. eyebrow = content type always; segment becomes a small tag). Ask the owner which.
- **Standardize card anatomy:** some cards show an italic quote, some don't → make it consistent (present-or-omit rule, same position).
- **CTA verbs** are per-type at `saved-item-card.tsx:47-49` + fallback `~L318`: `Write script →` (hook), `Develop into hooks →` (idea), `Test full script →` (script), `Use in thread →` (default). They're fine semantically but visually the action column doesn't scan — give them a consistent treatment (same weight/color/position, icon optional).
- Optional: masonry produces a ragged right edge; a uniform card height or cleaner grid reads as more considered.

### P1 · Audience — avatars + pills  *(BLOCKED on product direction — sketch first)*
Files: **`src/components/audience/audience-card.tsx`** (the row: avatar cluster + name + meta + pills), **`src/components/audience/audience-status-chip.tsx`** (the pill component), `trust-badge.tsx`. Container is `audience-manager.tsx`.
- **Placeholder dot-avatars:** each audience is a scatter of inconsistent grey dots that communicate nothing. Replace with a designed persona representation (real initials/faces, or a deliberate cluster mark). **This is a design decision — recommend sketching 2-3 throwaway HTML mockups before editing the real component.**
- **Pill overload:** rows carry 2 pills from a 6-term vocabulary (Validated · Calibrated · Needs calibration · Baseline · Template · Directional). Collapse to ≤2 meanings. Define the mapping WITH the owner (e.g. one "trust" axis + one "kind" axis).
- Fold the 4 section headers (YOURS · BASELINE · TEMPLATES · GENERAL TEMPLATES) into 2.
- Lane note: Audience is "lane a." Coordinate if that lane is active elsewhere.

### P2 · System-level *(design direction required — do NOT start solo)*
1. **One vocabulary** for the core concept: audience / room / persona / panel are used interchangeably app-wide. Pick one, purge synonyms.
2. **Right-rail IA:** define what belongs in a rail vs. main column; stop duplicating modules (Content pillars renders on BOTH Calendar rail and Audience→Account).
3. **Density/contrast token pass:** 6% borders read as voids at scale (the calendar grid fix was a local instance of this). Consider a system-wide review in `globals.css`.

---

## HOW TO RUN & VERIFY (critical)

**Dev server** (from `~/virtuna-explore-b`):
```bash
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002
```
If CSS changes don't appear: kill server, `rm -rf .next node_modules/.cache`, restart. (Uses Next 16 / Turbopack.)

**Auth (test user with real data):** `npx tsx e2e/create-test-user.ts` then log in at `/login` with `e2e-test@virtuna.local` / `e2e-test-password-2026`. Has a calibrated "Fitness Creators" audience, a `test` audience, 9 library items, and a mock July calendar — populates all four surfaces.

**Routes:** `/calendar` · `/feed` (this IS "Discover"; `/discover` redirects here) · `/audience` (+ `?tab=account`) · `/library` (`/saved` redirects here).

**Visual verify via Playwright** — screenshots hang on this app (ambient animations never settle). Inject this before capturing, and screenshot the viewport (not fullPage on animated pages):
```js
const s=document.createElement('style');
s.textContent=`*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}`;
document.head.appendChild(s);
```
Or verify via `getComputedStyle` / `innerText` assertions (used throughout P0 verification).

**Green-gates (run before every commit):**
```bash
npx tsc --noEmit                                   # must be 0 errors (repo runs a tsc gate)
npx eslint <changed files>                         # must be clean
node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts   # matte guard, must stay 38/38
```
⚠️ **Do NOT use `npm test` / `npx vitest`** — a shim prints fake results. Always the explicit binary: `node ./node_modules/vitest/vitest.mjs run <path>`.

---

## REPO GOTCHAS (will bite you)
- **`cn()` = `twMerge(clsx(...))`** (`src/lib/utils.ts`) → later conflicting Tailwind classes win. Relied on this for the calendar today-ring override.
- **Design tokens SSOT:** `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`. ⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are STALE (describe a dead Raycast system) — do not trust them. System = flat-warm charcoal, cream text `#ece7de` (never `#fff`), terracotta accent `#d97757` (near-zero dosage, liveness only), matte (no glass/glow/inset-shine).
- **Tailwind v4 `--font-*` is font-FAMILY only** — never declare weight tokens there (it shadows the built-in weight utilities app-wide). Use built-in `font-medium/semibold/bold`.
- **Lightning CSS strips `backdrop-filter`** → apply via React inline `style={{ backdropFilter: 'blur(Xpx)' }}`, not a class.
- **`--color-hover` is a translucent overlay tint** (`rgba(255,255,255,0.05)`), not an opaque fill — don't use as `hover:bg-*` on anything floating over scrolling content.
- **matte guard** `src/components/reading/__tests__/reskin-matte.test.ts` fails on any coral/glass — keep it green.
- **Lanes:** explore-a=audience/room · explore-b=cards/reading (this worktree) · explore-c=discover/data. Discover + Audience edits here cross lanes; keep them surgical and coordinate if those lanes are active.
- **Screenshots:** root `*.png` are gitignored (scratch); the committed audit evidence lives under `docs/audit-2026-07-13/screenshots/`.

---

## FILE MAP (quick reference)
| Surface | Route | Server page | Main component(s) |
|---|---|---|---|
| Calendar | `/calendar` | `src/app/(app)/calendar/page.tsx` | `components/calendar/calendar-workspace.tsx`, `month-grid.tsx`, `backlog-rail.tsx` |
| Discover | `/feed` | `src/app/(app)/feed/page.tsx` | `components/discover/discover-hub.tsx` → `components/feed/feed-toolbar.tsx`, `feed-card.tsx`, `feed-results.tsx` |
| Audience | `/audience` | `src/app/(app)/audience/page.tsx` | `components/audience/audience-manager.tsx`, `audience-card.tsx`, `audience-status-chip.tsx`; account tab → `components/analytics/analytics-view.tsx` |
| Library | `/library` | `src/app/(app)/library/page.tsx` | `components/saved/saved-shelf.tsx`, `saved-item-card.tsx` |

---

## SUGGESTED ORDER FOR CURSOR
1. **Open the calendar-grid PR** (base = `fix/p0-ui-copy-hygiene`), or wait for P0 to merge then rebase.
2. **Discover toolbar + metric key** — objective, ship it (new branch off latest, or continue the P1 branch).
3. **Library** — get the eyebrow-slot decision from the owner, then standardize.
4. **Audience** — sketch avatar/pill options, get owner sign-off, then build.
5. **P2** — only with explicit design direction.

Verify every surface live (recipe above) + green-gates before each commit. Keep commits atomic, `type(scope): description`, and end messages with the Co-Authored-By trailer.
