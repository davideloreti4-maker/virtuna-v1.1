---
phase: 07-audience-as-front-door-surface
plan: 02
subsystem: audience-lens
tags: [audience-picker, reactor, trust-tier, byte-identical, front-door]
requires:
  - groupAudiences (src/components/audience/audience-display.ts)
  - resolveTier leaf (src/lib/audience/resolve-tier.ts)
  - AudiencePresence switcher + reactor (src/components/audience-lens/audience-presence.tsx)
provides:
  - onBuildAudience optional prop on AudiencePresenceProps
  - Mode-sectioned switcher render (── Socials ── / ── General ──)
  - per-row neutral trust badge (resolveTier text)
  - "+ Build an audience" switcher row
  - person-SIM single-reactor framing branch
affects:
  - composer host (will pass onBuildAudience in 07-04 wiring; chooser is 07-03)
tech-stack:
  added: []
  patterns:
    - groupAudiences mode-sectioning (mode==='general' routed first, Pitfall 5)
    - leaf tier import (BUILD-01 bundle-leak discipline)
key-files:
  created: []
  modified:
    - src/components/audience-lens/audience-presence.tsx
    - src/components/audience-lens/__tests__/audience-presence.test.tsx
decisions:
  - Removed the leading Plus glyph from the Manage-audiences link so the new "+ Build an audience" row owns the Plus affordance (avoids a double-plus); the Manage link is retained (label + ChevronRight) so /audience stays reachable.
  - Replaced the standalone "Your audience" TITLE header inside the menu with the Socials/General section headers; the menu aria-label "Your audiences" is unchanged (existing test unaffected).
metrics:
  duration: ~10min
  completed: 2026-06-29
---

# Phase 7 Plan 02: Mode-sectioned Front-Door Picker + Generalized Reactor Summary

Promoted the LIVE `AudiencePresence` switcher into a Mode-sectioned front-door picker (trust badges + `+ Build an audience` row) and generalized the ambient reactor to General audiences with person-SIM single-reactor framing — all additive, Socials/creator render byte-identical.

## What Was Built

**Task 1 — Sectioned switcher (UX-01 / D-02).** The flat `audiences.map` in the switcher popover is replaced with a `groupAudiences(audiences)` render: a `── Socials ──` section over `baseline + templates + yours.filter(mode==='socials')`, and a `── General ──` section over `generalTemplates + yours.filter(mode==='general')` rendered ONLY when that set is non-empty (a Socials-only creator never sees a General header). Each row gained a right-aligned neutral trust badge from the LEAF `resolveTier(a)` (`Directional`/`Validated`, 11px/500 muted, no accent). A `+ Build an audience` row (plain `Plus` glyph, no accent) fires the new optional `onBuildAudience` prop then closes the switcher; the `Manage audiences` Link is retained below it.

**Task 2 — Generalized reactor (UX-03 / D-06).** The reactor view was already audience-agnostic; generalization is framing only. A General person-SIM (`audience.mode === 'general' && personas.length === 1`) is detected and presented as a SINGLE reactor — readiness copy `"{name} · 1 reactor ready"` and one roster dot (buildDots naturally yields one dot for one persona). A General panel-SIM (>1 persona) keeps the existing multi-persona presentation. `buildAudienceRepaint` and its `undefined`→no-op branch are untouched; no keystroke loop added (reuses the existing focus/AbortController throttle).

**Task 3 — Extended guard test.** Six new cases: Socials-only → no General header; mixed list → both headers + General SIM row; trust badges (Directional + Validated) present; `+ Build an audience` fires `onBuildAudience`; General panel SIM drives the multi-persona reactor; General person SIM presents a single reactor. Fixtures now set `mode:'socials'`; new `generalPanel()`/`generalPerson()` fixtures added.

## Verification

- `audience-presence.test.tsx` — 20 passed (6 new).
- `reskin-matte.test.ts` — green (no coral/glass regression).
- `audience-regression-gate.test.ts` — green (BLOCKING; ENGINE_VERSION 3.20.0 untouched).
- Combined run: 31 passed (3 files).
- `tsc --noEmit` — no new errors on the touched files (audience-presence / audience-display / resolve-tier all clean).

## Deviations from Plan

### Auto-fixed Issues

None requiring a rule. Two discretionary copy/markup choices (granted by the plan): removed the Manage link's leading Plus to avoid a double-plus next to the new Build row, and replaced the in-menu TITLE header with the Socials/General section headers (menu aria-label unchanged → existing tests unaffected).

## Threat Surface

No new surface. T-07-02-01 (row labels render as plain React children, no `dangerouslySetInnerHTML`) and T-07-02-02 (leaf `resolveTier` import, Directional-by-rule for General, no pack barrel) honored; T-07-02-03 reactor reuses the existing throttle (no new server call).

## Self-Check: PASSED

- src/components/audience-lens/audience-presence.tsx — FOUND
- src/components/audience-lens/__tests__/audience-presence.test.tsx — FOUND
- Commit fda5b073 (feat) — FOUND
- Commit 1783a37b (test) — FOUND

## Notes for Next Plan

- `onBuildAudience` is currently optional and unwired at the composer host. 07-03 builds the Build chooser (`build-chooser.tsx`); 07-04 threads the real `activeMode` + wires `onBuildAudience` to open it.
- The `+ Build an audience` row already closes the switcher and calls the callback — the host only needs to pass the chooser-opener.
