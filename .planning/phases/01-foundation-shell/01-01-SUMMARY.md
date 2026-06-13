---
phase: 01-foundation-shell
plan: 01
subsystem: ui
tags: [tailwind-v4, theme-tokens, css, next-font, newsreader, design-system, flat-warm]

# Dependency graph
requires:
  - phase: none
    provides: This is wave 1, plan 1 — the visual foundation; no prior phase dependency.
provides:
  - Flat-warm @theme token SSOT in globals.css (charcoal surfaces as HEX, cream text, terracotta coral, score-zone data colors)
  - Raycast glass fully stripped at the token level (Layer A): no 137deg gradients, no glass/glow shadows, no inset white-shine
  - --shadow-float token (the lone allowed shadow — composer/popovers only)
  - --font-serif (Newsreader) wired via next/font/google and exposed as the font-serif Tailwind utility (not yet consumed)
  - Provably-compiling foundation (clean `pnpm run build` exits 0) for every downstream Phase-1 surface
affects: [01-02 sidebar glass Layer B, 01-03 home greeting + serif consumption, 01-04 composer, 01-05 THEME-06 UAT gate, phase-02-the-simulation]

# Tech tracking
tech-stack:
  added: [Newsreader serif via next/font/google (build-time fetch, zero npm installs)]
  patterns:
    - "Charcoal dark-surface tokens authored as exact HEX (oklch L<0.15 miscompiles in Tailwind v4 @theme)"
    - "next/font variable (--font-newsreader) -> @theme semantic token (--font-serif), mirroring --font-inter -> --font-sans"
    - "[UAT] comment markers on every provisional pixel value (Frame A; locks at THEME-06)"

key-files:
  created:
    - .planning/phases/01-foundation-shell/deferred-items.md
  modified:
    - src/app/globals.css
    - src/app/layout.tsx

key-decisions:
  - "Added new charcoal + cream primitives instead of overloading the existing gray ramp (gray ramp still feeds data/score components)"
  - "Used --font-newsreader as the next/font variable and --font-serif as the @theme token to avoid a self-referential var() and mirror the Inter pattern (RESEARCH example's variable:'--font-serif' would self-reference)"
  - "Flattened --gradient-card-bg to solid charcoal (kept the token name) so existing var() consumers resolve; fully removed gradient-navbar/glass/feature"
  - "Kept accent-foreground #1a0f0a (marked [UAT]) — high contrast on the new terracotta coral; exact value verifies at THEME-06"

patterns-established:
  - "Flat-warm matte: depth from tone-step + hairline borders; the only shadow is --shadow-float on genuinely floating surfaces"
  - "Serif = voice moments only; wired but not applied (greeting consumption deferred to 01-03)"

requirements-completed: [THEME-01, THEME-02, THEME-03, THEME-04, THEME-05]

# Metrics
duration: 5min
completed: 2026-06-13
---

# Phase 1 Plan 01: Flat-Warm Token Foundation + Serif Summary

**Migrated the Tailwind v4 `@theme` SSOT off Raycast glass to a flat-warm matte system — charcoal HEX surfaces, cream text, terracotta coral, stripped glass/glow tokens — and wired Newsreader as `--font-serif`; clean build proves it compiles.**

## Performance

- **Duration:** ~5 min (plan wall-clock; excludes one-time worktree dependency restore)
- **Started:** 2026-06-13T17:14:02Z
- **Completed:** 2026-06-13T17:19:35Z
- **Tasks:** 3 (2 source tasks + 1 build gate)
- **Files modified:** 2 source files (`globals.css`, `layout.tsx`) + 1 planning artifact created

## Accomplishments
- Re-based the `@theme` surfaces to neutral charcoal authored as **exact HEX** (`#262624` app / `#1a1a18` sidebar / `#1e1d1b` composer / `#2f2e2b` chip) — avoiding the documented oklch-L<0.15 miscompile (CLAUDE.md Pitfall 1).
- Retuned text to a cream scale (`#ece7de`/`#c2bdb4`/`#8a857c`) — never pure white (D-02) — and matured the coral 100..900 ramp toward terracotta (`oklch(0.68 0.13 33)` ≈ `#d97757`, D-04), kept distinct from the alert-red score zone.
- **Stripped THEME-02 Layer A glass entirely:** removed the 137deg `--gradient-glass`/`--gradient-navbar`, the radial `--gradient-feature` halo, the glass + coral-glow shadow tokens, and the two inset white-shine layers from `--shadow-button`; flattened `--gradient-card-bg` to solid charcoal. Added a single whisper-soft `--shadow-float` for composer/popovers only (D-05). Score-zone data colors retained (THEME-03).
- Wired **Newsreader** (`next/font/google`, 400 + italic, build-time fetch) as `--font-newsreader` → `--font-serif` in `@theme`; the `font-serif` utility now resolves to Newsreader. No element consumes it yet (greeting is plan 01-03).
- Marked every provisional pixel/typeface value `[UAT]` (32 markers) — Frame A starting point, locks at the THEME-06 human gate (plan 01-05).
- **Clean `pnpm run build` exits 0** — globals.css compiles with the new tokens; all 55 static pages generate; zero CSS-parse errors. Structural proof the foundation is valid for downstream plans.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-base @theme surfaces flat-warm + strip glass tokens (Layer A)** — `e46c45c7` (feat)
2. **Task 2: Wire Newsreader serif as --font-serif (THEME-04)** — `bf14f9c7` (feat)
3. **Task 3: Clean-rebuild + prove globals.css compiles** — no commit (build gate only; no source edits)

**Plan metadata:** (final `docs(01-01)` commit — SUMMARY + STATE + ROADMAP + REQUIREMENTS + deferred-items)

_Note: Tasks 1 & 2 are `tdd="true"`. For a CSS-token / font-config migration the "test" is the plan's grep + build verification (RESEARCH classifies THEME-01/02/03 as "manual + build", not a vitest spec). RED was proven before each edit (glass tokens present / Newsreader+--font-serif absent) and GREEN after (plan verify printed `GLASS_TOKENS_STRIPPED` and `SERIF_WIRED`); no separate failing-unit-test artifact exists to commit for a token reskin, so each task is a single feat commit._

## Files Created/Modified
- `src/app/globals.css` — Flat-warm `@theme` SSOT: charcoal HEX surface primitives + cream text scale added; semantic background/surface/foreground repointed; coral ramp matured to terracotta; glass/glow tokens removed; `--shadow-float` added; `--font-serif` added; `:root` accent-transparent alias re-hued. All pixel values `[UAT]`.
- `src/app/layout.tsx` — Import `Newsreader` alongside `Inter`; configure as `--font-newsreader` (400 + italic); add `newsreader.variable` to the `<html>` className.
- `.planning/phases/01-foundation-shell/deferred-items.md` — Logged the out-of-scope marketing-page glass-token consumers (see Deviations).

## Decisions Made
- **next/font variable naming:** Used `--font-newsreader` for the next/font variable and `--font-serif` for the `@theme` token (consuming `var(--font-newsreader)`), mirroring the existing `--font-inter` → `--font-sans` chain. The RESEARCH code example used `variable: "--font-serif"` directly, which would make the `@theme --font-serif: var(--font-serif)` self-referential and the utility non-functional. Corrected to keep the utility actually resolving to Newsreader.
- **Charcoal/cream as new primitives, not gray-ramp overloads:** Per the plan, the cold gray ramp still feeds data/score components, so new `--color-charcoal-*` and `--color-cream-*` primitives were added and the semantics repointed onto them.
- **`--gradient-card-bg` flattened, not deleted:** Kept the token name (now a solid charcoal) so any existing `var(--gradient-card-bg)` consumer resolves to a valid value; fully removed the navbar/glass/feature gradients.
- All exact hex/coral/serif/score-zone values are **Frame A starting points** marked `[UAT]` (D-08) — NOT final; they sign at THEME-06.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored worktree dependencies from the frozen pnpm lockfile**
- **Found during:** Task 3 (clean-rebuild build gate)
- **Issue:** The `virtuna-numen-rework` worktree had **no `node_modules`** (git worktrees share `.git` but not the working-tree-local `node_modules`); `next: command not found` blocked the build gate.
- **Fix:** Ran `pnpm install --frozen-lockfile` — a deterministic restore of the already-committed, version-pinned `pnpm-lock.yaml` (444KB). This is environment setup (restoring vetted, pinned deps), NOT a new/named-package install — so the slopsquat/hallucination package-legitimacy gate does not apply (every package + version predates this plan in the committed lockfile).
- **Files modified:** none tracked (`node_modules` is gitignored; `pnpm-lock.yaml` unchanged by `--frozen-lockfile`).
- **Verification:** `pnpm run build` subsequently exits 0; ✓ Compiled successfully in 12.3s.
- **Committed in:** n/a (no tracked-file change).

### Out-of-scope discoveries (logged, NOT fixed)

**2. Marketing surfaces reference removed glass tokens** — logged to `deferred-items.md` (item D1).
- Removing `--gradient-navbar` / glass shadow tokens leaves dangling `var(--gradient-navbar)` in `src/components/layout/header.tsx:62` and `src/app/(marketing)/showcase/page.tsx` — out-of-scope marketing surfaces (Phase 1 scope = the app shell). Build is unaffected (dangling `var()` resolves empty; Tailwind v4 silently skips unknown utilities). Cosmetic regression on marketing pages only; deferred to a marketing reskin.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — dependency restore) + 1 out-of-scope item logged.
**Impact on plan:** The dependency restore was required environment setup, not a code change; no scope creep. The marketing-token references are an inherent consequence of the plan's Layer A glass-strip instruction on shared tokens, correctly deferred since they fall outside the shell scope. Plan executed as written otherwise.

## Issues Encountered
- **Build tooling PATH:** `npm run build` reported `next: command not found` because the worktree lacked `node_modules` (root cause above). Resolved by restoring deps with pnpm (the project's package manager per the committed `pnpm-lock.yaml`) and running the build via `pnpm run build`.
- **BSD vs GNU grep comment-filter:** The plan's `<verify>` comment-filter (`grep -v '^[[:space:]]*/\*\|^[[:space:]]*\*'`) uses BRE alternation that BSD/macOS grep treats literally (effective no-op). Mitigated by writing the migrated file so the forbidden strings (`linear-gradient(137deg`, `--shadow-glow-accent`, `--shadow-glass`) are absent **even within comments** — the assertion now passes on both grep dialects (raw counts = 0).

## Known Stubs
None. The `[UAT]` markers are intentional provisional design values (D-08), documented and gated at THEME-06 (plan 01-05) — not unwired data stubs. No data sources are touched in this plan.

## User Setup Required
None — no external service configuration required. (Newsreader is fetched by `next/font/google` at build time; no API key, no runtime install.)

## Next Phase Readiness
- **Ready:** the flat-warm token SSOT is the live foundation — sidebar (01-02), home/greeting (01-03), and composer (01-04) can now consume the charcoal surfaces, cream text, terracotta coral, and the `font-serif` utility.
- **Blocking handoff to 01-02:** THEME-02 **Layer B** (the 3 hardcoded inline-glass spots in `Sidebar.tsx` — nav ~414, popover ~683, hamburger ~747) is owned by plan 01-02 and is NOT touched here; a token-only reskin will NOT remove that inline glass (RESEARCH Pitfall 4).
- **Gate ahead:** all `[UAT]` values (charcoal hex, terracotta coral, Newsreader, score zones, greeting copy) lock at the **THEME-06 human-UAT gate** (plan 01-05, blocking) on the built shell — do not propagate them as final to Phase 2 until signed.
- **Note for downstream:** the worktree now has `node_modules` installed (pnpm); subsequent plans can run `pnpm test` / `pnpm run build` directly.

## Self-Check: PASSED

- `src/app/globals.css` — FOUND (modified; `#262624`, `--font-serif`, 32 `[UAT]` markers, zero glass/glow token strings).
- `src/app/layout.tsx` — FOUND (modified; `Newsreader` imported, `newsreader.variable` on `<html>`).
- `.planning/phases/01-foundation-shell/deferred-items.md` — FOUND (created).
- Commit `e46c45c7` (Task 1) — FOUND in git log.
- Commit `bf14f9c7` (Task 2) — FOUND in git log.
- `pnpm run build` — exits 0 (verified).

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-13*
