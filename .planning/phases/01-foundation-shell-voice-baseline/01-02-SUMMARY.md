---
phase: 01-foundation-shell-voice-baseline
plan: 02
subsystem: numen-landing-shell
tags: [nav, footer, section-shell, shell, a11y, tokens]
requires:
  - ".numen-surface bridged token scope (globals.css:356-392, mounts Plan 03)"
  - "NumenLogo @/components/brand/numen-logo"
  - "cn @/lib/utils"
  - "lucide-react (Menu, X)"
provides:
  - "Nav @/components/numen-landing/nav (sticky opaque top nav + mobile hamburger)"
  - "Footer @/components/numen-landing/footer (static minimal footer shell)"
  - "SectionShell @/components/numen-landing/section-shell (semantic section slot)"
affects:
  - "Plan 01-03 (marketing layout + page compose these three shells)"
tech-stack:
  added: []
  patterns:
    - "cn() class composition, caller className merged last (override wins)"
    - "client mobile-menu state machine: useState + useRef + mousedown outside-click + body scroll-lock"
    - "bridged .numen-surface token utilities only (bg-bg/text-text/text-text-muted/bg-accent text-bg/border-border)"
    - "focus-visible:ring-2 ring-accent on every interactive element (a11y)"
    - "external links target=_blank rel=noopener noreferrer (reverse-tabnabbing mitigation)"
key-files:
  created:
    - "src/components/numen-landing/section-shell.tsx"
    - "src/components/numen-landing/nav.tsx"
    - "src/components/numen-landing/footer.tsx"
  modified:
    - ".planning/phases/01-foundation-shell-voice-baseline/deferred-items.md"
decisions:
  - "Primary CTA label locked to 'Try Numen' across nav + footer (consistent, applied in Plan 03 hero too)"
  - "Footer anchor repeat uses a plain <div>, not a second <nav>, to keep the single <nav> landmark (UI-SPEC a11y)"
  - "X/LinkedIn rendered as text labels (Lucide-or-text both allowed); avoids ambiguous brand-X icon"
  - "Plan verify gate runs whole-project tsc/lint; new shell files verified type+lint clean in isolation (pre-existing engine/test tsc debt deferred)"
metrics:
  duration: "~6m"
  completed: "2026-06-12"
  tasks: 3
  files: 3
---

# Phase 1 Plan 02: Shell Components Summary

Built the three net-new Numen landing shell primitives in `src/components/numen-landing/` — a reusable `SectionShell` slot skeleton, a sticky opaque `Nav` with a clean mobile hamburger state machine, and a static minimal `Footer` — all on bridged `.numen-surface` tokens with focus rings, rebuilt clean from (not importing) the stale societies shell.

## What Was Built

- **`section-shell.tsx`** (server, 42 lines) — `SectionShell({ id, heading, children?, className? })` renders a semantic `<section id>` with `cn("scroll-mt-20 md:scroll-mt-24 py-24 md:py-32", className)` (caller override wins) and an in-voice `<h2 className="text-text text-3xl md:text-4xl font-bold tracking-tight">`. `scroll-mt-*` clears the sticky nav on anchor jump; uniform `py` is the kero rhythm (MOT-02).
- **`nav.tsx`** (client, 176 lines) — sticky opaque bar (`sticky top-0 z-50 bg-bg border-b border-border`, no glass/backdrop-filter), `NumenLogo` + desktop anchors (`#how-it-works`/`#honesty`/`#gallery`) + `Try Numen` CTA. Mobile hamburger: Lucide `Menu`/`X`, slide-down `bg-panel` sheet, outside-click close via `mousedown` listener, body scroll-lock with `useEffect` cleanup, dimming overlay, `aria-expanded` + dynamic `aria-label`, focus rings everywhere.
- **`footer.tsx`** (server, 95 lines) — `NumenLogo` + positioning line + anchor repeat + Privacy/Terms placeholders + X/LinkedIn external social (`rel="noopener noreferrer"`) + `Try Numen` CTA slot (`href="#cta"`) + `© {year} Numen`. `bg-bg border-t border-border`, bridged tokens, focus rings.

## Deviations from Plan

### Verification-gate accommodation (not a code change)

The plan's per-task `<verify>` chains end with whole-project `npx tsc --noEmit && npm run lint`. The repo carries **14 pre-existing `tsc` errors in 8 unrelated engine/board/numen TEST + fixture files** (e.g. `src/lib/engine/wave3/__tests__/*`, `tests/numen/*`) — present on HEAD, independent of this plan's untracked new files. Per SCOPE BOUNDARY these are out of scope and were NOT fixed; logged to `deferred-items.md`. Each new shell file was instead verified clean in isolation: `npx tsc --noEmit | grep numen-landing` → none, and per-file `npx eslint <file>` → exit 0. All grep gates from each task passed verbatim. (Plan 01-01 established the same whole-project-gate-vs-per-file-clean reconciliation for lint.)

No code-behavior deviations (Rules 1–4): no bugs, no missing critical functionality, no blocking issues, no architectural changes. Plan executed as written.

## Authentication Gates

None.

## Threat Mitigations Applied

- **T-01-03 (Tampering, footer externals):** every external `target="_blank"` link (X, LinkedIn) carries `rel="noopener noreferrer"`. Verified by grep gate.
- **T-01-04 (DoS, nav body-lock + global listener):** `useEffect` cleanups reset `document.body.style.overflow` and remove the `mousedown` listener on close/unmount — no leaked lock or dangling listener.

## Known Stubs

Placeholder hrefs are intentional per phase scope (D-05/D-07): nav/footer CTA `href="#cta"`, legal `href="#"`, social point at placeholder `x.com/numen` / `linkedin.com/company/numen`. Live CTA wiring is CTA-01 (Phase 2) / CTA-02 (Phase 3); these are documented placeholders, not blocking stubs. The three section ids the nav/footer anchors target (`#how-it-works`, `#honesty`, `#gallery`) are filled by Plan 03's page composition (this plan builds the components standalone by design).

## Self-Check

- [x] `src/components/numen-landing/section-shell.tsx` — FOUND
- [x] `src/components/numen-landing/nav.tsx` — FOUND
- [x] `src/components/numen-landing/footer.tsx` — FOUND
- [x] commit d9981cf5 (Task 1) — FOUND
- [x] commit 94970190 (Task 2) — FOUND
- [x] commit 37a073f6 (Task 3) — FOUND

## Self-Check: PASSED
