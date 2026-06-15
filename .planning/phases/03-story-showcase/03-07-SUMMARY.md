---
phase: 03-story-showcase
plan: 07
subsystem: marketing-layout-chrome
tags: [a11y, mobile-nav, focus-trap, scroll-lock, shared-constant, gap-closure]
gap_closure: true
requires:
  - "src/lib/routes.ts (shared-constant pattern mirrored)"
  - "src/components/layout/header.tsx (existing useState disclosure, NAV-03)"
  - "src/components/layout/footer.tsx (existing PRODUCT_LINKS column, NAV-02)"
provides:
  - "src/lib/nav.ts — single source of truth for the in-page nav anchor set (IN-03)"
  - "Accessible mobile-nav disclosure — Escape-close + focus trap + focus restore (GAP-4 / WR-03)"
  - "Non-destructive body scroll-lock that saves/restores prior overflow (WR-02)"
affects:
  - "src/components/layout/header.tsx"
  - "src/components/layout/footer.tsx"
tech-stack:
  added: []
  patterns:
    - "Inline focus-trap + focus-restore in the single consumer (no a11y.ts hook added — header is the only consumer)"
    - "Scroll-lock useEffect snapshots `const prev = document.body.style.overflow` and restores `prev` in cleanup"
    - "open→closed transition tracked via a `wasOpenRef` so focus is never stolen on initial mount"
key-files:
  created:
    - "src/lib/nav.ts"
  modified:
    - "src/components/layout/header.tsx"
    - "src/components/layout/footer.tsx"
    - "src/components/layout/__tests__/header.test.tsx"
decisions:
  - "Focus trap/restore implemented INLINE in header.tsx (a11y.ts has no such helper; header is the only consumer — no new exported hook)"
  - "Focus restore gated on a genuine open→closed transition via wasOpenRef; never steals focus on mount"
  - "Footer Product column now maps the shared NAV_LINKS; PRODUCT_LINKS + the hand-sync comment deleted"
metrics:
  duration: ~12min
  completed: 2026-06-15
  tasks: 2
  files: 4
---

# Phase 03 Plan 07: Mobile-nav a11y + shared nav constant Summary

Closed the confirmed-live mobile-nav accessibility gap (GAP-4 / WR-03) — Escape-to-close, a focus trap while the panel is open, and focus restore to the trigger on close — folded in the scroll-lock save/restore fix (WR-02), and lifted the byte-identical header/footer nav arrays into one shared `@/lib/nav` constant (IN-03).

## What Was Built

**Task 1 — Shared nav constant (IN-03):** Created `src/lib/nav.ts` exporting a single readonly `NAV_LINKS` array (`How it works` → `The Simulation` → `Features` → `Pricing` → `FAQ`, locked order, mirrors the `src/lib/routes.ts` JSDoc/`as const` style). `header.tsx` now imports it for both the desktop nav map and the mobile panel map; `footer.tsx` imports it for the Product column. The two hand-duplicated arrays (header `NAV_LINKS`, footer `PRODUCT_LINKS`) and the "keep them in sync by hand" comment are gone. Rendered output is byte-identical — footer suite stayed GREEN (all 5 anchors incl. `#features`).

**Task 2 — Accessible mobile disclosure (GAP-4 / WR-02 / WR-03, TDD):**
- **WR-02** — the scroll-lock `useEffect` now snapshots `const prev = document.body.style.overflow`, sets `"hidden"` only while open, and restores `prev` in cleanup (no bare `= ""` clobber of a pre-existing lock owner).
- **WR-03 / GAP-4 Escape** — a `keydown` listener (scoped to the open panel, removed on cleanup) calls `setMobileMenuOpen(false)` on `Escape`.
- **WR-03 / GAP-4 focus trap** — focus moves into the panel's first focusable on open; `Tab` / `Shift+Tab` wrap at the panel's focusable ends (`a[href], button`), keeping focus inside the panel container.
- **WR-03 / GAP-4 focus restore** — a `wasOpenRef`-gated `useEffect` returns focus to the trigger (`triggerRef.current?.focus()`) on a genuine open→closed transition (Escape, link tap, or toggle), never on initial mount.
- `aria-expanded` / `aria-controls` / panel `id` / `data-testid="mobile-nav-panel"` unchanged; flat-warm tokens only; no visual change; header stays `"use client"`.

## TDD Gate Compliance

Plan task 2 ran the RED → GREEN cycle:
- **RED** — `test(03-07)` commit `7eb5908b`: 5 new failing a11y tests (Escape-close, focus-restore via Escape, focus-restore via link tap, focus-trap wrap, overflow save/restore). All 5 failed as designed; the 6 existing open/close-on-tap/aria-label tests stayed green.
- **GREEN** — `feat(03-07)` commit `bd75a77c`: header implementation; header + footer suites 22/22 GREEN.
- No REFACTOR commit (implementation was clean).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Shared nav constant imported by header + footer (IN-03) | 78fa058f | src/lib/nav.ts (new), header.tsx, footer.tsx |
| 2 (RED) | Failing mobile-nav a11y tests | 7eb5908b | __tests__/header.test.tsx |
| 2 (GREEN) | Accessible mobile-nav disclosure | bd75a77c | header.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TS strict `noUncheckedIndexedAccess` on focusables[] access**
- **Found during:** Task 2 GREEN (build step)
- **Issue:** `next build` TypeScript pass failed — `first`/`last` from `focusables[0]` / `focusables[length-1]` are possibly `undefined` under strict indexed access; `last.focus()` flagged.
- **Fix:** Replaced the `if (focusables.length === 0) return;` length guard with a value guard `const first = ...; const last = ...; if (!first || !last) return;` (narrows the types). No behavior change.
- **Files modified:** src/components/layout/header.tsx
- **Commit:** bd75a77c (folded into the GREEN commit)

## Verification

- `npx vitest run src/components/layout/` — **22/22 GREEN** (header 11 + footer 11), including the new Escape-close, focus-restore (x2), focus-trap, and overflow save/restore regression tests.
- `header.tsx` contains the Escape keydown → `setMobileMenuOpen(false)`, the `const prev = document.body.style.overflow` snapshot + `prev` restore, the `triggerRef.current?.focus()` open→closed restore, and the Tab/Shift+Tab focus-trap wrap.
- `src/lib/nav.ts` is the single nav source; header + footer both `import { NAV_LINKS } from "@/lib/nav"`.
- `npm run build` — **exit 0**; `/` route renders `○ (Static)`. Header was already a client island; no new section-root client leak.

## Self-Check: PASSED

- FOUND: src/lib/nav.ts
- FOUND: src/components/layout/header.tsx (Escape + prev-overflow + triggerRef + trap)
- FOUND: src/components/layout/footer.tsx (NAV_LINKS import)
- FOUND commit 78fa058f, 7eb5908b, bd75a77c
