---
phase: 02-foundation-hero
plan: 04
subsystem: ui
tags: [hero, server-component, dom-accessibility, behavioral-canvas, brand-spine, integration]

# Dependency graph
requires:
  - phase: 02-foundation-hero (Plan 01)
    provides: page.tsx imports BehavioralHero + globals.css scroll-behavior + barrel export
  - phase: 02-foundation-hero (Plan 02)
    provides: BehavioralCanvas client island + HERO_GRADIENT/CONFIDENCE_CHIP/PARTICLE_MOTION constants
  - phase: 02-foundation-hero (Plan 03)
    provides: ZERO external-imports policy (Magic UI / Aceternity / Origin UI / Cult UI)
provides:
  - "src/components/landing/BehavioralHero.tsx -- server-rendered hero composition"
  - "Working pnpm build pipeline -- Phase 2 Wave 2 closes the chain (Plans 01-04 all green)"
  - "Latent Button asChild Slot bug fixed in src/components/ui/button.tsx (affects all asChild consumers)"
affects:
  - "Phase 3-5 landing surfaces that compose Button asChild (now works in SSR prerender)"
  - "Phase 5 BUILD verification (visual regression + reduced-motion gates target this hero)"
  - "Phase 4 #science anchor (forward-compatible no-op until target lands)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RSC composition with single client island (BehavioralCanvas) reading constants via verbatim named imports"
    - "DOM-accessible chip overlay pattern (role=status + aria-live=off + aria-label) above absolutely-positioned canvas -- alternative to canvas-painted text for a11y"
    - "Inline clamp() style for one-off oversized typography (Tailwind v4 has no built-in arbitrary-clamp utility)"
    - "Button asChild + Radix Slot: skip the loading spinner branch in asChild mode so children remain a single React element (Slot contract)"

key-files:
  created:
    - "src/components/landing/BehavioralHero.tsx (175 LOC)"
    - ".planning/phases/02-foundation-hero/02-04-SUMMARY.md (this file)"
  modified:
    - "src/components/ui/button.tsx (split asChild and non-asChild branches so Loader2 fragment is skipped in asChild mode -- fixes latent Slot SSR bug)"

key-decisions:
  - "Render confidence chip as DOM <div role=status aria-live=off> overlay positioned at top: 45% (matches canvas convergence point 0.5 + PARTICLE_MOTION.targetOffsetY = 45%) -- NOT canvas-painted text. Orchestrator decision #6 satisfied."
  - "Apply HERO_GRADIENT via inline `style={{ background: HERO_GRADIENT }}` rather than a Tailwind class -- gradient is a single-use brand asset and the constants file is source of truth (matches Plan 02 chip-token pattern)."
  - "Use &middot; HTML entity for the Numen Machines lockup separator (Pitfall 11) -- portable across editors."
  - "Apply font weights via Tailwind utility classes (font-light/medium/normal/mono) but clamp() font sizes via inline style -- cleanest split for one-off responsive typography."
  - "Auto-fix Button.tsx asChild Slot bug rather than work around it in BehavioralHero (Rule 1/Rule 3) -- the bug is latent in every asChild consumer and Plan 04 is the first to trigger prerender."

patterns-established:
  - "Behavioral hero composition pattern: section wrapper + ambient gradient + two-column flex (text/canvas) + DOM chip overlay"
  - "RSC server-component file naming: PascalCase (BehavioralHero.tsx) -- matches BehavioralCanvas.tsx for the feature pair"

requirements-completed: [HERO-01, HERO-02, HERO-03, HERO-04, HERO-05, HERO-07, HERO-09, HERO-10]

# Metrics
duration: 10min
completed: 2026-05-10
---

# Phase 02 Plan 04: BehavioralHero Composition Summary

**Server-rendered hero composition lands the locked five-string copy + dual CTA + ambient gradient + BehavioralCanvas client island + DOM-accessible 87% chip overlay -- closing Wave 2 of Phase 02 and producing the first green `pnpm build` of the milestone.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-10T21:26:00Z (worktree HEAD check)
- **Completed:** 2026-05-10T21:36:32Z
- **Tasks:** 1 of 1
- **Files created:** 1 (175 LOC)
- **Files modified:** 1 (Button.tsx asChild Slot fix, +14 LOC / -6 LOC)

## Accomplishments

- **`BehavioralHero.tsx` shipped as a React Server Component** -- no client-boundary directive at the top of the file. All copy + buttons + gradient are static SSR; only `BehavioralCanvas` (the Plan 02 client island) hydrates post-paint. Minimizes JS shipped per LCP per Phase 5 BUILD-04.
- **All five locked copy strings verbatim per REQUIREMENTS.md HERO-01..05:**
  - Pre-headline: `VIRTUNA &middot; A NUMEN MACHINES PRODUCT` (Inter mono, uppercase, tracking 0.18em)
  - H1: `Predict how your audience will respond.<br />Before you post.` (Inter 300, clamp(2.75rem, 6.5vw, 5rem), line-height 1.05, letter-spacing -0.02em, text-wrap balance, max-width 14ch)
  - Sub-headline: `Virtuna simulates your audience to forecast every video before it ships.` (Inter 500, clamp(1.25rem, 2.2vw, 1.5rem))
  - Subline: `Trained on decades of behavioral research. Self-improving with every outcome.` (Inter 400, clamp(1rem, 1.4vw, 1.125rem), muted foreground/70)
  - Primary CTA: `Run a prediction →` → `<Link href="/dashboard">` (middleware-controlled auth redirect)
  - Secondary CTA: `See the science` → `<Link href="#science">` (forward-compatible smooth-scroll anchor; target lands in Phase 4)
- **DOM-accessible chip overlay** (orchestrator decision #6): the "87%" chip is rendered as a real `<div role="status" aria-live="off" aria-label="...">`, absolutely positioned at `top: 45%` (matches `PARTICLE_MOTION.targetOffsetY` so the chip center aligns with the canvas particle convergence point), `pointer-events-none` makes it decorative. All visual tokens (bg/border/text colors, padding, radius, font size/weight) come from `CONFIDENCE_CHIP` constants (Plan 02) -- single source of truth.
- **Two-column desktop layout (~60/40)** at lg+ breakpoint, stacked mobile layout (canvas above text via `flex-col-reverse lg:flex-row`).
- **Zero external library imports** -- only `next/link`, `@/components/ui` (Button), `@/lib/utils` (cn), `./BehavioralCanvas`, `./behavioral-hero-constants`. Matches Plan 03 phase2_policy 7-source allowed list.
- **`pnpm build` exits clean** for the first time this milestone (Plans 01, 02, 03 produced intermediate scaffold state). All 55 pages prerender successfully.

## Task Commits

Single task plan -- one atomic commit on branch `worktree-agent-ab6502fe6a583f4d7`:

1. **Task 1: BehavioralHero.tsx server component + asChild Slot fix in Button** -- `60e2374` (feat)

## VALIDATION.md Per-Task Verification Map Entries

| Task ID | Acceptance Check | Result |
|---------|------------------|--------|
| 02-04-01 | File exists, no client directive at top, all 6 locked copy strings present, clamp(2.75rem, 6.5vw, 5rem) H1, `<br />` two-line break, `href="/dashboard"`, `href="#science"`, `role="status"`, `aria-label`, `BehavioralCanvas` + `HERO_GRADIENT` + `CONFIDENCE_CHIP` imports wired, zero external library imports, zero banned terms in non-comment lines, lint:vocab clean on new file, full pnpm build green | PASS |

## Phase 2 Closeout: All 12 Requirements Addressed

| Req ID | Description | Landed In |
|--------|-------------|-----------|
| BUILD-01 | Behavioral hero scaffold + smooth-scroll CSS | Plan 02-01 |
| BUILD-02 | External component policy doc (REJECT/ACCEPT matrix) | Plan 02-03 |
| HERO-01 | Pre-headline `VIRTUNA · A NUMEN MACHINES PRODUCT` | Plan 02-04 |
| HERO-02 | H1 `Predict how your audience will respond. Before you post.` | Plan 02-04 |
| HERO-03 | Sub-headline `Virtuna simulates your audience to forecast every video before it ships.` | Plan 02-04 |
| HERO-04 | Subline `Trained on decades of behavioral research. Self-improving with every outcome.` | Plan 02-04 |
| HERO-05 | Dual CTA `Run a prediction →` + `See the science` | Plan 02-04 |
| HERO-06 | DOM-accessible 87% confidence chip overlay | Plan 02-04 (chip render) + Plan 02-02 (token constants) |
| HERO-07 | Behavioral simulation canvas (250 desktop / 120 mobile particles) | Plan 02-02 (canvas) + Plan 02-04 (composition) |
| HERO-08 | Mobile graceful scaling (particle count + size multiplier) | Plan 02-02 |
| HERO-09 | Two-column desktop / stacked mobile layout | Plan 02-04 |
| HERO-10 | Zero "viral" / "AI" terms + vocab-lint guard | Plan 02-02 (canvas/constants), Plan 02-04 (hero), enforced via `pnpm lint:vocab` |

All 12 Phase 2 requirement IDs satisfied across the four plans of the phase.

## Decisions Made

- **Chip is a DOM `<div role="status">`, not canvas-painted text** (orchestrator decision #6). Three reasons: (1) screen readers can announce the value via the explicit `aria-label`, (2) the chip remains visible in `prefers-reduced-motion: reduce` mode without a separate canvas-text rendering branch, (3) the chip inherits the page Inter font stack with no canvas-font shimming required.
- **Chip Y position computed from `PARTICLE_MOTION.targetOffsetY`** rather than hardcoded. `CHIP_TOP_PERCENT = (0.5 + PARTICLE_MOTION.targetOffsetY) * 100` (= 45) keeps the chip and the canvas particle target in lockstep through any future tuning of `targetOffsetY`.
- **`HERO_GRADIENT` applied via inline `style={{ background: ... }}`** rather than authoring a Tailwind class. The gradient is a single-use brand asset; the constants file (Plan 02 output) is the single source of truth; an inline style keeps the relationship explicit.
- **Typography sizes inline, weights via Tailwind utility classes.** Tailwind v4 has no built-in arbitrary-clamp utility (the `text-[clamp(...,...,...)]` arbitrary value pattern is supported but harder to read). Inline `style={{ fontSize: "clamp(...)" }}` reads cleaner for the H1 / sub-headline / subline. `font-light`, `font-medium`, `font-normal`, `font-mono` Tailwind utilities still apply Inter weights.
- **`&middot;` HTML entity over literal `·` Unicode** (Pitfall 11) -- more portable across editor configurations.
- **Auto-fixed Button.tsx asChild Slot bug rather than worked around it** (see Deviations below). Rationale: the bug is latent in every `<Button asChild>` consumer (including the not-yet-imported `cta-section.tsx`). Fixing in Button.tsx is one place; working around in BehavioralHero would leak the problem to every future `asChild` consumer. The fix is minimal (3 lines), strictly more correct (`asChild` + `loading` spinner was semantically incoherent anyway), and preserves all existing non-asChild Button behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 / Rule 3 - Bug, blocking] Fixed latent `<Button asChild>` Slot SSR prerender crash**

- **Found during:** Task 1 build verification (`pnpm build` after `BehavioralHero.tsx` written)
- **Issue:** `pnpm build` failed with `Error: React.Children.only expected to receive a single React element child` while prerendering `/`. Root cause in `src/components/ui/button.tsx`: when `asChild=true`, the rendered JSX inside the Radix `Slot` was `{loading && <Loader2 />}{children}`. Even with the default `loading=false`, the JSX runtime produces an array `[false, <Link>...</Link>]`. Radix `Slot.SlotClone` calls `React.Children.count(children) > 1` and intentionally throws via `React.Children.only(null)`. The bug was latent because the only other `asChild` consumer (`cta-section.tsx`) was never imported into any route -- `BehavioralHero` became the first prerendered consumer.
- **Fix:** Split the `<Comp>` body into two branches: `asChild ? children : <>{loading && <Loader2 />}{children}</>`. In asChild mode the loading spinner is skipped (semantically incoherent -- you cannot compose a spinner into a Link's text node). In non-asChild mode the existing loading behavior is preserved exactly.
- **Files modified:** `src/components/ui/button.tsx` (added asChild ternary inside the Comp body; total delta +14 LOC / -6 LOC including the explanatory comment).
- **Verification:** `pnpm build` exits 0 after the fix (all 55 pages prerender). Full Vitest suite still 218 / 221 passing -- zero regressions. ESLint clean on the modified file.
- **Committed in:** `60e2374` (Task 1 commit; the fix and the new hero file ship together as one atomic change because the hero is what surfaces the bug).

### Deferred Issues

None -- one auto-fix, plan complete.

**Total deviations:** 1 auto-fixed (Rule 1 / Rule 3 bug, blocking).
**Impact on plan:** The Button.tsx change is out of the original `<files_modified>` scope but is the cleanest path to satisfying the plan's `pnpm build exits 0` success criterion. Tracked here as a deviation per the deviation-rules protocol.

## Authentication Gates

None -- pure UI composition work, no auth flow encountered.

## Issues Encountered

- **Pre-existing `pnpm lint:vocab` baseline errors (NOT introduced by this plan).** Same 55 errors / 3 warnings noted in Plan 02-02's `deferred-items.md`. Owned by Plan 06 BUILD-09 ("Replace plagiarized Artificial Societies copy"). The new `BehavioralHero.tsx` file is clean when checked in isolation:

  ```bash
  $ node scripts/lint-vocab.mjs src/components/landing/BehavioralHero.tsx
  [lint-vocab] 0 error(s), 0 warning(s)
  ```

- **Pre-existing `pnpm lint` baseline errors (NOT introduced by this plan).** Same 12 errors / 24 warnings present before Plan 02-04 (confirmed via `git stash --include-untracked` baseline check). Affected files (all outside Plan 02 scope): `src/components/primitives/GlassTooltip.tsx`, `src/components/ui/testimonial-card.tsx`, and several engine test files in `src/lib/engine/__tests__/`. ESLint clean on `src/components/landing/BehavioralHero.tsx` AND `src/components/ui/button.tsx` (the two files touched by this plan):

  ```bash
  $ npx eslint src/components/ui/button.tsx src/components/landing/BehavioralHero.tsx
  # (no output -- both clean)
  ```

## Known Stubs

None -- the hero renders complete and final copy + tokens + composition. The DOM chip displays the hardcoded 87% illustration value (per CONTEXT.md D-34 -- this is the marketing illustration, not real prediction data). The `href="#science"` anchor on the secondary CTA points at a target that ships in Phase 4 (forward-compatible no-op until then per orchestrator decision #3) -- intentional, not a stub.

## Threat Surface Scan / Threat Flags

No NEW security-relevant surface introduced beyond what the PLAN.md `<threat_model>` already enumerated. All threats accepted/mitigated per plan:

| Threat ID | Status |
|-----------|--------|
| T-2-12 (Spoofing: hero copy) | MITIGATED -- copy is verbatim from REQUIREMENTS.md HERO-01..05; `pnpm lint:vocab` guards against drift; new file is vocab-clean |
| T-2-13 (Tampering: /dashboard CTA route) | ACCEPTED -- middleware (`src/lib/supabase/middleware.ts`) controls all `/dashboard` access; no new auth code in this plan |
| T-2-14 (Info disclosure: 87% chip value) | ACCEPTED -- hardcoded illustration per CONTEXT.md D-34; source-of-truth is constants file (Plan 02); no PII |
| T-2-15 (DoS: DOM chip overlay) | ACCEPTED -- pure HTML/CSS overlay, no JS animation, no network, no listeners; `pointer-events-none` prevents input interception |
| T-2-16 (Info disclosure: SSR HTML pre-hydration) | ACCEPTED -- only public marketing copy ships in initial paint; no secrets, no env vars, no user data |
| T-2-17 (Elevation: external imports) | MITIGATED -- zero imports from Magic UI / Aceternity / Origin UI / Cult UI (verified by grep); `package.json` untouched (no new npm dependencies) |

No new threat flags to add.

## Manual Verification Gates (per VALIDATION.md "Manual-Only Verifications")

Davide to verify before phase 02 closeout:

- [ ] `pnpm dev`, open Chrome at 1280x720 viewport, screenshot the hero -- verify hierarchy (pre-headline → H1 → sub-headline → subline → dual CTA stacked left; canvas right; coral gradient bloom upper-center; "87%" chip visible overlaying canvas convergence point)
- [ ] Same in Safari at 1280x720 -- confirm visual parity (font rendering + gradient + canvas)
- [ ] Chrome DevTools device emulation iPhone 14 (390x844) -- confirm canvas stacks above text, no horizontal scroll, CTAs ≥ 44px tap target
- [ ] DevTools Rendering panel → Emulate prefers-reduced-motion: reduce → reload -- confirm canvas mounts directly into converged static state, chip still visible
- [ ] Toggle off, reload -- confirm 2.2s drift+attract animation plays once
- [ ] Navigate to /dashboard (will redirect to /login via middleware) and back -- confirm canvas animation does NOT replay (module-level flag persistence)
- [ ] VoiceOver (Cmd+F5 on Mac) -- confirm SR announces "87%" via the chip's aria-label

## Self-Check: PASSED

**Files exist:**
- `src/components/landing/BehavioralHero.tsx` -- FOUND (175 LOC)
- `src/components/ui/button.tsx` -- FOUND (modified)
- `.planning/phases/02-foundation-hero/02-04-SUMMARY.md` -- FOUND (this file)

**Commit exists on `worktree-agent-ab6502fe6a583f4d7`:**
- `60e2374` (Task 1) -- FOUND in `git log`

**Critical greps pass:**
- `export function BehavioralHero` -- FOUND
- `'use client'` -- ABSENT at top of BehavioralHero.tsx (server component confirmed)
- `VIRTUNA &middot; A NUMEN MACHINES PRODUCT` -- FOUND
- `Predict how your audience will respond` -- FOUND
- `Before you post` -- FOUND
- `clamp(2.75rem, 6.5vw, 5rem)` -- FOUND
- `<br />` -- FOUND
- `href="/dashboard"` -- FOUND
- `href="#science"` -- FOUND
- `role="status"` -- FOUND
- `BehavioralCanvas` -- FOUND
- `HERO_GRADIENT` -- FOUND
- `CONFIDENCE_CHIP` -- FOUND
- External library imports (magic-ui / aceternity-ui / origin-ui / cult-ui) -- ABSENT
- `framer-motion` -- ABSENT
- Banned terms (viral / AI whole-word) in non-comment lines -- 0 occurrences

**Pipeline gates pass:**
- `pnpm build` -- exits 0, all 55 pages prerendered
- `pnpm test` -- 218 / 221 passing (3 unrelated skips, zero regressions from Button.tsx change)
- `./node_modules/.bin/vitest run src/components/landing/__tests__/behavioral-hero-constants.test.ts` -- 4 / 4 invariant tests pass
- `node scripts/lint-vocab.mjs src/components/landing/BehavioralHero.tsx` -- 0 errors / 0 warnings
- `npx eslint src/components/ui/button.tsx src/components/landing/BehavioralHero.tsx` -- 0 errors / 0 warnings

---
*Phase: 02-foundation-hero*
*Plan: 04*
*Completed: 2026-05-10*
