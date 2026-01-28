---
phase: 04-app-layout-navigation
plan: 05
subsystem: app-shell
tags: [mobile-nav, auth-guard, skeleton, responsive, drawer]

requires:
  - 04-02  # Sidebar component
  - 04-03  # Society/View selectors
  - 04-04  # Network visualization

provides:
  - mobile-responsive-sidebar
  - auth-guard-skeleton
  - app-shell-wrapper

affects:
  - 05-xx  # State management may lift mobile state
  - 06-xx  # Auth integration will replace mock

tech-stack:
  added: []
  patterns:
    - client-component-wrapper
    - css-only-responsive
    - skeleton-loading

key-files:
  created:
    - src/components/app/mobile-nav.tsx
    - src/components/app/auth-guard.tsx
    - src/components/app/app-shell.tsx
  modified:
    - src/components/app/sidebar.tsx
    - src/app/(app)/layout.tsx
    - src/components/app/index.ts

decisions:
  - id: client-wrapper-pattern
    context: Layout needs useState for mobile menu but must export metadata
    choice: Extract AppShell client component, keep layout as server component
    alternatives: [make-layout-client, use-context-provider]

metrics:
  duration: ~10min
  completed: 2026-01-28
---

# Phase 04 Plan 05: Mobile Navigation & Auth Guard Summary

**One-liner:** Mobile drawer sidebar with hamburger trigger and mock auth guard showing skeleton loading state.

## What Was Built

### 1. Mobile Drawer Behavior (Sidebar)
Updated the existing Sidebar component to support mobile drawer pattern:
- Added `mobileOpen` and `onMobileOpenChange` props
- CSS-only responsive: `md:static md:flex` for desktop, `hidden -translate-x-full` for mobile
- Slide-in animation with `transition-transform duration-200`
- Mobile overlay backdrop (`bg-black/50`) that closes drawer on tap
- X close button visible only on mobile (`md:hidden`)

### 2. MobileNav Component
New hamburger trigger component:
- Fixed position at top-left on mobile only
- Glassmorphism style (`bg-zinc-900/80 backdrop-blur-sm`)
- Triggers sidebar drawer open via callback
- Hidden on desktop (`md:hidden`)

### 3. AuthGuard with Skeleton
Mock authentication guard:
- 350ms delay simulates auth check
- Shows `AppShellSkeleton` during loading
- Skeleton matches actual app shell structure
- Sidebar skeleton hidden on mobile (matches real behavior)
- Ready for real Supabase auth integration in Phase 5

### 4. AppShell Wrapper
Client component that manages interactive state:
- Extracted from layout to preserve server component benefits
- Manages `mobileMenuOpen` state with useState
- Wraps children with AuthGuard
- Integrates MobileNav and Sidebar with state handlers

## Technical Decisions

### Client-Wrapper Pattern
**Decision:** Extract AppShell as client component instead of making the entire layout a client component.

**Why:**
- Layout can remain server component for metadata export
- Font configuration stays at layout level
- Only interactive parts are client-rendered
- Better separation of concerns

**Alternatives considered:**
- Make layout client: Would lose metadata export capability
- Use context provider: Overkill for simple open/close state

## Implementation Notes

### CSS-Only Responsive
The responsive behavior uses only CSS classes (no JavaScript media queries):
```tsx
// Desktop: static position, always visible
"md:static md:translate-x-0 md:flex"
// Mobile: hidden by default, slides when open
mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full"
```

This approach:
- Avoids hydration mismatches
- Works with SSR
- No flash of wrong state on load

### Skeleton Structure
The skeleton mirrors the actual layout:
- Sidebar skeleton only shows on `md:` breakpoint
- Main content area has header + content skeleton
- Uses existing Skeleton component from UI library

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 792424a | feat | Add mobile drawer behavior to Sidebar |
| f59584e | feat | Create AuthGuard with skeleton loading |
| 232b665 | feat | Integrate mobile nav and auth guard into app layout |

## Files Changed

### Created
- `src/components/app/mobile-nav.tsx` (25 lines) - Hamburger trigger
- `src/components/app/auth-guard.tsx` (96 lines) - Mock auth with skeleton
- `src/components/app/app-shell.tsx` (41 lines) - Client wrapper

### Modified
- `src/components/app/sidebar.tsx` - Added mobile props and drawer behavior
- `src/app/(app)/layout.tsx` - Uses AppShell instead of direct Sidebar
- `src/components/app/index.ts` - Added new exports

## Verification Results

- [x] Build passes with no errors
- [x] Mobile nav appears only on narrow viewports
- [x] Sidebar slides in from left on mobile
- [x] Overlay and close button dismiss drawer
- [x] Desktop sidebar remains static/visible
- [x] Skeleton shows for ~350ms before content
- [x] No hydration warnings

## Deviations from Plan

**None** - Plan executed exactly as written.

## Next Phase Readiness

**Ready for Phase 4 Plan 6:** Finalization and verification.

**Ready for Phase 5:** State management will:
- Lift mobile menu state if needed for other components
- Replace mock AuthGuard with real Supabase session check
- Add redirect logic for unauthenticated users
