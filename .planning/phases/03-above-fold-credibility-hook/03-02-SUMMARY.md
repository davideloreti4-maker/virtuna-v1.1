---
phase: "03"
plan: "02"
subsystem: hero-bookend
tags: [gap-closure, dom-order, credibility-hook, accessibility, a11y]
dependency_graph:
  requires: ["03-01"]
  provides: ["HERO-10 fully satisfied", "HERO-11 DOM order correct", "Gap 1 closed", "Gap 2 closed"]
  affects: ["HeroSection", "FinalCtaSection"]
tech_stack:
  added: []
  patterns: ["boolean prop gate", "conditional JSX render", "default prop value"]
key_files:
  created: []
  modified:
    - src/app/(marketing)/_components/HeroBookend.tsx
    - src/app/(marketing)/_components/FinalCtaSection.tsx
decisions:
  - "Option A (prop gate) chosen over Option B (move render to HeroSection): preserves centered flex-col layout context inside HeroBookend inner div"
  - "showCredibilityHook defaults to true so HeroSection caller requires zero changes"
  - "Gate comment in FinalCtaSection uses 'is false here' phrasing to avoid grep collision with JSX prop pattern"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 03 Plan 02: DOM Order Fix + FinalCtaSection Duplication Suppression Summary

**One-liner:** `showCredibilityHook` boolean prop gates CredibilityHook after CTA pair; FinalCtaSection passes `false` to suppress duplicate render.

## What Was Built

Closed two blocking gaps from 03-VERIFICATION.md:

**Gap 1 (DOM Order — BLOCKING):** CredibilityHook was rendering at line 173 of HeroBookend — BEFORE the CTA pair (line 175). HERO-11, ROADMAP Phase 3 SC #2, and UI-SPEC § Screen Reader Order all mandate order: H1 → sub-headline → CTA pair → credibility hook. Fixed by moving JSX to after CTA pair closing `</div>`.

**Gap 2 (FinalCtaSection regression — BLOCKING):** HeroBookend is shared between HeroSection and FinalCtaSection. The unconditional `<CredibilityHook />` was shipping the credibility bar twice — once in Hero, once in Final CTA. Fixed via prop gate.

## Approach: Option A (Prop Gate)

Selected over Option B (move render to HeroSection) because:
- CredibilityHook needs `max-w-7xl mx-auto flex flex-col items-center text-center gap-4` layout context inside HeroBookend's inner div
- Moving it to HeroSection (outside HeroBookend) loses the centered, gap-4-spaced layout context and requires duplicating that layout wrapper
- Option A = one prop + one JSX move. Option B = layout duplication.

## Files Modified

### `src/app/(marketing)/_components/HeroBookend.tsx`

Three surgical edits:

1. **Interface:** Added `showCredibilityHook?: boolean` prop after `headingAs` with JSDoc explaining Hero-only semantics and regression context.
2. **Destructure:** Added `showCredibilityHook = true` default in function signature — backwards-compatible, HeroSection caller unchanged.
3. **JSX move:** Removed unconditional `<CredibilityHook />` from before CTA pair (with old "replaces placeholder gap" comment). Inserted `{showCredibilityHook && <CredibilityHook />}` after CTA pair closing `</div>`, still inside inner content stack (inherits `gap-4` rhythm and `items-center text-center`).

### `src/app/(marketing)/_components/FinalCtaSection.tsx`

One edit:
- Added `showCredibilityHook={false}` to the `<HeroBookend reducedHeight headingAs="p" />` instance
- Added explanatory comment above referencing HERO-10, UI-SPEC § Component Anatomy, and 03-VERIFICATION Gap 2

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c 'showCredibilityHook' HeroBookend.tsx` | 4 (interface + JSDoc + destructure + gate) |
| `grep -c '{showCredibilityHook && <CredibilityHook />}'` | 1 |
| `grep -c '<CredibilityHook />'` | 1 (only gated render) |
| DOM order: CredibilityHook line > "See pricing" CTA line | PASS |
| `grep -c 'replaces placeholder gap'` | 0 (old comment removed) |
| `grep -c 'showCredibilityHook={false}' FinalCtaSection.tsx` | 1 |
| `grep -c 'LandingFooter' FinalCtaSection.tsx` | 5 (import + JSX + comments — untouched) |
| `npm run build` | Exit 0, compiled successfully |

## Build Verification

`npm run build` exits 0. TypeScript accepts `showCredibilityHook?: boolean` on HeroBookendProps. No type errors in HeroBookend.tsx or FinalCtaSection.tsx. All 60 pages generated successfully.

## Re-verification Needed

Human verification via `/gsd-verify-phase 03 --re-verify` to confirm:
- `/v3` at 1440px desktop: credibility hook visible BELOW "Score your first TikTok" / "See pricing" CTAs
- VoiceOver/NVDA reading order: H1 → sub-headline → "Score your first TikTok" → "See pricing" → credibility hook text
- Final CTA section near page bottom: NO second credibility bar renders

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both files contain real functional logic, no hardcoded empty values or placeholder text introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both edits affect static JSX markup only. Threat model T-03-02-01 and T-03-02-02 documented in plan — both accepted (cosmetic boolean prop, no security boundary).

## Self-Check: PASSED

- `src/app/(marketing)/_components/HeroBookend.tsx` — file exists with showCredibilityHook prop
- `src/app/(marketing)/_components/FinalCtaSection.tsx` — file exists with showCredibilityHook={false}
- Task 1 commit: cbfb898
- Task 2 commit: 523c3b3
