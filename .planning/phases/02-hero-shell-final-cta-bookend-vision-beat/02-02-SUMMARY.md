---
phase: "02"
plan: "02"
subsystem: marketing-landing
tags: [server-components, footer, vision, seo, sitemap, stub-routes, accessibility]
dependency_graph:
  requires:
    - "02-01: HeroBookend + UI primitives (GlassPanel from primitives/)"
    - "Phase 1: Foundation scaffold (globals.css tokens, SectionShell, motionTokens)"
  provides:
    - VisionBeat server component (founder quote in GlassPanel)
    - LandingFooter server component (4-column footer + Sign-in + Numen Machines)
    - /privacy stub route with canonical
    - /terms stub route with canonical
    - sitemap.ts extended to 5 entries
  affects:
    - "02-03: Assembly route wires VisionBeat + LandingFooter (via FinalCtaSection) into /v3"
tech_stack:
  added: []
  patterns:
    - Server component with GlassPanel client island composition (VisionBeat)
    - Server-rendered footer with disabled-link aria pattern (LandingFooter)
    - Next.js Metadata API with alternates.canonical (stub pages)
    - sitemap.ts MetadataRoute.Sitemap extension
key_files:
  created:
    - src/app/(marketing)/_components/VisionBeat.tsx
    - src/app/(marketing)/_components/LandingFooter.tsx
    - src/app/(marketing)/privacy/page.tsx
    - src/app/(marketing)/terms/page.tsx
  modified:
    - src/app/sitemap.ts
decisions:
  - "LandingFooter uses <p> not <h*> for column headers — prevents a11y hierarchy gaps per UI-SPEC Accessibility Contract"
  - "No SVG lockup used (public/landing/ has no numen-machines-lockup.svg at execution time) — text-only Numen Machines strip per D-16"
  - "Numen Machines strip rendered twice in grep count (link text + 2 occurrences) — content correct"
metrics:
  duration: "179s"
  completed_date: "2026-05-25"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 02 Plan 02: VisionBeat + LandingFooter + Stub Routes Summary

Server-rendered founder quote in Raycast GlassPanel, 4-column footer with Sign-in and Numen Machines lockup strip, /privacy + /terms stub routes with canonical metadata, and sitemap extended from 3 to 5 entries.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build VisionBeat.tsx server component | 05e15b6 | src/app/(marketing)/_components/VisionBeat.tsx |
| 2 | Build LandingFooter.tsx server component | e1b8278 | src/app/(marketing)/_components/LandingFooter.tsx |
| 3 | Create /privacy + /terms stub routes + extend sitemap | aa8fd1d | privacy/page.tsx, terms/page.tsx, sitemap.ts |

## Implementation Notes

### VisionBeat.tsx
- Server component confirmed: no `"use client"` directive
- GlassPanel client island composition works correctly with server-component children in Next.js App Router
- Locked D-10 quote and D-12 attribution match spec exactly
- `aria-label="Founder vision"` landmark provides screen-reader discoverability
- HTML entities (`&apos;`, `&mdash;`) used per Phase 1 lint convention

### LandingFooter.tsx
- Server component confirmed: no `"use client"` directive (CTA-03)
- Exact link counts: Product column has 4 nav links + Sign-in (CTA-06); Company has 3 disabled links with `aria-disabled="true"` + `tabIndex={-1}`; Legal has 2 real route links; Social has 4 icon links
- All 4 social icons wrapped with `target="_blank" rel="noopener noreferrer"` (T-02-07 reverse-tabnabbing mitigation)
- Hit targets: social icons use `h-11 w-11` (44×44px) satisfying WCAG 2.5.5
- Column headers use `<p>` not `<h*>` per UI-SPEC Accessibility Contract
- WCAG AA: all text colors pre-verified in UI-SPEC (column links #9c9c9d = 5.8:1, headers #848586 = 4.6:1)

### Stub Routes
- `/privacy` and `/terms`: both server components with no `"use client"`, canonical via `metadata.alternates.canonical`
- `pnpm build` confirms both render as static routes (○ marker) in build output

### Sitemap
- Extended from 3 to 5 entries
- Original 3 entries (/, /#demo, /#pricing) preserved unchanged with original priorities/frequencies
- New entries: /privacy and /terms at `priority: 0.3, changeFrequency: 'yearly'`
- Original JSDoc comment with FOUND-10 preserved

### SVG Asset Check
No `numen-machines-lockup.svg` found at `public/landing/` at execution time. Text-only lockup used per D-16: "A Numen Machines product" + copyright. SVG upgrade blocked on Phase 9 content gate.

### WCAG Note
Contrast pre-verified in UI-SPEC § Footer Contract WCAG table. No new audit needed — no new color tokens introduced in this plan.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new trust boundaries introduced beyond those defined in the plan's threat model. All `target="_blank"` anchors have `rel="noopener noreferrer"` (T-02-07). Static stub pages have no user input (T-02-09). VisionBeat quote is a static literal with HTML entities (T-02-10).

## Self-Check: PASSED

Files exist:
- FOUND: src/app/(marketing)/_components/VisionBeat.tsx
- FOUND: src/app/(marketing)/_components/LandingFooter.tsx
- FOUND: src/app/(marketing)/privacy/page.tsx
- FOUND: src/app/(marketing)/terms/page.tsx
- FOUND: src/app/sitemap.ts (modified)

Commits exist:
- FOUND: 05e15b6 (VisionBeat)
- FOUND: e1b8278 (LandingFooter)
- FOUND: aa8fd1d (stub routes + sitemap)
