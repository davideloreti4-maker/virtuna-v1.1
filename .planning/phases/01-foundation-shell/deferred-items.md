# Deferred Items — Phase 01 Foundation & Shell

Out-of-scope discoveries logged during execution (executor SCOPE BOUNDARY: only
auto-fix issues directly caused by the current task; pre-existing failures in
unrelated files are logged, not fixed).

## From 01-01 (flat-warm theme port + scroll skeleton)

### Pre-existing lint debt in engine/product code (NOT introduced this plan)

`pnpm lint` reports **58 errors + 68 warnings** across `src/lib/engine/*`,
`src/lib/schemas/*`, `src/stores/__tests__/*`, and other product code carried
over from `main`. None are in the 6 files this plan touched (`globals.css`,
`layout.tsx`, `lib/routes.ts`, `(marketing)/page.tsx`, `(marketing)/layout.tsx`,
`(marketing)/pricing/page.tsx` — all lint clean). This milestone is
marketing-surface-only; the engine lint debt is unrelated.

- **Status:** deferred (out of scope for landing-v2 milestone)
- **Discovered:** 2026-06-14 during 01-01
- **Action:** none — `pnpm build` (with typecheck) is green; the lint debt
  predates this milestone and lives in product code this milestone does not own.

### Dead removed-token references in deferred sibling routes (build-safe)

`src/app/(marketing)/showcase/page.tsx` (lines ~163, 215–216, 604, 772) and
`src/components/layout/header.tsx` (line ~62) still reference design tokens that
the flat-warm port removed (`--shadow-glass`, `--gradient-navbar`). These do NOT
break the build — Tailwind v4 silently drops unknown utility classes and a CSS
`var()` with no definition is inert. They render as minor visual no-ops.

- **Status:** deferred — resolved by later plans/phases, not 01-01.
  - `header.tsx` is rewritten in place by plan **01-04** (flat-matte header).
  - `/showcase` full reskin is explicitly out of single-scroll v1 scope
    (CONTEXT `<deferred>`); it is a dev-only component gallery.
- **Discovered:** 2026-06-14 during 01-01
- **Action:** none this plan (plan scoped Task 2 to NOT touch showcase; header
  owned by 01-04).
