---
phase: 01-foundation-shell
plan: 02
subsystem: ui
tags: [cva, placeholder-slot, lucide-react, aspect-ratio, flat-warm, reduced-motion, vitest, happy-dom, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: flat-warm @theme tokens in globals.css (--color-surface-elevated, --color-border, --color-foreground-muted, --radius-lg, --font-mono, --text-xs) + skeleton-breathe keyframe + cn() + ui/button.tsx CVA pattern + ui/skeleton.tsx motion-reduce gate
provides:
  - "<Placeholder> CVA slot component (image/video/avatar/logo variants) with the one-prop src swap, inline aspect-ratio lock, and an opt-in reduced-motion-gated breathe"
  - src/components/marketing/ directory + barrel (Placeholder, placeholderVariants, PlaceholderProps) — the milestone surface kept out of shared ui/
  - happy-dom unit coverage proving variant→icon, src-vs-stand-in, aspect lock, and the breathe gate (FOUND-03)
affects: [02 hero (uses Placeholder for the crowd→score visual frame), 03 the-simulation showcase (product-shot slots), 04 pricing/faq/proof (avatar + logo + image slots), 05 hardening (FOUND-06 no-layout-shift, FOUND-07 a11y/reduced-motion)]

# Tech tracking
tech-stack:
  added: []  # zero new packages — class-variance-authority + lucide-react already installed (01-01)
  patterns:
    - "Marketing components mirror ui/ CVA convention (cva + cn() + forwardRef + displayName + named export + variants export + exported Props type) but live in src/components/marketing/ (D-15)"
    - "Aspect-ratio is an inline style (free CSS string), NOT a CVA key — any ratio works and the box is reserved before any asset loads (D-14, no layout shift)"
    - "data-variant on the root is the deterministic test/styling hook; decorative media-type glyphs are aria-hidden svgs"
    - "Optional motion is opt-in + double-gated: animate-skeleton-breathe paired with motion-reduce:animate-none (mirrors ui/skeleton.tsx), OFF by default"

key-files:
  created:
    - src/components/marketing/placeholder.tsx
    - src/components/marketing/index.ts
    - src/components/marketing/__tests__/placeholder.test.tsx
  modified: []

key-decisions:
  - "Exposed the optional breathe behind a `breathe` boolean prop (default false) — matches the plan's 'OFF by default' + reduced-motion-gated contract"
  - "Per-variant default aspect map: image/video 16/9, avatar 1/1, logo 3/1 (wide-short box per UI-SPEC); any explicit `aspect` string overrides"
  - "logo variant suppresses the label caption (icon-only acceptable per UI-SPEC item 1); video overlays a static muted play-triangle over the media-type icon"
  - "src present → real <img> for image/avatar/logo, <video muted playsInline> for video; the developer-supplied static src is build-time, not user input (threat T-01-02 accept)"

patterns-established:
  - "src/components/marketing/ is the home for all landing-v2-specific components; barrel re-exports component + variants + Props type"
  - "Stand-in look = charcoal chip (--color-surface-elevated) + hairline 6% border + 12px radius (avatar rounded-full) + low-opacity lucide glyph + cream-muted label + faint mono dimension hint. Flat-matte only: no glass/blur/shine/glow/dashed-wireframe (D-13)"

requirements-completed: [FOUND-03]

# Metrics
duration: 5min
completed: 2026-06-14
---

# Phase 01 Plan 02: Placeholder Slot Summary

**A reusable CVA `<Placeholder>` slot (image/video/avatar/logo) that swaps to real `<img>`/`<video>` via one `src` prop, locks its box with inline aspect-ratio (no layout shift), and ships flat-warm with an opt-in reduced-motion-gated breathe — FOUND-03, TDD red→green.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-14T20:15Z (RED commit)
- **Completed:** 2026-06-14T20:18Z
- **Tasks:** 2 (TDD: RED test → GREEN implementation)
- **Files created:** 3

## Accomplishments
- `<Placeholder>` component: 4 CVA variants, the one-prop `src` swap (stand-in ⇄ real media), inline `aspect-ratio` lock that reserves the box before any asset loads (D-14, sets up FOUND-06).
- Flat-warm stand-in (D-13): charcoal chip surface, hairline 6% border, 12px radius (avatar → `rounded-full`), low-opacity lucide media-type glyph (`Image`/`Video`/`UserRound`/`Building2`), cream-muted `label` caption, faint mono dimension hint. No glass/blur/shine/glow.
- Opt-in `breathe` prop: `animate-skeleton-breathe` + `motion-reduce:animate-none`, OFF by default — reduced-motion safe.
- `src/components/marketing/` dir + barrel established (D-15) — the landing surface stays out of the shared `ui/` design system.
- happy-dom suite GREEN 11/11 covering every `<behavior>` clause.

## Task Commits

Each task committed atomically (TDD cycle):

1. **Task 1: Wave-0 failing test (RED)** — `aa4a3d55` (test)
2. **Task 2: Implement `<Placeholder>` + barrel (GREEN)** — `11477197` (feat)

**Plan metadata:** (this commit) — docs: complete plan

_TDD: RED `test(...)` → GREEN `feat(...)`. No REFACTOR commit — implementation landed clean._

## Files Created/Modified
- `src/components/marketing/placeholder.tsx` — the CVA placeholder-slot component (variants, src swap, aspect lock, breathe gate).
- `src/components/marketing/index.ts` — barrel: `Placeholder`, `placeholderVariants`, `PlaceholderProps`.
- `src/components/marketing/__tests__/placeholder.test.tsx` — FOUND-03 happy-dom unit coverage (11 assertions).

## Decisions Made
- **Breathe is a `breathe` boolean prop, default `false`** — the plan left the opt-in mechanism to the executor; a boolean is the minimal surface that satisfies "OFF by default + reduced-motion-gated."
- **Per-variant default aspect** (`image`/`video` 16/9, `avatar` 1/1, `logo` 3/1) so callers can omit `aspect`; any explicit string overrides.
- **`logo` is icon-only** (caption suppressed) and **`video` shows a static play-triangle** — both per UI-SPEC item 1 variant overrides.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aspect-ratio assertion brittle to CSSOM whitespace normalization**
- **Found during:** Task 2 (GREEN — first implementation run, 9/11 passing)
- **Issue:** The Task-1 test asserted `style.aspectRatio === "16/9"` / `"1/1"` exactly, but the browser CSSOM (happy-dom) normalizes the value to `"16 / 9"` / `"1 / 1"` (spaces around the slash). The component was correct; the assertion was over-specified on whitespace formatting that is not part of the behavioral contract.
- **Fix:** Normalized whitespace in the two aspect assertions (`.replace(/\s+/g, "")`) before comparing — still proves the contract (aspect reflects the `aspect` prop; avatar defaults `1/1`) without coupling to browser whitespace.
- **Files modified:** `src/components/marketing/__tests__/placeholder.test.tsx`
- **Verification:** Suite GREEN 11/11.
- **Committed in:** `11477197` (Task 2 / GREEN commit)

**2. [Rule 3 - Blocking] Doc-comment string tripped the flat-matte acceptance guard**
- **Found during:** Task 2 (acceptance check — `grep -E "backdrop|blur|--gradient-glass" placeholder.tsx` must be empty)
- **Issue:** A JSDoc line read "NO backdrop-blur, NO inset shine…", so the literal substring `backdrop-blur` matched the flat-matte guard even though no glass/blur CSS is used anywhere in the component.
- **Fix:** Reworded the comment to "flat-matte only: no glass surface, no inset shine…" — same meaning, no `backdrop`/`blur` substring. Guard now returns clean.
- **Files modified:** `src/components/marketing/placeholder.tsx`
- **Verification:** `grep -E "backdrop|blur|--gradient-glass"` returns empty; ESLint clean.
- **Committed in:** `11477197` (Task 2 / GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 bug — test assertion robustness; 1 blocking — guard false-positive). Both are test/comment-level corrections; the component's behavior matched the plan from the first implementation pass (9/11 green pre-fix, only the two whitespace assertions failed).
**Impact on plan:** No scope creep, no behavior change vs. the plan. Component shipped exactly as specified (D-12/D-13/D-14/D-15).

## Issues Encountered
- The Bash tool wrapper truncated `pnpm vitest` stdout (`PASS (0) FAIL (0)` placeholder line); resolved by reading the JSON reporter log under `~/Library/Application Support/rtk/tee/` and using the `&& echo GREEN || echo RED` exit-code gate as the authoritative pass/fail signal. Final fresh run reported `PASS (11) FAIL (0)`.

## Known Stubs
None. `<Placeholder>` is itself the intentional, swappable stand-in primitive (FOUND-03) — the labelled stand-in is the designed default state, replaced per-call via the `src` prop, not a placeholder-for-missing-work.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `<Placeholder>` is ready for Plans 01-04/01-05 (header/footer chrome may use it) and Phases 2–4 (every product-visual slot). Import via `@/components/marketing`.
- Aspect-lock + reduced-motion gate seed FOUND-06 (no layout shift) and FOUND-07 (a11y/reduced-motion) for the Phase 5 hardening audit.
- The optional `skeleton-breathe` relies on the keyframe in `globals.css` (present, 01-01) and the global CSS `@media (prefers-reduced-motion: reduce)` block that 01-03 adds — the Tailwind `motion-reduce:animate-none` utility already gates it independently, so it is safe in the interim.

## Self-Check: PASSED
- Files: `placeholder.tsx`, `index.ts`, `__tests__/placeholder.test.tsx` all FOUND on disk.
- Commits: `aa4a3d55` (RED) + `11477197` (GREEN) both FOUND in git log.

## TDD Gate Compliance
RED gate `test(01-02)` `aa4a3d55` precedes GREEN gate `feat(01-02)` `11477197`. RED confirmed failing for the right reason (`Failed to resolve import "../placeholder"`). No REFACTOR needed. Gate sequence satisfied.

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-14*
