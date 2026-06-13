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
