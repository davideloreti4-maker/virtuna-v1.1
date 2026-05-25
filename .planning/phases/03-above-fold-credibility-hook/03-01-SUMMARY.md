---
phase: "03"
plan: "01"
subsystem: marketing-hero
tags: [credibility-hook, server-component, accessibility, hero-section]
dependency_graph:
  requires: []
  provides: [CredibilityHook, HERO-10]
  affects: [HeroBookend, HeroSection]
tech_stack:
  added: []
  patterns: [server-component-inside-client-boundary, inline-style-tailwind-v4-workaround]
key_files:
  created:
    - src/app/(marketing)/_components/CredibilityHook.tsx
  modified:
    - src/app/(marketing)/_components/HeroBookend.tsx
decisions:
  - "Server component insertion inside client component HeroBookend is valid in Next.js App Router — CredibilityHook renders to static HTML, no boundary violation"
  - "Inline style used for borderLeftColor due to Tailwind v4 + Lightning CSS stripping border-left-color when combined with shorthand border classes"
  - "Removed pre-existing unused BorderBeam import from HeroBookend (was causing TypeScript strict error on production build)"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-25T12:25:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 03 Plan 01: Above-Fold Credibility Hook Summary

**One-liner:** Zero-JS server component credibility bar (Numen Machines lockup + 4 placeholder partner slots + microcopy) wired below CTAs in HeroBookend, replacing 64px placeholder gap, satisfying HERO-10.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build CredibilityHook server component | 8de4ff5 | CredibilityHook.tsx (created) |
| 2 | Wire CredibilityHook into HeroBookend | 161d2bc | HeroBookend.tsx (patched) |

## What Was Built

**CredibilityHook.tsx** — pure server component (no `"use client"`, no hooks, no motion imports):
- Desktop: 1px separator line + flex row with Numen Machines slot (coral left-border accent) + 4 placeholder Partner slots + microcopy
- Mobile: microcopy above + 3 slots (Numen + 2 placeholders) centered, max 48px height
- Accessibility: `<section aria-label="Backed by">` wrapper; Numen Machines `<a>` with descriptive aria-label; placeholder slots `aria-hidden="true"`; DOM order places hook AFTER CTA pair (HERO-11)
- External link: `rel="noopener noreferrer"` (T-03-01 threat mitigation)

**HeroBookend.tsx** patch:
- Added import for CredibilityHook
- Replaced `<div className="hidden md:block min-h-[64px]" aria-hidden="true" />` with `<CredibilityHook />`
- Updated JSDoc to reflect Phase 3 completion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused BorderBeam import from HeroBookend**
- **Found during:** Task 2 build verification
- **Issue:** `BorderBeam` was imported but never used in HeroBookend.tsx; TypeScript strict mode treated this as a compile error blocking `npm run build`
- **Fix:** Removed the unused `import { BorderBeam } from "@/components/ui/border-beam"` line
- **Files modified:** `src/app/(marketing)/_components/HeroBookend.tsx`
- **Commit:** 161d2bc (included in Task 2 commit)

## Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| CredibilityHook.tsx is zero-JS server component | PASS — `grep -c '"use client"'` returns 0 |
| HeroBookend renders CredibilityHook where placeholder was | PASS — import + JSX usage confirmed |
| `npm run build` exits 0 | PASS — compiled successfully |
| aria-label="Backed by" section wrapper | PASS |
| Numen Machines link has descriptive aria-label | PASS |
| Placeholder slots aria-hidden="true" | PASS — 5 occurrences (4 desktop + mobile separator + mobile slots) |
| DOM order: CredibilityHook AFTER CTA pair | PASS — rendered after CTA pair in HeroBookend flex-col stack |
| Hero background (#07080a) unchanged | PASS — no new background elements added |
| HERO-10 satisfied | PASS |

## Known Stubs

- 4 desktop placeholder slots + 2 mobile placeholder slots render "Partner" text at 50% opacity — intentional placeholders until real partner logos added in Phase 9 (per PROJECT.md: "Phase 9: Numen Machines logo lockup SVG — Davide / designer")

## Threat Flags

No new threat surface beyond what the plan's threat model captured. T-03-01 (external link tab-napping) mitigated via `rel="noopener noreferrer"` on the Numen Machines anchor.

## Self-Check: PASSED

- [x] `src/app/(marketing)/_components/CredibilityHook.tsx` exists
- [x] `src/app/(marketing)/_components/HeroBookend.tsx` modified
- [x] Commit 8de4ff5 exists (Task 1)
- [x] Commit 161d2bc exists (Task 2)
- [x] `npm run build` exits 0
