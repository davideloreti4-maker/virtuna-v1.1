---
phase: 53
plan: 02
subsystem: page-shell
tags: [radix-tabs, url-sync, motion, glassmorphism, sidebar, v0-mcp]
dependency-graph:
  requires: [53-01]
  provides: [brand-deals-route, tab-shell, sidebar-wiring]
  affects: [54, 55, 56, 57]
tech-stack:
  added: []
  patterns: [server-reads-searchparams, controlled-radix-tabs, pushstate-url-sync, motion-layoutid, usePathname-routing]
key-files:
  created:
    - src/app/(app)/brand-deals/page.tsx
    - src/components/app/brand-deals/brand-deals-page.tsx
    - src/components/app/brand-deals/brand-deals-header.tsx
    - src/components/app/brand-deals/brand-deals-tabs.tsx
    - src/components/app/brand-deals/index.ts
  modified:
    - src/components/app/sidebar.tsx
    - src/components/app/sidebar-nav-item.tsx
decisions:
  - id: DEC-53-02-01
    decision: "Use window.history.pushState for tab URL sync (not router.push)"
    rationale: "Avoids server component re-renders on tab switch, integrates with useSearchParams"
  - id: DEC-53-02-02
    decision: "Motion layoutId for sliding pill animation"
    rationale: "Auto-measures and animates between positions, no manual width/position calculation"
  - id: DEC-53-02-03
    decision: "Hybrid sidebar nav: usePathname for routed items, useState for non-routed"
    rationale: "Only Brand Deals has a real route; other nav items are still in-page actions"
  - id: DEC-53-02-04
    decision: "Inline backdrop-filter style on header (not Tailwind class)"
    rationale: "Lightning CSS strips backdrop-filter from compiled CSS classes"
  - id: DEC-53-02-05
    decision: "LinkSimple icon instead of Link (Phosphor) to avoid next/link conflict"
    rationale: "Avoids import name collision with Next.js Link component"
metrics:
  duration: "~5 minutes"
  completed: "2026-02-05"
---

# Phase 53 Plan 02: Page Route, Tab Shell, Header & Sidebar Summary

**Brand Deals page shell with three-tab navigation, URL sync, glass header with contextual stats, and sidebar routing integration.**

## What Was Built

### Server Route (`src/app/(app)/brand-deals/page.tsx`)

Follows Settings page pattern exactly:
- Validates `?tab` searchParam against `["earnings", "deals", "affiliates"]`
- Defaults to "earnings" (show the money first)
- Passes validated `defaultTab` to client component
- Exports page metadata

### Client Orchestrator (`src/components/app/brand-deals/brand-deals-page.tsx`)

- Controlled Radix `Tabs.Root` with `value` + `onValueChange`
- `useSearchParams` reads current tab from URL
- `window.history.pushState` for shallow URL updates (browser back/forward works)
- `AnimatePresence` with `mode="wait"` for fade transitions between tab content
- Placeholder content for each tab referencing future phases (54, 55, 56)

### Tab Control (`src/components/app/brand-deals/brand-deals-tabs.tsx`)

- Pill/segment control with `rounded-full bg-surface-elevated/50` container
- Three Radix `Tabs.Trigger` elements with Phosphor icons (CurrencyDollar, Handshake, LinkSimple)
- Motion `layoutId="brand-deals-tab-pill"` sliding animation (spring: stiffness 400, damping 30)
- Active tab: `text-foreground` with `bg-white/10` pill background
- Inactive tabs: `text-foreground-muted` with hover to `text-foreground-secondary`
- Icon weight changes: fill (active) vs regular (inactive)

### Glass Header (`src/components/app/brand-deals/brand-deals-header.tsx`)

- Glass panel with `bg-white/[0.03]`, `border-white/[0.08]`, inline `backdropFilter: blur(8px)`
- `font-display` heading "Brand Deals" with subtitle
- Tab-contextual stats (3 per tab) with vertical dividers
- Responsive: stacks on mobile (`sm:flex-row`)

### Sidebar Integration (`src/components/app/sidebar.tsx` + `sidebar-nav-item.tsx`)

- `usePathname` for Brand Deals route-based active state
- `router.push("/brand-deals")` on click
- Badge prop added to SidebarNavItem (coral accent, `bg-accent/20 text-accent`)
- Badge showing "3" (new deals count)
- Other nav items deactivate when on `/brand-deals` (no dual highlighting)

## Commits

| Hash | Message | Files |
|------|---------|-------|
| `3d160b2` | feat(53-02): add BrandDealsTabs and BrandDealsHeader components | brand-deals-tabs.tsx, brand-deals-header.tsx |
| `deac22b` | feat(53-02): add brand-deals page route and client orchestrator | page.tsx, brand-deals-page.tsx, index.ts |
| `dd00a7e` | feat(53-02): wire sidebar Brand Deals nav with routing and badge | sidebar.tsx, sidebar-nav-item.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Git worktree file sync issue**
- Files were committed but not checked out to disk
- Fixed by `git checkout HEAD -- <files>` to restore working tree
- Root cause: worktree sparse checkout or git index desync

### Design Choices

**1. LinkSimple instead of Link icon**
- Plan specified `Link as LinkIcon` from Phosphor
- Used `LinkSimple` instead (cleaner icon, no alias needed)

## Verification Results

- `npm run build`: PASS
- `/brand-deals` returns HTTP 200
- Three tabs render with pill control
- URL sync via pushState works
- Header shows tab-contextual stats with glass effect
- Sidebar routes to /brand-deals with active state and badge
- Human verification: APPROVED

## Next Phase Readiness

Phases 54-56 can now:
- Import tab shell and replace placeholder content
- Use the URL sync pattern (tabs already wired)
- Access mock data from Plan 01
- Follow the established component structure in `src/components/app/brand-deals/`
