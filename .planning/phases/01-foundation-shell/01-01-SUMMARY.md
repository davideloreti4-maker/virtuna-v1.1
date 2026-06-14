---
phase: 01-foundation-shell
plan: 01
subsystem: ui
tags: [tailwind-v4, design-tokens, nextjs-app-router, next-font, newsreader, flat-warm, scroll-skeleton]

# Dependency graph
requires:
  - phase: none (first plan of the milestone)
    provides: existing src/components/layout barrel (Header/Footer), src/components/brand/numen-logo, motion primitives
provides:
  - Flat-warm @theme in src/app/globals.css (charcoal #262624 / cream #ece7de / terracotta coral ~#d97757, flat-matte shadows, no glass/glow)
  - Newsreader serif variable wired on <html> (var(--font-newsreader) + --font-serif alias resolve; reserved for the Phase-2 hero)
  - Scroll skeleton at / — Header + main of anchored stub sections (hero, how-it-works, the-simulation, pricing, faq) + Footer, with Numen page metadata
  - Bare pass-through (marketing)/layout.tsx (root layout is sole owner of document shell + fonts + base metadata)
  - src/lib/routes.ts — SIGNUP_URL / LOGIN_URL shared CTA constants
  - Clean slate — old societies-clone src/components/landing/* + 4 dead test routes removed
affects: [01-04 header rewrite, 01-05 footer rewrite, 02 hero (serif voice + crowd→score), 03 the-simulation showcase, 04 pricing/faq, 05 hardening]

# Tech tracking
tech-stack:
  added: []  # zero new packages — pnpm install ran against the existing committed lockfile (threat T-01-SC)
  patterns:
    - "Tailwind v4 two-layer @theme (primitive → semantic); reskin = repoint semantic tokens, components auto-adopt"
    - "Dark charcoal surfaces stay exact HEX (oklch L<0.15 miscompiles in @theme); coral stays oklch — intentional mixed representation"
    - "Root layout owns html/body/fonts/base metadata; route-group layout is a pass-through; each page exports its own page metadata"
    - "Page (not layout) owns Header + main + Footer for the single-scroll landing — avoids the double-Header mount"
    - "Anchored stub <section id> doubles as nav/footer target AND the mount point a later phase fills"
    - "Shared route constants (src/lib/routes.ts) — one place every CTA URL references"

key-files:
  created:
    - src/lib/routes.ts
    - .planning/phases/01-foundation-shell/deferred-items.md
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/(marketing)/page.tsx
    - src/app/(marketing)/layout.tsx
    - src/app/(marketing)/pricing/page.tsx

key-decisions:
  - "Wholesale-replaced globals.css with numen-rework's flat-warm @theme (token-name-identical; UAT-locked THEME-06) rather than hand-merging"
  - "page.tsx owns Header + main + Footer; (marketing)/layout.tsx collapsed to a bare pass-through (D-10) — single source of the document shell, no double-Header"
  - "Nav/section anchor set = hero · how-it-works · the-simulation · pricing · faq (D-23 'Simulation' noun)"
  - "Surgical /pricing fix only (drop FAQSection import+usage); full /pricing reskin stays deferred"

patterns-established:
  - "Flat-warm token SSOT lives in globals.css; never re-derive — port from numen-rework"
  - "Removed glass/glow tokens are gone (not aliased); only --gradient-card-bg kept as a flattened no-op alias so existing var() refs resolve"

requirements-completed: [FOUND-01, FOUND-02]

# Metrics
duration: 9min
completed: 2026-06-14
---

# Phase 1 Plan 01: Foundation epicenter — flat-warm theme + scroll skeleton Summary

**Replaced the cold Raycast brand with the UAT-locked flat-warm Numen design system (charcoal/cream/terracotta, flat-matte), wired the Newsreader serif variable, mounted a clean anchored scroll skeleton at `/`, fixed the duplicated-`<html>` marketing layout, and deleted the old societies-clone — `pnpm build` green.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-14T17:57:55Z
- **Completed:** 2026-06-14T18:07:22Z
- **Tasks:** 3 (Task 0 install — no commit; Tasks 1–2 committed)
- **Files modified:** 6 changed (1 created, 5 modified) + 18 deleted

## Accomplishments
- Flat-warm `@theme` ported wholesale into `globals.css`: charcoal `#262624` page bg, cream `#ece7de` text, terracotta coral `oklch(0.68 0.13 33)` ≈ `#d97757`, flat-matte shadows (`--shadow-float` only; glass/glow tokens removed). Cold `--color-gray-*` ramp survives (product refs). `--font-serif → var(--font-newsreader)`.
- Newsreader (400 + italic) variable wired onto `<html>` alongside Inter in the root layout — reserved, not yet rendered (the Phase-2 hero consumes it; `--font-serif` resolves now).
- `/` now renders the flat-warm scroll skeleton: `<Header/>` + `<main>` of five anchored stub `<section>`s + `<Footer/>`, server component, Numen page metadata.
- `(marketing)/layout.tsx` collapsed to a bare pass-through — duplicated document shell, redundant Inter, stale "Artificial Societies" metadata, and the second Header render all stripped (D-10 bug fixed).
- `src/lib/routes.ts` shared CTA constants (`SIGNUP_URL`, `LOGIN_URL`) for every "Try it free" / "Sign in" link (D-20).
- Clean slate: `src/components/landing/*` (14 files) + the 4 dead test routes deleted; `/pricing` build-break surgically fixed.

## Task Commits

Each task was committed atomically:

1. **Task 0: Install dependencies** — no commit (installs gitignored `node_modules` from the committed lockfile; zero new packages)
2. **Task 1: Port flat-warm globals.css + wire Newsreader + add route constants** — `b37dce52` (feat)
3. **Task 2: Mount scroll skeleton, collapse marketing layout, delete old landing/* + dead routes, fix pricing import** — `a90267ba` (feat)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified
- `src/app/globals.css` — flat-warm `@theme` (charcoal/cream/terracotta, flat-matte shadows, `--shadow-float`, `--font-serif → var(--font-newsreader)`; removed glass/glow tokens; flattened `--gradient-card-bg` alias)
- `src/app/layout.tsx` — Newsreader (400 + italic) wired onto `<html>` alongside Inter
- `src/lib/routes.ts` — `SIGNUP_URL` / `LOGIN_URL` shared CTA constants
- `src/app/(marketing)/page.tsx` — server-component scroll skeleton (Header + main of 5 anchored stub sections + Footer + Numen metadata)
- `src/app/(marketing)/layout.tsx` — bare pass-through (document shell + Header + stale metadata removed)
- `src/app/(marketing)/pricing/page.tsx` — dropped `FAQSection` import + usage (Footer + PricingSection intact)
- `src/components/landing/*` (14 files) — **deleted** (old societies clone, D-11)
- `src/app/(marketing)/{viz-test,viral-score-test,board-preview,primitives-showcase}/page.tsx` — **deleted** (dead test routes, D-11)
- `.planning/phases/01-foundation-shell/deferred-items.md` — logged out-of-scope discoveries

## Decisions Made
- **Wholesale replace, not hand-merge** for `globals.css` — source and target `@theme` blocks are token-name-identical, so a verbatim copy of numen-rework's UAT-locked file is the lowest-risk path (RESEARCH A2: no landing-v2-only token to preserve).
- **Header ownership = page, not layout** — the `/` skeleton renders `<Header/>`, and `(marketing)/layout.tsx` is a pass-through. Resolves the D-10 double-`<html>`/double-Header bug cleanly (RESEARCH Open Q1 / Pitfall 2).
- **Anchor set** = `hero · how-it-works · the-simulation · pricing · faq` (D-23 "Simulation" product noun); these are both nav/footer targets and Phase 2–4 mount points.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Root layout actually needed the Newsreader wiring (plan read_first assumed it was already present)**
- **Found during:** Task 1 (verification step)
- **Issue:** The plan's `read_first` for Task 1(b) implied the landing-v2 root `layout.tsx` "imports only Inter today" but separately listed numen-rework's already-wired layout as the source pattern — the two were easy to conflate. On disk, landing-v2's root layout imported **only Inter**; the Newsreader 3-line diff was genuinely required (not a no-op). The automated verify (`grep Newsreader src/app/layout.tsx`) correctly caught this.
- **Fix:** Applied the precise 3-line diff — `import { Inter, Newsreader }`, the `newsreader` const (`subsets:["latin"]`, `display:"swap"`, `variable:"--font-newsreader"`, `style:["normal","italic"]`, `weight:["400"]`), and `${inter.variable} ${newsreader.variable}` on `<html>`. Existing metadata/viewport/body/DevLocator untouched.
- **Files modified:** src/app/layout.tsx
- **Verification:** `grep Newsreader && grep newsreader.variable` pass; `pnpm build` green.
- **Committed in:** b37dce52 (Task 1 commit)

**2. [Rule 3 - Blocking] Doc-comment prose tripped the plan's own grep assertions**
- **Found during:** Task 2 (acceptance verification)
- **Issue:** My initial JSDoc on `(marketing)/layout.tsx` and `(marketing)/page.tsx` quoted the literal strings the acceptance criteria assert *absent* — e.g. the comment explaining "the root layout owns `<html>`/`<body>`... stale 'Artificial Societies' metadata... rendered `<Header/>`", and `page.tsx` saying `(no "use client")`. The contract's `! grep -q "<html"` / `! grep "Artificial Societies"` / `! grep '"use client"'` checks matched the prose, producing false failures.
- **Fix:** Rewrote both comments to convey the same intent without the literal trigger strings (document-shell / client-directive phrasing). No logic change.
- **Files modified:** src/app/(marketing)/layout.tsx, src/app/(marketing)/page.tsx
- **Verification:** All three checks now PASS; `pnpm build` re-run green afterward.
- **Committed in:** a90267ba (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both were necessary to satisfy the plan's own acceptance gates; neither changed scope or behavior. No scope creep.

## Issues Encountered
- **Removed-token consumers in deferred files:** `showcase/page.tsx` (token-swatch refs to `--shadow-glass`/`--gradient-navbar`) and `header.tsx` (`var(--gradient-navbar)`) reference tokens the flat-warm port removed. **Did not break the build** — Tailwind v4 silently drops unknown utility classes and an undefined CSS `var()` is inert. The plan scopes both out (header rewritten by 01-04; `/showcase` reskin deferred). Logged to `deferred-items.md`. No action taken (correct per SCOPE BOUNDARY).
- **Pre-existing lint debt (58 errors / 68 warnings) in `src/lib/engine|schemas|stores`:** all outside this plan's 6 touched files (which lint clean). Unrelated product code carried from `main`; out of scope for a marketing-surface milestone. Logged to `deferred-items.md`. `pnpm build` (with typecheck) is green — the plan's stated correctness gate.
- **Shell-quoting false negatives during verification:** chained `&&` grep with `$`-interpolated patterns (`${inter.variable}`) and the `^[^*]*` anchor produced spurious exit-1s; re-running each clause independently with safe quoting confirmed all pass. No file-content problem.

## User Setup Required
None — no external service configuration required (static marketing scaffold; zero new packages, no env vars, no secrets — threat register T-01-01 / T-01-SC both `accept`).

## Next Phase Readiness
- **Ready for the rest of Wave 1 / Phase 1:** the flat-warm theme compiles, the scroll skeleton + anchors exist, the layout is a clean pass-through, and `src/lib/routes.ts` is in place for 01-04's Header. The Newsreader variable resolves for 01-03/Phase-2's serif hero.
- **Hand-offs:** 01-04 rewrites `header.tsx` in place (will clear its dead `var(--gradient-navbar)`); 01-05 rewrites `footer.tsx`; both keep the `@/components/layout` barrel paths/exports unchanged (the skeleton already imports `Header`/`Footer` from there).
- **No blockers.** Build green; deferred items tracked.

## Self-Check: PASSED

- Created/modified files verified on disk: `globals.css`, `layout.tsx`, `src/lib/routes.ts`, `(marketing)/page.tsx`, `(marketing)/layout.tsx`, `(marketing)/pricing/page.tsx`, `deferred-items.md`, `01-01-SUMMARY.md` — all FOUND.
- Deletions verified gone: `src/components/landing/`, the 4 dead test routes.
- Task commits verified present: `b37dce52`, `a90267ba`.
- `pnpm build` exits 0 (51 static pages, `/` static).

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-14*
