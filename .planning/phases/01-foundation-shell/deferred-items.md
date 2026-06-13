# Phase 01 — Deferred Items (out-of-scope discoveries)

Items discovered during execution that are OUTSIDE the current plan's scope.
Logged per the executor scope-boundary rule; NOT fixed in the plan that found them.

## From plan 01-01 (flat-warm token migration)

### D1 — Marketing surfaces still reference removed glass tokens
- **Found during:** 01-01 Task 1 (strip THEME-02 Layer A glass tokens in `globals.css`).
- **What:** Removing `--gradient-navbar` (and the glass shadow tokens) from `@theme` leaves dangling `var(--gradient-navbar)` references in **out-of-scope marketing/showcase surfaces** — they now resolve to nothing (transparent background), a cosmetic regression on those pages only.
  - `src/components/layout/header.tsx:62` — `style={{ background: "var(--gradient-navbar)", backdropFilter: "blur(5px)", … }}` (marketing header glass).
  - `src/app/(marketing)/showcase/page.tsx` — token-showcase entries + a `<nav style={{ background: "var(--gradient-navbar)" }}>` (L772) and `shadow-glass`/`shadow-button` code-sample strings (L604–607, display only).
- **Why deferred:** Phase 1 scope is the **app shell** (`globals.css` tokens, `Sidebar.tsx`, `app-shell.tsx`, the new home/composer) — NOT the marketing pages. The plan's Layer A instruction is to remove these tokens; the marketing consumers are a separate surface. Build is **unaffected** (Tailwind v4 silently skips unknown utilities; a dangling `var()` is valid CSS that resolves empty). Verified: `pnpm run build` exits 0.
- **Suggested resolution:** When the marketing pages are reskinned (later milestone/phase, or an explicit "tear out Raycast glass from marketing" task), flatten `header.tsx` + the `showcase` page to the flat-warm charcoal surface (solid `--color-surface`, hairline border, no blur, no inset shine) and drop the dead token-showcase entries.
- **Impact if left:** Marketing header / showcase page render with a transparent (instead of glass) nav background. No effect on the Numen app shell, the build, or any Phase 1 surface.

## From plan 01-02 (flat-warm sidebar reskin + collapse revival)

### D2 — Pre-existing `tsc --noEmit` errors in engine/board test files
- **Found during:** 01-02 Task 3 verification (ran a project-wide `tsc --noEmit` to confirm the sidebar/app-shell edits type-check).
- **What:** `npx tsc --noEmit` reports type errors in **test/fixture files that this plan never touches**, e.g. `src/lib/engine/__tests__/flop-warning.test.ts` (`'views' does not exist in type 'EngagementRange'`), `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` (`PersonaSlot[]` mismatch), `src/lib/engine/wave3/__tests__/fold-schema.test.ts` (`Object is possibly 'undefined'`), and `src/components/board/verdict/__tests__/fixtures/prediction-result.ts` (unsafe cast). These are engine-test type drift, unrelated to the presentation reskin.
- **Why deferred:** Out of scope per the executor scope-boundary rule — Phase 1 is a presentation-layer reskin (engine FROZEN 3.19.0). The errors are in `src/lib/engine/**` + board verdict fixtures, not in any file this plan edits. This plan's files (`Sidebar.tsx`, `app-shell.tsx`, `SidebarAccountSelector.tsx`, the 3 sidebar test files) type-check with **0 errors**. The Vitest suite (which uses esbuild, not the TS type-checker) is green; these `tsc` errors do not block test execution.
- **Suggested resolution:** Address during an engine-test maintenance pass (or whenever the relevant engine types are next revised). Likely just need the test fixtures realigned to the current `EngagementRange` / `PersonaSlot` / fold-schema types.
- **Impact if left:** No runtime or test-suite impact (tests run via esbuild and pass). Only a strict app-wide `tsc --noEmit` is noisy. The Numen shell surfaces are unaffected.
